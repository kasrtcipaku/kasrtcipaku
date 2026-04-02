# apps/bot/parser.py
import os
import json
import time
import logging
import threading
import google.generativeai as genai

logger = logging.getLogger(__name__)

genai.configure(api_key=os.environ["GEMINI_API_KEY"])
model = genai.GenerativeModel("gemini-2.0-flash")

# Cache sederhana biar tidak boros quota Gemini
_cache: dict[str, dict] = {}

# ── Rate limiter: max 14 request/menit (sedikit di bawah limit 15) ──
_lock = threading.Lock()
_request_times = []

def _wait_for_rate_limit():
    """Tunggu kalau sudah 14 request dalam 60 detik terakhir."""
    with _lock:
        now = time.time()
        # Hapus request yang sudah lebih dari 60 detik
        while _request_times and _request_times[0] < now - 60:
            _request_times.pop(0)

        # Kalau sudah 14 request, tunggu sampai slot kosong
        if len(_request_times) >= 14:
            wait_time = 60 - (now - _request_times[0]) + 0.5
            logger.info(f"Rate limit: menunggu {wait_time:.1f} detik...")
            time.sleep(wait_time)
            # Bersihkan lagi setelah tunggu
            now = time.time()
            while _request_times and _request_times[0] < now - 60:
                _request_times.pop(0)

        _request_times.append(time.time())

def parse_transaction(text: str, categories: list) -> dict | None:
    """
    Parse teks natural language jadi data transaksi.
    Contoh input: "bayar listrik 150rb"
    Output: {"type": "expense", "amount": 150000, "description": "Bayar listrik", "category": "Listrik"}
    """
    # Cek cache dulu
    cache_key = f"{text.lower().strip()}"
    if cache_key in _cache:
        logger.info(f"Cache hit: {cache_key}")
        return _cache[cache_key]

    cat_income  = [c["name"] for c in categories if c["type"] == "income"]
    cat_expense = [c["name"] for c in categories if c["type"] == "expense"]

    prompt = f"""Kamu adalah parser transaksi keuangan untuk aplikasi KasRT Indonesia.
Ekstrak informasi dari teks berikut menjadi JSON transaksi.

Teks: "{text}"

Kategori pemasukan tersedia: {", ".join(cat_income) or "Lainnya"}
Kategori pengeluaran tersedia: {", ".join(cat_expense) or "Lainnya"}

Aturan konversi nominal (WAJIB diikuti):
- "150rb" atau "150ribu" = 150000
- "1.5jt" atau "1,5juta" = 1500000
- "50k" = 50000
- "dua ratus ribu" = 200000
- "setengah juta" = 500000
- Nominal tanpa satuan yang masuk akal = nilai aslinya (misal "150000" = 150000)

Aturan tipe transaksi:
- Kata seperti "bayar", "beli", "keluar", "habis", "kasih", "transfer ke" → expense
- Kata seperti "terima", "dapat", "masuk", "iuran dari", "bayaran" → income
- Default jika tidak jelas → expense

Format output (HANYA JSON, tidak ada teks lain):
{{"type": "expense", "amount": 150000, "description": "Deskripsi singkat", "category": "Nama kategori yang paling cocok"}}

Jika teks tidak mengandung transaksi sama sekali, kembalikan:
{{"error": "bukan transaksi"}}"""

    try:
        # Tunggu kalau rate limit tercapai
        _wait_for_rate_limit()

        response = model.generate_content(prompt)
        raw = response.text.strip()

        # Bersihkan markdown code block kalau ada
        if raw.startswith("```"):
            raw = raw.split("```")[1]
            if raw.startswith("json"):
                raw = raw[4:]
        raw = raw.strip()

        result = json.loads(raw)

        # Validasi result
        if "error" in result:
            return None

        if not all(k in result for k in ["type", "amount"]):
            return None

        # Pastikan amount adalah integer positif
        result["amount"] = max(1, int(float(str(result["amount"]).replace(",", "").replace(".", ""))))

        # Cache hasil
        _cache[cache_key] = result
        if len(_cache) > 200:  # Batas cache 200 item
            oldest = next(iter(_cache))
            del _cache[oldest]

        return result

    except json.JSONDecodeError as e:
        logger.error(f"JSON parse error: {e} | raw: {raw}")
        return None
    except Exception as e:
        logger.error(f"Gemini error: {e}")
        return None