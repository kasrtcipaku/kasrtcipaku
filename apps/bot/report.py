# apps/bot/report.py
import os
import logging
from io import BytesIO
from datetime import datetime, timezone, timedelta
from reportlab.lib.pagesizes import A4
from reportlab.lib import colors
from reportlab.lib.units import mm
from reportlab.platypus import (
    SimpleDocTemplate, Paragraph, Spacer, Table, TableStyle, HRFlowable
)
from reportlab.lib.styles import getSampleStyleSheet, ParagraphStyle
from reportlab.lib.enums import TA_CENTER, TA_RIGHT

logger = logging.getLogger(__name__)

# ── Warna tema KasRT ─────────────────────────────────────────
BLUE   = colors.HexColor("#7AAACE")
DARK   = colors.HexColor("#1A1A18")
GRAY   = colors.HexColor("#8B7E6E")
GREEN  = colors.HexColor("#15803D")
RED    = colors.HexColor("#DC2626")
LIGHT  = colors.HexColor("#F5F0EA")
WHITE  = colors.white

MONTHS_ID = [
    "Januari", "Februari", "Maret", "April", "Mei", "Juni",
    "Juli", "Agustus", "September", "Oktober", "November", "Desember"
]


def fmt_rupiah(n: int) -> str:
    return f"Rp {n:,.0f}".replace(",", ".")


