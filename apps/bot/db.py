# apps/bot/db.py
import os
from supabase import create_client, Client

_client: Client | None = None

def get_db() -> Client:
    global _client
    if _client is None:
        url = os.environ["SUPABASE_URL"]
        key = os.environ["SUPABASE_SERVICE_ROLE_KEY"]
        _client = create_client(url, key)
    return _client

# ── User & workspace ──────────────────────────────────────────

def get_workspace_by_telegram(telegram_id: int) -> dict | None:
    """Cari workspace berdasarkan telegram_chat_id."""
    db = get_db()
    res = (
        db.table("telegram_links")
        .select("workspace_id, user_id, workspaces(id, name, type)")
        .eq("telegram_chat_id", telegram_id)
        .limit(1)
        .execute()
    )
    if res.data:
        return res.data[0]
    return None

def get_categories(workspace_id: str) -> list:
    """Ambil semua kategori workspace."""
    db = get_db()
    res = (
        db.table("categories")
        .select("id, name, icon, type")
        .eq("workspace_id", workspace_id)
        .execute()
    )
    return res.data or []

def insert_transaction(workspace_id: str, user_id: str, payload: dict) -> dict:
    """Insert transaksi baru dari Telegram."""
    db = get_db()
    data = {
        "workspace_id": workspace_id,
        "type":         payload["type"],
        "amount":       int(payload["amount"]),
        "description":  payload.get("description", ""),
        "date":         payload.get("date", None) or _today(),
        "source":       "telegram",
        "created_by":   user_id,
    }
    # Cari category_id berdasarkan nama
    if payload.get("category"):
        cats = get_categories(workspace_id)
        match = next(
            (c for c in cats if c["name"].lower() == payload["category"].lower()),
            None
        )
        if match:
            data["category_id"] = match["id"]

    res = db.table("transactions").insert(data).execute()
    return res.data[0] if res.data else {}

def get_monthly_summary(workspace_id: str) -> dict:
    """Ambil ringkasan bulan ini."""
    db  = get_db()
    now = _today()
    y, m = now[:4], now[5:7]
    first = f"{y}-{m}-01"
    import calendar
    last_day = calendar.monthrange(int(y), int(m))[1]
    last  = f"{y}-{m}-{last_day:02d}"

    res = (
        db.table("transactions")
        .select("type, amount")
        .eq("workspace_id", workspace_id)
        .gte("date", first)
        .lte("date", last)
        .execute()
    )
    rows = res.data or []
    income  = sum(r["amount"] for r in rows if r["type"] == "income")
    expense = sum(r["amount"] for r in rows if r["type"] == "expense")
    return {
        "income":  income,
        "expense": expense,
        "balance": income - expense,
        "month":   f"{m}/{y}",
        "count":   len(rows),
    }

def get_unpaid_bills(workspace_id: str) -> list:
    """Ambil tagihan belum dibayar."""
    db = get_db()
    res = (
        db.table("bills")
        .select("id, title, amount, due_date")
        .eq("workspace_id", workspace_id)
        .eq("status", "unpaid")
        .order("due_date")
        .limit(5)
        .execute()
    )
    return res.data or []

def get_all_telegram_links() -> list:
    """Ambil semua workspace yang punya Telegram link."""
    db = get_db()
    res = (
        db.table("telegram_links")
        .select("telegram_chat_id, workspace_id, user_id, workspaces(id, name)")
        .execute()
    )
    return res.data or []

