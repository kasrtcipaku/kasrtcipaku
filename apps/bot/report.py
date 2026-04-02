# apps/bot/report.py
import os
import logging
from io import BytesIO
from datetime import datetime, timezone, timedelta
from reportlab.lib.pagesizes import A4
from reportlab.lib import colors
from reportlab.lib.units import mm
from reportlab.platypus import (
    SimpleDocTemplate, Paragraph, Spacer, Table, TableStyle,
    HRFlowable, KeepTogether
)
from reportlab.lib.styles import getSampleStyleSheet, ParagraphStyle
from reportlab.lib.enums import TA_CENTER, TA_RIGHT, TA_LEFT
from reportlab.platypus import Flowable

logger = logging.getLogger(__name__)

# ── Warna tema KasRT ─────────────────────────────────────────
BLUE        = colors.HexColor("#4A7FB5")
BLUE_LIGHT  = colors.HexColor("#EBF3FB")
DARK        = colors.HexColor("#1A1A2E")
GRAY        = colors.HexColor("#6B7280")
GRAY_LIGHT  = colors.HexColor("#F3F4F6")
GREEN       = colors.HexColor("#15803D")
GREEN_LIGHT = colors.HexColor("#DCFCE7")
RED         = colors.HexColor("#DC2626")
RED_LIGHT   = colors.HexColor("#FEE2E2")
ORANGE      = colors.HexColor("#D97706")
ORANGE_LIGHT= colors.HexColor("#FEF3C7")
WHITE       = colors.white
BORDER      = colors.HexColor("#E5E7EB")
STRIPE      = colors.HexColor("#F9FAFB")

MONTHS_ID = [
    "Januari", "Februari", "Maret", "April", "Mei", "Juni",
    "Juli", "Agustus", "September", "Oktober", "November", "Desember"
]


def fmt_rupiah(n: int) -> str:
    return f"Rp {n:,.0f}".replace(",", ".")


class ColorBar(Flowable):
    """Horizontal accent bar untuk header section."""
    def __init__(self, width, height=3, color=BLUE):
        super().__init__()
        self.bar_width  = width
        self.bar_height = height
        self.bar_color  = color

    def wrap(self, *args):
        return self.bar_width, self.bar_height + 4

    def draw(self):
        self.canv.setFillColor(self.bar_color)
        self.canv.roundRect(0, 2, self.bar_width, self.bar_height, 1.5, fill=1, stroke=0)


def _style(base, **kw):
    """Helper buat ParagraphStyle inline."""
    return ParagraphStyle("_", parent=base, **kw)


