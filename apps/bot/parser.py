# apps/bot/parser.py
import os
import json
import logging
import google.generativeai as genai

logger = logging.getLogger(__name__)

genai.configure(api_key=os.environ["GEMINI_API_KEY"])
model = genai.GenerativeModel("gemini-1.5-flash")

# Cache sederhana biar tidak boros quota Gemini
_cache: dict[str, dict] = {}

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
