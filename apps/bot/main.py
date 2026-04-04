from dotenv import load_dotenv
load_dotenv()

import os
import asyncio
import logging
import requests as req_lib
from datetime import datetime, timezone, timedelta
from flask import Flask, request, jsonify
from telegram import Update
from telegram.ext import (
    Application, CommandHandler, MessageHandler,
    CallbackQueryHandler, filters
)
from handlers.start import cmd_start, cmd_saldo, cmd_help, cmd_hubungkan, cmd_lunas, cmd_putuskan, cmd_masuk_anggota, cmd_saldo_anggota, cmd_keluar_anggota
from handlers.messages import handle_message
from handlers.callbacks import handle_callback
from report import send_monthly_report
from db import get_all_telegram_links, get_monthly_report_data

logging.basicConfig(
    format="%(asctime)s - %(name)s - %(levelname)s - %(message)s",
    level=logging.INFO
)
logger = logging.getLogger(__name__)

TOKEN   = os.environ["TELEGRAM_BOT_TOKEN"]
SECRET  = os.environ["TELEGRAM_WEBHOOK_SECRET"]
APP_URL = os.environ.get("RENDER_EXTERNAL_URL", "").rstrip("/")

# ── Register webhook via HTTP biasa (tanpa asyncio) ───────────
if APP_URL:
    webhook_url = f"{APP_URL}/webhook/{SECRET}"
    resp = req_lib.post(
        f"https://api.telegram.org/bot{TOKEN}/setWebhook",
        json={"url": webhook_url, "allowed_updates": ["message", "callback_query"]}
    )
    logger.info(f"Webhook register: {resp.json()}")

# ── Event loop permanen ───────────────────────────────────────
loop = asyncio.new_event_loop()
asyncio.set_event_loop(loop)

# ── Telegram Application ──────────────────────────────────────
app_bot = Application.builder().token(TOKEN).build()

app_bot.add_handler(CommandHandler("start",          cmd_start))
app_bot.add_handler(CommandHandler("saldo",          cmd_saldo))
app_bot.add_handler(CommandHandler("help",           cmd_help))
app_bot.add_handler(CommandHandler("hubungkan",      cmd_hubungkan))
app_bot.add_handler(CommandHandler("lunas",          cmd_lunas))
app_bot.add_handler(CommandHandler("putuskan",       cmd_putuskan))
app_bot.add_handler(CommandHandler("masuk_anggota",  cmd_masuk_anggota))
app_bot.add_handler(CommandHandler("saldo_anggota",  cmd_saldo_anggota))
app_bot.add_handler(CommandHandler("keluar_anggota", cmd_keluar_anggota))
app_bot.add_handler(CallbackQueryHandler(handle_callback))
app_bot.add_handler(MessageHandler(filters.TEXT & ~filters.COMMAND, handle_message))

loop.run_until_complete(app_bot.initialize())

# ── Flask App ─────────────────────────────────────────────────
flask_app = Flask(__name__)

@flask_app.post(f"/webhook/{SECRET}")
def webhook():
    try:
        data   = request.get_json(force=True)
        update = Update.de_json(data, app_bot.bot)
        loop.run_until_complete(app_bot.process_update(update))
    except Exception as e:
        logger.error(f"Webhook error: {e}")
    return "OK", 200

@flask_app.get("/")
def health():
    return jsonify({"status": "alive", "bot": "KasRT"}), 200

@flask_app.get("/debug/env")
def debug_env():
    return jsonify({
        "CRON_SECRET": os.environ.get("CRON_SECRET", "NOT SET"),
    }), 200

@flask_app.get("/cron/monthly-report")
def cron_monthly_report():
    """
    Dipanggil cron-job.org tiap tanggal 1 jam 07:00 WIB (00:00 UTC).
    Kirim laporan bulan berjalan ke semua workspace yang terhubung Telegram.
    Karena dikirim di akhir/awal bulan, data yang diambil adalah bulan saat cron berjalan.
    """
    # Validasi secret
    secret = request.headers.get("x-cron-secret", "")
    if secret != os.environ.get("CRON_SECRET", ""):
        return jsonify({"error": "unauthorized"}), 401

    # Gunakan bulan berjalan (bukan bulan lalu)
    # Cron jalan tiap tgl 1, tapi laporan tetap ambil bulan ini
    # sehingga saat testing kapan pun, data bulan sekarang selalu keambil
    now   = datetime.now(timezone(timedelta(hours=7)))  # WIB
    month = now.month
    year  = now.year

    links   = get_all_telegram_links()
    results = []

    for link in links:
        chat_id      = link["telegram_chat_id"]
        workspace_id = link["workspace_id"]
        ws_name      = link["workspaces"]["name"] if link.get("workspaces") else "Workspace"

        try:
            data = get_monthly_report_data(workspace_id, month, year)

            loop.run_until_complete(
                send_monthly_report(
                    bot            = app_bot.bot,
                    chat_id        = chat_id,
                    workspace_name = ws_name,
                    month          = month,
                    year           = year,
                    income         = data["income"],
                    expense        = data["expense"],
                    transactions   = data["transactions"],
                    category_data  = data["category_data"],
                    unpaid_bills   = data["unpaid_bills"],
                    paid_bills     = data["paid_bills"],
                )
            )
            results.append({"chat_id": chat_id, "workspace": ws_name, "status": "ok"})
            logger.info(f"Monthly report sent: {ws_name} ({chat_id})")

        except Exception as e:
            logger.error(f"Monthly report error ({ws_name}): {e}")
            results.append({"chat_id": chat_id, "workspace": ws_name, "status": "error", "error": str(e)})

    return jsonify({"month": f"{month}/{year}", "sent": len(results), "results": results}), 200

if __name__ == "__main__":
    port = int(os.environ.get("PORT", 8080))
    flask_app.run(host="0.0.0.0", port=port)