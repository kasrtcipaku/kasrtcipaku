# apps/bot/parser.py
import os
import json
import time
import logging
import threading
import google.generativeai as genai
from google.generativeai.types import GenerationConfig

logger = logging.getLogger(__name__)

genai.configure(api_key=os.environ["GEMINI_API_KEY"])

# Model terbaru yang support generateContent
_MODEL_OPTIONS = [
    "models/gemini-1.5-flash",
    "models/gemini-1.5-pro",
    "models/gemini-1.0-pro",
]

# GenerationConfig: output pendek + deterministik = lebih cepat
_GEN_CONFIG = GenerationConfig(
    max_output_tokens=150,  # JSON output pendek, tidak perlu banyak
    temperature=0.1,        # deterministik, kurangi variasi = lebih cepat
)

def _init_model():
    for model_name in _MODEL_OPTIONS:
        try:
            m = genai.GenerativeModel(model_name, generation_config=_GEN_CONFIG)
            m.generate_content("hi")
            logger.info(f"Model aktif: {model_name}")
            return m
        except Exception as e:
            logger.warning(f"Model {model_name} tidak tersedia: {e}")
            continue
    # Last resort — list semua model dan pakai yang pertama support generateContent
    try:
        available = [
            m.name for m in genai.list_models()
            if "generateContent" in m.supported_generation_methods
        ]
        logger.info(f"Model tersedia: {available}")
        if available:
            m = genai.GenerativeModel(available[0], generation_config=_GEN_CONFIG)
            logger.info(f"Pakai model: {available[0]}")
            return m
    except Exception as e:
        logger.error(f"list_models error: {e}")
    raise RuntimeError("Tidak ada model Gemini yang tersedia!")

model = _init_model()

_cache: dict[str, dict] = {}
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
    global model

    cache_key = text.lower().strip()
    if cache_key in _cache:
        return _cache[cache_key]

    cat_income  = [c["name"] for c in categories if c["type"] == "income"]
    cat_expense = [c["name"] for c in categories if c["type"] == "expense"]

    prompt = f"""Kamu adalah parser transaksi keuangan untuk aplikasi KasRT Indonesia.
Ekstrak informasi dari teks berikut menjadi JSON transaksi.

Teks: "{text}"

Kategori pemasukan tersedia: {", ".join(cat_income) or "Lainnya"}
Kategori pengeluaran tersedia: {", ".join(cat_expense) or "Lainnya"}

Aturan konversi nominal:
- "150rb" atau "150ribu" = 150000
- "1.5jt" atau "1,5juta" = 1500000
- "50k" = 50000
- "dua ratus ribu" = 200000
- Nominal tanpa satuan = nilai aslinya

Aturan tipe:
- "bayar", "beli", "keluar", "habis" -> expense
- "terima", "dapat", "masuk", "iuran" -> income
- Default -> expense

Format output (HANYA JSON):
{{"type": "expense", "amount": 150000, "description": "Deskripsi singkat", "category": "Kategori"}}

Jika bukan transaksi:
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
        logger.error(f"JSON parse error: {e}")
        return None
    except Exception as e:
        logger.error(f"Gemini error: {e}")
        try:
            model = _init_model()
        except Exception:
            pass
        return None