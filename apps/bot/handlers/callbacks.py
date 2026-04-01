# apps/bot/handlers/callbacks.py
import json
import logging
from telegram import Update, InlineKeyboardMarkup, InlineKeyboardButton
from telegram.ext import ContextTypes
from db import insert_transaction, fmt_rupiah

logger = logging.getLogger(__name__)

async def handle_callback(update: Update, ctx: ContextTypes.DEFAULT_TYPE):
    query = update.callback_query
    await query.answer()

    data = query.data

    # ── Batal ────────────────────────────────────────────────
    if data == "cancel":
        await query.edit_message_text("❌ Transaksi dibatalkan.")
        return

    # ── Simpan ───────────────────────────────────────────────
    if data.startswith("save|"):
        try:
            payload      = json.loads(data[5:])
            workspace_id = payload.pop("workspace_id")
            user_id      = payload.pop("user_id")

            trx = insert_transaction(workspace_id, user_id, payload)

            tipe_emoji = "💚" if payload["type"] == "income" else "❤️"
            await query.edit_message_text(
                f"✅ *Transaksi disimpan!*\n\n"
                f"{tipe_emoji} {fmt_rupiah(payload['amount'])}\n"
                f"📁 {payload.get('category', '—')}\n"
                f"📝 {payload.get('description', '—')}",
                parse_mode="Markdown"
            )
        except Exception as e:
            logger.error(f"Save error: {e}")
            await query.edit_message_text(
                "⚠️ Gagal menyimpan transaksi. Coba lagi nanti."
            )
        return

    # ── Edit — minta input ulang ─────────────────────────────
    if data.startswith("edit|"):
        await query.edit_message_text(
            "✏️ Kirim ulang transaksi dengan format yang lebih jelas.\n\n"
            "Contoh:\n"
            "• `bayar listrik 150000`\n"
            "• `pemasukan iuran RT 50rb`",
            parse_mode="Markdown"
        )
        return
