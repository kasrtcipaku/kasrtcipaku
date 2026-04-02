# apps/bot/parser.py
import os
import json
import time
import logging
import threading
import google.generativeai as genai

logger = logging.getLogger(__name__)

genai.configure(api_key=os.environ["GEMINI_API_KEY"])

# Coba model dari yang paling baru ke lama
_MODEL_OPTIONS = [
    "gemini-1.5-flash-latest",
    "gemini-1.5-flash-002",
    "gemini-1.5-flash-001",
    "gemini-1.0-pro-latest",
    "gemini-1.0-pro",
    "gemini-pro",
]

def _get_model():
    """Coba model satu per satu sampai ada yang works."""
    for model_name in _MODEL_OPTIONS:
        try:
            m = genai.GenerativeModel(model_name)
            # Test kecil
            m.generate_content("hi")
            logger.info(f"Model aktif: {model_name}")
            return m
        except Exception as e:
            logger.warning(f"Model {model_name} tidak tersedia: {e}")
            continue
    raise RuntimeError("Tidak ada model Gemini yang tersedia!")

# Inisialisasi model saat startup
try:
    model = _get_model()
except Exception as e:
    logger.error(f"Gagal init model: {e}")
    model = genai.GenerativeModel("gemini-pro")  # fallback

# Cache sederhana
_cache: dict[str, dict] = {}

# Rate limiter
_lock = threading.Lock()
_request_times = []

def _wait_for_rate_limit():
    with _lock:
        now = time.time()
        while _request_times and _request_times[0] < now - 60:
            _request_times.pop(0)
        if len(_request_times) >= 14:
            wait_time = 60 - (now - _request_times[0]) + 0.5
            logger.info(f"Rate limit: menunggu {wait_time:.1f}s...")
            time.sleep(wait_time)
            now = time.time()
            while _request_times and _request_times[0] < now - 60:
                _request_times.pop(0)
        _request_times.append(time.time())

def parse_transaction(text: str, categories: list) -> dict | None:
    cache_key = text.lower().strip()
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
- Nominal tanpa satuan = nilai aslinya (misal "150000" = 150000)

Aturan tipe transaksi:
- "bayar", "beli", "keluar", "habis", "kasih", "transfer ke" → expense
- "terima", "dapat", "masuk", "iuran dari", "bayaran" → income
- Default jika tidak jelas → expense

Format output (HANYA JSON, tidak ada teks lain):
{{"type": "expense", "amount": 150000, "description": "Deskripsi singkat", "category": "Nama kategori yang paling cocok"}}

Jika teks tidak mengandung transaksi, kembalikan:
{{"error": "bukan transaksi"}}"""

    try:
        _wait_for_rate_limit()
        response = model.generate_content(prompt)
        raw = response.text.strip()

        if raw.startswith("```"):
            raw = raw.split("```")[1]
            if raw.startswith("json"):
                raw = raw[4:]
        raw = raw.strip()

        result = json.loads(raw)

        if "error" in result:
            return None
        if not all(k in result for k in ["type", "amount"]):
            return None

        result["amount"] = max(1, int(float(
            str(result["amount"]).replace(",", "").replace(".", "")
        )))

        _cache[cache_key] = result
        if len(_cache) > 200:
            del _cache[next(iter(_cache))]

        return result

    except json.JSONDecodeError as e:
        logger.error(f"JSON parse error: {e} | raw: {raw}")
        return None
    except Exception as e:
        logger.error(f"Gemini error: {e}")
        # Coba reinit model kalau error
        global model
        try:
            model = _get_model()
        except:
            pass
        return None