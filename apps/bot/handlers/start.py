# apps/bot/handlers/start.py
import os
import secrets
import logging
from datetime import datetime, timezone, timedelta
from telegram import Update, InlineKeyboardButton, InlineKeyboardMarkup
from telegram.ext import ContextTypes
from db import get_workspace_by_telegram, get_monthly_summary, get_unpaid_bills, fmt_rupiah, get_db, get_member_by_code, get_telegram_member_link, save_telegram_member_link, disconnect_telegram_member

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
            f"/lunas — Tandai tagihan sudah dibayar\n"
            f"/help — Bantuan lengkap",
            parse_mode="Markdown"
        )
    else:
        await update.message.reply_text(
            "👋 Halo! Saya bot *KasRT* — asisten keuangan kamu.\n\n"
            "Untuk mulai, hubungkan bot ini ke workspace kamu dengan perintah:\n"
            "➡️ /hubungkan\n\n"
            "Atau login ke kasrtcipaku.vercel.app dan ikuti langkah koneksi di sana.",
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
        "/lunas — Tandai tagihan sudah dibayar\n"
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
        text += "\nKetik /lunas untuk tandai tagihan yang sudah dibayar."

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
        "code":             code,
        "telegram_chat_id": chat_id,
        "expires_at":       expires,
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

async def cmd_lunas(update: Update, ctx: ContextTypes.DEFAULT_TYPE):
    chat_id = update.effective_chat.id
    link    = get_workspace_by_telegram(chat_id)

    if not link:
        await update.message.reply_text(
            "⚠️ Workspace belum terhubung. Ketik /hubungkan dulu."
        )
        return

    ws_id = link["workspace_id"]
    bills = get_unpaid_bills(ws_id)

    if not bills:
        await update.message.reply_text("✅ Tidak ada tagihan yang belum lunas.")
        return

    keyboard = []
    for b in bills:
        due   = b["due_date"][5:]  # MM-DD
        label = f"{b['title']} — {fmt_rupiah(b['amount'])} (due {due})"
        keyboard.append([InlineKeyboardButton(label, callback_data=f"lunas:{b['id']}")])
    keyboard.append([InlineKeyboardButton("Batal", callback_data="cancel")])

    await update.message.reply_text(
        "💳 *Pilih tagihan yang sudah dibayar:*",
        parse_mode="Markdown",
        reply_markup=InlineKeyboardMarkup(keyboard)
    )

async def cmd_putuskan(update: Update, ctx: ContextTypes.DEFAULT_TYPE):
    chat_id = update.effective_chat.id
    link    = get_workspace_by_telegram(chat_id)

    if not link:
        await update.message.reply_text(
            "⚠️ Bot ini belum terhubung ke workspace manapun."
        )
        return

    ws_name = link["workspaces"]["name"]

    keyboard = InlineKeyboardMarkup([[
        InlineKeyboardButton("✅ Ya, putuskan", callback_data=f"putuskan:{chat_id}"),
        InlineKeyboardButton("❌ Batal",        callback_data="cancel"),
    ]])

    await update.message.reply_text(
        f"⚠️ *Putuskan koneksi bot dari workspace?*\n\n"
        f"Workspace: *{ws_name}*\n\n"
        f"Setelah diputus, bot tidak bisa lagi mencatat transaksi "
        f"ke workspace ini. Kamu bisa hubungkan ulang kapan saja dengan /hubungkan.",
        parse_mode="Markdown",
        reply_markup=keyboard
    )

# ── State untuk input kode anggota ───────────────────────────
_waiting_member_code: set[int] = set()

async def cmd_masuk_anggota(update: Update, ctx: ContextTypes.DEFAULT_TYPE):
    chat_id = update.effective_chat.id

    # Cek apakah sudah terhubung sebagai anggota
    link = get_telegram_member_link(chat_id)
    if link:
        member = link.get("workspace_members", {})
        ws     = member.get("workspaces", {}) if member else {}
        ws_name = ws.get("name", "workspace") if ws else "workspace"
        name    = member.get("display_name", "Anggota") if member else "Anggota"
        await update.message.reply_text(
            f"✅ Kamu sudah terhubung sebagai anggota *{ws_name}*.\n"
            f"Nama: {name}\n\n"
            f"Ketik /keluar\\_anggota untuk putus koneksi.",
            parse_mode="Markdown"
        )
        return

    _waiting_member_code.add(chat_id)
    await update.message.reply_text(
        "🔑 *Masuk sebagai Anggota*\n\n"
        "Kirimkan kode anggota kamu.\n"
        "Contoh: `HIJAU-429` atau `BINTANG-071`\n\n"
        "Kode bisa didapat dari pemilik workspace.",
        parse_mode="Markdown"
    )

async def handle_member_code_input(update: Update, ctx: ContextTypes.DEFAULT_TYPE) -> bool:
    """
    Dipanggil dari handle_message — return True kalau pesan adalah input kode anggota.
    """
    chat_id = update.effective_chat.id
    if chat_id not in _waiting_member_code:
        return False

    code = update.message.text.strip().upper()
    member = get_member_by_code(code)

    if not member:
        await update.message.reply_text(
            "❌ Kode tidak ditemukan. Periksa kembali kode kamu.\n\n"
            "Ketik /masuk\\_anggota untuk coba lagi.",
            parse_mode="Markdown"
        )
        _waiting_member_code.discard(chat_id)
        return True

    # Simpan link
    save_telegram_member_link(chat_id, member["id"])
    _waiting_member_code.discard(chat_id)

    ws_name = member.get("workspaces", {}).get("name", "workspace") if member.get("workspaces") else "workspace"
    name    = member.get("display_name") or "Anggota"

    await update.message.reply_text(
        f"✅ *Berhasil masuk sebagai Anggota!*\n\n"
        f"Workspace : *{ws_name}*\n"
        f"Nama      : {name}\n"
        f"Role      : {member.get('role', 'member')}\n\n"
        f"Kamu bisa catat transaksi dan cek tagihan.\n"
        f"Ketik /saldo\\_anggota untuk lihat ringkasan.",
        parse_mode="Markdown"
    )
    return True

async def cmd_saldo_anggota(update: Update, ctx: ContextTypes.DEFAULT_TYPE):
    chat_id = update.effective_chat.id
    link    = get_telegram_member_link(chat_id)

    if not link:
        await update.message.reply_text(
            "⚠️ Kamu belum masuk sebagai anggota. Ketik /masuk\\_anggota dulu.",
            parse_mode="Markdown"
        )
        return

    member  = link.get("workspace_members", {})
    ws      = member.get("workspaces", {}) if member else {}
    ws_id   = member.get("workspace_id") if member else None
    ws_name = ws.get("name", "workspace") if ws else "workspace"

    if not ws_id:
        await update.message.reply_text("⚠️ Data workspace tidak ditemukan.")
        return

    await update.message.reply_text("⏳ Mengambil data...")

    summary = get_monthly_summary(ws_id)
    bills   = get_unpaid_bills(ws_id)

    sign = "🟢" if summary["balance"] >= 0 else "🔴"
    text = (
        f"📊 *Ringkasan {summary['month']} — {ws_name}*\n"
        f"{'─' * 28}\n"
        f"💚 Pemasukan : {fmt_rupiah(summary['income'])}\n"
        f"❤️  Pengeluaran: {fmt_rupiah(summary['expense'])}\n"
        f"{'─' * 28}\n"
        f"{sign} Saldo     : *{fmt_rupiah(summary['balance'])}*\n"
        f"📝 Total transaksi: {summary['count']}\n"
    )

    if bills:
        text += f"\n⚠️ *Tagihan belum lunas ({len(bills)}):*\n"
        for b in bills:
            due = b["due_date"][5:]
            text += f"• {b['title']} — {fmt_rupiah(b['amount'])} (jatuh tempo {due})\n"

    await update.message.reply_text(text, parse_mode="Markdown")

async def cmd_keluar_anggota(update: Update, ctx: ContextTypes.DEFAULT_TYPE):
    chat_id = update.effective_chat.id
    link    = get_telegram_member_link(chat_id)

    if not link:
        await update.message.reply_text("⚠️ Kamu belum masuk sebagai anggota.")
        return

    member  = link.get("workspace_members", {})
    ws      = member.get("workspaces", {}) if member else {}
    ws_name = ws.get("name", "workspace") if ws else "workspace"

    from telegram import InlineKeyboardButton, InlineKeyboardMarkup
    keyboard = InlineKeyboardMarkup([[
        InlineKeyboardButton("✅ Ya, keluar", callback_data=f"keluar_anggota:{chat_id}"),
        InlineKeyboardButton("❌ Batal",      callback_data="cancel"),
    ]])

    await update.message.reply_text(
        f"⚠️ Keluar dari workspace *{ws_name}* sebagai anggota?\n\n"
        f"Kamu bisa masuk lagi kapan saja dengan /masuk\\_anggota.",
        parse_mode="Markdown",
        reply_markup=keyboard
    )