'use client'

import { useEffect, useState, useRef } from 'react'
import { useRouter } from 'next/navigation'
import { createClient } from '@/lib/supabase/client'

/* ── Tokens (konsisten dengan halaman lain) ── */
const SB    = '#7AAACE'
const SB_D  = '#5E96C0'
const GREEN = '#2d5a27'
const RED   = '#DC2626'

/* ── Icon pool untuk kategori baru ── */
const ICON_OPTIONS = [
  '💰','💸','🏦','📈','📉','💼','🧾','🎁','🤝','🏛️',
  '👥','💡','💧','🔥','🌐','🛒','🔧','🏠','🚗','🍽️',
  '🎉','🏥','📋','🔒','🧹','🪑','💻','📦','⭐','🎯',
  '🔑','📌','🗂️','📝','🍱','📄','🛍️','🏪','🎓','🌿',
]

type Category = {
  id: string
  name: string
  icon: string
  type: 'income' | 'expense'
  is_active: boolean
}

type ModalState =
  | { mode: 'add';  type: 'income' | 'expense' }
  | { mode: 'edit'; cat: Category }
  | { mode: 'delete'; cat: Category }
  | null

const fmt = (n: number) =>
  new Intl.NumberFormat('id-ID', { style: 'currency', currency: 'IDR', maximumFractionDigits: 0 }).format(n)

