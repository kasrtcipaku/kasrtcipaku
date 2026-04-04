'use client'

import { useEffect, useState, useCallback } from 'react'
import { createClient } from '@/lib/supabase/client'
import Link from 'next/link'

type Transaction = {
  id: string
  type: 'income' | 'expense'
  amount: number
  description: string
  date: string
  categories: { name: string; icon: string } | null
}

type FilterPeriod = 'today' | 'week' | 'month' | 'all'

const ACCENT   = '#7AAACE'
const ACCENT_D = '#5E96C0'
const fmt = (n: number) =>
  new Intl.NumberFormat('id-ID', { style: 'currency', currency: 'IDR', maximumFractionDigits: 0 }).format(n)

export default function TransaksiPage() {
  const [transactions, setTransactions] = useState<Transaction[]>([])
  const [loading, setLoading]           = useState(true)
  const [filter, setFilter]             = useState<FilterPeriod>('month')
  const [typeFilter, setTypeFilter]     = useState<'all' | 'income' | 'expense'>('all')
  const [search, setSearch]             = useState('')
  const [deleteId, setDeleteId]         = useState<string | null>(null)
  const [deleting, setDeleting]         = useState(false)
  const [page, setPage]                 = useState(1)
  const [newItem, setNewItem]           = useState<string | null>(null)
  const [hoveredRow, setHoveredRow]     = useState<string | null>(null)
  const [addHover, setAddHover]         = useState(false)
  const PER_PAGE = 20

  const getDateRange = (period: FilterPeriod) => {
    const now = new Date()
    if (period === 'today') {
      const d = now.toISOString().split('T')[0]
      return { from: d, to: d }
    }
    if (period === 'week') {
      const day  = now.getDay()
      const diff = now.getDate() - day + (day === 0 ? -6 : 1)
      const from = new Date(new Date(now).setDate(diff)).toISOString().split('T')[0]
      return { from, to: new Date().toISOString().split('T')[0] }
    }
    if (period === 'month') {
      const from = new Date(now.getFullYear(), now.getMonth(), 1).toISOString().split('T')[0]
      const to   = new Date(now.getFullYear(), now.getMonth() + 1, 0).toISOString().split('T')[0]
      return { from, to }
    }
    return null
  }

  const fetchTransactions = useCallback(async () => {
    setLoading(true)
    const { getWorkspaceId } = await import('@/lib/get-workspace-id')
    const { workspaceId } = await getWorkspaceId()
    if (!workspaceId) { setLoading(false); return }

    const supabase = createClient()
    let query = supabase
      .from('transactions')
      .select('id, type, amount, description, date, categories(name, icon)')
      .eq('workspace_id', workspaceId)
      .order('date', { ascending: false })

    const range = getDateRange(filter)
    if (range) query = query.gte('date', range.from).lte('date', range.to)
    if (typeFilter !== 'all') query = query.eq('type', typeFilter)
    if (search.trim()) query = query.ilike('description', `%${search}%`)

    const { data } = await query
    setTransactions((data as any[]) || [])
    setLoading(false)
    setPage(1)
  }, [filter, typeFilter, search])

  useEffect(() => { fetchTransactions() }, [fetchTransactions])

  useEffect(() => {
    const params = new URLSearchParams(window.location.search)
    const newId  = params.get('new')
    if (newId) {
      setNewItem(newId)
      setTimeout(() => setNewItem(null), 3000)
      window.history.replaceState({}, '', '/dashboard/transaksi')
    }
  }, [])

  const handleDelete = async () => {
    if (!deleteId) return
    setDeleting(true)
    const supabase = createClient()
    await supabase.from('transactions').delete().eq('id', deleteId)
    setDeleteId(null)
    setDeleting(false)
    fetchTransactions()
  }

  const totalIncome  = transactions.filter(t => t.type === 'income').reduce((s, t) => s + t.amount, 0)
  const totalExpense = transactions.filter(t => t.type === 'expense').reduce((s, t) => s + t.amount, 0)
  const saldo        = totalIncome - totalExpense
  const incomeCount  = transactions.filter(t => t.type === 'income').length
  const expenseCount = transactions.filter(t => t.type === 'expense').length

  const paginated  = transactions.slice((page - 1) * PER_PAGE, page * PER_PAGE)
  const totalPages = Math.ceil(transactions.length / PER_PAGE)

  const filterLabels: Record<FilterPeriod, string> = {
    today: 'Hari ini', week: 'Minggu ini', month: 'Bulan ini', all: 'Semua',
  }

  const card = {
    background: '#fff',
    border: '1px solid #E8E0D4',
    borderRadius: 12,
  } as const

  // Pill style helper
  const pillStyle = (active: boolean, variant?: 'income' | 'expense' | 'accent') => ({
    padding: '5px 12px',
    borderRadius: 7,
    fontSize: 11.5,
    fontWeight: 500,
    border: 'none',
    cursor: 'pointer',
    fontFamily: 'inherit',
    transition: 'background 0.12s',
    background: active
      ? variant === 'income' ? '#F0FDF4'
        : variant === 'expense' ? '#FEF2F2'
        : ACCENT
      : '#F5F0EA',
    color: active
      ? variant === 'income' ? '#15803D'
        : variant === 'expense' ? '#DC2626'
        : '#fff'
      : '#6B6860',
    ...(active && variant === 'income' ? { border: '1px solid #BBF7D0' } : {}),
    ...(active && variant === 'expense' ? { border: '1px solid #FECACA' } : {}),
  } as React.CSSProperties)

  return (
    <div style={{ maxWidth: 860, margin: '0 auto', fontFamily: 'DM Sans, system-ui, sans-serif' }}>
      <style>{`
        @import url('https://fonts.googleapis.com/css2?family=DM+Sans:wght@400;500;600&display=swap');
        @keyframes kasrt-slideIn {
          from { opacity: 0; transform: translateY(-8px); }
          to   { opacity: 1; transform: translateY(0); }
        }
        @keyframes kasrt-bounceIn {
          0%   { opacity: 0; transform: scale(0.8); }
          60%  { opacity: 1; transform: scale(1.04); }
          100% { transform: scale(1); }
        }
        @keyframes kasrt-shimmer {
          0%   { background-position: -200% 0; }
          100% { background-position:  200% 0; }
        }
        .kasrt-row-new {
          animation: kasrt-bounceIn 0.4s cubic-bezier(0.34,1.56,0.64,1) forwards;
          outline: 2px solid ${ACCENT};
          outline-offset: -2px;
        }
        .kasrt-row-enter { animation: kasrt-slideIn 0.25s ease forwards; }
        .kasrt-skeleton {
          background: linear-gradient(90deg,#ede9e0 25%,#d8d3c9 50%,#ede9e0 75%);
          background-size: 200% 100%;
          animation: kasrt-shimmer 1.4s infinite;
          border-radius: 6px;
        }
        .kasrt-modal-in { animation: kasrt-bounceIn 0.3s cubic-bezier(0.34,1.56,0.64,1); }
        .kasrt-search:focus { outline: none; border-color: ${ACCENT}; box-shadow: 0 0 0 3px rgba(122,170,206,0.18); }
        .kasrt-page-btn:hover:not(:disabled) { background: #F5F0EA; }
      `}</style>

      {/* Header */}
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 18 }}>
        <div>
          <h2 style={{ fontSize: 22, fontWeight: 600, color: '#1A1A18', letterSpacing: '-0.4px', margin: 0 }}>Transaksi</h2>
          <p style={{ fontSize: 12, color: '#8B7E6E', marginTop: 3 }}>
            {loading ? 'Memuat...' : `${transactions.length} transaksi ditemukan`}
          </p>
        </div>
        <Link
          href="/dashboard/transaksi/baru"
          onMouseEnter={() => setAddHover(true)}
          onMouseLeave={() => setAddHover(false)}
          style={{
            display: 'flex', alignItems: 'center', gap: 6,
            padding: '8px 16px', background: addHover ? ACCENT_D : ACCENT,
            color: '#fff', border: 'none', borderRadius: 9,
            fontSize: 12.5, fontWeight: 500, cursor: 'pointer',
            fontFamily: 'inherit', textDecoration: 'none',
            transition: 'background 0.12s',
          }}
        >
          <svg width="12" height="12" viewBox="0 0 12 12" fill="none">
            <path d="M6 1v10M1 6h10" stroke="#fff" strokeWidth="1.8" strokeLinecap="round"/>
          </svg>
          Tambah
        </Link>
      </div>

      {/* Stat cards */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3,1fr)', gap: 10, marginBottom: 14 }}>
        {[
          { label: 'Pemasukan',     value: totalIncome,  color: '#15803D', badge: `${incomeCount} transaksi`,  badgeBg: '#F0FDF4', badgeColor: '#15803D' },
          { label: 'Pengeluaran',   value: totalExpense, color: '#DC2626', badge: `${expenseCount} transaksi`, badgeBg: '#FEF2F2', badgeColor: '#DC2626' },
          { label: 'Saldo Periode', value: saldo,        color: saldo >= 0 ? '#15803D' : '#DC2626',
            badge: saldo >= 0 ? '↑ Surplus' : '↓ Defisit',
            badgeBg: saldo >= 0 ? '#F0FDF4' : '#FEF2F2',
            badgeColor: saldo >= 0 ? '#15803D' : '#DC2626' },
        ].map((c) => (
          <div key={c.label} style={{ ...card, padding: '14px 16px' }}>
            <div style={{ fontSize: 11, fontWeight: 500, color: '#8B7E6E', marginBottom: 5 }}>{c.label}</div>
            <div style={{ fontSize: 19, fontWeight: 600, color: c.color, letterSpacing: '-0.3px' }}>{fmt(c.value)}</div>
            <span style={{ display: 'inline-block', marginTop: 7, fontSize: 10, fontWeight: 500, padding: '2px 8px', borderRadius: 99, background: c.badgeBg, color: c.badgeColor }}>
              {c.badge}
            </span>
          </div>
        ))}
      </div>

      {/* Filters */}
      <div style={{ ...card, padding: '14px 16px', marginBottom: 12 }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 7, marginBottom: 10, flexWrap: 'wrap' }}>
          {(Object.entries(filterLabels) as [FilterPeriod, string][]).map(([key, label]) => (
            <button key={key} onClick={() => setFilter(key)} style={pillStyle(filter === key)}>
              {label}
            </button>
          ))}
          <div style={{ marginLeft: 'auto', display: 'flex', gap: 6 }}>
            <button onClick={() => setTypeFilter('all')}     style={pillStyle(typeFilter === 'all')}>Semua</button>
            <button onClick={() => setTypeFilter('income')}  style={pillStyle(typeFilter === 'income',  'income')}>↑ Masuk</button>
            <button onClick={() => setTypeFilter('expense')} style={pillStyle(typeFilter === 'expense', 'expense')}>↓ Keluar</button>
          </div>
        </div>
        <div style={{ position: 'relative' }}>
          <svg width="13" height="13" viewBox="0 0 16 16" fill="none" style={{ position: 'absolute', left: 11, top: '50%', transform: 'translateY(-50%)', pointerEvents: 'none' }}>
            <circle cx="7" cy="7" r="4.5" stroke="#9C9082" strokeWidth="1.5"/>
            <path d="M10.5 10.5L13 13" stroke="#9C9082" strokeWidth="1.5" strokeLinecap="round"/>
          </svg>
          <input
            type="text"
            value={search}
            onChange={e => setSearch(e.target.value)}
            placeholder="Cari deskripsi transaksi..."
            className="kasrt-search"
            style={{
              width: '100%', padding: '8px 12px 8px 32px',
              border: '1px solid #E0D9CE', borderRadius: 8,
              fontSize: 12.5, color: '#1A1A18', background: '#FAFAF8',
              fontFamily: 'inherit', transition: 'border-color 0.15s, box-shadow 0.15s',
            }}
          />
        </div>
      </div>

      {/* Table */}
      <div style={{ ...card, overflow: 'hidden' }}>
        {/* Table header */}
        <div style={{ display: 'grid', gridTemplateColumns: '2fr 120px 140px 72px', padding: '10px 18px', borderBottom: '1px solid #F2EDE5', background: '#FAFAF8' }}>
          {['Transaksi', 'Tanggal', 'Jumlah', 'Aksi'].map((h, i) => (
            <div key={h} style={{ fontSize: 10.5, fontWeight: 600, color: '#8B7E6E', textTransform: 'uppercase', letterSpacing: '0.06em', textAlign: i >= 2 ? 'right' : 'left' }}>
              {h}
            </div>
          ))}
        </div>

        {loading ? (
          <div style={{ padding: '16px 18px' }}>
            {[...Array(5)].map((_, i) => (
              <div key={i} style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 14 }}>
                <div className="kasrt-skeleton" style={{ width: 32, height: 32, borderRadius: 9, flexShrink: 0 }} />
                <div style={{ flex: 1 }}>
                  <div className="kasrt-skeleton" style={{ height: 13, width: '45%', marginBottom: 6 }} />
                  <div className="kasrt-skeleton" style={{ height: 11, width: '28%' }} />
                </div>
                <div className="kasrt-skeleton" style={{ height: 13, width: 90 }} />
              </div>
            ))}
          </div>
        ) : paginated.length === 0 ? (
          <div style={{ textAlign: 'center', padding: '56px 20px' }}>
            <div style={{ fontSize: 36, marginBottom: 10 }}>💸</div>
            <p style={{ fontSize: 13, color: '#8B7E6E', marginBottom: 14 }}>Belum ada transaksi ditemukan</p>
            <Link
              href="/dashboard/transaksi/baru"
              style={{ display: 'inline-block', fontSize: 12, fontWeight: 500, color: '#fff', padding: '7px 16px', borderRadius: 8, background: ACCENT, textDecoration: 'none' }}
            >
              + Tambah Transaksi
            </Link>
          </div>
        ) : (
          <div>
            {paginated.map((t, i) => {
              const hovered = hoveredRow === t.id
              const isNew   = t.id === newItem
              return (
                <div
                  key={t.id}
                  className={isNew ? 'kasrt-row-new' : 'kasrt-row-enter'}
                  onMouseEnter={() => setHoveredRow(t.id)}
                  onMouseLeave={() => setHoveredRow(null)}
                  style={{
                    display: 'grid',
                    gridTemplateColumns: '2fr 120px 140px 72px',
                    alignItems: 'center',
                    padding: '11px 18px',
                    borderBottom: i < paginated.length - 1 ? '1px solid #F5F1EC' : 'none',
                    background: hovered ? '#FAFAF8' : '#fff',
                    transition: 'background 0.1s',
                    animationDelay: isNew ? '0s' : `${i * 0.025}s`,
                  }}
                >
                  {/* Transaksi */}
                  <div style={{ display: 'flex', alignItems: 'center', gap: 10, minWidth: 0 }}>
                    <div style={{
                      width: 32, height: 32, borderRadius: 9, flexShrink: 0,
                      background: t.type === 'income' ? '#F0FDF4' : '#FEF2F2',
                      display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 15,
                    }}>
                      {t.categories?.icon || (t.type === 'income' ? '💰' : '💸')}
                    </div>
                    <div style={{ minWidth: 0 }}>
                      <div style={{ fontSize: 12.5, fontWeight: 500, color: '#1A1A18', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                        {t.description || t.categories?.name || '-'}
                      </div>
                      <div style={{ fontSize: 10.5, color: '#8B7E6E', marginTop: 2 }}>
                        {t.type === 'income' ? 'Pemasukan' : 'Pengeluaran'}
                        {t.categories?.name && (
                          <span style={{ marginLeft: 5, display: 'inline-block', fontSize: 10, padding: '1px 6px', borderRadius: 99, background: '#F5F0EA', color: '#6B6860' }}>
                            {t.categories.name}
                          </span>
                        )}
                      </div>
                    </div>
                  </div>

                  {/* Tanggal */}
                  <div style={{ fontSize: 12, color: '#8B7E6E' }}>
                    {new Date(t.date).toLocaleDateString('id-ID', { weekday: 'short', day: 'numeric', month: 'short' })}
                  </div>

                  {/* Jumlah */}
                  <div style={{ fontSize: 12.5, fontWeight: 600, color: t.type === 'income' ? '#15803D' : '#DC2626', textAlign: 'right', fontVariantNumeric: 'tabular-nums' }}>
                    {t.type === 'income' ? '+' : '−'}{fmt(t.amount)}
                  </div>

                  {/* Aksi */}
                  <div style={{ display: 'flex', gap: 3, justifyContent: 'flex-end', opacity: hovered ? 1 : 0, transition: 'opacity 0.15s' }}>
                    <Link
                      href={`/dashboard/transaksi/${t.id}/edit`}
                      title="Edit"
                      style={{ width: 28, height: 28, borderRadius: 6, display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 13, textDecoration: 'none', background: 'transparent', border: 'none', cursor: 'pointer' }}
                      onMouseEnter={e => (e.currentTarget.style.background = '#F5F0EA')}
                      onMouseLeave={e => (e.currentTarget.style.background = 'transparent')}
                    >
                      ✏️
                    </Link>
                    <button
                      onClick={() => setDeleteId(t.id)}
                      title="Hapus"
                      style={{ width: 28, height: 28, borderRadius: 6, display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 13, background: 'transparent', border: 'none', cursor: 'pointer' }}
                      onMouseEnter={e => (e.currentTarget.style.background = '#FEF2F2')}
                      onMouseLeave={e => (e.currentTarget.style.background = 'transparent')}
                    >
                      🗑️
                    </button>
                  </div>
                </div>
              )
            })}
          </div>
        )}

        {/* Pagination */}
        {totalPages > 1 && (
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '11px 18px', borderTop: '1px solid #F2EDE5', background: '#FAFAF8' }}>
            <span style={{ fontSize: 11.5, color: '#8B7E6E' }}>
              {(page - 1) * PER_PAGE + 1}–{Math.min(page * PER_PAGE, transactions.length)} dari {transactions.length} transaksi
            </span>
            <div style={{ display: 'flex', gap: 6 }}>
              {[{ label: '←', action: () => setPage(p => Math.max(1, p - 1)), disabled: page === 1 },
                { label: '→', action: () => setPage(p => Math.min(totalPages, p + 1)), disabled: page === totalPages }
              ].map(b => (
                <button
                  key={b.label}
                  onClick={b.action}
                  disabled={b.disabled}
                  className="kasrt-page-btn"
                  style={{ padding: '5px 12px', borderRadius: 7, border: '1px solid #E0D9CE', background: '#fff', fontSize: 11.5, cursor: 'pointer', fontFamily: 'inherit', color: '#3d3a35', opacity: b.disabled ? 0.35 : 1, transition: 'background 0.12s' }}
                >
                  {b.label}
                </button>
              ))}
            </div>
          </div>
        )}
      </div>

      {/* Delete modal */}
      {deleteId && (
        <div
          style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.4)', zIndex: 50, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 16 }}
          onClick={() => setDeleteId(null)}
        >
          <div
            className="kasrt-modal-in"
            onClick={e => e.stopPropagation()}
            style={{ background: '#fff', borderRadius: 16, padding: '28px 24px', width: '100%', maxWidth: 340 }}
          >
            <div style={{ textAlign: 'center', marginBottom: 16 }}>
              <div style={{ width: 48, height: 48, borderRadius: 12, background: '#FEF2F2', display: 'flex', alignItems: 'center', justifyContent: 'center', margin: '0 auto 12px', fontSize: 22 }}>🗑️</div>
              <h3 style={{ fontSize: 16, fontWeight: 600, color: '#1A1A18', margin: '0 0 6px' }}>Hapus Transaksi?</h3>
              <p style={{ fontSize: 13, color: '#8B7E6E', margin: 0 }}>Tindakan ini tidak bisa dibatalkan.</p>
            </div>
            <div style={{ display: 'flex', gap: 10, marginTop: 20 }}>
              <button
                onClick={() => setDeleteId(null)}
                style={{ flex: 1, padding: '10px', border: '1px solid #E0D9CE', background: '#fff', color: '#3d3a35', borderRadius: 10, fontSize: 13, fontWeight: 500, cursor: 'pointer', fontFamily: 'inherit' }}
              >
                Batal
              </button>
              <button
                onClick={handleDelete}
                disabled={deleting}
                style={{ flex: 1, padding: '10px', border: 'none', background: '#DC2626', color: '#fff', borderRadius: 10, fontSize: 13, fontWeight: 500, cursor: 'pointer', fontFamily: 'inherit', opacity: deleting ? 0.6 : 1 }}
              >
                {deleting ? 'Menghapus...' : 'Ya, Hapus'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}