def generate_monthly_pdf(
    workspace_name: str,
    month: int,
    year: int,
    income: int,
    expense: int,
    transactions: list,
    category_data: list,
    unpaid_bills: list,
    paid_bills: list = None,
) -> BytesIO:
    """
    Generate laporan bulanan PDF, return BytesIO buffer.
    transactions : list of dict {date, description, category, type, amount}
    category_data: list of dict {name, amount, count}
    unpaid_bills : list of dict {title, amount, due_date}
    paid_bills   : list of dict {title, amount, due_date, paid_at}
    """
    paid_bills = paid_bills or []
    buffer = BytesIO()
    W, H   = A4
    doc = SimpleDocTemplate(
        buffer,
        pagesize=A4,
        leftMargin=18*mm, rightMargin=18*mm,
        topMargin=18*mm, bottomMargin=18*mm,
    )

    styles  = getSampleStyleSheet()
    base    = styles["Normal"]
    balance = income - expense
    bulan_str = f"{MONTHS_ID[month - 1]} {year}"
    usable_w  = W - 36*mm

    # ── Styles ────────────────────────────────────────────────
    s_title = _style(base, fontSize=22, fontName="Helvetica-Bold",
                     textColor=DARK, spaceAfter=1, leading=26)
    s_sub   = _style(base, fontSize=12, fontName="Helvetica",
                     textColor=GRAY, spaceAfter=2)
    s_period= _style(base, fontSize=9,  fontName="Helvetica",
                     textColor=GRAY, spaceAfter=0)
    s_sec   = _style(base, fontSize=11, fontName="Helvetica-Bold",
                     textColor=DARK, spaceBefore=4, spaceAfter=6)
    s_norm  = _style(base, fontSize=9,  fontName="Helvetica", textColor=DARK)
    s_small = _style(base, fontSize=8,  fontName="Helvetica", textColor=GRAY)
    s_bold  = _style(base, fontSize=9,  fontName="Helvetica-Bold", textColor=DARK)
    s_rb    = _style(base, fontSize=9,  fontName="Helvetica-Bold", textColor=DARK, alignment=TA_RIGHT)
    s_wh    = _style(base, fontSize=8,  fontName="Helvetica-Bold", textColor=WHITE)
    s_whc   = _style(base, fontSize=8,  fontName="Helvetica-Bold", textColor=WHITE, alignment=TA_CENTER)
    s_whr   = _style(base, fontSize=8,  fontName="Helvetica-Bold", textColor=WHITE, alignment=TA_RIGHT)
    s_footer= _style(base, fontSize=7.5,fontName="Helvetica", textColor=GRAY, alignment=TA_CENTER)

    story = []

    # ════════════════════════════════════════════════════════
    # HEADER
    # ════════════════════════════════════════════════════════
    header_data = [[
        Paragraph("Laporan Keuangan", s_title),
        Paragraph(
            datetime.now(timezone(timedelta(hours=7))).strftime("%d %b %Y"),
            _style(base, fontSize=9, fontName="Helvetica", textColor=GRAY, alignment=TA_RIGHT)
        ),
    ]]
    header_tbl = Table(header_data, colWidths=[usable_w * 0.7, usable_w * 0.3])
    header_tbl.setStyle(TableStyle([
        ("VALIGN",        (0,0), (-1,-1), "BOTTOM"),
        ("TOPPADDING",    (0,0), (-1,-1), 0),
        ("BOTTOMPADDING", (0,0), (-1,-1), 0),
    ]))
    story.append(header_tbl)
    story.append(Paragraph(workspace_name, s_sub))
    story.append(Paragraph(f"Periode: {bulan_str}", s_period))
    story.append(Spacer(1, 6))
    story.append(ColorBar(usable_w, height=4, color=BLUE))
    story.append(Spacer(1, 14))

    # ════════════════════════════════════════════════════════
    # RINGKASAN 3 KOTAK
    # ════════════════════════════════════════════════════════
    def summary_cell(label, value, val_color, bg_color):
        inner = Table(
            [[Paragraph(label, _style(base, fontSize=7.5, fontName="Helvetica", textColor=GRAY))],
             [Paragraph(value, _style(base, fontSize=14, fontName="Helvetica-Bold",
                                      textColor=val_color, leading=17))]],
            colWidths=["100%"]
        )
        inner.setStyle(TableStyle([
            ("TOPPADDING",    (0,0), (-1,-1), 0),
            ("BOTTOMPADDING", (0,0), (-1,-1), 0),
            ("LEFTPADDING",   (0,0), (-1,-1), 0),
            ("RIGHTPADDING",  (0,0), (-1,-1), 0),
        ]))
        outer = Table([[inner]], colWidths=["100%"])
        outer.setStyle(TableStyle([
            ("BACKGROUND",    (0,0), (-1,-1), bg_color),
            ("BOX",           (0,0), (-1,-1), 0.5, BORDER),
            ("TOPPADDING",    (0,0), (-1,-1), 10),
            ("BOTTOMPADDING", (0,0), (-1,-1), 12),
            ("LEFTPADDING",   (0,0), (-1,-1), 12),
            ("RIGHTPADDING",  (0,0), (-1,-1), 12),
        ]))
        return outer

    bal_color = GREEN if balance >= 0 else RED
    bal_bg    = GREEN_LIGHT if balance >= 0 else RED_LIGHT

    gap = 4
    cw  = (usable_w - gap * 2) / 3
    summary_row = Table([[
        summary_cell("PEMASUKAN",   fmt_rupiah(income),   GREEN, GREEN_LIGHT),
        summary_cell("PENGELUARAN", fmt_rupiah(expense),  RED,   RED_LIGHT),
        summary_cell("SALDO",       fmt_rupiah(balance),  bal_color, bal_bg),
    ]], colWidths=[cw, cw, cw])
    summary_row.setStyle(TableStyle([
        ("TOPPADDING",    (0,0), (-1,-1), 0),
        ("BOTTOMPADDING", (0,0), (-1,-1), 0),
        ("LEFTPADDING",   (0,0), (-1,-1), 0),
        ("RIGHTPADDING",  (0,0), (-1,-1), gap/2),
        ("LEFTPADDING",   (1,0), (1,0),   gap/2),
        ("RIGHTPADDING",  (1,0), (1,0),   gap/2),
        ("LEFTPADDING",   (2,0), (2,0),   gap/2),
        ("RIGHTPADDING",  (2,0), (2,0),   0),
    ]))
    story.append(summary_row)
    story.append(Spacer(1, 18))

    # ════════════════════════════════════════════════════════
    # PENGELUARAN PER KATEGORI
    # ════════════════════════════════════════════════════════
    if category_data:
        story.append(KeepTogether([
            ColorBar(usable_w * 0.35, height=3, color=BLUE),
            Spacer(1, 4),
            Paragraph("Pengeluaran per Kategori", s_sec),
        ]))
        cat_rows = [[
            Paragraph("Kategori",  s_wh),
            Paragraph("Transaksi", s_whc),
            Paragraph("Total",     s_whr),
            Paragraph("%",         s_whr),
        ]]
        for i, cat in enumerate(category_data):
            pct = (cat["amount"] / expense * 100) if expense > 0 else 0
            cat_rows.append([
                Paragraph(cat["name"], s_norm),
                Paragraph(str(cat["count"]), _style(base, fontSize=9, alignment=TA_CENTER, textColor=GRAY)),
                Paragraph(fmt_rupiah(cat["amount"]), s_rb),
                Paragraph(f"{pct:.1f}%", _style(base, fontSize=9, textColor=GRAY, alignment=TA_RIGHT)),
            ])

        cat_tbl = Table(cat_rows, colWidths=[usable_w*0.44, usable_w*0.14, usable_w*0.28, usable_w*0.14])
        cat_tbl.setStyle(TableStyle([
            ("BACKGROUND",     (0,0), (-1,0), BLUE),
            ("ROWBACKGROUNDS", (0,1), (-1,-1), [WHITE, STRIPE]),
            ("LINEBELOW",      (0,0), (-1,-2), 0.25, BORDER),
            ("LINEBELOW",      (0,-1),(-1,-1), 0.5,  BORDER),
            ("TOPPADDING",     (0,0), (-1,-1), 7),
            ("BOTTOMPADDING",  (0,0), (-1,-1), 7),
            ("LEFTPADDING",    (0,0), (-1,-1), 9),
            ("RIGHTPADDING",   (0,0), (-1,-1), 9),
        ]))
        story.append(cat_tbl)
        story.append(Spacer(1, 16))

    # ════════════════════════════════════════════════════════
    # TAGIHAN BELUM LUNAS
    # ════════════════════════════════════════════════════════
    if unpaid_bills:
        story.append(KeepTogether([
            ColorBar(usable_w * 0.35, height=3, color=RED),
            Spacer(1, 4),
            Paragraph(f"Tagihan Belum Lunas ({len(unpaid_bills)})", s_sec),
        ]))
        bill_rows = [[
            Paragraph("Tagihan",    s_wh),
            Paragraph("Jatuh Tempo",s_whc),
            Paragraph("Nominal",    s_whr),
        ]]
        for i, b in enumerate(unpaid_bills):
            due = b.get("due_date", "")
            try:
                due_fmt = datetime.strptime(due[:10], "%Y-%m-%d").strftime("%d %b %Y")
            except Exception:
                due_fmt = due[:10]
            bill_rows.append([
                Paragraph(b["title"], s_bold),
                Paragraph(due_fmt, _style(base, fontSize=9, textColor=ORANGE, alignment=TA_CENTER)),
                Paragraph(fmt_rupiah(b["amount"]),
                          _style(base, fontSize=9, fontName="Helvetica-Bold", textColor=RED, alignment=TA_RIGHT)),
            ])

        bill_tbl = Table(bill_rows, colWidths=[usable_w*0.52, usable_w*0.24, usable_w*0.24])
        bill_tbl.setStyle(TableStyle([
            ("BACKGROUND",     (0,0), (-1,0), RED),
            ("ROWBACKGROUNDS", (0,1), (-1,-1), [WHITE, RED_LIGHT]),
            ("LINEBELOW",      (0,0), (-1,-2), 0.25, BORDER),
            ("LINEBELOW",      (0,-1),(-1,-1), 0.5,  BORDER),
            ("TOPPADDING",     (0,0), (-1,-1), 7),
            ("BOTTOMPADDING",  (0,0), (-1,-1), 7),
            ("LEFTPADDING",    (0,0), (-1,-1), 9),
            ("RIGHTPADDING",   (0,0), (-1,-1), 9),
        ]))
        story.append(bill_tbl)
        story.append(Spacer(1, 16))

    # ════════════════════════════════════════════════════════
    # TAGIHAN SUDAH LUNAS
    # ════════════════════════════════════════════════════════
    if paid_bills:
        story.append(KeepTogether([
            ColorBar(usable_w * 0.35, height=3, color=GREEN),
            Spacer(1, 4),
            Paragraph(f"Tagihan Sudah Lunas ({len(paid_bills)})", s_sec),
        ]))
        paid_rows = [[
            Paragraph("Tagihan",    s_wh),
            Paragraph("Jatuh Tempo",s_whc),
            Paragraph("Tgl Bayar",  s_whc),
            Paragraph("Nominal",    s_whr),
        ]]
        for i, b in enumerate(paid_bills):
            due = b.get("due_date", "")
            try:
                due_fmt = datetime.strptime(due[:10], "%Y-%m-%d").strftime("%d %b %Y")
            except Exception:
                due_fmt = due[:10]
            paid_at = b.get("paid_at", "")
            try:
                paid_fmt = datetime.strptime(paid_at[:10], "%Y-%m-%d").strftime("%d %b %Y")
            except Exception:
                paid_fmt = paid_at[:10]
            paid_rows.append([
                Paragraph(b["title"], s_bold),
                Paragraph(due_fmt,  _style(base, fontSize=9, textColor=GRAY,  alignment=TA_CENTER)),
                Paragraph(paid_fmt, _style(base, fontSize=9, textColor=GREEN, alignment=TA_CENTER)),
                Paragraph(fmt_rupiah(b["amount"]),
                          _style(base, fontSize=9, fontName="Helvetica-Bold", textColor=GREEN, alignment=TA_RIGHT)),
            ])

        paid_tbl = Table(paid_rows, colWidths=[usable_w*0.40, usable_w*0.20, usable_w*0.20, usable_w*0.20])
        paid_tbl.setStyle(TableStyle([
            ("BACKGROUND",     (0,0), (-1,0), GREEN),
            ("ROWBACKGROUNDS", (0,1), (-1,-1), [WHITE, GREEN_LIGHT]),
            ("LINEBELOW",      (0,0), (-1,-2), 0.25, BORDER),
            ("LINEBELOW",      (0,-1),(-1,-1), 0.5,  BORDER),
            ("TOPPADDING",     (0,0), (-1,-1), 7),
            ("BOTTOMPADDING",  (0,0), (-1,-1), 7),
            ("LEFTPADDING",    (0,0), (-1,-1), 9),
            ("RIGHTPADDING",   (0,0), (-1,-1), 9),
        ]))
        story.append(paid_tbl)
        story.append(Spacer(1, 16))

    # ════════════════════════════════════════════════════════
    # DETAIL TRANSAKSI
    # ════════════════════════════════════════════════════════
    if transactions:
        story.append(KeepTogether([
            ColorBar(usable_w * 0.35, height=3, color=BLUE),
            Spacer(1, 4),
            Paragraph(f"Detail Transaksi ({len(transactions)})", s_sec),
        ]))
        tx_rows = [[
            Paragraph("Tanggal",    s_wh),
            Paragraph("Keterangan", s_wh),
            Paragraph("Kategori",   s_wh),
            Paragraph("Nominal",    s_whr),
        ]]
        for i, t in enumerate(transactions):
            try:
                tgl = datetime.strptime(t["date"][:10], "%Y-%m-%d").strftime("%d %b")
            except Exception:
                tgl = t["date"][:10]
            is_income = t["type"] == "income"
            amt_color = GREEN if is_income else RED
            prefix    = "+" if is_income else "-"
            tx_rows.append([
                Paragraph(tgl, s_small),
                Paragraph(t.get("description") or "-", s_norm),
                Paragraph(t.get("category") or "-", s_small),
                Paragraph(
                    f"{prefix}{fmt_rupiah(t['amount'])}",
                    _style(base, fontSize=9, fontName="Helvetica-Bold",
                           textColor=amt_color, alignment=TA_RIGHT)
                ),
            ])

        tx_tbl = Table(tx_rows, colWidths=[usable_w*0.12, usable_w*0.42, usable_w*0.22, usable_w*0.24])
        tx_tbl.setStyle(TableStyle([
            ("BACKGROUND",     (0,0), (-1,0), BLUE),
            ("ROWBACKGROUNDS", (0,1), (-1,-1), [WHITE, STRIPE]),
            ("LINEBELOW",      (0,0), (-1,-2), 0.25, BORDER),
            ("LINEBELOW",      (0,-1),(-1,-1), 0.5,  BORDER),
            ("TOPPADDING",     (0,0), (-1,-1), 6),
            ("BOTTOMPADDING",  (0,0), (-1,-1), 6),
            ("LEFTPADDING",    (0,0), (-1,-1), 8),
            ("RIGHTPADDING",   (0,0), (-1,-1), 8),
        ]))
        story.append(tx_tbl)

    # ════════════════════════════════════════════════════════
    # FOOTER
    # ════════════════════════════════════════════════════════
    story.append(Spacer(1, 20))
    story.append(HRFlowable(width="100%", thickness=0.5, color=BORDER))
    story.append(Spacer(1, 6))
    generated = datetime.now(timezone(timedelta(hours=7))).strftime("%d %B %Y %H:%M WIB")
    story.append(Paragraph(
        f"Laporan dibuat otomatis oleh KasRT Bot  ·  {generated}",
        s_footer
    ))

    doc.build(story)
    buffer.seek(0)
    return buffer


async def send_monthly_report(bot, chat_id: int, workspace_name: str,
                               month: int, year: int,
                               income: int, expense: int,
                               transactions: list, category_data: list,
                               unpaid_bills: list, paid_bills: list = None):
    """Kirim ringkasan teks + PDF laporan ke chat Telegram."""
    paid_bills = paid_bills or []
    balance    = income - expense
    bulan_str  = f"{MONTHS_ID[month - 1]} {year}"
    sign       = "🟢" if balance >= 0 else "🔴"

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

    if paid_bills:
        text += f"\n✅ *Tagihan Sudah Lunas ({len(paid_bills)}):*\n"
        for b in paid_bills:
            text += f"  • {b['title']}: {fmt_rupiah(b['amount'])}\n"

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
        paid_bills=paid_bills,
    )
    filename = f"laporan-{bulan_str.lower().replace(' ', '-')}.pdf"
    await bot.send_document(
        chat_id=chat_id,
        document=pdf_buffer,
        filename=filename,
        caption=f"📄 Laporan Keuangan {bulan_str} — {workspace_name}",
    )