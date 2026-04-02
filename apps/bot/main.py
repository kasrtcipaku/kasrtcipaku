from dotenv import load_dotenv
load_dotenv()

import os
import asyncio
import logging
from flask import Flask, request, jsonify
from telegram import Update
from telegram.ext import (
    Application, CommandHandler, MessageHandler,
    CallbackQueryHandler, filters
)
from handlers.start import cmd_start, cmd_saldo, cmd_help, cmd_hubungkan
from handlers.messages import handle_message
from handlers.callbacks import handle_callback

logging.basicConfig(
    format="%(asctime)s - %(name)s - %(levelname)s - %(message)s",
    level=logging.INFO
)
logger = logging.getLogger(__name__)

TOKEN   = os.environ["TELEGRAM_BOT_TOKEN"]
SECRET  = os.environ["TELEGRAM_WEBHOOK_SECRET"]
APP_URL = os.environ.get("RENDER_EXTERNAL_URL", "")

# ── Event loop permanen ───────────────────────────────────────
loop = asyncio.new_event_loop()
asyncio.set_event_loop(loop)

# ── Telegram Application ──────────────────────────────────────
app_bot = Application.builder().token(TOKEN).build()

app_bot.add_handler(CommandHandler("start",     cmd_start))
app_bot.add_handler(CommandHandler("saldo",     cmd_saldo))
app_bot.add_handler(CommandHandler("help",      cmd_help))
app_bot.add_handler(CommandHandler("hubungkan", cmd_hubungkan))
app_bot.add_handler(CallbackQueryHandler(handle_callback))
app_bot.add_handler(MessageHandler(filters.TEXT & ~filters.COMMAND, handle_message))

# Initialize bot sekali saat startup
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

if __name__ == "__main__":
    port = int(os.environ.get("PORT", 8080))
    flask_app.run(host="0.0.0.0", port=port)