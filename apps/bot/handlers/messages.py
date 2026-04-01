# apps/bot/handlers/messages.py
import json
import logging
from telegram import Update, InlineKeyboardButton, InlineKeyboardMarkup
from telegram.ext import ContextTypes
from db import get_workspace_by_telegram, get_categories, fmt_rupiah
from parser import parse_transaction

logger = logging.getLogger(__name__)

async def handle_message(update: Update, ctx: ContextTypes.DEFAULT_TYPE):
    chat_id = update.effective_chat.id
    text    = update.message.text.strip()

    # Cek apakah sudah terhubung
    link = get_workspace_by_telegram(chat_id)
    if not link:
        await update.message.reply_text(
            "⚠️ Workspace belum terhubung.\n"
            "Ketik /hubungkan untuk menghubungkan bot ke akun KasRT kamu."
        )
        return

    ws_id   = link["workspace_id"]
    user_id = link["user_id"]

    # Typing indicator
    await update.message.reply_chat_action("typing")

    # Load kategori workspace
    categories = get_categories(ws_id)
    if not categories:
        await update.message.reply_text(
            "⚠️ Workspace belum punya kategori. "
            "Buka dashboard KasRT untuk setup kategori dulu."
        )
        return

    # Parse dengan Gemini
    result = parse_transaction(text, categories)

    if result is None:
        await update.message.reply_text(
            "🤔 Hmm, saya tidak mengenali transaksi dari pesan itu.\n\n"
            "Coba format seperti:\n"
            "• `bayar listrik 150rb`\n"
            "• `terima iuran 50000`\n"
            "• `beli bahan baku 1.2jt`",
            parse_mode="Markdown"
        )
        return

    # Tampilkan konfirmasi
    tipe_label  = "💚 Pemasukan" if result["type"] == "income" else "❤️ Pengeluaran"
    cat_label   = result.get("category", "—")
    desc_label  = result.get("description", text)
    amount_str  = fmt_rupiah(result["amount"])

    konfirmasi = (
        f"📋 *Konfirmasi Transaksi*\n"
        f"{'─' * 26}\n"
        f"Jenis  : {tipe_label}\n"
        f"Nominal: *{amount_str}*\n"
        f"Kategori: {cat_label}\n"
        f"Keterangan: {desc_label}\n"
        f"{'─' * 26}\n"
        f"Simpan transaksi ini?"
    )

    # Simpan data sementara di context
    pending_data = json.dumps({
        "type":        result["type"],
        "amount":      result["amount"],
        "description": desc_label,
        "category":    cat_label,
        "workspace_id": ws_id,
        "user_id":     user_id,
    })

    keyboard = InlineKeyboardMarkup([[
        InlineKeyboardButton("✅ Simpan",  callback_data=f"save|{pending_data}"),
        InlineKeyboardButton("✏️ Edit",    callback_data=f"edit|{pending_data}"),
        InlineKeyboardButton("❌ Batal",   callback_data="cancel"),
    ]])

    await update.message.reply_text(
        konfirmasi,
        parse_mode="Markdown",
        reply_markup=keyboard
    )