def generate_monthly_pdf(
    workspace_name: str,
    month: int,
    year: int,
    income: int,
    expense: int,
    transactions: list,
    category_data: list,
    unpaid_bills: list,
) -> BytesIO:
    """
    Generate laporan bulanan PDF, return BytesIO buffer.
    transactions: list of dict {date, description, category, type, amount}
    category_data: list of dict {name, amount, count}
    unpaid_bills: list of dict {title, amount, due_date}
    """
    buffer = BytesIO()
    doc = SimpleDocTemplate(
        buffer,
        pagesize=A4,
        leftMargin=20*mm, rightMargin=20*mm,
        topMargin=20*mm, bottomMargin=20*mm,
    )

    styles = getSampleStyleSheet()
    balance = income - expense
    bulan_str = f"{MONTHS_ID[month - 1]} {year}"

    # ── Custom styles ─────────────────────────────────────────
    title_style = ParagraphStyle(
        "title", parent=styles["Normal"],
        fontSize=20, fontName="Helvetica-Bold",
        textColor=DARK, spaceAfter=2,
    )
    sub_style = ParagraphStyle(
        "sub", parent=styles["Normal"],
        fontSize=11, fontName="Helvetica",
        textColor=GRAY, spaceAfter=4,
    )
    section_style = ParagraphStyle(
        "section", parent=styles["Normal"],
        fontSize=12, fontName="Helvetica-Bold",
        textColor=DARK, spaceBefore=14, spaceAfter=8,
    )
    normal = ParagraphStyle(
        "norm", parent=styles["Normal"],
        fontSize=9, fontName="Helvetica",
        textColor=DARK,
    )
    small_gray = ParagraphStyle(
        "sg", parent=styles["Normal"],
        fontSize=8, fontName="Helvetica",
        textColor=GRAY,
    )
    right_bold = ParagraphStyle(
        "rb", parent=styles["Normal"],
        fontSize=9, fontName="Helvetica-Bold",
        textColor=DARK, alignment=TA_RIGHT,
    )

    story = []

    # ── Header ────────────────────────────────────────────────
    story.append(Paragraph("Laporan Keuangan", title_style))
    story.append(Paragraph(workspace_name, sub_style))
    story.append(Paragraph(f"Periode: {bulan_str}", small_gray))
    story.append(HRFlowable(width="100%", thickness=1, color=LIGHT, spaceAfter=12))

    # ── Ringkasan 3 kotak ─────────────────────────────────────
    summary_data = [
        [
            Paragraph("PEMASUKAN", ParagraphStyle("lbl", parent=styles["Normal"], fontSize=8, textColor=GRAY, fontName="Helvetica")),
            Paragraph("PENGELUARAN", ParagraphStyle("lbl", parent=styles["Normal"], fontSize=8, textColor=GRAY, fontName="Helvetica")),
            Paragraph("SALDO", ParagraphStyle("lbl", parent=styles["Normal"], fontSize=8, textColor=GRAY, fontName="Helvetica")),
        ],
        [
            Paragraph(fmt_rupiah(income),   ParagraphStyle("val", parent=styles["Normal"], fontSize=13, fontName="Helvetica-Bold", textColor=GREEN)),
            Paragraph(fmt_rupiah(expense),  ParagraphStyle("val", parent=styles["Normal"], fontSize=13, fontName="Helvetica-Bold", textColor=RED)),
            Paragraph(fmt_rupiah(balance),  ParagraphStyle("val", parent=styles["Normal"], fontSize=13, fontName="Helvetica-Bold", textColor=GREEN if balance >= 0 else RED)),
        ],
    ]
    summary_table = Table(summary_data, colWidths=["33%", "33%", "34%"])
    summary_table.setStyle(TableStyle([
        ("BACKGROUND", (0, 0), (-1, -1), colors.HexColor("#FAFAF8")),
        ("BOX",        (0, 0), (0, -1), 0.5, colors.HexColor("#E8E0D4")),
        ("BOX",        (1, 0), (1, -1), 0.5, colors.HexColor("#E8E0D4")),
        ("BOX",        (2, 0), (2, -1), 0.5, colors.HexColor("#E8E0D4")),
        ("TOPPADDING",    (0, 0), (-1, -1), 8),
        ("BOTTOMPADDING", (0, 0), (-1, -1), 10),
        ("LEFTPADDING",   (0, 0), (-1, -1), 10),
        ("RIGHTPADDING",  (0, 0), (-1, -1), 10),
        ("ROUNDEDCORNERS", (0, 0), (-1, -1), [6, 6, 6, 6]),
    ]))
    story.append(summary_table)
    story.append(Spacer(1, 14))

    # ── Pengeluaran per Kategori ──────────────────────────────
    if category_data:
        story.append(Paragraph("Pengeluaran per Kategori", section_style))
        cat_rows = [[
            Paragraph("Kategori", ParagraphStyle("h", parent=styles["Normal"], fontSize=8, fontName="Helvetica-Bold", textColor=WHITE)),
            Paragraph("Transaksi", ParagraphStyle("h", parent=styles["Normal"], fontSize=8, fontName="Helvetica-Bold", textColor=WHITE, alignment=TA_CENTER)),
            Paragraph("Total", ParagraphStyle("h", parent=styles["Normal"], fontSize=8, fontName="Helvetica-Bold", textColor=WHITE, alignment=TA_RIGHT)),
            Paragraph("%", ParagraphStyle("h", parent=styles["Normal"], fontSize=8, fontName="Helvetica-Bold", textColor=WHITE, alignment=TA_RIGHT)),
        ]]
        for cat in category_data:
            pct = (cat["amount"] / expense * 100) if expense > 0 else 0
            cat_rows.append([
                Paragraph(cat["name"], normal),
                Paragraph(str(cat["count"]), ParagraphStyle("c", parent=styles["Normal"], fontSize=9, alignment=TA_CENTER)),
                Paragraph(fmt_rupiah(cat["amount"]), right_bold),
                Paragraph(f"{pct:.1f}%", ParagraphStyle("p", parent=styles["Normal"], fontSize=9, textColor=GRAY, alignment=TA_RIGHT)),
            ])

        cat_table = Table(cat_rows, colWidths=["45%", "15%", "28%", "12%"])
        cat_table.setStyle(TableStyle([
            ("BACKGROUND",    (0, 0), (-1, 0), BLUE),
            ("ROWBACKGROUNDS", (0, 1), (-1, -1), [WHITE, colors.HexColor("#F5F0EA")]),
            ("GRID",          (0, 0), (-1, -1), 0.3, colors.HexColor("#E8E0D4")),
            ("TOPPADDING",    (0, 0), (-1, -1), 6),
            ("BOTTOMPADDING", (0, 0), (-1, -1), 6),
            ("LEFTPADDING",   (0, 0), (-1, -1), 8),
            ("RIGHTPADDING",  (0, 0), (-1, -1), 8),
        ]))
        story.append(cat_table)
        story.append(Spacer(1, 14))

    # ── Tagihan Belum Lunas ───────────────────────────────────
    if unpaid_bills:
        story.append(Paragraph(f"⚠ Tagihan Belum Lunas ({len(unpaid_bills)})", section_style))
        bill_rows = [[
            Paragraph("Tagihan", ParagraphStyle("h", parent=styles["Normal"], fontSize=8, fontName="Helvetica-Bold", textColor=WHITE)),
            Paragraph("Jatuh Tempo", ParagraphStyle("h", parent=styles["Normal"], fontSize=8, fontName="Helvetica-Bold", textColor=WHITE)),
            Paragraph("Nominal", ParagraphStyle("h", parent=styles["Normal"], fontSize=8, fontName="Helvetica-Bold", textColor=WHITE, alignment=TA_RIGHT)),
        ]]
        for b in unpaid_bills:
            due = b.get("due_date", "")
            try:
                due_fmt = datetime.strptime(due[:10], "%Y-%m-%d").strftime("%d %b %Y")
            except Exception:
                due_fmt = due[:10]
            bill_rows.append([
                Paragraph(b["title"], normal),
                Paragraph(due_fmt, small_gray),
                Paragraph(fmt_rupiah(b["amount"]), right_bold),
            ])

        bill_table = Table(bill_rows, colWidths=["50%", "25%", "25%"])
        bill_table.setStyle(TableStyle([
            ("BACKGROUND",    (0, 0), (-1, 0), colors.HexColor("#DC2626")),
            ("ROWBACKGROUNDS", (0, 1), (-1, -1), [WHITE, colors.HexColor("#FEF2F2")]),
            ("GRID",          (0, 0), (-1, -1), 0.3, colors.HexColor("#E8E0D4")),
            ("TOPPADDING",    (0, 0), (-1, -1), 6),
            ("BOTTOMPADDING", (0, 0), (-1, -1), 6),
            ("LEFTPADDING",   (0, 0), (-1, -1), 8),
            ("RIGHTPADDING",  (0, 0), (-1, -1), 8),
        ]))
        story.append(bill_table)
        story.append(Spacer(1, 14))

    # ── Detail Transaksi ──────────────────────────────────────
    if transactions:
        story.append(Paragraph("Detail Transaksi", section_style))
        tx_rows = [[
            Paragraph("Tanggal", ParagraphStyle("h", parent=styles["Normal"], fontSize=8, fontName="Helvetica-Bold", textColor=WHITE)),
            Paragraph("Keterangan", ParagraphStyle("h", parent=styles["Normal"], fontSize=8, fontName="Helvetica-Bold", textColor=WHITE)),
            Paragraph("Kategori", ParagraphStyle("h", parent=styles["Normal"], fontSize=8, fontName="Helvetica-Bold", textColor=WHITE)),
            Paragraph("Nominal", ParagraphStyle("h", parent=styles["Normal"], fontSize=8, fontName="Helvetica-Bold", textColor=WHITE, alignment=TA_RIGHT)),
        ]]
        for t in transactions:
            try:
                tgl = datetime.strptime(t["date"][:10], "%Y-%m-%d").strftime("%d %b")
            except Exception:
                tgl = t["date"][:10]
            nominal_color = GREEN if t["type"] == "income" else RED
            prefix = "+" if t["type"] == "income" else "-"
            tx_rows.append([
                Paragraph(tgl, small_gray),
                Paragraph(t.get("description") or "-", normal),
                Paragraph(t.get("category") or "-", small_gray),
                Paragraph(
                    f"{prefix}{fmt_rupiah(t['amount'])}",
                    ParagraphStyle("amt", parent=styles["Normal"], fontSize=9,
                                   fontName="Helvetica-Bold", textColor=nominal_color, alignment=TA_RIGHT)
                ),
            ])

        tx_table = Table(tx_rows, colWidths=["13%", "42%", "23%", "22%"])
        tx_table.setStyle(TableStyle([
            ("BACKGROUND",    (0, 0), (-1, 0), BLUE),
            ("ROWBACKGROUNDS", (0, 1), (-1, -1), [WHITE, colors.HexColor("#F5F0EA")]),
            ("GRID",          (0, 0), (-1, -1), 0.3, colors.HexColor("#E8E0D4")),
            ("TOPPADDING",    (0, 0), (-1, -1), 5),
            ("BOTTOMPADDING", (0, 0), (-1, -1), 5),
            ("LEFTPADDING",   (0, 0), (-1, -1), 6),
            ("RIGHTPADDING",  (0, 0), (-1, -1), 6),
        ]))
        story.append(tx_table)

    # ── Footer ────────────────────────────────────────────────
    story.append(Spacer(1, 16))
    story.append(HRFlowable(width="100%", thickness=0.5, color=LIGHT))
    story.append(Spacer(1, 6))
    generated = datetime.now(timezone(timedelta(hours=7))).strftime("%d %B %Y %H:%M WIB")
    story.append(Paragraph(
        f"Laporan dibuat otomatis oleh KasRT Bot · {generated}",
        ParagraphStyle("footer", parent=styles["Normal"], fontSize=7.5, textColor=GRAY, alignment=TA_CENTER)
    ))

    doc.build(story)
    buffer.seek(0)
    return buffer