def get_monthly_report_data(workspace_id: str, month: int, year: int) -> dict:
    """
    Ambil data lengkap untuk laporan bulanan.
    Return: {income, expense, transactions, category_data, unpaid_bills}
    """
    import calendar
    db    = get_db()
    first = f"{year}-{month:02d}-01"
    last  = f"{year}-{month:02d}-{calendar.monthrange(year, month)[1]:02d}"

    # Transaksi bulan tsb
    res = (
        db.table("transactions")
        .select("id, type, amount, date, description, categories(name)")
        .eq("workspace_id", workspace_id)
        .gte("date", first)
        .lte("date", last)
        .order("date", desc=False)
        .execute()
    )
    rows = res.data or []

    income  = sum(r["amount"] for r in rows if r["type"] == "income")
    expense = sum(r["amount"] for r in rows if r["type"] == "expense")

    # Format transaksi untuk PDF
    transactions = [
        {
            "date":        r["date"],
            "description": r.get("description") or "-",
            "category":    r["categories"]["name"] if r.get("categories") else "-",
            "type":        r["type"],
            "amount":      r["amount"],
        }
        for r in rows
    ]

    # Kategori pengeluaran
    cat_map: dict = {}
    for r in rows:
        if r["type"] != "expense":
            continue
        key = r["categories"]["name"] if r.get("categories") else "Lainnya"
        if key not in cat_map:
            cat_map[key] = {"name": key, "amount": 0, "count": 0}
        cat_map[key]["amount"] += r["amount"]
        cat_map[key]["count"]  += 1
    category_data = sorted(cat_map.values(), key=lambda x: x["amount"], reverse=True)

    # Tagihan belum lunas
    unpaid_bills = get_unpaid_bills(workspace_id)

    # Tagihan sudah lunas bulan tsb
    res_paid = (
        db.table("bills")
        .select("id, title, amount, due_date, paid_at")
        .eq("workspace_id", workspace_id)
        .eq("status", "paid")
        .gte("paid_at", first + "T00:00:00")
        .lte("paid_at", last + "T23:59:59")
        .order("paid_at")
        .execute()
    )
    paid_bills = res_paid.data or []

    return {
        "income":        income,
        "expense":       expense,
        "transactions":  transactions,
        "category_data": category_data,
        "unpaid_bills":  unpaid_bills,
        "paid_bills":    paid_bills,
    }

def mark_bill_paid(bill_id: str):
    """Tandai tagihan sebagai lunas."""
    from datetime import datetime, timezone
    db = get_db()
    res = db.table("bills").update({
        "status":  "paid",
        "paid_at": datetime.now(timezone.utc).isoformat()
    }).eq("id", bill_id).execute()

    # Cek apakah update benar-benar kena
    if not res.data:
        raise Exception(f"Bill {bill_id} tidak ditemukan atau tidak bisa diupdate")

def disconnect_telegram(telegram_chat_id: int):
    """Putuskan koneksi bot dari workspace."""
    db = get_db()
    db.table("telegram_links").delete().eq("telegram_chat_id", telegram_chat_id).execute()

def save_telegram_link(telegram_id: int, workspace_id: str, user_id: str):
    """Simpan link telegram ↔ workspace."""
    db = get_db()
    db.table("telegram_links").upsert({
        "telegram_chat_id": telegram_id,
        "workspace_id":     workspace_id,
        "user_id":          user_id,
    }).execute()

def get_connect_code(code: str) -> dict | None:
    """Cari pending connect code dari tabel connect_codes."""
    db = get_db()
    res = (
        db.table("connect_codes")
        .select("*")
        .eq("code", code)
        .gt("expires_at", _now_iso())
        .limit(1)
        .execute()
    )
    if res.data:
        return res.data[0]
    return None

def delete_connect_code(code: str):
    db = get_db()
    db.table("connect_codes").delete().eq("code", code).execute()

# ── Helpers ───────────────────────────────────────────────────

def _today() -> str:
    from datetime import date
    return date.today().isoformat()

def _now_iso() -> str:
    from datetime import datetime, timezone
    return datetime.now(timezone.utc).isoformat()

def fmt_rupiah(n: int) -> str:
    return f"Rp {n:,.0f}".replace(",", ".")

# ── Anggota (member_session via kode unik) ────────────────────

def get_member_by_code(member_code: str) -> dict | None:
    """Cari anggota berdasarkan kode unik."""
    db = get_db()
    res = (
        db.table("workspace_members")
        .select("id, role, display_name, workspace_id, member_code, workspaces(id, name)")
        .eq("member_code", member_code.strip().upper())
        .limit(1)
        .execute()
    )
    if res.data:
        return res.data[0]
    return None

def get_telegram_member_link(telegram_id: int) -> dict | None:
    """Cari link anggota berdasarkan telegram_chat_id."""
    db = get_db()
    res = (
        db.table("telegram_member_links")
        .select("workspace_member_id, telegram_chat_id, workspace_members(id, role, display_name, workspace_id, workspaces(id, name))")
        .eq("telegram_chat_id", telegram_id)
        .limit(1)
        .execute()
    )
    if res.data:
        return res.data[0]
    return None

def save_telegram_member_link(telegram_id: int, workspace_member_id: str):
    """Simpan link telegram ↔ anggota."""
    db = get_db()
    db.table("telegram_member_links").upsert({
        "telegram_chat_id":    telegram_id,
        "workspace_member_id": workspace_member_id,
    }).execute()

def disconnect_telegram_member(telegram_id: int):
    """Putuskan koneksi anggota dari Telegram."""
    db = get_db()
    db.table("telegram_member_links").delete().eq("telegram_chat_id", telegram_id).execute()