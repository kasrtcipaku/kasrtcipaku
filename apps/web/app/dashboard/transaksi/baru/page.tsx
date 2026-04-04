'use client'

import { useEffect, useState, useRef } from 'react'
import { useRouter, useSearchParams } from 'next/navigation'
import { createClient } from '@/lib/supabase/client'

const SB     = '#7AAACE'
const SB_DRK = '#5E96C0'

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

type DbCategory = {
  id: string
  name: string
  icon: string
  type: 'income' | 'expense'
}

export default function NewTransactionPage() {
  const router  = useRouter()
  const params  = useSearchParams()
  const fileRef = useRef<HTMLInputElement>(null)

  const [workspace,    setWorkspace]    = useState<any>(null)
  const [loading,      setLoading]      = useState(true)
  const [submitting,   setSubmitting]   = useState(false)
  const [error,        setError]        = useState<string | null>(null)
  const [loadError,    setLoadError]    = useState<string | null>(null)
  const [dbCategories, setDbCategories] = useState<DbCategory[]>([])

  const [type,        setType]        = useState<'income' | 'expense'>(
    (params.get('type') as 'income' | 'expense') || 'expense'
  )
  const [amount,      setAmount]      = useState('')
  const [date,        setDate]        = useState(today())
  const [categoryId,  setCategoryId]  = useState<string | null>(null)
  const [description, setDesc]        = useState('')
  const [note,        setNote]        = useState('')
  const [file,        setFile]        = useState<File | null>(null)
  const [hoverCancel, setHoverCancel] = useState(false)
  const [hoverSubmit, setHoverSubmit] = useState(false)
  const [hoverFile,   setHoverFile]   = useState(false)

  useEffect(() => {
    ;(async () => {
      // Gunakan getWorkspaceId agar konsisten — sudah filter owner
      const { getWorkspaceId } = await import('@/lib/get-workspace-id')
      const { workspaceId, isMember } = await getWorkspaceId()

      if (!workspaceId) {
        // Tidak ada session valid sama sekali
        router.push('/login')
        return
      }

      const supabase = createClient()

      // Ambil nama workspace
      const { data: ws, error: wsErr } = await supabase
        .from('workspaces')
        .select('id, name, type')
        .eq('id', workspaceId)
        .maybeSingle()

      if (wsErr || !ws) {
        setLoadError('Gagal memuat workspace: ' + (wsErr?.message || 'tidak ditemukan'))
        setLoading(false)
        return
      }

      setWorkspace({ ...ws, id: workspaceId })

      const { data: cats, error: catErr } = await supabase
        .from('categories')
        .select('id, name, icon, type')
        .eq('workspace_id', workspaceId)
        .eq('is_active', true)
        .order('name', { ascending: true })

      if (catErr) {
        const { data: catsFallback } = await supabase
          .from('categories')
          .select('id, name, icon, type')
          .eq('workspace_id', workspaceId)
          .order('name', { ascending: true })
        setDbCategories((catsFallback as DbCategory[]) ?? [])
      } else {
        setDbCategories((cats as DbCategory[]) ?? [])
      }

      setLoading(false)
    })()
  }, [])

  useEffect(() => { setCategoryId(null) }, [type])

  const filteredCats = dbCategories.filter(c => c.type === type)
  const selectedCat  = filteredCats.find(c => c.id === categoryId) ?? null
  const isIncome     = type === 'income'

  const handleSubmit = async () => {
    setError(null)
    if (!description.trim())       { setError('Keterangan tidak boleh kosong.'); return }
    if (parseAmount(amount) === 0) { setError('Jumlah tidak boleh nol.'); return }
    if (!categoryId)               { setError('Pilih kategori terlebih dahulu.'); return }

    setSubmitting(true)
    const supabase = createClient()

    // Ambil created_by dari Supabase Auth (owner) atau null (member pakai session)
    const { data: { user } } = await supabase.auth.getUser()

    // Upload lampiran kalau ada
    let attachmentUrl: string | null = null
    if (file) {
      const ext  = file.name.split('.').pop()
      const path = `${workspace.id}/${Date.now()}.${ext}`
      const { data: uploaded, error: upErr } = await supabase.storage
        .from('transaction-attachments')
        .upload(path, file)
      if (upErr) {
        setError('Gagal upload lampiran: ' + upErr.message)
        setSubmitting(false)
        return
      }
      const { data: { publicUrl } } = supabase.storage
        .from('transaction-attachments')
        .getPublicUrl(uploaded.path)
      attachmentUrl = publicUrl
    }

    const { error: insertError } = await supabase.from('transactions').insert({
      workspace_id:   workspace.id,
      created_by:     user?.id ?? null,
      type,
      amount:         parseAmount(amount),
      date,
      description:    description.trim(),
      note:           note.trim() || null,
      category_id:    categoryId,
      attachment_url: attachmentUrl,
      source:         'web',
    })

    if (insertError) {
      setError(insertError.message)
      setSubmitting(false)
    } else {
      router.push('/dashboard/transaksi?new=1')
    }
  }

  const card: React.CSSProperties = {
    background: '#fff', borderRadius: 12, border: '1px solid #E8E0D4',
    padding: '20px 22px', marginBottom: 12,
  }
  const sectionTitle: React.CSSProperties = {
    fontSize: 11, fontWeight: 600, color: '#8B7E6E',
    textTransform: 'uppercase', letterSpacing: '0.07em', margin: 0,
  }
  const fieldLabel: React.CSSProperties = {
    display: 'block', fontSize: 11.5, fontWeight: 500, color: '#5C5650', marginBottom: 5,
  }
  const inputBase: React.CSSProperties = {
    width: '100%', padding: '9px 12px', border: '1px solid #DDD8CF', borderRadius: 8,
    fontSize: 13, fontFamily: 'inherit', color: '#1A1A18', background: '#fff',
    outline: 'none', boxSizing: 'border-box',
  }

  if (loading) return (
    <div style={{ minHeight: 300, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
      <p style={{ fontSize: 13, color: '#8B7E6E', fontFamily: 'DM Sans, system-ui, sans-serif' }}>Memuat kategori...</p>
    </div>
  )

  if (loadError) return (
    <div style={{ minHeight: 300, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 24, fontFamily: 'DM Sans, system-ui, sans-serif' }}>
      <div style={{ textAlign: 'center' }}>
        <div style={{ fontSize: 32, marginBottom: 12 }}>⚠️</div>
        <p style={{ fontSize: 13, color: '#DC2626', marginBottom: 16 }}>{loadError}</p>
        <button onClick={() => window.location.reload()} style={{ padding: '8px 16px', background: SB, color: '#fff', border: 'none', borderRadius: 8, fontSize: 13, cursor: 'pointer', fontFamily: 'inherit' }}>Coba lagi</button>
      </div>
    </div>
  )

  return (
    <>
      <style>{`
        @import url('https://fonts.googleapis.com/css2?family=DM+Sans:wght@400;500;600&display=swap');
        *, *::before, *::after { box-sizing: border-box; }
        .kbn-input { transition: border-color 0.12s, box-shadow 0.12s; }
        .kbn-input:focus { border-color: ${SB} !important; box-shadow: 0 0 0 3px rgba(122,170,206,0.15) !important; }
        .kbn-cat { transition: all 0.12s; cursor: pointer; }
        .kbn-cat:hover { border-color: ${SB} !important; background: #EBF4FB !important; }
        .kbn-cat.active-income  { border-color: #16A34A !important; background: #DCFCE7 !important; box-shadow: 0 0 0 2px rgba(22,163,74,0.15); }
        .kbn-cat.active-expense { border-color: #DC2626 !important; background: #FEE2E2 !important; box-shadow: 0 0 0 2px rgba(220,38,38,0.15); }
        .kbn-type-income { background: #F0FDF4; border-color: #BBF7D0; color: #15803D; }
        .kbn-type-income.t-active { background: #DCFCE7; border-color: #16A34A; box-shadow: 0 0 0 3px rgba(22,163,74,0.12); }
        .kbn-type-expense { background: #FEF2F2; border-color: #FECACA; color: #DC2626; }
        .kbn-type-expense.t-active { background: #FEE2E2; border-color: #DC2626; box-shadow: 0 0 0 3px rgba(220,38,38,0.12); }
        @keyframes spin { to { transform: rotate(360deg); } }
        @keyframes cat-pop { from{opacity:0;transform:scale(0.92)} to{opacity:1;transform:scale(1)} }
        .kbn-cat { animation: cat-pop 0.15s ease both; }
        .manage-cat-link:hover { background: #EBF4FB !important; color: ${SB_DRK} !important; }
      `}</style>

      <div style={{ maxWidth: 620, margin: '0 auto', fontFamily: 'DM Sans, system-ui, sans-serif' }}>

        {/* Header */}
        <div style={{ marginBottom: 22 }}>
          <button onClick={() => router.back()} style={{ display: 'flex', alignItems: 'center', gap: 5, fontSize: 12, fontWeight: 500, color: '#8B7E6E', background: 'none', border: 'none', cursor: 'pointer', padding: 0, fontFamily: 'inherit', marginBottom: 12 }}>
            <svg width="14" height="14" viewBox="0 0 14 14" fill="none"><path d="M9 2L4 7l5 5" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"/></svg>
            Kembali
          </button>
          <div style={{ fontSize: 10.5, fontWeight: 600, color: '#8B7E6E', textTransform: 'uppercase', letterSpacing: '0.07em' }}>Transaksi</div>
          <h2 style={{ fontSize: 22, fontWeight: 600, color: '#1A1A18', letterSpacing: '-0.4px', margin: '3px 0 4px' }}>Catat Transaksi Baru</h2>
          <p style={{ fontSize: 12, color: '#8B7E6E', margin: 0 }}>{workspace?.name}</p>
        </div>

        {error && (
          <div style={{ marginBottom: 12, padding: '10px 14px', borderRadius: 8, background: '#FEF2F2', border: '1px solid #FECACA', fontSize: 12.5, color: '#DC2626' }}>{error}</div>
        )}

        {/* Jenis + Jumlah + Tanggal */}
        <div style={card}>
          <p style={{ ...sectionTitle, marginBottom: 14 }}>Jenis Transaksi</p>
          <div style={{ display: 'flex', gap: 8, marginBottom: 20 }}>
            {(['expense', 'income'] as const).map(t => (
              <button key={t} onClick={() => setType(t)}
                className={`kbn-type-${t}${type === t ? ' t-active' : ''}`}
                style={{ flex: 1, padding: '10px', borderRadius: 10, border: '1.5px solid transparent', cursor: 'pointer', fontSize: 13, fontWeight: 500, fontFamily: 'inherit', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 7, transition: 'all 0.15s' }}>
                {t === 'income'
                  ? <svg width="13" height="13" viewBox="0 0 14 14" fill="none"><path d="M7 12V2M2 7h10" stroke="currentColor" strokeWidth="2" strokeLinecap="round"/></svg>
                  : <svg width="13" height="13" viewBox="0 0 14 14" fill="none"><path d="M2 7h10" stroke="currentColor" strokeWidth="2" strokeLinecap="round"/></svg>}
                {t === 'income' ? 'Pemasukan' : 'Pengeluaran'}
              </button>
            ))}
          </div>
          <div style={{ marginBottom: 14 }}>
            <label style={fieldLabel}>Jumlah <span style={{ color: '#DC2626' }}>*</span></label>
            <div style={{ position: 'relative' }}>
              <span style={{ position: 'absolute', left: 12, top: '50%', transform: 'translateY(-50%)', fontSize: 13, fontWeight: 600, color: '#8B7E6E', pointerEvents: 'none' }}>Rp</span>
              <input className="kbn-input" style={{ ...inputBase, paddingLeft: 52, fontSize: 15, fontWeight: 600, letterSpacing: '-0.3px' }}
                placeholder="0" value={amount} onChange={e => setAmount(displayAmount(e.target.value))} inputMode="numeric" />
            </div>
          </div>
          <div>
            <label style={fieldLabel}>Tanggal <span style={{ color: '#DC2626' }}>*</span></label>
            <input className="kbn-input" style={inputBase} type="date" value={date} onChange={e => setDate(e.target.value)} />
          </div>
        </div>

        {/* Kategori */}
        <div style={card}>
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 14 }}>
            <p style={sectionTitle}>
              Kategori <span style={{ color: '#DC2626' }}>*</span>
              <span style={{ fontWeight: 400, textTransform: 'none', letterSpacing: 0, color: '#B0A89A', marginLeft: 6 }}>
                ({filteredCats.length} tersedia)
              </span>
            </p>
            <a href="/dashboard/kategori" className="manage-cat-link"
              style={{ display: 'flex', alignItems: 'center', gap: 4, fontSize: 11, fontWeight: 600, color: SB, textDecoration: 'none', padding: '4px 8px', borderRadius: 6, background: '#F0F6FB', border: '1px solid #C8DFF0', whiteSpace: 'nowrap', transition: 'background 0.12s, color 0.12s' }}>
              <svg width="10" height="10" viewBox="0 0 12 12" fill="none">
                <path d="M1 6h10M6 1l5 5-5 5" stroke={SB} strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"/>
              </svg>
              Kelola Kategori
            </a>
          </div>
          {filteredCats.length === 0 ? (
            <div style={{ textAlign: 'center', padding: '20px 0' }}>
              <div style={{ fontSize: 28, marginBottom: 8 }}>{isIncome ? '💰' : '💸'}</div>
              <p style={{ fontSize: 12.5, color: '#8B7E6E', margin: 0 }}>
                Belum ada kategori {isIncome ? 'pemasukan' : 'pengeluaran'} aktif.
              </p>
            </div>
          ) : (
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: 7 }}>
              {filteredCats.map((cat, i) => {
                const active = categoryId === cat.id
                return (
                  <button key={cat.id} onClick={() => setCategoryId(active ? null : cat.id)}
                    className={`kbn-cat${active ? ` active-${type}` : ''}`}
                    style={{ padding: '9px 6px', borderRadius: 8, border: '1.5px solid #E8E0D4', background: '#FAFAF9', cursor: 'pointer', fontFamily: 'inherit', display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 4, animationDelay: `${i * 0.02}s` }}>
                    <span style={{ fontSize: 18, lineHeight: 1 }}>{cat.icon || (isIncome ? '💰' : '💸')}</span>
                    <span style={{ fontSize: 10, fontWeight: 500, color: '#5C5650', textAlign: 'center', lineHeight: 1.3 }}>{cat.name}</span>
                  </button>
                )
              })}
            </div>
          )}
        </div>

        {/* Detail */}
        <div style={card}>
          <p style={{ ...sectionTitle, marginBottom: 14 }}>Detail</p>
          <div style={{ marginBottom: 14 }}>
            <label style={fieldLabel}>Keterangan <span style={{ color: '#DC2626' }}>*</span></label>
            <input className="kbn-input" style={inputBase}
              placeholder={isIncome ? 'Contoh: Iuran warga bulan Juni' : 'Contoh: Bayar rekening listrik Juli'}
              value={description} onChange={e => setDesc(e.target.value)} />
          </div>
          <div style={{ marginBottom: 14 }}>
            <label style={fieldLabel}>Catatan <span style={{ fontSize: 10.5, color: '#B0A89A', fontWeight: 400 }}>(opsional)</span></label>
            <textarea className="kbn-input" style={{ ...inputBase, resize: 'vertical', minHeight: 70 }}
              placeholder="Tambahkan catatan tambahan jika diperlukan..."
              value={note} onChange={e => setNote(e.target.value)} />
          </div>
          <div>
            <label style={fieldLabel}>Lampiran Bukti <span style={{ fontSize: 10.5, color: '#B0A89A', fontWeight: 400 }}>(opsional)</span></label>
            <div
              onClick={() => fileRef.current?.click()}
              onMouseEnter={() => setHoverFile(true)}
              onMouseLeave={() => setHoverFile(false)}
              style={{ border: `1.5px dashed ${hoverFile ? SB : '#D4CFC4'}`, borderRadius: 8, padding: '16px', textAlign: 'center', cursor: 'pointer', background: hoverFile ? '#EBF4FB' : '#FAFAF9', transition: 'border-color 0.12s, background 0.12s' }}>
              {file ? (
                <>
                  <div style={{ fontSize: 18, marginBottom: 4 }}>📎</div>
                  <div style={{ fontSize: 12, fontWeight: 500, color: '#1A1A18' }}>{file.name}</div>
                  <div style={{ fontSize: 10.5, color: '#8B7E6E', marginTop: 2 }}>{(file.size / 1024).toFixed(0)} KB — klik untuk ganti</div>
                </>
              ) : (
                <>
                  <div style={{ fontSize: 20, marginBottom: 4 }}>📎</div>
                  <div style={{ fontSize: 12, fontWeight: 500, color: '#5C5650' }}>Klik untuk unggah</div>
                  <div style={{ fontSize: 10.5, color: '#8B7E6E', marginTop: 2 }}>Gambar maks. 100 KB · PDF maks. 300 KB</div>
                </>
              )}
            </div>
            <input ref={fileRef} type="file" accept="image/*,.pdf" style={{ display: 'none' }}
              onChange={e => {
                const f = e.target.files?.[0]
                if (!f) return
                const isPdf    = f.type === 'application/pdf'
                const maxBytes = isPdf ? 300 * 1024 : 100 * 1024
                const maxLabel = isPdf ? '300 KB' : '100 KB'
                if (f.size > maxBytes) {
                  setError(`Ukuran file terlalu besar. Maksimal ${maxLabel} untuk ${isPdf ? 'PDF' : 'gambar'}.`)
                  e.target.value = ''
                  return
                }
                setError(null)
                setFile(f)
              }} />
          </div>
        </div>

        {/* Preview */}
        {parseAmount(amount) > 0 && selectedCat && (
          <div style={{ marginBottom: 12, padding: '12px 16px', borderRadius: 10, background: '#fff', border: '1px solid #E8E0D4', display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
              <span style={{ fontSize: 16 }}>{selectedCat.icon || (isIncome ? '💰' : '💸')}</span>
              <div>
                <div style={{ fontSize: 12, fontWeight: 500, color: '#1A1A18' }}>{description || selectedCat.name}</div>
                <div style={{ fontSize: 10.5, color: '#8B7E6E' }}>{new Date(date).toLocaleDateString('id-ID', { day: 'numeric', month: 'long', year: 'numeric' })}</div>
              </div>
            </div>
            <div style={{ fontSize: 14, fontWeight: 600, color: isIncome ? '#15803D' : '#DC2626' }}>{isIncome ? '+' : '−'}{fmt(parseAmount(amount))}</div>
          </div>
        )}

        {/* Actions */}
        <div style={{ display: 'flex', gap: 9, marginBottom: 32 }}>
          <button onClick={() => router.back()} onMouseEnter={() => setHoverCancel(true)} onMouseLeave={() => setHoverCancel(false)}
            style={{ flex: 1, padding: '11px', borderRadius: 9, border: '1px solid #DDD8CF', background: hoverCancel ? '#F5F2EB' : '#fff', color: '#5C5650', fontSize: 13, fontWeight: 500, fontFamily: 'inherit', cursor: 'pointer', transition: 'background 0.12s' }}>
            Batal
          </button>
          <button onClick={handleSubmit} disabled={submitting} onMouseEnter={() => setHoverSubmit(true)} onMouseLeave={() => setHoverSubmit(false)}
            style={{ flex: 2, padding: '11px', borderRadius: 9, border: 'none', background: submitting ? '#9C9892' : isIncome ? (hoverSubmit ? '#15803D' : '#16A34A') : (hoverSubmit ? '#B91C1C' : '#DC2626'), color: '#fff', fontSize: 13, fontWeight: 600, fontFamily: 'inherit', cursor: submitting ? 'not-allowed' : 'pointer', transition: 'background 0.12s', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 6 }}>
            {submitting
              ? (<><svg width="14" height="14" viewBox="0 0 14 14" fill="none" style={{ animation: 'spin 1s linear infinite' }}><circle cx="7" cy="7" r="5.5" stroke="rgba(255,255,255,0.4)" strokeWidth="1.5"/><path d="M7 1.5A5.5 5.5 0 0 1 12.5 7" stroke="#fff" strokeWidth="1.5" strokeLinecap="round"/></svg>Menyimpan...</>)
              : `Simpan ${isIncome ? 'Pemasukan' : 'Pengeluaran'}`}
          </button>
        </div>
      </div>
    </>
  )
}