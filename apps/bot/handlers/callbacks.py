# apps/bot/handlers/callbacks.py
import logging
from telegram import Update, InlineKeyboardMarkup, InlineKeyboardButton
from telegram.ext import ContextTypes
from db import insert_transaction, fmt_rupiah
from handlers.messages import get_pending

logger = logging.getLogger(__name__)

async def handle_callback(update: Update, ctx: ContextTypes.DEFAULT_TYPE):
    query = update.callback_query
    await query.answer()

    data = query.data

    if data == "cancel":
        await query.edit_message_text("Transaksi dibatalkan.")
        return

    if data.startswith("save:"):
        pending_id = data[5:]
        payload = get_pending(pending_id)

        if not payload:
            await query.edit_message_text(
                "Sesi transaksi sudah expired. Kirim ulang pesan kamu."
            )
            return

        try:
            workspace_id = payload.pop("workspace_id")
            user_id      = payload.pop("user_id")
            insert_transaction(workspace_id, user_id, payload)

            tipe_emoji = "+" if payload["type"] == "income" else "-"
            await query.edit_message_text(
                f"Transaksi disimpan!\n\n"
                f"{tipe_emoji} {fmt_rupiah(payload['amount'])}\n"
                f"Kategori: {payload.get('category', '-')}\n"
                f"Catatan: {payload.get('description', '-')}"
            )
        except Exception as e:
            logger.error(f"Save error: {e}")
            await query.edit_message_text(
                "Gagal menyimpan transaksi. Coba lagi nanti."
            )
        return

    if data.startswith("edit:"):
        pending_id = data[5:]
        get_pending(pending_id)  # hapus dari pending
        await query.edit_message_text(
            "Kirim ulang transaksi dengan format yang lebih jelas.\n\n"
            "Contoh:\n"
            "- bayar listrik 150000\n"
            "- terima iuran RT 50rb"
        )
        return