async def send_monthly_report(bot, chat_id: int, workspace_name: str,
                               month: int, year: int,
                               income: int, expense: int,
                               transactions: list, category_data: list,
                               unpaid_bills: list):
    """Kirim ringkasan teks + PDF laporan ke chat Telegram."""
    balance   = income - expense
    bulan_str = f"{MONTHS_ID[month - 1]} {year}"
    sign      = "🟢" if balance >= 0 else "🔴"

    # ── Pesan teks ringkasan ──────────────────────────────────
    text = (
        f"📊 *Laporan Bulanan — {bulan_str}*\n"
        f"*{workspace_name}*\n"
        f"{'─' * 28}\n"
        f"💚 Pemasukan    : {fmt_rupiah(income)}\n"
        f"❤️  Pengeluaran : {fmt_rupiah(expense)}\n"
        f"{'─' * 28}\n"
        f"{sign} Saldo       : *{fmt_rupiah(balance)}*\n"
        f"📝 Total transaksi: {len(transactions)}\n"
    )

    if category_data:
        text += f"\n📂 *Pengeluaran per Kategori:*\n"
        for cat in category_data[:5]:
            pct = (cat["amount"] / expense * 100) if expense > 0 else 0
            text += f"  • {cat['name']}: {fmt_rupiah(cat['amount'])} ({pct:.0f}%)\n"

    if unpaid_bills:
        text += f"\n⚠️ *Tagihan Belum Lunas ({len(unpaid_bills)}):*\n"
        for b in unpaid_bills:
            due = b.get("due_date", "")[:10]
            text += f"  • {b['title']}: {fmt_rupiah(b['amount'])} (jatuh tempo {due[5:]})\n"
        text += "\nKetik /lunas untuk tandai yang sudah dibayar."

    text += "\n\n📄 _Laporan PDF terlampir di bawah._"

    await bot.send_message(chat_id=chat_id, text=text, parse_mode="Markdown")

    # ── Generate dan kirim PDF ────────────────────────────────
    pdf_buffer = generate_monthly_pdf(
        workspace_name=workspace_name,
        month=month, year=year,
        income=income, expense=expense,
        transactions=transactions,
        category_data=category_data,
        unpaid_bills=unpaid_bills,
    )
    filename = f"laporan-{bulan_str.lower().replace(' ', '-')}.pdf"
    await bot.send_document(
        chat_id=chat_id,
        document=pdf_buffer,
        filename=filename,
        caption=f"📄 Laporan Keuangan {bulan_str} — {workspace_name}",
    )
