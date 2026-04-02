'use client'

import { useEffect, useState, useRef } from 'react'
import { useRouter, useSearchParams } from 'next/navigation'
import { createClient } from '@/lib/supabase/client'

/* ── Colour tokens (matches layout.tsx signature) ── */
const SB     = '#7AAACE'
const SB_DRK = '#5E96C0'

/* ── Category presets ── */
const INCOME_CATS = [
  { icon: '👥', label: 'Iuran Warga' },
  { icon: '🏛️', label: 'Dana Desa' },
  { icon: '🎁', label: 'Donasi' },
  { icon: '💼', label: 'Sewa Aset' },
  { icon: '🌐', label: 'Sponsor' },
  { icon: '📦', label: 'Penjualan' },
  { icon: '💰', label: 'Lainnya' },
]
const EXPENSE_CATS = [
  { icon: '💡', label: 'Listrik & Air' },
  { icon: '🛒', label: 'Kebersihan' },
  { icon: '🔧', label: 'Perbaikan' },
  { icon: '🎉', label: 'Acara' },
  { icon: '🏥', label: 'Sosial' },
  { icon: '📋', label: 'Administrasi' },
  { icon: '🚗', label: 'Transportasi' },
  { icon: '💸', label: 'Lainnya' },
]

/* ── Helpers ── */
const today = () => new Date().toISOString().split('T')[0]
const fmt   = (n: number) =>
  new Intl.NumberFormat('id-ID', { style: 'currency', currency: 'IDR', maximumFractionDigits: 0 }).format(n)

function parseAmount(raw: string): number {
  return parseInt(raw.replace(/\D/g, ''), 10) || 0
}
function displayAmount(raw: string): string {
  const n = parseAmount(raw)
  if (!n) return ''
  return n.toLocaleString('id-ID')
}

