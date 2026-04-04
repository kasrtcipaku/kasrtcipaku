'use client'

import { useEffect, useRef, useState } from 'react'
import { createClient } from '@/lib/supabase/client'

/* ── Types ── */
type Bill = {
  id: string
  title: string
  amount: number
  due_date: string
  status: 'unpaid' | 'paid'
  frequency: 'once' | 'monthly' | 'weekly'
}

/* ── Helpers ── */
const SB = '#7AAACE'
const SB_DRK = '#5E96C0'

const fmt = (n: number) =>
  new Intl.NumberFormat('id-ID', { style: 'currency', currency: 'IDR', maximumFractionDigits: 0 }).format(n)

const daysUntil = (dateStr: string) => {
  const today = new Date(); today.setHours(0, 0, 0, 0)
  const due   = new Date(dateStr); due.setHours(0, 0, 0, 0)
  return Math.ceil((due.getTime() - today.getTime()) / 86400000)
}

const urgency = (days: number) => {
  if (days < 0)  return { rowBg: '#FEF2F2', rowBorder: '#FECACA', textColor: '#DC2626', badgeBg: '#DC2626', badgeColor: '#fff', label: 'Jatuh tempo!' }
  if (days === 0) return { rowBg: '#FFF7ED', rowBorder: '#FED7AA', textColor: '#EA580C', badgeBg: '#EA580C', badgeColor: '#fff', label: 'Hari ini' }
  if (days <= 3)  return { rowBg: '#FFFBEB', rowBorder: '#FDE68A', textColor: '#D97706', badgeBg: '#D97706', badgeColor: '#fff', label: `${days} hari lagi` }
  return { rowBg: '#fff', rowBorder: '#E8E0D4', textColor: '#1A1A18', badgeBg: '#F5F0EA', badgeColor: '#7A7469', label: `${days} hari lagi` }
}

const FREQ_LABELS: Record<string, string> = { once: 'Sekali', monthly: 'Bulanan', weekly: 'Mingguan' }

