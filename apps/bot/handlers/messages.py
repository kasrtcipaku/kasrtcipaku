# apps/bot/handlers/messages.py
import uuid
import logging
from telegram import Update, InlineKeyboardButton, InlineKeyboardMarkup
from telegram.ext import ContextTypes
from db import get_workspace_by_telegram, get_categories, fmt_rupiah, get_telegram_member_link
from parser import parse_transaction

logger = logging.getLogger(__name__)

# Simpan pending transaksi di memory dengan key pendek
_pending: dict[str, dict] = {}

async def handle_message(update: Update, ctx: ContextTypes.DEFAULT_TYPE):
    chat_id = update.effective_chat.id
    text    = update.message.text.strip()

    # Cek dulu apakah sedang input kode anggota
    from handlers.start import handle_member_code_input
    if await handle_member_code_input(update, ctx):
        return

    # Cek link owner dulu, lalu anggota
    link        = get_workspace_by_telegram(chat_id)
    member_link = get_telegram_member_link(chat_id) if not link else None

    if not link and not member_link:
        await update.message.reply_text(
            "Workspace belum terhubung.\n"
            "• Owner: ketik /hubungkan\n"
            "• Anggota: ketik /masuk\_anggota",
            parse_mode="Markdown"
        )
        return

    if member_link:
        # Jalur anggota
        member  = member_link.get("workspace_members", {})
        ws_id   = member.get("workspace_id") if member else None
        user_id = None  # anggota tidak punya user_id Supabase Auth
    else:
        ws_id   = link["workspace_id"]
        user_id = link["user_id"]

    # Typing indicator — tidak masalah kalau gagal, proses tetap lanjut
    try:
        await update.message.reply_chat_action("typing")
    except Exception:
        pass

    categories = get_categories(ws_id)
    if not categories:
        await update.message.reply_text(
            "Workspace belum punya kategori. "
            "Buka dashboard KasRT untuk setup kategori dulu."
        )
        return

    result = parse_transaction(text, categories)

    if result is None:
        await update.message.reply_text(
            "Hmm, saya tidak mengenali transaksi dari pesan itu.\n\n"
            "Coba format seperti:\n"
            "- bayar listrik 150rb\n"
            "- terima iuran 50000\n"
            "- beli bahan baku 1.2jt"
        )
        return

    # Simpan data di memory, buat ID pendek
    pending_id = str(uuid.uuid4())[:8]
    _pending[pending_id] = {
        "type":         result["type"],
        "amount":       result["amount"],
        "description":  result.get("description", text),
        "category":     result.get("category", "-"),
        "workspace_id": ws_id,
        "user_id":      user_id,
    }

    # Bersihkan pending lama (max 100)
    if len(_pending) > 100:
        oldest = next(iter(_pending))
        del _pending[oldest]

    tipe_label = "Pemasukan" if result["type"] == "income" else "Pengeluaran"
    tipe_emoji = "+" if result["type"] == "income" else "-"

    konfirmasi = (
        f"Konfirmasi Transaksi\n"
        f"{'─' * 24}\n"
        f"Jenis    : {tipe_emoji} {tipe_label}\n"
        f"Nominal  : {fmt_rupiah(result['amount'])}\n"
        f"Kategori : {result.get('category', '-')}\n"
        f"Catatan  : {result.get('description', text)}\n"
        f"{'─' * 24}\n"
        f"Simpan transaksi ini?"
    )

    # callback_data pendek — max 64 byte
    keyboard = InlineKeyboardMarkup([[
        InlineKeyboardButton("Simpan", callback_data=f"save:{pending_id}"),
        InlineKeyboardButton("Edit",   callback_data=f"edit:{pending_id}"),
        InlineKeyboardButton("Batal",  callback_data="cancel"),
    ]])

    await update.message.reply_text(konfirmasi, reply_markup=keyboard)


def get_pending(pending_id: str) -> dict | None:
    return _pending.pop(pending_id, None)