/* ── Component ── */
export default function NewTransactionPage() {
  const router      = useRouter()
  const params      = useSearchParams()
  const fileRef     = useRef<HTMLInputElement>(null)

  const [workspace, setWorkspace]     = useState<any>(null)
  const [loading, setLoading]         = useState(true)
  const [submitting, setSubmitting]   = useState(false)
  const [error, setError]             = useState<string | null>(null)

  /* form state */
  const [type, setType]           = useState<'income' | 'expense'>(
    (params.get('type') as 'income' | 'expense') || 'income'
  )
  const [amount, setAmount]       = useState('')
  const [date, setDate]           = useState(today())
  const [ref, setRef]             = useState('')
  const [catIndex, setCatIndex]   = useState(0)
  const [catName, setCatName]     = useState('')   // custom / from DB
  const [description, setDesc]    = useState('')
  const [note, setNote]           = useState('')
  const [file, setFile]           = useState<File | null>(null)

  /* hover states */
  const [hoverCancel, setHoverCancel]   = useState(false)
  const [hoverSubmit, setHoverSubmit]   = useState(false)
  const [hoverFile, setHoverFile]       = useState(false)

  /* workspace categories from DB */
  const [dbCategories, setDbCategories] = useState<{ id: string; name: string; icon: string; type: string }[]>([])

  /* ── Load workspace & categories ── */
  useEffect(() => {
    ;(async () => {
      const supabase = createClient()
      const { data: { user } } = await supabase.auth.getUser()
      if (!user) { router.push('/login'); return }

      const { data: memberships } = await supabase
        .from('workspace_members')
        .select('workspace_id, workspaces(id, name, type)')
        .eq('user_id', user.id)
        .limit(1)

      if (!memberships || memberships.length === 0) { router.push('/setup'); return }

      const ws = (memberships[0] as any).workspaces
      setWorkspace(ws)

      const { data: cats } = await supabase
        .from('categories')
        .select('id, name, icon, type')
        .eq('workspace_id', ws.id)

      if (cats && cats.length > 0) setDbCategories(cats)
      setLoading(false)
    })()
  }, [])

  /* reset category selection when type changes */
  useEffect(() => { setCatIndex(0); setCatName('') }, [type])

  /* ── Resolved category list ── */
  const filteredDbCats = dbCategories.filter(c => c.type === type || c.type === 'all')
  const presets        = type === 'income' ? INCOME_CATS : EXPENSE_CATS
  const categories     = filteredDbCats.length > 0
    ? filteredDbCats.map(c => ({ icon: c.icon, label: c.name, id: c.id }))
    : presets.map(c => ({ ...c, id: undefined }))

  const selectedCat = categories[catIndex]

  /* ── Submit ── */
  const handleSubmit = async () => {
    setError(null)
    if (!description.trim()) { setError('Keterangan tidak boleh kosong.'); return }
    if (parseAmount(amount) === 0) { setError('Jumlah tidak boleh nol.'); return }

    setSubmitting(true)
    const supabase = createClient()
    const { data: { user } } = await supabase.auth.getUser()

    /* resolve category id */
    let categoryId: string | null = (selectedCat as any)?.id ?? null
    if (!categoryId) {
      /* upsert preset category */
      const { data: upserted } = await supabase
        .from('categories')
        .upsert(
          { workspace_id: workspace.id, name: selectedCat.label, icon: selectedCat.icon, type },
          { onConflict: 'workspace_id,name,type' }
        )
        .select('id')
        .single()
      categoryId = upserted?.id ?? null
    }

    /* upload attachment */
    let attachmentUrl: string | null = null
    if (file) {
      const path = `${workspace.id}/${Date.now()}_${file.name}`
      const { data: uploaded } = await supabase.storage
        .from('transaction-attachments')
        .upload(path, file)
      if (uploaded) {
        const { data: { publicUrl } } = supabase.storage
          .from('transaction-attachments')
          .getPublicUrl(uploaded.path)
        attachmentUrl = publicUrl
      }
    }

    const { error: insertError } = await supabase.from('transactions').insert({
      workspace_id:   workspace.id,
      user_id:        user!.id,
      type,
      amount:         parseAmount(amount),
      date,
      description:    description.trim(),
      note:           note.trim() || null,
      category_id:    categoryId,
      reference:      ref.trim() || null,
      attachment_url: attachmentUrl,
    })

    if (insertError) {
      setError(insertError.message)
      setSubmitting(false)
    } else {
      router.push('/dashboard/transaksi')
    }
  }

  /* ── Styles ── */
  const card: React.CSSProperties = {
    background: '#fff',
    borderRadius: 12,
    border: '1px solid #E8E0D4',
    padding: '20px 22px',
    marginBottom: 12,
  }
  const sectionTitle: React.CSSProperties = {
    fontSize: 11,
    fontWeight: 600,
    color: '#8B7E6E',
    textTransform: 'uppercase',
    letterSpacing: '0.07em',
    margin: '0 0 14px',
  }
  const fieldLabel: React.CSSProperties = {
    display: 'block',
    fontSize: 11.5,
    fontWeight: 500,
    color: '#5C5650',
    marginBottom: 5,
  }
  const inputBase: React.CSSProperties = {
    width: '100%',
    padding: '9px 12px',
    border: '1px solid #DDD8CF',
    borderRadius: 8,
    fontSize: 13,
    fontFamily: 'inherit',
    color: '#1A1A18',
    background: '#fff',
    outline: 'none',
    boxSizing: 'border-box',
  }

  /* ── Loading ── */
  if (loading) return (
    <div style={{ minHeight: 300, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
      <p style={{ fontSize: 13, color: '#8B7E6E', fontFamily: 'DM Sans, system-ui, sans-serif' }}>Memuat...</p>
    </div>
  )

  const cats    = categories
  const isIncome = type === 'income'

  return (
    <>
      <style>{`
        @import url('https://fonts.googleapis.com/css2?family=DM+Sans:wght@400;500;600&display=swap');
        *, *::before, *::after { box-sizing: border-box; }
        .kbn-input { transition: border-color 0.12s, box-shadow 0.12s; }
        .kbn-input:focus { border-color: ${SB} !important; box-shadow: 0 0 0 3px rgba(122,170,206,0.15) !important; }
        .kbn-cat:hover { border-color: ${SB}; background: #EBF4FB; }
        .kbn-cat.active { border-color: ${SB}; background: #EBF4FB; box-shadow: 0 0 0 2px rgba(122,170,206,0.2); }
        .kbn-type-income { background: #F0FDF4; border-color: #BBF7D0; color: #15803D; }
        .kbn-type-income.active { background: #DCFCE7; border-color: #16A34A; box-shadow: 0 0 0 3px rgba(22,163,74,0.12); }
        .kbn-type-expense { background: #FEF2F2; border-color: #FECACA; color: #DC2626; }
        .kbn-type-expense.active { background: #FEE2E2; border-color: #DC2626; box-shadow: 0 0 0 3px rgba(220,38,38,0.12); }
      `}</style>

      <div style={{ maxWidth: 620, margin: '0 auto', fontFamily: 'DM Sans, system-ui, sans-serif' }}>

        {/* ── Header ── */}
        <div style={{ marginBottom: 22 }}>
          <button
            onClick={() => router.back()}
            style={{ display: 'flex', alignItems: 'center', gap: 5, fontSize: 12, fontWeight: 500, color: '#8B7E6E', background: 'none', border: 'none', cursor: 'pointer', padding: 0, fontFamily: 'inherit', marginBottom: 12 }}
          >
            <svg width="14" height="14" viewBox="0 0 14 14" fill="none">
              <path d="M9 2L4 7l5 5" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"/>
            </svg>
            Kembali
          </button>
          <div style={{ fontSize: 10.5, fontWeight: 600, color: '#8B7E6E', textTransform: 'uppercase', letterSpacing: '0.07em' }}>
            Transaksi
          </div>
          <h2 style={{ fontSize: 22, fontWeight: 600, color: '#1A1A18', letterSpacing: '-0.4px', margin: '3px 0 4px' }}>
            Catat Transaksi Baru
          </h2>
          <p style={{ fontSize: 12, color: '#8B7E6E', margin: 0 }}>{workspace?.name}</p>
        </div>

        {/* ── Error ── */}
        {error && (
          <div style={{ marginBottom: 12, padding: '10px 14px', borderRadius: 8, background: '#FEF2F2', border: '1px solid #FECACA', fontSize: 12.5, color: '#DC2626' }}>
            {error}
          </div>
        )}

        {/* ── Type Toggle + Amount ── */}
        <div style={card}>
          <p style={sectionTitle}>Jenis Transaksi</p>

          <div style={{ display: 'flex', gap: 8, marginBottom: 20 }}>
            {(['expense', 'income'] as const).map(t => (
              <button
                key={t}
                onClick={() => setType(t)}
                className={`kbn-type-${t}${type === t ? ' active' : ''}`}
                style={{
                  flex: 1,
                  padding: '10px',
                  borderRadius: 10,
                  border: '1.5px solid transparent',
                  cursor: 'pointer',
                  fontSize: 13,
                  fontWeight: 500,
                  fontFamily: 'inherit',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  gap: 7,
                  transition: 'all 0.15s',
                }}
              >
                {t === 'income'
                  ? <svg width="13" height="13" viewBox="0 0 14 14" fill="none"><path d="M7 12V2M2 7h10" stroke="currentColor" strokeWidth="2" strokeLinecap="round"/></svg>
                  : <svg width="13" height="13" viewBox="0 0 14 14" fill="none"><path d="M2 7h10" stroke="currentColor" strokeWidth="2" strokeLinecap="round"/></svg>
                }
                {t === 'income' ? 'Pemasukan' : 'Pengeluaran'}
              </button>
            ))}
          </div>

          {/* Amount */}
          <div style={{ marginBottom: 14 }}>
            <label style={fieldLabel}>Jumlah <span style={{ color: '#DC2626' }}>*</span></label>
            <div style={{ position: 'relative' }}>
              <span style={{ position: 'absolute', left: 12, top: '50%', transform: 'translateY(-50%)', fontSize: 13, fontWeight: 600, color: '#8B7E6E', pointerEvents: 'none' }}>
                Rp
              </span>
              <input
                className="kbn-input"
                style={{ ...inputBase, paddingLeft: 52, fontSize: 15, fontWeight: 600, letterSpacing: '-0.3px' }}
                placeholder="0"
                value={amount}
                onChange={e => setAmount(displayAmount(e.target.value))}
                inputMode="numeric"
              />
            </div>
          </div>

          {/* Date + Ref */}
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
            <div>
              <label style={fieldLabel}>Tanggal <span style={{ color: '#DC2626' }}>*</span></label>
              <input className="kbn-input" style={inputBase} type="date" value={date} onChange={e => setDate(e.target.value)} />
            </div>
            <div>
              <label style={fieldLabel}>No. Referensi</label>
              <input className="kbn-input" style={inputBase} placeholder="Opsional" value={ref} onChange={e => setRef(e.target.value)} />
            </div>
          </div>
        </div>

        {/* ── Kategori ── */}
        <div style={card}>
          <p style={sectionTitle}>Kategori</p>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: 7 }}>
            {cats.map((c, i) => (
              <button
                key={i}
                onClick={() => setCatIndex(i)}
                className={`kbn-cat${catIndex === i ? ' active' : ''}`}
                style={{
                  padding: '9px 6px',
                  borderRadius: 8,
                  border: '1.5px solid #E8E0D4',
                  background: '#FAFAF9',
                  cursor: 'pointer',
                  fontFamily: 'inherit',
                  display: 'flex',
                  flexDirection: 'column',
                  alignItems: 'center',
                  gap: 4,
                  transition: 'all 0.12s',
                }}
              >
                <span style={{ fontSize: 18, lineHeight: 1 }}>{c.icon}</span>
                <span style={{ fontSize: 10, fontWeight: 500, color: '#5C5650', textAlign: 'center', lineHeight: 1.2 }}>{c.label}</span>
              </button>
            ))}
          </div>
        </div>

        {/* ── Detail ── */}
        <div style={card}>
          <p style={sectionTitle}>Detail</p>

          <div style={{ marginBottom: 14 }}>
            <label style={fieldLabel}>Keterangan <span style={{ color: '#DC2626' }}>*</span></label>
            <input
              className="kbn-input"
              style={inputBase}
              placeholder={isIncome ? 'Contoh: Iuran warga bulan Juni' : 'Contoh: Bayar rekening listrik Juli'}
              value={description}
              onChange={e => setDesc(e.target.value)}
            />
          </div>

          <div style={{ marginBottom: 14 }}>
            <label style={fieldLabel}>Catatan</label>
            <textarea
              className="kbn-input"
              style={{ ...inputBase, resize: 'vertical', minHeight: 70 }}
              placeholder="Tambahkan catatan tambahan jika diperlukan..."
              value={note}
              onChange={e => setNote(e.target.value)}
            />
          </div>

          {/* File upload */}
          <div>
            <label style={fieldLabel}>Lampiran Bukti</label>
            <div
              onClick={() => fileRef.current?.click()}
              onMouseEnter={() => setHoverFile(true)}
              onMouseLeave={() => setHoverFile(false)}
              style={{
                border: `1.5px dashed ${hoverFile ? SB : '#D4CFC4'}`,
                borderRadius: 8,
                padding: '16px',
                textAlign: 'center',
                cursor: 'pointer',
                background: hoverFile ? '#EBF4FB' : '#FAFAF9',
                transition: 'border-color 0.12s, background 0.12s',
              }}
            >
              {file ? (
                <>
                  <div style={{ fontSize: 18, marginBottom: 4 }}>📎</div>
                  <div style={{ fontSize: 12, fontWeight: 500, color: '#1A1A18' }}>{file.name}</div>
                  <div style={{ fontSize: 10.5, color: '#8B7E6E', marginTop: 2 }}>
                    {(file.size / 1024).toFixed(0)} KB — klik untuk ganti
                  </div>
                </>
              ) : (
                <>
                  <div style={{ fontSize: 20, marginBottom: 4 }}>📎</div>
                  <div style={{ fontSize: 12, fontWeight: 500, color: '#5C5650' }}>Klik untuk unggah</div>
                  <div style={{ fontSize: 10.5, color: '#8B7E6E', marginTop: 2 }}>JPG, PNG, PDF — maks. 5 MB</div>
                </>
              )}
            </div>
            <input
              ref={fileRef}
              type="file"
              accept="image/*,.pdf"
              style={{ display: 'none' }}
              onChange={e => setFile(e.target.files?.[0] ?? null)}
            />
          </div>
        </div>

        {/* ── Preview pill ── */}
        {parseAmount(amount) > 0 && (
          <div style={{ marginBottom: 12, padding: '12px 16px', borderRadius: 10, background: '#fff', border: '1px solid #E8E0D4', display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
              <span style={{ fontSize: 16 }}>{selectedCat?.icon}</span>
              <div>
                <div style={{ fontSize: 12, fontWeight: 500, color: '#1A1A18' }}>{description || selectedCat?.label}</div>
                <div style={{ fontSize: 10.5, color: '#8B7E6E' }}>{new Date(date).toLocaleDateString('id-ID', { day: 'numeric', month: 'long', year: 'numeric' })}</div>
              </div>
            </div>
            <div style={{ fontSize: 14, fontWeight: 600, color: isIncome ? '#15803D' : '#DC2626' }}>
              {isIncome ? '+' : '−'}{fmt(parseAmount(amount))}
            </div>
          </div>
        )}

        {/* ── Actions ── */}
        <div style={{ display: 'flex', gap: 9, marginBottom: 32 }}>
          <button
            onClick={() => router.back()}
            onMouseEnter={() => setHoverCancel(true)}
            onMouseLeave={() => setHoverCancel(false)}
            style={{
              flex: 1,
              padding: '11px',
              borderRadius: 9,
              border: '1px solid #DDD8CF',
              background: hoverCancel ? '#F5F2EB' : '#fff',
              color: '#5C5650',
              fontSize: 13,
              fontWeight: 500,
              fontFamily: 'inherit',
              cursor: 'pointer',
              transition: 'background 0.12s',
            }}
          >
            Batal
          </button>
          <button
            onClick={handleSubmit}
            disabled={submitting}
            onMouseEnter={() => setHoverSubmit(true)}
            onMouseLeave={() => setHoverSubmit(false)}
            style={{
              flex: 2,
              padding: '11px',
              borderRadius: 9,
              border: 'none',
              background: submitting
                ? '#9C9892'
                : isIncome
                  ? (hoverSubmit ? '#15803D' : '#16A34A')
                  : (hoverSubmit ? '#B91C1C' : '#DC2626'),
              color: '#fff',
              fontSize: 13,
              fontWeight: 600,
              fontFamily: 'inherit',
              cursor: submitting ? 'not-allowed' : 'pointer',
              transition: 'background 0.12s',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              gap: 6,
            }}
          >
            {submitting ? (
              <>
                <svg width="14" height="14" viewBox="0 0 14 14" fill="none" style={{ animation: 'spin 1s linear infinite' }}>
                  <circle cx="7" cy="7" r="5.5" stroke="rgba(255,255,255,0.4)" strokeWidth="1.5"/>
                  <path d="M7 1.5A5.5 5.5 0 0 1 12.5 7" stroke="#fff" strokeWidth="1.5" strokeLinecap="round"/>
                </svg>
                Menyimpan...
              </>
            ) : (
              `Simpan ${isIncome ? 'Pemasukan' : 'Pengeluaran'}`
            )}
          </button>
        </div>

      </div>
      <style>{`@keyframes spin { to { transform: rotate(360deg); } }`}</style>
    </>
  )
}