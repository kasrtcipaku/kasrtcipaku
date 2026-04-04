# apps/bot/handlers/callbacks.py
import logging
from telegram import Update, InlineKeyboardMarkup, InlineKeyboardButton
from telegram.ext import ContextTypes
from db import insert_transaction, fmt_rupiah, mark_bill_paid, disconnect_telegram, disconnect_telegram_member
from handlers.messages import get_pending

logger = logging.getLogger(__name__)

async def handle_callback(update: Update, ctx: ContextTypes.DEFAULT_TYPE):
    query = update.callback_query
    await query.answer()

    data = query.data

    # ── Batal ────────────────────────────────────────────────────
    if data == "cancel":
        await query.edit_message_text("Transaksi dibatalkan.")
        return

    # ── Simpan transaksi ─────────────────────────────────────────
    if data.startswith("save:"):
        pending_id = data[5:]
        payload    = get_pending(pending_id)

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
                f"✅ Transaksi disimpan!\n\n"
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

    # ── Edit / kirim ulang ────────────────────────────────────────
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

    # ── Tandai tagihan lunas ──────────────────────────────────────
    if data.startswith("lunas:"):
        bill_id = data[6:]
        try:
            mark_bill_paid(bill_id)
            await query.edit_message_text("✅ Tagihan berhasil ditandai lunas!")
        except Exception as e:
            logger.error(f"Lunas error: {e}")
            await query.edit_message_text(
                "Gagal menandai lunas. Coba lagi."
            )
        return

    # ── Putuskan koneksi workspace ────────────────────────────────
    if data.startswith("putuskan:"):
        chat_id_to_disconnect = int(data[9:])
        try:
            disconnect_telegram(chat_id_to_disconnect)
            await query.edit_message_text(
                "✅ Bot berhasil diputus dari workspace.\n\n"
                "Ketik /hubungkan untuk menghubungkan ke workspace lain."
            )
        except Exception as e:
            logger.error(f"Putuskan error: {e}")
            await query.edit_message_text(
                "Gagal memutus koneksi. Coba lagi nanti."
            )
        return

    # ── Keluar sebagai anggota ────────────────────────────────────
    if data.startswith("keluar_anggota:"):
        chat_id_to_disconnect = int(data[15:])
        try:
            disconnect_telegram_member(chat_id_to_disconnect)
            await query.edit_message_text(
                "✅ Kamu sudah keluar sebagai anggota.\n\n"
                "Ketik /masuk\_anggota untuk masuk lagi dengan kode anggota.",
                parse_mode="Markdown"
            )
        except Exception as e:
            logger.error(f"Keluar anggota error: {e}")
            await query.edit_message_text("Gagal keluar. Coba lagi nanti.")
        return