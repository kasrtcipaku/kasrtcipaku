# apps/bot/handlers/start.py
import os
import secrets
import logging
from datetime import datetime, timezone, timedelta
from telegram import Update, InlineKeyboardButton, InlineKeyboardMarkup
from telegram.ext import ContextTypes
from db import get_workspace_by_telegram, get_monthly_summary, get_unpaid_bills, fmt_rupiah, get_db

logger = logging.getLogger(__name__)

APP_URL = os.environ.get("NEXT_PUBLIC_APP_URL", "https://kasrtcipaku.vercel.app")

async def cmd_start(update: Update, ctx: ContextTypes.DEFAULT_TYPE):
    chat_id = update.effective_chat.id
    link    = get_workspace_by_telegram(chat_id)

    if link:
        ws_name = link["workspaces"]["name"]
        await update.message.reply_text(
            f"👋 Halo! Bot KasRT sudah terhubung ke *{ws_name}*.\n\n"
            f"Ketik nominal transaksi langsung, contoh:\n"
            f"• `bayar listrik 150rb`\n"
            f"• `terima iuran RT 50000`\n"
            f"• `beli bahan baku 200k`\n\n"
            f"Perintah lain:\n"
            f"/saldo — Lihat ringkasan bulan ini\n"
            f"/help — Bantuan lengkap",
            parse_mode="Markdown"
        )
    else:
        await update.message.reply_text(
            "👋 Halo! Saya bot *KasRT* — asisten keuangan kamu.\n\n"
            "Untuk mulai, hubungkan bot ini ke workspace kamu dengan perintah:\n"
            "➡️ /hubungkan\n\n"
            "Atau login ke kasrt.app dan ikuti langkah koneksi di sana.",
            parse_mode="Markdown"
        )

async def cmd_help(update: Update, ctx: ContextTypes.DEFAULT_TYPE):
    await update.message.reply_text(
        "📖 *Panduan KasRT Bot*\n\n"
        "*Catat transaksi* — ketik langsung:\n"
        "• `bayar listrik 150rb`\n"
        "• `terima iuran pak budi 50000`\n"
        "• `beli bahan baku 1.2jt`\n"
        "• `keluar untuk kebersihan 75k`\n\n"
        "*Perintah:*\n"
        "/saldo — Ringkasan bulan ini\n"
        "/hubungkan — Hubungkan ke workspace\n"
        "/help — Tampilkan bantuan ini\n\n"
        "*Tips:*\n"
        "Bot pakai AI untuk mengerti pesan kamu. "
        "Setelah parsing, bot akan minta konfirmasi sebelum menyimpan.",
        parse_mode="Markdown"
    )

async def cmd_saldo(update: Update, ctx: ContextTypes.DEFAULT_TYPE):
    chat_id = update.effective_chat.id
    link    = get_workspace_by_telegram(chat_id)

    if not link:
        await update.message.reply_text(
            "⚠️ Workspace belum terhubung. Ketik /hubungkan dulu ya."
        )
        return

    await update.message.reply_text("⏳ Mengambil data...")

    ws_id   = link["workspace_id"]
    ws_name = link["workspaces"]["name"]
    summary = get_monthly_summary(ws_id)
    bills   = get_unpaid_bills(ws_id)

    # Format saldo
    balance_str = fmt_rupiah(summary["balance"])
    sign = "🟢" if summary["balance"] >= 0 else "🔴"

    text = (
        f"📊 *Ringkasan {summary['month']} — {ws_name}*\n"
        f"{'─' * 28}\n"
        f"💚 Pemasukan : {fmt_rupiah(summary['income'])}\n"
        f"❤️  Pengeluaran: {fmt_rupiah(summary['expense'])}\n"
        f"{'─' * 28}\n"
        f"{sign} Saldo     : *{balance_str}*\n"
        f"📝 Total transaksi: {summary['count']}\n"
    )

    if bills:
        text += f"\n⚠️ *Tagihan belum lunas ({len(bills)}):*\n"
        for b in bills:
            due = b["due_date"][5:]  # MM-DD
            text += f"• {b['title']} — {fmt_rupiah(b['amount'])} (jatuh tempo {due})\n"

    keyboard = InlineKeyboardMarkup([[
        InlineKeyboardButton("📈 Lihat Laporan", url=f"{APP_URL}/dashboard/laporan"),
        InlineKeyboardButton("➕ Tambah Transaksi", url=f"{APP_URL}/dashboard/transaksi/baru"),
    ]])

    await update.message.reply_text(text, parse_mode="Markdown", reply_markup=keyboard)

async def cmd_hubungkan(update: Update, ctx: ContextTypes.DEFAULT_TYPE):
    chat_id = update.effective_chat.id

    # Generate kode unik 6 karakter
    code = secrets.token_hex(3).upper()  # contoh: A3F9B2

    # Simpan ke tabel connect_codes dengan expiry 10 menit
    db = get_db()
    expires = (datetime.now(timezone.utc) + timedelta(minutes=10)).isoformat()
    db.table("connect_codes").upsert({
        "code":            code,
        "telegram_chat_id": chat_id,
        "expires_at":      expires,
    }).execute()

    connect_url = f"{APP_URL}/dashboard/connect?code={code}"

    await update.message.reply_text(
        f"🔗 *Hubungkan Bot ke Workspace*\n\n"
        f"Kode koneksi kamu: `{code}`\n"
        f"_(berlaku 10 menit)_\n\n"
        f"Langkah:\n"
        f"1. Buka link berikut di browser\n"
        f"2. Login ke akun KasRT kamu\n"
        f"3. Pilih workspace yang ingin dihubungkan\n"
        f"4. Klik *Konfirmasi*\n\n"
        f"🌐 {connect_url}",
        parse_mode="Markdown",
        reply_markup=InlineKeyboardMarkup([[
            InlineKeyboardButton("🔗 Buka KasRT", url=connect_url)
        ]])
    )