/* ── Component ── */
export default function TagihanPage() {
  const [bills, setBills]           = useState<Bill[]>([])
  const [loading, setLoading]       = useState(true)
  const [workspaceId, setWsId]      = useState<string | null>(null)

  /* form */
  const [showForm, setShowForm]     = useState(false)
  const [editBill, setEditBill]     = useState<Bill | null>(null)
  const [title, setTitle]           = useState('')
  const [amountDisplay, setAmtDisp] = useState('')
  const [amountRaw, setAmtRaw]      = useState('')
  const [dueDate, setDueDate]       = useState('')
  const [frequency, setFrequency]   = useState<'once' | 'monthly' | 'weekly'>('monthly')
  const [saving, setSaving]         = useState(false)
  const [formError, setFormError]   = useState('')

  /* actions */
  const [payingId, setPayingId]     = useState<string | null>(null)
  const [deleteId, setDeleteId]     = useState<string | null>(null)
  const [hoveredRow, setHoveredRow] = useState<string | null>(null)
  const [hoverAdd, setHoverAdd]     = useState(false)

  /* ── Load ── */
  useEffect(() => {
    ;(async () => {
      const { getWorkspaceId } = await import('@/lib/get-workspace-id')
      const { workspaceId } = await getWorkspaceId()
      if (!workspaceId) return
      setWsId(workspaceId)
      fetchBills(workspaceId)
    })()
  }, [])

  const fetchBills = async (wsId: string) => {
    setLoading(true)
    const supabase = createClient()
    const { data } = await supabase
      .from('bills').select('*').eq('workspace_id', wsId).order('due_date', { ascending: true })
    setBills((data as Bill[]) || [])
    setLoading(false)
  }

  /* ── Form helpers ── */
  const openForm = (bill?: Bill) => {
    setEditBill(bill ?? null)
    setTitle(bill?.title ?? '')
    setAmtRaw(bill ? String(bill.amount) : '')
    setAmtDisp(bill ? new Intl.NumberFormat('id-ID').format(bill.amount) : '')
    setDueDate(bill?.due_date ?? '')
    setFrequency(bill?.frequency ?? 'monthly')
    setFormError('')
    setShowForm(true)
  }

  const closeForm = () => { setShowForm(false); setEditBill(null) }

  const handleAmountChange = (val: string) => {
    const raw = val.replace(/\D/g, '')
    setAmtRaw(raw)
    setAmtDisp(raw ? new Intl.NumberFormat('id-ID').format(parseInt(raw)) : '')
  }

  /* ── Save ── */
  const handleSave = async () => {
    if (!title.trim())                      { setFormError('Isi nama tagihan.'); return }
    if (!amountRaw || parseInt(amountRaw) <= 0) { setFormError('Masukkan nominal yang valid.'); return }
    if (!dueDate)                           { setFormError('Pilih tanggal jatuh tempo.'); return }
    if (!workspaceId) return

    setSaving(true); setFormError('')
    const supabase  = createClient()
    const payload   = { workspace_id: workspaceId, title: title.trim(), amount: parseInt(amountRaw), due_date: dueDate, frequency, status: 'unpaid' as const }

    if (editBill) await supabase.from('bills').update(payload).eq('id', editBill.id)
    else          await supabase.from('bills').insert(payload)

    setSaving(false); closeForm(); fetchBills(workspaceId)
  }

  /* ── Pay ── */
  const handlePay = async (id: string) => {
    if (!workspaceId) return
    setPayingId(id)
    const supabase = createClient()
    const bill     = bills.find(b => b.id === id)!

    await Promise.all([
      supabase.from('bills').update({ status: 'paid' }).eq('id', id),
      supabase.from('transactions').insert({
        workspace_id: workspaceId,
        type:         'expense',
        amount:       bill.amount,
        description:  `Bayar tagihan: ${bill.title}`,
        date:         new Date().toISOString().split('T')[0],
      }),
    ])

    setPayingId(null); fetchBills(workspaceId)
  }

  /* ── Delete ── */
  const handleDelete = async () => {
    if (!deleteId || !workspaceId) return
    const supabase = createClient()
    await supabase.from('bills').delete().eq('id', deleteId)
    setDeleteId(null); fetchBills(workspaceId)
  }

  /* ── Derived ── */
  const unpaid      = bills.filter(b => b.status === 'unpaid')
  const paid        = bills.filter(b => b.status === 'paid')
  const totalUnpaid = unpaid.reduce((s, b) => s + b.amount, 0)

  /* ── Shared style tokens ── */
  const card: React.CSSProperties    = { background: '#fff', borderRadius: 12, border: '1px solid #E8E0D4', padding: '20px 22px', marginBottom: 12 }
  const inputBase: React.CSSProperties = { width: '100%', padding: '9px 12px', border: '1px solid #DDD8CF', borderRadius: 8, fontSize: 13, fontFamily: 'inherit', color: '#1A1A18', background: '#fff', outline: 'none', boxSizing: 'border-box' as const }
  const fieldLbl: React.CSSProperties = { display: 'block', fontSize: 11, fontWeight: 600, color: '#8B7E6E', textTransform: 'uppercase' as const, letterSpacing: '0.07em', marginBottom: 5 }

  return (
    <>
      <style>{`
        @keyframes slideDown { from { opacity:0; transform:translateY(-10px); } to { opacity:1; transform:none; } }
        @keyframes fadeIn    { from { opacity:0; } to { opacity:1; } }
        .tb-form-enter  { animation: slideDown 0.28s cubic-bezier(0.34,1.1,0.64,1) forwards; }
        .tb-bill-enter  { animation: fadeIn 0.22s ease forwards; }
        .tb-input-focus:focus { border-color: ${SB} !important; box-shadow: 0 0 0 3px rgba(122,170,206,0.15) !important; }
        .tb-icon-btn { width:28px;height:28px;border-radius:7px;border:none;background:#F5F0EA;cursor:pointer;display:flex;align-items:center;justify-content:center;transition:background 0.12s; }
        .tb-icon-btn:hover { background:#E8E0D4; }
        .tb-pay-btn { padding:6px 14px;background:#16A34A;color:#fff;border:none;border-radius:7px;font-size:12px;font-weight:600;font-family:inherit;cursor:pointer;transition:background 0.12s;white-space:nowrap; }
        .tb-pay-btn:hover:not(:disabled) { background:#15803D; }
        .tb-pay-btn:disabled { opacity:0.5;cursor:not-allowed; }
        .tb-row-actions { opacity:0;transition:opacity 0.15s;display:flex;gap:4px; }
        .tb-bill-row:hover .tb-row-actions { opacity:1; }
        .tb-bill-row { transition:box-shadow 0.12s; }
        .tb-bill-row:hover { box-shadow:0 2px 8px rgba(0,0,0,0.06); }
        .tb-freq-btn { flex:1;padding:8px;border-radius:8px;border:1.5px solid #E8E0D4;background:#FAFAF9;font-size:12px;font-weight:500;color:#8B7E6E;font-family:inherit;cursor:pointer;transition:all 0.12s; }
        .tb-freq-btn:hover:not(.active) { background:#EBF4FB;border-color:${SB}; }
        .tb-freq-btn.active { background:${SB};border-color:${SB};color:#fff; }
        .tb-del-btn { flex:1;padding:10px;border:none;border-radius:9px;background:#DC2626;color:#fff;font-size:13px;font-weight:600;font-family:inherit;cursor:pointer;transition:background 0.12s; }
        .tb-del-btn:hover { background:#B91C1C; }
      `}</style>

      <div style={{ maxWidth: 700, margin: '0 auto', fontFamily: 'DM Sans, system-ui, sans-serif' }}>

        {/* ── Header ── */}
        <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', marginBottom: 20 }}>
          <div>
            <div style={{ fontSize: 10.5, fontWeight: 600, color: '#8B7E6E', textTransform: 'uppercase', letterSpacing: '0.07em' }}>Keuangan</div>
            <h2 style={{ fontSize: 22, fontWeight: 600, color: '#1A1A18', letterSpacing: '-0.4px', margin: '3px 0 4px' }}>Tagihan</h2>
            {unpaid.length > 0 ? (
              <p style={{ fontSize: 12, color: '#DC2626', margin: 0 }}>
                {unpaid.length} tagihan belum lunas · {fmt(totalUnpaid)}
              </p>
            ) : (
              <p style={{ fontSize: 12, color: '#8B7E6E', margin: 0 }}>Semua tagihan sudah lunas</p>
            )}
          </div>
          <button
            onClick={() => showForm ? closeForm() : openForm()}
            onMouseEnter={() => setHoverAdd(true)}
            onMouseLeave={() => setHoverAdd(false)}
            style={{
              display: 'flex', alignItems: 'center', gap: 6,
              padding: '8px 16px',
              background: showForm ? SB_DRK : (hoverAdd ? SB_DRK : SB),
              color: '#fff', border: 'none', borderRadius: 9,
              fontSize: 13, fontWeight: 600, fontFamily: 'inherit', cursor: 'pointer',
              transition: 'background 0.12s',
            }}
          >
            <svg width="12" height="12" viewBox="0 0 12 12" fill="none">
              <path d={showForm ? 'M1 6h10' : 'M6 1v10M1 6h10'} stroke="#fff" strokeWidth="1.8" strokeLinecap="round"/>
            </svg>
            {showForm ? 'Tutup' : 'Tambah Tagihan'}
          </button>
        </div>

        {/* ── Add/Edit Form ── */}
        {showForm && (
          <div className="tb-form-enter" style={card}>
            <div style={{ fontSize: 13, fontWeight: 600, color: '#1A1A18', marginBottom: 16 }}>
              {editBill ? 'Edit Tagihan' : 'Tagihan Baru'}
            </div>

            {/* Nama */}
            <div style={{ marginBottom: 12 }}>
              <label style={fieldLbl}>Nama Tagihan <span style={{ color: '#DC2626' }}>*</span></label>
              <input
                autoFocus
                className="tb-input-focus"
                style={inputBase}
                placeholder="Contoh: Tagihan Listrik PLN"
                value={title}
                onChange={e => setTitle(e.target.value)}
              />
            </div>

            {/* Amount + Due date */}
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12, marginBottom: 12 }}>
              <div>
                <label style={fieldLbl}>Nominal (Rp) <span style={{ color: '#DC2626' }}>*</span></label>
                <input
                  className="tb-input-focus"
                  style={inputBase}
                  inputMode="numeric"
                  placeholder="0"
                  value={amountDisplay}
                  onChange={e => handleAmountChange(e.target.value)}
                />
              </div>
              <div>
                <label style={fieldLbl}>Jatuh Tempo <span style={{ color: '#DC2626' }}>*</span></label>
                <input
                  className="tb-input-focus"
                  style={inputBase}
                  type="date"
                  value={dueDate}
                  onChange={e => setDueDate(e.target.value)}
                />
              </div>
            </div>

            {/* Frequency */}
            <div style={{ marginBottom: 16 }}>
              <label style={fieldLbl}>Frekuensi</label>
              <div style={{ display: 'flex', gap: 7 }}>
                {(['once', 'monthly', 'weekly'] as const).map(f => (
                  <button
                    key={f}
                    onClick={() => setFrequency(f)}
                    className={`tb-freq-btn${frequency === f ? ' active' : ''}`}
                  >
                    {FREQ_LABELS[f]}
                  </button>
                ))}
              </div>
            </div>

            {/* Error */}
            {formError && (
              <div style={{ marginBottom: 12, padding: '8px 12px', borderRadius: 8, background: '#FEF2F2', border: '1px solid #FECACA', fontSize: 12, color: '#DC2626' }}>
                {formError}
              </div>
            )}

            {/* Actions */}
            <div style={{ display: 'flex', gap: 9 }}>
              <button
                onClick={closeForm}
                style={{ flex: 1, padding: 10, border: '1px solid #DDD8CF', borderRadius: 9, background: '#fff', color: '#5C5650', fontSize: 13, fontWeight: 500, fontFamily: 'inherit', cursor: 'pointer' }}
              >
                Batal
              </button>
              <button
                onClick={handleSave}
                disabled={saving}
                style={{ flex: 2, padding: 10, border: 'none', borderRadius: 9, background: saving ? '#9C9892' : SB, color: '#fff', fontSize: 13, fontWeight: 600, fontFamily: 'inherit', cursor: saving ? 'not-allowed' : 'pointer', transition: 'background 0.12s' }}
              >
                {saving ? 'Menyimpan...' : editBill ? 'Simpan Perubahan' : 'Simpan Tagihan'}
              </button>
            </div>
          </div>
        )}

        {/* ── Unpaid Bills ── */}
        {loading ? (
          <div>
            {[1, 2, 3].map(i => (
              <div key={i} style={{ background: '#fff', borderRadius: 10, border: '1px solid #E8E0D4', padding: '14px 16px', marginBottom: 8 }}>
                <div style={{ height: 14, background: '#E8E4DC', borderRadius: 6, width: '40%', marginBottom: 8, animation: 'pulse 1.5s infinite' }} />
                <div style={{ height: 11, background: '#E8E4DC', borderRadius: 6, width: '25%' }} />
              </div>
            ))}
          </div>
        ) : unpaid.length === 0 ? (
          <div style={{ background: '#fff', borderRadius: 12, border: '1px solid #E8E0D4', padding: '48px 24px', textAlign: 'center', marginBottom: 12 }}>
            <div style={{ fontSize: 32, marginBottom: 8 }}>🎉</div>
            <div style={{ fontSize: 14, fontWeight: 600, color: '#1A1A18', marginBottom: 4 }}>Semua tagihan sudah lunas!</div>
            <div style={{ fontSize: 12, color: '#8B7E6E' }}>Tambah tagihan baru untuk mulai melacak.</div>
          </div>
        ) : (
          <div>
            {unpaid.map((bill, i) => {
              const days = daysUntil(bill.due_date)
              const urg  = urgency(days)
              return (
                <div
                  key={bill.id}
                  className="tb-bill-row tb-bill-enter"
                  onMouseEnter={() => setHoveredRow(bill.id)}
                  onMouseLeave={() => setHoveredRow(null)}
                  style={{
                    borderRadius: 10,
                    border: `1px solid ${urg.rowBorder}`,
                    background: urg.rowBg,
                    padding: '14px 16px',
                    display: 'flex',
                    alignItems: 'center',
                    gap: 12,
                    marginBottom: 8,
                    animationDelay: `${i * 0.05}s`,
                  }}
                >
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 7, marginBottom: 4, flexWrap: 'wrap' }}>
                      <span style={{ fontSize: 13, fontWeight: 600, color: urg.textColor, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                        {bill.title}
                      </span>
                      <span style={{ display: 'inline-flex', alignItems: 'center', padding: '2px 8px', borderRadius: 99, fontSize: 10, fontWeight: 600, background: urg.badgeBg, color: urg.badgeColor, flexShrink: 0 }}>
                        {urg.label}
                      </span>
                      {bill.frequency !== 'once' && (
                        <span style={{ display: 'inline-flex', alignItems: 'center', padding: '2px 8px', borderRadius: 99, fontSize: 10, fontWeight: 500, background: '#EBF4FB', color: SB_DRK, flexShrink: 0 }}>
                          {FREQ_LABELS[bill.frequency].toLowerCase()}
                        </span>
                      )}
                    </div>
                    <span style={{ fontSize: 11, color: '#8B7E6E' }}>
                      Jatuh tempo: {new Date(bill.due_date).toLocaleDateString('id-ID', { day: 'numeric', month: 'long', year: 'numeric' })}
                    </span>
                  </div>

                  <div style={{ display: 'flex', alignItems: 'center', gap: 10, flexShrink: 0 }}>
                    <span style={{ fontSize: 14, fontWeight: 700, color: urg.textColor }}>
                      {fmt(bill.amount)}
                    </span>

                    {/* Edit / Delete — visible on hover */}
                    <div className="tb-row-actions">
                      <button className="tb-icon-btn" onClick={() => openForm(bill)} title="Edit">
                        <svg width="13" height="13" viewBox="0 0 14 14" fill="none">
                          <path d="M9.5 2.5l2 2-7 7H2.5v-2l7-7z" stroke="#7A7469" strokeWidth="1.3" strokeLinejoin="round"/>
                        </svg>
                      </button>
                      <button className="tb-icon-btn" onClick={() => setDeleteId(bill.id)} title="Hapus">
                        <svg width="13" height="13" viewBox="0 0 14 14" fill="none">
                          <path d="M2 4h10M5 4V3a1 1 0 011-1h2a1 1 0 011 1v1M6 7v3M8 7v3M3 4l.7 7.3A1 1 0 004.7 12h4.6a1 1 0 001-.7L11 4" stroke="#7A7469" strokeWidth="1.3" strokeLinecap="round" strokeLinejoin="round"/>
                        </svg>
                      </button>
                    </div>

                    <button
                      className="tb-pay-btn"
                      onClick={() => handlePay(bill.id)}
                      disabled={payingId === bill.id}
                    >
                      {payingId === bill.id ? (
                        <span style={{ display: 'flex', alignItems: 'center', gap: 5 }}>
                          <svg width="12" height="12" viewBox="0 0 12 12" fill="none" style={{ animation: 'spin 1s linear infinite' }}>
                            <circle cx="6" cy="6" r="4.5" stroke="rgba(255,255,255,0.4)" strokeWidth="1.5"/>
                            <path d="M6 1.5A4.5 4.5 0 0 1 10.5 6" stroke="#fff" strokeWidth="1.5" strokeLinecap="round"/>
                          </svg>
                          Memproses
                        </span>
                      ) : '✓ Lunas'}
                    </button>
                  </div>
                </div>
              )
            })}
          </div>
        )}

        {/* ── Paid Bills ── */}
        {paid.length > 0 && (
          <div style={{ marginTop: 8 }}>
            <div style={{ fontSize: 10.5, fontWeight: 600, color: '#8B7E6E', textTransform: 'uppercase', letterSpacing: '0.07em', marginBottom: 10 }}>
              Sudah Dibayar ({paid.length})
            </div>
            <div>
              {paid.map(bill => (
                <div
                  key={bill.id}
                  style={{
                    background: 'rgba(255,255,255,0.6)',
                    borderRadius: 10,
                    border: '1px solid #F2EDE5',
                    padding: '11px 16px',
                    display: 'flex',
                    alignItems: 'center',
                    gap: 12,
                    marginBottom: 6,
                    opacity: 0.7,
                  }}
                >
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <span style={{ fontSize: 13, color: '#8B7E6E', textDecoration: 'line-through', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', display: 'block' }}>
                      {bill.title}
                    </span>
                  </div>
                  <span style={{ fontSize: 10, fontWeight: 600, color: '#16A34A', background: '#F0FDF4', border: '1px solid #BBF7D0', padding: '2px 9px', borderRadius: 99, flexShrink: 0 }}>
                    ✓ Lunas
                  </span>
                  <span style={{ fontSize: 13, color: '#8B7E6E', flexShrink: 0 }}>
                    {fmt(bill.amount)}
                  </span>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* ── Delete Confirmation Modal ── */}
        {deleteId && (
          <div
            onClick={() => setDeleteId(null)}
            style={{
              position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.4)',
              zIndex: 50, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 16,
            }}
          >
            <div
              onClick={e => e.stopPropagation()}
              style={{
                background: '#fff', borderRadius: 16, padding: 24,
                width: '100%', maxWidth: 320, textAlign: 'center',
                animation: 'bounceIn 0.3s cubic-bezier(0.34,1.4,0.64,1)',
              }}
            >
              <div style={{ width: 44, height: 44, borderRadius: '50%', background: '#FEF2F2', display: 'flex', alignItems: 'center', justifyContent: 'center', margin: '0 auto 14px' }}>
                <svg width="20" height="20" viewBox="0 0 20 20" fill="none">
                  <path d="M10 7v4M10 13h.01M4 17h12a1 1 0 00.9-1.45L10.9 4.55a1 1 0 00-1.8 0L3.1 15.55A1 1 0 004 17z" stroke="#DC2626" strokeWidth="1.5" strokeLinecap="round"/>
                </svg>
              </div>
              <div style={{ fontSize: 15, fontWeight: 600, color: '#1A1A18', marginBottom: 6 }}>Hapus tagihan ini?</div>
              <div style={{ fontSize: 12, color: '#8B7E6E', marginBottom: 20, lineHeight: 1.5 }}>
                Riwayat tagihan akan hilang permanen dan tidak bisa dikembalikan.
              </div>
              <div style={{ display: 'flex', gap: 9 }}>
                <button
                  onClick={() => setDeleteId(null)}
                  style={{ flex: 1, padding: 10, border: '1px solid #DDD8CF', borderRadius: 9, background: '#fff', color: '#5C5650', fontSize: 13, fontWeight: 500, fontFamily: 'inherit', cursor: 'pointer' }}
                >
                  Batal
                </button>
                <button
                  className="tb-del-btn"
                  onClick={handleDelete}
                >
                  Hapus
                </button>
              </div>
            </div>
          </div>
        )}
      </div>

      <style>{`
        @keyframes spin     { to { transform: rotate(360deg); } }
        @keyframes bounceIn { 0%{opacity:0;transform:scale(0.8)} 70%{transform:scale(1.04)} 100%{opacity:1;transform:scale(1)} }
        @keyframes pulse    { 0%,100%{opacity:1} 50%{opacity:0.4} }
      `}</style>
    </>
  )
}