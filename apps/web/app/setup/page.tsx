'use client'

import { useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'
import { createClient } from '@/lib/supabase/client'

const TYPE_OPTIONS = [
  { value: 'rt',       label: 'RT / RW',        icon: '🏘️', desc: 'Iuran warga, kas, tagihan listrik & air' },
  { value: 'kosan',    label: 'Kosan',           icon: '🏠', desc: 'Sewa kamar, listrik, internet, perawatan' },
  { value: 'warteg',   label: 'Warteg / Usaha',  icon: '🍽️', desc: 'Pendapatan harian, bahan baku, gaji' },
  { value: 'personal', label: 'Personal',        icon: '👤', desc: 'Keuangan pribadi & keluarga' },
]

const DEFAULT_CATS: Record<string, { income: string[]; expense: string[] }> = {
  rt: {
    income:  ['Iuran Warga', 'Kas RT', 'Donasi', 'Denda', 'Sumbangan', 'Lain-lain'],
    expense: ['Listrik', 'Air', 'Keamanan', 'Kebersihan', 'Administrasi', 'Sosial', 'Perawatan', 'Lain-lain'],
  },
  kosan: {
    income:  ['Sewa Kamar', 'Deposit', 'Listrik Tenant', 'Internet Tenant', 'Lain-lain'],
    expense: ['Listrik', 'Air', 'Internet', 'Perawatan', 'Furnitur', 'Kebersihan', 'Lain-lain'],
  },
  warteg: {
    income:  ['Pendapatan Harian', 'Catering', 'Pesanan Online', 'Lain-lain'],
    expense: ['Bahan Baku', 'Gaji Karyawan', 'Listrik', 'Gas', 'Peralatan', 'Sewa Tempat', 'Lain-lain'],
  },
  personal: {
    income:  ['Gaji', 'Freelance', 'Investasi', 'Hadiah', 'Lain-lain'],
    expense: ['Makan', 'Transport', 'Belanja', 'Tagihan', 'Hiburan', 'Kesehatan', 'Tabungan', 'Lain-lain'],
  },
}

const SB = '#7AAACE'
const GREEN = '#2d5a27'

export default function SetupPage() {
  const router = useRouter()

  const [step, setStep]           = useState(1)
  const [wsName, setWsName]       = useState('')
  const [wsType, setWsType]       = useState('rt')
  const [incomeCats, setIncomeCats]   = useState<string[]>([])
  const [expenseCats, setExpenseCats] = useState<string[]>([])
  const [newCat, setNewCat]       = useState('')
  const [addingFor, setAddingFor] = useState<'income' | 'expense' | null>(null)
  const [creating, setCreating]   = useState(false)
  const [error, setError]         = useState('')

  // Cek kalau sudah punya workspace → redirect
  useEffect(() => {
    const supabase = createClient()
    supabase.auth.getUser().then(async ({ data: { user } }) => {
      if (!user) { router.push('/login'); return }
      // Gunakan query ke workspaces via join agar tidak memicu RLS recursion di workspace_members
      const { data, error } = await supabase
        .from('workspaces')
        .select('id, workspace_members!inner(user_id)')
        .eq('workspace_members.user_id', user.id)
        .limit(1)
      if (!error && data?.length) router.push('/dashboard')
    })
  }, [])

  // Reset kategori saat tipe berubah
  useEffect(() => {
    const cats = DEFAULT_CATS[wsType]
    setIncomeCats([...cats.income])
    setExpenseCats([...cats.expense])
  }, [wsType])

  const toggleCat = (type: 'income' | 'expense', name: string) => {
    if (type === 'income') {
      setIncomeCats(prev =>
        prev.includes(name) ? prev.filter(c => c !== name) : [...prev, name]
      )
    } else {
      setExpenseCats(prev =>
        prev.includes(name) ? prev.filter(c => c !== name) : [...prev, name]
      )
    }
  }

  const addCustomCat = (type: 'income' | 'expense') => {
    const val = newCat.trim()
    if (!val) return
    if (type === 'income') {
      if (!incomeCats.includes(val)) setIncomeCats(prev => [...prev, val])
    } else {
      if (!expenseCats.includes(val)) setExpenseCats(prev => [...prev, val])
    }
    setNewCat('')
    setAddingFor(null)
  }

  const handleCreate = async () => {
    if (!wsName.trim()) { setError('Nama workspace wajib diisi.'); return }
    if (incomeCats.length === 0 && expenseCats.length === 0) {
      setError('Pilih minimal satu kategori.'); return
    }

    setCreating(true)
    setError('')
    const supabase = createClient()
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) { router.push('/login'); return }

    // 1. Buat workspace
    const { data: ws, error: wsErr } = await supabase
      .from('workspaces')
      .insert({ name: wsName.trim(), type: wsType })
      .select('id')
      .single()

    if (wsErr || !ws) {
      setError(wsErr?.message || 'Gagal membuat workspace.')
      setCreating(false)
      return
    }

    // 2. Tambahkan user sebagai owner
    await supabase.from('workspace_members').insert({
      workspace_id: ws.id,
      user_id: user.id,
      role: 'owner',
    })

    // 3. Insert kategori yang dipilih
    const catPayload = [
      ...incomeCats.map(name => ({ workspace_id: ws.id, name, type: 'income', is_active: true })),
      ...expenseCats.map(name => ({ workspace_id: ws.id, name, type: 'expense', is_active: true })),
    ]
    await supabase.from('categories').insert(catPayload)

    setStep(3)
    setCreating(false)
  }

  const selectedType = TYPE_OPTIONS.find(t => t.value === wsType)

  return (
    <div className="setup-outer" style={{
      minHeight: '100vh', background: '#FAFAF9',
      display: 'flex', alignItems: 'flex-start', justifyContent: 'center',
      padding: '24px 16px', fontFamily: 'DM Sans, system-ui, sans-serif',
    }}>
      <style>{`
        @keyframes fadeUp { from{opacity:0;transform:translateY(14px)} to{opacity:1;transform:none} }
        @keyframes scaleIn { from{opacity:0;transform:scale(0.95)} to{opacity:1;transform:scale(1)} }
        .fade-up { animation: fadeUp 0.35s cubic-bezier(0.22,1,0.36,1) forwards; }
        .scale-in { animation: scaleIn 0.4s cubic-bezier(0.34,1.56,0.64,1) forwards; }
        .btn-press:active { transform: scale(0.95); }
        .btn-press { transition: transform 0.12s, background 0.15s, border-color 0.15s; }
        .type-card { transition: border-color 0.15s, background 0.15s; }
        .type-card:hover { border-color: #aac8e0 !important; background: #f0f6fb !important; }
        .cat-chip { transition: all 0.15s; cursor: pointer; }
        .cat-chip:hover { opacity: 0.8; }
        input:focus { outline: none; border-color: #aac8e0 !important; }
        .setup-card::-webkit-scrollbar { width: 4px; }
        .setup-card::-webkit-scrollbar-track { background: transparent; }
        .setup-card::-webkit-scrollbar-thumb { background: #E3DED6; border-radius: 4px; }
        @media (min-height: 700px) { .setup-outer { align-items: center !important; } }
      `}</style>

      <div className="fade-up setup-card" style={{
        background: '#fff', borderRadius: 20, border: '1px solid #E3DED6',
        padding: '36px 32px', width: '100%', maxWidth: 480,
        boxShadow: '0 4px 24px rgba(0,0,0,0.06)',
        maxHeight: 'calc(100vh - 48px)', overflowY: 'auto',
      }}>
        {/* Logo */}
        <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 28 }}>
          <div style={{ width: 36, height: 36, borderRadius: 10, background: SB, display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#fff', fontSize: 16, fontFamily: 'Georgia,serif', fontWeight: 700 }}>K</div>
          <div>
            <div style={{ fontSize: 16, fontWeight: 600, color: '#0f0e0c', letterSpacing: '-0.2px' }}>KasRT</div>
            <div style={{ fontSize: 11, color: '#9C9892', marginTop: 1 }}>Keuangan Bersama</div>
          </div>
        </div>

        {/* Step indicator */}
        <div style={{ display: 'flex', alignItems: 'center', marginBottom: 28 }}>
          {[
            { n: 1, label: 'Workspace' },
            { n: 2, label: 'Kategori' },
            { n: 3, label: 'Selesai' },
          ].map((s, i) => (
            <div key={s.n} style={{ display: 'flex', alignItems: 'center', flex: i < 2 ? 1 : 'none' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                <div style={{
                  width: 24, height: 24, borderRadius: '50%', fontSize: 11, fontWeight: 600,
                  display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0,
                  background: step > s.n ? GREEN : step === s.n ? SB : '#F0EDE6',
                  color: step >= s.n ? '#fff' : '#9C9892',
                }}>
                  {step > s.n ? '✓' : s.n}
                </div>
                <span style={{
                  fontSize: 12, fontWeight: step === s.n ? 600 : 400,
                  color: step === s.n ? '#0f0e0c' : '#9C9892',
                }}>
                  {s.label}
                </span>
              </div>
              {i < 2 && <div style={{ flex: 1, height: 1, background: '#E3DED6', margin: '0 10px' }} />}
            </div>
          ))}
        </div>

        {/* ─── STEP 1: Nama & Tipe ─────────────────────────────────────────── */}
        {step === 1 && (
          <div>
            <h2 style={{ fontSize: 22, fontWeight: 600, color: '#0f0e0c', marginBottom: 6, letterSpacing: '-0.3px' }}>
              Buat workspace
            </h2>
            <p style={{ fontSize: 13, color: '#7a7469', marginBottom: 24, lineHeight: 1.6 }}>
              Workspace adalah ruang kerja kamu. Bisa untuk RT, kosan, warung, atau keuangan pribadi.
            </p>

            <label style={{ fontSize: 11, fontWeight: 600, color: '#7a7469', textTransform: 'uppercase', letterSpacing: '0.07em', display: 'block', marginBottom: 6 }}>
              Nama workspace
            </label>
            <input
              type="text"
              value={wsName}
              onChange={e => setWsName(e.target.value)}
              placeholder="Contoh: RT 05 Kel. Merdeka"
              style={{
                width: '100%', padding: '10px 14px', border: '1px solid #E3DED6',
                borderRadius: 10, fontSize: 14, fontFamily: 'inherit', color: '#0f0e0c',
                background: '#FAFAF8', marginBottom: 20, boxSizing: 'border-box',
              }}
            />

            <label style={{ fontSize: 11, fontWeight: 600, color: '#7a7469', textTransform: 'uppercase', letterSpacing: '0.07em', display: 'block', marginBottom: 10 }}>
              Tipe workspace
            </label>
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 8, marginBottom: 24 }}>
              {TYPE_OPTIONS.map(t => (
                <div
                  key={t.value}
                  className="type-card btn-press"
                  onClick={() => setWsType(t.value)}
                  style={{
                    border: wsType === t.value ? `2px solid ${SB}` : '1px solid #E3DED6',
                    borderRadius: 12, padding: '14px 12px', cursor: 'pointer',
                    background: wsType === t.value ? '#f0f6fb' : '#FAFAF8',
                  }}
                >
                  <div style={{ fontSize: 22, marginBottom: 8 }}>{t.icon}</div>
                  <div style={{ fontSize: 13, fontWeight: 600, color: '#0f0e0c', marginBottom: 3 }}>{t.label}</div>
                  <div style={{ fontSize: 11.5, color: '#7a7469', lineHeight: 1.4 }}>{t.desc}</div>
                </div>
              ))}
            </div>

            <button
              onClick={() => {
                if (!wsName.trim()) { setError('Nama workspace wajib diisi.'); return }
                setError('')
                setStep(2)
              }}
              className="btn-press"
              style={{
                width: '100%', padding: '12px', background: GREEN, color: '#fff',
                border: 'none', borderRadius: 12, fontSize: 14, fontWeight: 600,
                cursor: 'pointer', fontFamily: 'inherit',
              }}
            >
              Lanjut →
            </button>

            {error && <p style={{ fontSize: 12, color: '#dc2626', marginTop: 10, textAlign: 'center' }}>{error}</p>}
          </div>
        )}

        {/* ─── STEP 2: Kategori ────────────────────────────────────────────── */}
        {step === 2 && (
          <div>
            <h2 style={{ fontSize: 22, fontWeight: 600, color: '#0f0e0c', marginBottom: 6, letterSpacing: '-0.3px' }}>
              Pilih kategori
            </h2>
            <p style={{ fontSize: 13, color: '#7a7469', marginBottom: 24, lineHeight: 1.6 }}>
              Kategori default untuk <strong style={{ color: '#0f0e0c' }}>{selectedType?.label}</strong>. Aktifkan yang relevan, nonaktifkan yang tidak perlu. Bisa diubah kapan saja.
            </p>

            {/* Income */}
            <div style={{ marginBottom: 20 }}>
              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 10 }}>
                <label style={{ fontSize: 11, fontWeight: 600, color: '#16a34a', textTransform: 'uppercase', letterSpacing: '0.07em' }}>
                  ↑ Pemasukan
                </label>
                <button onClick={() => setAddingFor(addingFor === 'income' ? null : 'income')}
                  style={{ fontSize: 11, color: SB, background: 'none', border: 'none', cursor: 'pointer', fontFamily: 'inherit', fontWeight: 600 }}>
                  + Tambah
                </button>
              </div>
              <div style={{ display: 'flex', flexWrap: 'wrap', gap: 7 }}>
                {DEFAULT_CATS[wsType].income.map(cat => (
                  <div
                    key={cat}
                    className="cat-chip"
                    onClick={() => toggleCat('income', cat)}
                    style={{
                      padding: '5px 12px', borderRadius: 99, fontSize: 12.5, fontWeight: 500,
                      border: incomeCats.includes(cat) ? '1.5px solid #b8d9b4' : '1px solid #E3DED6',
                      background: incomeCats.includes(cat) ? '#e8f4e8' : '#F5F2EB',
                      color: incomeCats.includes(cat) ? '#2d5a27' : '#7a7469',
                      userSelect: 'none',
                    }}
                  >
                    {cat}
                  </div>
                ))}
                {incomeCats.filter(c => !DEFAULT_CATS[wsType].income.includes(c)).map(cat => (
                  <div key={cat} className="cat-chip" onClick={() => toggleCat('income', cat)} style={{
                    padding: '5px 12px', borderRadius: 99, fontSize: 12.5, fontWeight: 500,
                    border: '1.5px solid #b8d9b4', background: '#e8f4e8', color: '#2d5a27', userSelect: 'none',
                  }}>{cat} ✕</div>
                ))}
              </div>
              {addingFor === 'income' && (
                <div style={{ display: 'flex', gap: 6, marginTop: 8 }}>
                  <input type="text" value={newCat} onChange={e => setNewCat(e.target.value)}
                    onKeyDown={e => e.key === 'Enter' && addCustomCat('income')}
                    placeholder="Nama kategori baru..."
                    style={{ flex: 1, padding: '7px 10px', border: '1px solid #E3DED6', borderRadius: 8, fontSize: 12.5, fontFamily: 'inherit' }}
                    autoFocus />
                  <button onClick={() => addCustomCat('income')} style={{ padding: '7px 12px', background: GREEN, color: '#fff', border: 'none', borderRadius: 8, fontSize: 12, cursor: 'pointer', fontFamily: 'inherit' }}>
                    Tambah
                  </button>
                </div>
              )}
            </div>

            {/* Expense */}
            <div style={{ marginBottom: 24 }}>
              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 10 }}>
                <label style={{ fontSize: 11, fontWeight: 600, color: '#dc2626', textTransform: 'uppercase', letterSpacing: '0.07em' }}>
                  ↓ Pengeluaran
                </label>
                <button onClick={() => setAddingFor(addingFor === 'expense' ? null : 'expense')}
                  style={{ fontSize: 11, color: SB, background: 'none', border: 'none', cursor: 'pointer', fontFamily: 'inherit', fontWeight: 600 }}>
                  + Tambah
                </button>
              </div>
              <div style={{ display: 'flex', flexWrap: 'wrap', gap: 7 }}>
                {DEFAULT_CATS[wsType].expense.map(cat => (
                  <div key={cat} className="cat-chip" onClick={() => toggleCat('expense', cat)} style={{
                    padding: '5px 12px', borderRadius: 99, fontSize: 12.5, fontWeight: 500,
                    border: expenseCats.includes(cat) ? '1.5px solid #fecaca' : '1px solid #E3DED6',
                    background: expenseCats.includes(cat) ? '#fef2f2' : '#F5F2EB',
                    color: expenseCats.includes(cat) ? '#dc2626' : '#7a7469',
                    userSelect: 'none',
                  }}>{cat}</div>
                ))}
                {expenseCats.filter(c => !DEFAULT_CATS[wsType].expense.includes(c)).map(cat => (
                  <div key={cat} className="cat-chip" onClick={() => toggleCat('expense', cat)} style={{
                    padding: '5px 12px', borderRadius: 99, fontSize: 12.5, fontWeight: 500,
                    border: '1.5px solid #fecaca', background: '#fef2f2', color: '#dc2626', userSelect: 'none',
                  }}>{cat} ✕</div>
                ))}
              </div>
              {addingFor === 'expense' && (
                <div style={{ display: 'flex', gap: 6, marginTop: 8 }}>
                  <input type="text" value={newCat} onChange={e => setNewCat(e.target.value)}
                    onKeyDown={e => e.key === 'Enter' && addCustomCat('expense')}
                    placeholder="Nama kategori baru..."
                    style={{ flex: 1, padding: '7px 10px', border: '1px solid #E3DED6', borderRadius: 8, fontSize: 12.5, fontFamily: 'inherit' }}
                    autoFocus />
                  <button onClick={() => addCustomCat('expense')} style={{ padding: '7px 12px', background: '#dc2626', color: '#fff', border: 'none', borderRadius: 8, fontSize: 12, cursor: 'pointer', fontFamily: 'inherit' }}>
                    Tambah
                  </button>
                </div>
              )}
            </div>

            {error && <p style={{ fontSize: 12, color: '#dc2626', marginBottom: 12 }}>{error}</p>}

            <button onClick={handleCreate} disabled={creating} className="btn-press" style={{
              width: '100%', padding: '12px', background: creating ? '#a3c9a0' : GREEN,
              color: '#fff', border: 'none', borderRadius: 12, fontSize: 14, fontWeight: 600,
              cursor: creating ? 'not-allowed' : 'pointer', fontFamily: 'inherit', marginBottom: 10,
            }}>
              {creating ? 'Membuat workspace...' : '✓ Buat Workspace'}
            </button>
            <button onClick={() => { setStep(1); setError('') }} className="btn-press" style={{
              width: '100%', padding: '10px', background: 'transparent', color: '#7a7469',
              border: '1px solid #E3DED6', borderRadius: 12, fontSize: 13, fontWeight: 500,
              cursor: 'pointer', fontFamily: 'inherit',
            }}>
              ← Kembali
            </button>
          </div>
        )}

        {/* ─── STEP 3: Sukses ──────────────────────────────────────────────── */}
        {step === 3 && (
          <div className="scale-in" style={{ textAlign: 'center' }}>
            <div style={{
              width: 64, height: 64, borderRadius: '50%', background: '#e8f4e8',
              border: '2px solid #b8d9b4', display: 'flex', alignItems: 'center', justifyContent: 'center',
              margin: '0 auto 20px', fontSize: 28,
            }}>✓</div>
            <h2 style={{ fontSize: 22, fontWeight: 600, color: '#0f0e0c', marginBottom: 6, letterSpacing: '-0.3px' }}>
              Workspace siap!
            </h2>
            <p style={{ fontSize: 13, color: '#7a7469', marginBottom: 24, lineHeight: 1.6 }}>
              Kamu sudah bisa mulai mencatat transaksi dan mengundang anggota ke workspace.
            </p>

            <div style={{
              background: '#FAFAF8', border: '1px solid #E3DED6', borderRadius: 12,
              padding: 16, marginBottom: 24, textAlign: 'left',
            }}>
              {[
                { k: 'Nama', v: wsName },
                { k: 'Tipe', v: selectedType?.label },
                { k: 'Kategori pemasukan', v: `${incomeCats.length} kategori` },
                { k: 'Kategori pengeluaran', v: `${expenseCats.length} kategori` },
              ].map(r => (
                <div key={r.k} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '6px 0', borderBottom: '1px solid #F0EDE6' }}>
                  <span style={{ fontSize: 12.5, color: '#7a7469' }}>{r.k}</span>
                  <span style={{ fontSize: 12.5, fontWeight: 600, color: '#0f0e0c' }}>{r.v}</span>
                </div>
              ))}
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', paddingTop: 8 }}>
                <span style={{ fontSize: 12.5, color: '#7a7469' }}>Status</span>
                <span style={{ fontSize: 11.5, fontWeight: 600, background: '#e8f4e8', color: '#2d5a27', border: '1px solid #b8d9b4', padding: '3px 10px', borderRadius: 99 }}>Aktif</span>
              </div>
            </div>

            <button
              onClick={() => router.push('/dashboard')}
              className="btn-press"
              style={{
                width: '100%', padding: '12px', background: GREEN, color: '#fff',
                border: 'none', borderRadius: 12, fontSize: 14, fontWeight: 600,
                cursor: 'pointer', fontFamily: 'inherit', marginBottom: 10,
              }}
            >
              Ke Dashboard →
            </button>
            <button
              onClick={() => router.push('/dashboard/anggota')}
              className="btn-press"
              style={{
                width: '100%', padding: '10px', background: 'transparent', color: '#7a7469',
                border: '1px solid #E3DED6', borderRadius: 12, fontSize: 13, fontWeight: 500,
                cursor: 'pointer', fontFamily: 'inherit',
              }}
            >
              Undang anggota sekarang
            </button>
          </div>
        )}
      </div>
    </div>
  )
}