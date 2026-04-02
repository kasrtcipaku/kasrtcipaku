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