export default function KategoriPage() {
  const router = useRouter()

  const [workspace,   setWorkspace]   = useState<any>(null)
  const [categories,  setCategories]  = useState<Category[]>([])
  const [loading,     setLoading]     = useState(true)
  const [saving,      setSaving]      = useState(false)
  const [error,       setError]       = useState('')
  const [modal,       setModal]       = useState<ModalState>(null)
  const [activeTab,   setActiveTab]   = useState<'income' | 'expense'>('income')

  /* form state (add / edit) */
  const [formName,    setFormName]    = useState('')
  const [formIcon,    setFormIcon]    = useState('⭐')
  const [showIcons,   setShowIcons]   = useState(false)

  /* stats per kategori (jumlah transaksi) */
  const [catStats, setCatStats] = useState<Record<string, number>>({})

  /* ── Load data ── */
  useEffect(() => { load() }, [])

  async function load() {
    setLoading(true)
    const supabase = createClient()
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) { router.push('/login'); return }

    const { data: memberships } = await supabase
      .from('workspace_members')
      .select('workspace_id, workspaces(id, name, type)')
      .eq('user_id', user.id)
      .limit(1)

    if (!memberships?.length) { router.push('/setup'); return }

    const ws = (memberships[0] as any).workspaces
    setWorkspace(ws)

    const { data: cats } = await supabase
      .from('categories')
      .select('id, name, icon, type, is_active')
      .eq('workspace_id', ws.id)
      .order('type')
      .order('name')

    setCategories((cats as Category[]) || [])

    /* Hitung jumlah transaksi per kategori */
    const { data: txStats } = await supabase
      .from('transactions')
      .select('category_id')
      .eq('workspace_id', ws.id)

    if (txStats) {
      const counts: Record<string, number> = {}
      txStats.forEach((t: any) => {
        if (t.category_id) counts[t.category_id] = (counts[t.category_id] || 0) + 1
      })
      setCatStats(counts)
    }

    setLoading(false)
  }

  /* ── Buka modal ── */
  const openAdd = (type: 'income' | 'expense') => {
    setFormName(''); setFormIcon('⭐'); setShowIcons(false); setError('')
    setModal({ mode: 'add', type })
  }
  const openEdit = (cat: Category) => {
    setFormName(cat.name); setFormIcon(cat.icon); setShowIcons(false); setError('')
    setModal({ mode: 'edit', cat })
  }
  const closeModal = () => { setModal(null); setError('') }

  /* ── Toggle aktif/nonaktif ── */
  const toggleActive = async (cat: Category) => {
    const supabase = createClient()
    await supabase.from('categories').update({ is_active: !cat.is_active }).eq('id', cat.id)
    setCategories(prev => prev.map(c => c.id === cat.id ? { ...c, is_active: !c.is_active } : c))
  }

  /* ── Simpan (add/edit) ── */
  const handleSave = async () => {
    if (!formName.trim()) { setError('Nama kategori wajib diisi.'); return }
    setSaving(true); setError('')
    const supabase = createClient()

    if (modal?.mode === 'add') {
      const type = modal.type
      // Cek duplikat
      const dup = categories.find(c => c.name.toLowerCase() === formName.trim().toLowerCase() && c.type === type)
      if (dup) { setError('Nama kategori sudah ada.'); setSaving(false); return }

      const { data, error: err } = await supabase
        .from('categories')
        .insert({ workspace_id: workspace.id, name: formName.trim(), icon: formIcon, type, is_active: true })
        .select('id, name, icon, type, is_active')
        .single()

      if (err || !data) { setError(err?.message || 'Gagal menyimpan.'); setSaving(false); return }
      setCategories(prev => [...prev, data as Category])

    } else if (modal?.mode === 'edit') {
      const { error: err } = await supabase
        .from('categories')
        .update({ name: formName.trim(), icon: formIcon })
        .eq('id', modal.cat.id)

      if (err) { setError(err.message); setSaving(false); return }
      setCategories(prev => prev.map(c => c.id === modal.cat.id ? { ...c, name: formName.trim(), icon: formIcon } : c))
    }

    setSaving(false)
    closeModal()
  }

  /* ── Hapus ── */
  const handleDelete = async () => {
    if (modal?.mode !== 'delete') return
    setSaving(true)
    const supabase = createClient()
    await supabase.from('categories').delete().eq('id', modal.cat.id)
    setCategories(prev => prev.filter(c => c.id !== modal.cat.id))
    setSaving(false)
    closeModal()
  }

  /* ── Derived ── */
  const incomeCats  = categories.filter(c => c.type === 'income')
  const expenseCats = categories.filter(c => c.type === 'expense')
  const shown       = activeTab === 'income' ? incomeCats : expenseCats
  const activeCount = shown.filter(c => c.is_active).length

  /* ── Shared card style ── */
  const card: React.CSSProperties = {
    background: '#fff', borderRadius: 12, border: '1px solid #E8E0D4',
  }

  if (loading) return (
    <div style={{ minHeight: 300, display: 'flex', alignItems: 'center', justifyContent: 'center', fontFamily: 'DM Sans, system-ui, sans-serif' }}>
      <div style={{ textAlign: 'center' }}>
        <div style={{ fontSize: 28, marginBottom: 10 }}>⏳</div>
        <p style={{ fontSize: 13, color: '#8B7E6E' }}>Memuat kategori...</p>
      </div>
    </div>
  )

  return (
    <div style={{ maxWidth: 720, margin: '0 auto', fontFamily: 'DM Sans, system-ui, sans-serif' }}>
      <style>{`
        @import url('https://fonts.googleapis.com/css2?family=DM+Sans:wght@400;500;600&display=swap');
        *, *::before, *::after { box-sizing: border-box; }
        .kat-row { transition: background 0.1s; }
        .kat-row:hover { background: #FAFAF8 !important; }
        .kat-row:hover .kat-actions { opacity: 1 !important; }
        .kat-actions { opacity: 0; transition: opacity 0.15s; }
        .kat-btn { transition: background 0.12s; border: none; cursor: pointer; border-radius: 6px; padding: 5px 8px; font-family: inherit; font-size: 11.5px; font-weight: 500; }
        .kat-tab { transition: all 0.15s; cursor: pointer; border: none; font-family: inherit; font-weight: 500; }
        .icon-opt { transition: all 0.1s; cursor: pointer; font-size: 18px; padding: 6px; border-radius: 6px; border: 1.5px solid transparent; }
        .icon-opt:hover { background: #EBF4FB; border-color: ${SB}; }
        .icon-opt.selected { background: #EBF4FB; border-color: ${SB}; }
        .toggle-track { transition: background 0.2s; }
        .toggle-thumb { transition: transform 0.2s; }
        @keyframes kat-fade { from{opacity:0;transform:translateY(6px)} to{opacity:1;transform:none} }
        .kat-item { animation: kat-fade 0.2s ease forwards; }
        @keyframes modal-in { from{opacity:0;transform:scale(0.95)} to{opacity:1;transform:scale(1)} }
        .modal-box { animation: modal-in 0.2s cubic-bezier(0.34,1.56,0.64,1); }
        input:focus { outline: none !important; border-color: ${SB} !important; box-shadow: 0 0 0 3px rgba(122,170,206,0.15) !important; }
      `}</style>

      {/* ── Header ── */}
      <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', marginBottom: 20 }}>
        <div>
          <h2 style={{ fontSize: 22, fontWeight: 600, color: '#1A1A18', letterSpacing: '-0.4px', margin: 0 }}>Kategori</h2>
          <p style={{ fontSize: 12, color: '#8B7E6E', marginTop: 3, marginBottom: 0 }}>
            {workspace?.name} · {incomeCats.length} pemasukan, {expenseCats.length} pengeluaran
          </p>
        </div>
        <button
          onClick={() => openAdd(activeTab)}
          style={{
            display: 'flex', alignItems: 'center', gap: 6,
            padding: '8px 16px', background: SB, color: '#fff',
            border: 'none', borderRadius: 9, fontSize: 12.5,
            fontWeight: 500, cursor: 'pointer', fontFamily: 'inherit',
            transition: 'background 0.12s',
          }}
          onMouseEnter={e => (e.currentTarget.style.background = SB_D)}
          onMouseLeave={e => (e.currentTarget.style.background = SB)}
        >
          <svg width="11" height="11" viewBox="0 0 12 12" fill="none">
            <path d="M6 1v10M1 6h10" stroke="#fff" strokeWidth="1.8" strokeLinecap="round"/>
          </svg>
          Tambah Kategori
        </button>
      </div>

      {/* ── Stat cards ── */}
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: 10, marginBottom: 16 }}>
        {[
          {
            label: 'Total Kategori',
            value: categories.length,
            sub: `${categories.filter(c => c.is_active).length} aktif`,
            icon: '🗂️',
            bg: '#F5F0EA', color: '#3d3a35',
          },
          {
            label: 'Pemasukan',
            value: incomeCats.length,
            sub: `${incomeCats.filter(c => c.is_active).length} aktif`,
            icon: '↑',
            bg: '#F0FDF4', color: '#15803D',
          },
          {
            label: 'Pengeluaran',
            value: expenseCats.length,
            sub: `${expenseCats.filter(c => c.is_active).length} aktif`,
            icon: '↓',
            bg: '#FEF2F2', color: '#DC2626',
          },
        ].map(s => (
          <div key={s.label} style={{ ...card, padding: '14px 16px' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 8 }}>
              <div style={{ width: 28, height: 28, borderRadius: 7, background: s.bg, display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 14, color: s.color, fontWeight: 700 }}>
                {s.icon}
              </div>
              <span style={{ fontSize: 11, fontWeight: 500, color: '#8B7E6E' }}>{s.label}</span>
            </div>
            <div style={{ fontSize: 22, fontWeight: 600, color: '#1A1A18', letterSpacing: '-0.5px' }}>{s.value}</div>
            <div style={{ fontSize: 10.5, color: '#8B7E6E', marginTop: 3 }}>{s.sub}</div>
          </div>
        ))}
      </div>

      {/* ── Tabs ── */}
      <div style={{ ...card, overflow: 'hidden' }}>
        {/* Tab header */}
        <div style={{ display: 'flex', borderBottom: '1px solid #F2EDE5' }}>
          {(['income', 'expense'] as const).map(tab => {
            const active = activeTab === tab
            const count  = tab === 'income' ? incomeCats.length : expenseCats.length
            return (
              <button
                key={tab}
                onClick={() => setActiveTab(tab)}
                className="kat-tab"
                style={{
                  flex: 1, padding: '13px 16px',
                  background: active ? '#fff' : '#FAFAF8',
                  borderBottom: active ? `2px solid ${tab === 'income' ? '#16A34A' : RED}` : '2px solid transparent',
                  color: active ? (tab === 'income' ? '#15803D' : RED) : '#8B7E6E',
                  fontSize: 13,
                }}
              >
                <span style={{ marginRight: 6 }}>{tab === 'income' ? '↑' : '↓'}</span>
                {tab === 'income' ? 'Pemasukan' : 'Pengeluaran'}
                <span style={{
                  marginLeft: 7, fontSize: 10.5, fontWeight: 600,
                  padding: '2px 7px', borderRadius: 99,
                  background: active ? (tab === 'income' ? '#DCFCE7' : '#FEE2E2') : '#EDE8DF',
                  color: active ? (tab === 'income' ? '#15803D' : RED) : '#8B7E6E',
                }}>
                  {count}
                </span>
              </button>
            )
          })}
        </div>

        {/* Sub-header: aktif count + add button */}
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '10px 18px', borderBottom: '1px solid #F5F1EC', background: '#FAFAF8' }}>
          <span style={{ fontSize: 11.5, color: '#8B7E6E' }}>
            {activeCount} dari {shown.length} kategori aktif
          </span>
          <button
            onClick={() => openAdd(activeTab)}
            style={{
              fontSize: 11, color: SB, background: 'none', border: 'none',
              cursor: 'pointer', fontFamily: 'inherit', fontWeight: 600,
              display: 'flex', alignItems: 'center', gap: 4,
            }}
          >
            <svg width="10" height="10" viewBox="0 0 12 12" fill="none">
              <path d="M6 1v10M1 6h10" stroke={SB} strokeWidth="1.8" strokeLinecap="round"/>
            </svg>
            Tambah {activeTab === 'income' ? 'Pemasukan' : 'Pengeluaran'}
          </button>
        </div>

        {/* List */}
        {shown.length === 0 ? (
          <div style={{ textAlign: 'center', padding: '48px 20px' }}>
            <div style={{ fontSize: 32, marginBottom: 10 }}>{activeTab === 'income' ? '💰' : '💸'}</div>
            <p style={{ fontSize: 13, color: '#8B7E6E', marginBottom: 14 }}>
              Belum ada kategori {activeTab === 'income' ? 'pemasukan' : 'pengeluaran'}
            </p>
            <button
              onClick={() => openAdd(activeTab)}
              style={{
                fontSize: 12, fontWeight: 500, color: '#fff', padding: '7px 16px',
                borderRadius: 8, background: SB, border: 'none', cursor: 'pointer', fontFamily: 'inherit',
              }}
            >
              + Tambah Sekarang
            </button>
          </div>
        ) : (
          shown.map((cat, i) => {
            const txCount = catStats[cat.id] || 0
            return (
              <div
                key={cat.id}
                className="kat-row kat-item"
                style={{
                  display: 'grid',
                  gridTemplateColumns: '1fr auto',
                  alignItems: 'center',
                  padding: '12px 18px',
                  borderBottom: i < shown.length - 1 ? '1px solid #F5F1EC' : 'none',
                  background: '#fff',
                  animationDelay: `${i * 0.03}s`,
                }}
              >
                {/* Kiri: icon + nama + badge */}
                <div style={{ display: 'flex', alignItems: 'center', gap: 11, minWidth: 0 }}>
                  <div style={{
                    width: 36, height: 36, borderRadius: 9, flexShrink: 0,
                    background: cat.type === 'income' ? '#F0FDF4' : '#FEF2F2',
                    display: 'flex', alignItems: 'center', justifyContent: 'center',
                    fontSize: 17, opacity: cat.is_active ? 1 : 0.45,
                  }}>
                    {cat.icon || (cat.type === 'income' ? '💰' : '💸')}
                  </div>
                  <div style={{ minWidth: 0 }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 7 }}>
                      <span style={{
                        fontSize: 13, fontWeight: 500,
                        color: cat.is_active ? '#1A1A18' : '#B0A89A',
                        overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap',
                      }}>
                        {cat.name}
                      </span>
                      {!cat.is_active && (
                        <span style={{ fontSize: 10, padding: '1px 6px', borderRadius: 99, background: '#F0EDE6', color: '#9C9082', whiteSpace: 'nowrap' }}>
                          nonaktif
                        </span>
                      )}
                    </div>
                    <div style={{ fontSize: 10.5, color: '#8B7E6E', marginTop: 2 }}>
                      {txCount > 0
                        ? `${txCount} transaksi`
                        : 'Belum ada transaksi'}
                    </div>
                  </div>
                </div>

                {/* Kanan: toggle + actions */}
                <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                  {/* Toggle aktif */}
                  <div
                    onClick={() => toggleActive(cat)}
                    className="toggle-track"
                    title={cat.is_active ? 'Nonaktifkan' : 'Aktifkan'}
                    style={{
                      width: 36, height: 20, borderRadius: 99, cursor: 'pointer', position: 'relative', flexShrink: 0,
                      background: cat.is_active
                        ? (cat.type === 'income' ? '#16A34A' : RED)
                        : '#D4CFC4',
                    }}
                  >
                    <div
                      className="toggle-thumb"
                      style={{
                        position: 'absolute', top: 3, width: 14, height: 14, borderRadius: '50%',
                        background: '#fff', boxShadow: '0 1px 3px rgba(0,0,0,0.2)',
                        transform: cat.is_active ? 'translateX(19px)' : 'translateX(3px)',
                      }}
                    />
                  </div>

                  {/* Edit / Hapus */}
                  <div className="kat-actions" style={{ display: 'flex', gap: 3 }}>
                    <button
                      onClick={() => openEdit(cat)}
                      className="kat-btn"
                      style={{ background: 'transparent', color: '#5C5650' }}
                      onMouseEnter={e => (e.currentTarget.style.background = '#F5F0EA')}
                      onMouseLeave={e => (e.currentTarget.style.background = 'transparent')}
                      title="Edit"
                    >
                      ✏️
                    </button>
                    <button
                      onClick={() => { setModal({ mode: 'delete', cat }); setError('') }}
                      className="kat-btn"
                      style={{ background: 'transparent', color: RED }}
                      onMouseEnter={e => (e.currentTarget.style.background = '#FEF2F2')}
                      onMouseLeave={e => (e.currentTarget.style.background = 'transparent')}
                      title="Hapus"
                      disabled={txCount > 0}
                    >
                      🗑️
                    </button>
                  </div>
                </div>
              </div>
            )
          })
        )}
      </div>

      {/* ── Info footer ── */}
      <p style={{ fontSize: 11, color: '#B0A89A', marginTop: 12, textAlign: 'center' }}>
        Kategori nonaktif tidak muncul saat mencatat transaksi baru. Kategori yang sudah memiliki transaksi tidak dapat dihapus.
      </p>

      {/* ══════════════════════════════════════════════════
          MODAL: Tambah / Edit
      ══════════════════════════════════════════════════ */}
      {(modal?.mode === 'add' || modal?.mode === 'edit') && (
        <div
          style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.4)', zIndex: 50, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 16 }}
          onClick={closeModal}
        >
          <div
            className="modal-box"
            onClick={e => e.stopPropagation()}
            style={{ background: '#fff', borderRadius: 16, padding: '24px', width: '100%', maxWidth: 380 }}
          >
            <h3 style={{ fontSize: 16, fontWeight: 600, color: '#1A1A18', margin: '0 0 18px' }}>
              {modal.mode === 'add'
                ? `Tambah Kategori ${modal.type === 'income' ? 'Pemasukan' : 'Pengeluaran'}`
                : 'Edit Kategori'}
            </h3>

            {/* Pilih Icon */}
            <label style={{ fontSize: 11.5, fontWeight: 500, color: '#5C5650', display: 'block', marginBottom: 6 }}>
              Ikon
            </label>
            <div
              onClick={() => setShowIcons(v => !v)}
              style={{
                display: 'inline-flex', alignItems: 'center', gap: 8,
                padding: '7px 12px', borderRadius: 8, border: '1px solid #DDD8CF',
                cursor: 'pointer', marginBottom: showIcons ? 8 : 16, background: '#FAFAF8',
              }}
            >
              <span style={{ fontSize: 22 }}>{formIcon}</span>
              <span style={{ fontSize: 12, color: '#5C5650' }}>{showIcons ? '▲ Tutup' : '▼ Ganti ikon'}</span>
            </div>

            {showIcons && (
              <div style={{
                display: 'flex', flexWrap: 'wrap', gap: 4, padding: '10px',
                border: '1px solid #E8E0D4', borderRadius: 8, marginBottom: 16,
                maxHeight: 160, overflowY: 'auto', background: '#FAFAF8',
              }}>
                {ICON_OPTIONS.map(ic => (
                  <div
                    key={ic}
                    className={`icon-opt${formIcon === ic ? ' selected' : ''}`}
                    onClick={() => { setFormIcon(ic); setShowIcons(false) }}
                  >
                    {ic}
                  </div>
                ))}
              </div>
            )}

            {/* Nama */}
            <label style={{ fontSize: 11.5, fontWeight: 500, color: '#5C5650', display: 'block', marginBottom: 6 }}>
              Nama Kategori <span style={{ color: RED }}>*</span>
            </label>
            <input
              type="text"
              value={formName}
              onChange={e => setFormName(e.target.value)}
              onKeyDown={e => e.key === 'Enter' && handleSave()}
              placeholder="Contoh: Iuran Warga"
              autoFocus
              style={{
                width: '100%', padding: '9px 12px', border: '1px solid #DDD8CF',
                borderRadius: 8, fontSize: 13, fontFamily: 'inherit', color: '#1A1A18',
                background: '#fff', marginBottom: error ? 8 : 20,
              }}
            />

            {error && (
              <p style={{ fontSize: 12, color: RED, marginBottom: 14 }}>{error}</p>
            )}

            <div style={{ display: 'flex', gap: 9 }}>
              <button
                onClick={closeModal}
                style={{
                  flex: 1, padding: '10px', border: '1px solid #DDD8CF', background: '#fff',
                  color: '#5C5650', borderRadius: 9, fontSize: 13, cursor: 'pointer', fontFamily: 'inherit',
                }}
              >
                Batal
              </button>
              <button
                onClick={handleSave}
                disabled={saving}
                style={{
                  flex: 2, padding: '10px', border: 'none',
                  background: saving ? '#9C9892' : (modal.mode === 'add' && modal.type === 'expense' ? RED : GREEN),
                  color: '#fff', borderRadius: 9, fontSize: 13, fontWeight: 600,
                  cursor: saving ? 'not-allowed' : 'pointer', fontFamily: 'inherit',
                  opacity: saving ? 0.7 : 1,
                }}
              >
                {saving ? 'Menyimpan...' : modal.mode === 'add' ? '+ Tambah' : '✓ Simpan Perubahan'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ══════════════════════════════════════════════════
          MODAL: Hapus
      ══════════════════════════════════════════════════ */}
      {modal?.mode === 'delete' && (
        <div
          style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.4)', zIndex: 50, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 16 }}
          onClick={closeModal}
        >
          <div
            className="modal-box"
            onClick={e => e.stopPropagation()}
            style={{ background: '#fff', borderRadius: 16, padding: '28px 24px', width: '100%', maxWidth: 340, textAlign: 'center' }}
          >
            <div style={{ width: 52, height: 52, borderRadius: 12, background: '#FEF2F2', display: 'flex', alignItems: 'center', justifyContent: 'center', margin: '0 auto 14px', fontSize: 24 }}>
              🗑️
            </div>
            <h3 style={{ fontSize: 16, fontWeight: 600, color: '#1A1A18', margin: '0 0 6px' }}>
              Hapus "{modal.cat.name}"?
            </h3>
            <p style={{ fontSize: 13, color: '#8B7E6E', margin: '0 0 20px' }}>
              Kategori ini akan dihapus permanen. Tindakan ini tidak bisa dibatalkan.
            </p>
            <div style={{ display: 'flex', gap: 10 }}>
              <button
                onClick={closeModal}
                style={{ flex: 1, padding: '10px', border: '1px solid #E0D9CE', background: '#fff', color: '#3d3a35', borderRadius: 10, fontSize: 13, cursor: 'pointer', fontFamily: 'inherit' }}
              >
                Batal
              </button>
              <button
                onClick={handleDelete}
                disabled={saving}
                style={{ flex: 1, padding: '10px', border: 'none', background: RED, color: '#fff', borderRadius: 10, fontSize: 13, fontWeight: 500, cursor: saving ? 'not-allowed' : 'pointer', fontFamily: 'inherit', opacity: saving ? 0.6 : 1 }}
              >
                {saving ? 'Menghapus...' : 'Ya, Hapus'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
