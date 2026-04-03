'use client'

import { useEffect, useState, useRef } from 'react'
import { useRouter } from 'next/navigation'
import { createClient } from '@/lib/supabase/client'

const TYPE_OPTIONS = [
  { value: 'rt',       label: 'RT / RW',        icon: '🏘️', desc: 'Iuran warga, kas, tagihan listrik & air' },
  { value: 'kosan',    label: 'Kosan',           icon: '🏠', desc: 'Sewa kamar, listrik, internet, perawatan' },
  { value: 'warteg',   label: 'Warteg / Usaha',  icon: '🍽️', desc: 'Pendapatan harian, bahan baku, gaji' },
  { value: 'personal', label: 'Personal',        icon: '👤', desc: 'Keuangan pribadi & keluarga' },
]

const DEFAULT_CATS: Record<string, {
  income:  { name: string; icon: string }[]
  expense: { name: string; icon: string }[]
}> = {
  rt: {
    income:  [
      { name: 'Iuran Warga',   icon: '👥' },
      { name: 'Kas RT',        icon: '🏛️' },
      { name: 'Donasi',        icon: '🎁' },
      { name: 'Denda',         icon: '⚖️' },
      { name: 'Sumbangan',     icon: '🤝' },
      { name: 'Lain-lain',     icon: '💰' },
    ],
    expense: [
      { name: 'Listrik',       icon: '💡' },
      { name: 'Air',           icon: '💧' },
      { name: 'Keamanan',      icon: '🔒' },
      { name: 'Kebersihan',    icon: '🧹' },
      { name: 'Administrasi',  icon: '📋' },
      { name: 'Sosial',        icon: '🏥' },
      { name: 'Perawatan',     icon: '🔧' },
      { name: 'Lain-lain',     icon: '💸' },
    ],
  },
  kosan: {
    income:  [
      { name: 'Sewa Kamar',       icon: '🏠' },
      { name: 'Deposit',          icon: '💼' },
      { name: 'Listrik Tenant',   icon: '💡' },
      { name: 'Internet Tenant',  icon: '🌐' },
      { name: 'Lain-lain',        icon: '💰' },
    ],
    expense: [
      { name: 'Listrik',    icon: '💡' },
      { name: 'Air',        icon: '💧' },
      { name: 'Internet',   icon: '🌐' },
      { name: 'Perawatan',  icon: '🔧' },
      { name: 'Furnitur',   icon: '🪑' },
      { name: 'Kebersihan', icon: '🧹' },
      { name: 'Lain-lain',  icon: '💸' },
    ],
  },
  warteg: {
    income:  [
      { name: 'Pendapatan Harian', icon: '🍽️' },
      { name: 'Catering',          icon: '🍱' },
      { name: 'Pesanan Online',    icon: '📦' },
      { name: 'Lain-lain',         icon: '💰' },
    ],
    expense: [
      { name: 'Bahan Baku',     icon: '🛒' },
      { name: 'Gaji Karyawan',  icon: '👤' },
      { name: 'Listrik',        icon: '💡' },
      { name: 'Gas',            icon: '🔥' },
      { name: 'Peralatan',      icon: '🔧' },
      { name: 'Sewa Tempat',    icon: '🏠' },
      { name: 'Lain-lain',      icon: '💸' },
    ],
  },
  personal: {
    income:  [
      { name: 'Gaji',       icon: '💼' },
      { name: 'Freelance',  icon: '💻' },
      { name: 'Investasi',  icon: '📈' },
      { name: 'Hadiah',     icon: '🎁' },
      { name: 'Lain-lain',  icon: '💰' },
    ],
    expense: [
      { name: 'Makan',      icon: '🍽️' },
      { name: 'Transport',  icon: '🚗' },
      { name: 'Belanja',    icon: '🛍️' },
      { name: 'Tagihan',    icon: '📄' },
      { name: 'Hiburan',    icon: '🎉' },
      { name: 'Kesehatan',  icon: '🏥' },
      { name: 'Tabungan',   icon: '🏦' },
      { name: 'Lain-lain',  icon: '💸' },
    ],
  },
}

const SB    = '#7AAACE'
const GREEN = '#2d5a27'

export default function SetupPage() {
  const router = useRouter()
  const isSubmitting = useRef(false)

  const [step, setStep]     = useState(1)
  const [wsName, setWsName] = useState('')
  const [wsType, setWsType] = useState('rt')
  const [creating, setCreating] = useState(false)
  const [error, setError]       = useState('')

  useEffect(() => {
    const supabase = createClient()
    supabase.auth.getUser().then(async ({ data: { user } }) => {
      if (!user) { router.push('/login'); return }
      const { data, error } = await supabase
        .from('workspaces')
        .select('id, workspace_members!inner(user_id)')
        .eq('workspace_members.user_id', user.id)
        .limit(1)
      if (!error && data?.length) router.push('/dashboard')
    })
  }, [])



  const handleCreate = async () => {
    if (!wsName.trim()) { setError('Nama workspace wajib diisi.'); return }
    if (isSubmitting.current) return
    isSubmitting.current = true

    setCreating(true)
    setError('')
    const supabase = createClient()
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) { router.push('/login'); return }

    // Guard anti duplikat
    const { data: existingMember } = await supabase
      .from('workspace_members')
      .select('workspace_id')
      .eq('user_id', user.id)
      .limit(1)

    if (existingMember?.length) {
      router.push('/dashboard')
      return
    }

    // 1. Buat workspace
    const { data: ws, error: wsErr } = await supabase
      .from('workspaces')
      .insert({ name: wsName.trim(), type: wsType, owner_id: user.id })
      .select('id')
      .single()

    if (wsErr || !ws) {
      setError(wsErr?.message || 'Gagal membuat workspace.')
      setCreating(false)
      isSubmitting.current = false
      return
    }

    // 2. Tambahkan user sebagai owner
    await supabase.from('workspace_members').insert({
      workspace_id: ws.id,
      user_id: user.id,
      role: 'owner',
    })

    // 3. Insert semua kategori default sesuai tipe workspace
    const cats = DEFAULT_CATS[wsType]
    const catPayload = [
      ...cats.income.map(c  => ({ workspace_id: ws.id, name: c.name, icon: c.icon, type: 'income',  is_active: true })),
      ...cats.expense.map(c => ({ workspace_id: ws.id, name: c.name, icon: c.icon, type: 'expense', is_active: true })),
    ]
    const { error: catErr } = await supabase
      .from('categories')
      .upsert(catPayload, { onConflict: 'workspace_id,name,type', ignoreDuplicates: true })

    if (catErr) {
      setError(catErr.message)
      setCreating(false)
      isSubmitting.current = false
      return
    }

    setStep(2)
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
        .cat-chip { transition: all 0.15s; cursor: pointer; user-select: none; }
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
          {[{ n: 1, label: 'Workspace' }, { n: 2, label: 'Selesai' }].map((s, i) => (
            <div key={s.n} style={{ display: 'flex', alignItems: 'center', flex: i < 1 ? 1 : 'none' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                <div style={{
                  width: 24, height: 24, borderRadius: '50%', fontSize: 11, fontWeight: 600,
                  display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0,
                  background: step > s.n ? GREEN : step === s.n ? SB : '#F0EDE6',
                  color: step >= s.n ? '#fff' : '#9C9892',
                }}>
                  {step > s.n ? '✓' : s.n}
                </div>
                <span style={{ fontSize: 12, fontWeight: step === s.n ? 600 : 400, color: step === s.n ? '#0f0e0c' : '#9C9892' }}>{s.label}</span>
              </div>
              {i < 1 && <div style={{ flex: 1, height: 1, background: '#E3DED6', margin: '0 10px' }} />}
            </div>
          ))}
        </div>

        {/* STEP 1 */}
        {step === 1 && (
          <div>
            <h2 style={{ fontSize: 22, fontWeight: 600, color: '#0f0e0c', marginBottom: 6, letterSpacing: '-0.3px' }}>Buat workspace</h2>
            <p style={{ fontSize: 13, color: '#7a7469', marginBottom: 24, lineHeight: 1.6 }}>
              Workspace adalah ruang kerja kamu. Bisa untuk RT, kosan, warung, atau keuangan pribadi.
            </p>
            <label style={{ fontSize: 11, fontWeight: 600, color: '#7a7469', textTransform: 'uppercase', letterSpacing: '0.07em', display: 'block', marginBottom: 6 }}>Nama workspace</label>
            <input type="text" value={wsName} onChange={e => setWsName(e.target.value)}
              placeholder="Contoh: RT 05 Kel. Merdeka"
              style={{ width: '100%', padding: '10px 14px', border: '1px solid #E3DED6', borderRadius: 10, fontSize: 14, fontFamily: 'inherit', color: '#0f0e0c', background: '#FAFAF8', marginBottom: 20, boxSizing: 'border-box' }} />
            <label style={{ fontSize: 11, fontWeight: 600, color: '#7a7469', textTransform: 'uppercase', letterSpacing: '0.07em', display: 'block', marginBottom: 10 }}>Tipe workspace</label>
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 8, marginBottom: 24 }}>
              {TYPE_OPTIONS.map(t => (
                <div key={t.value} className="type-card btn-press" onClick={() => setWsType(t.value)}
                  style={{ border: wsType === t.value ? `2px solid ${SB}` : '1px solid #E3DED6', borderRadius: 12, padding: '14px 12px', cursor: 'pointer', background: wsType === t.value ? '#f0f6fb' : '#FAFAF8' }}>
                  <div style={{ fontSize: 22, marginBottom: 8 }}>{t.icon}</div>
                  <div style={{ fontSize: 13, fontWeight: 600, color: '#0f0e0c', marginBottom: 3 }}>{t.label}</div>
                  <div style={{ fontSize: 11.5, color: '#7a7469', lineHeight: 1.4 }}>{t.desc}</div>
                </div>
              ))}
            </div>
            {error && <p style={{ fontSize: 12, color: '#dc2626', marginBottom: 10 }}>{error}</p>}
            <button onClick={handleCreate} disabled={creating} className="btn-press"
              style={{ width: '100%', padding: '12px', background: creating ? '#a3c9a0' : GREEN, color: '#fff', border: 'none', borderRadius: 12, fontSize: 14, fontWeight: 600, cursor: creating ? 'not-allowed' : 'pointer', fontFamily: 'inherit' }}>
              {creating ? 'Membuat workspace...' : '✓ Buat Workspace'}
            </button>
          </div>
        )}



        {/* STEP 3 */}
        {step === 2 && (
          <div className="scale-in" style={{ textAlign: 'center' }}>
            <div style={{ width: 64, height: 64, borderRadius: '50%', background: '#e8f4e8', border: '2px solid #b8d9b4', display: 'flex', alignItems: 'center', justifyContent: 'center', margin: '0 auto 20px', fontSize: 28 }}>✓</div>
            <h2 style={{ fontSize: 22, fontWeight: 600, color: '#0f0e0c', marginBottom: 6, letterSpacing: '-0.3px' }}>Workspace siap!</h2>
            <p style={{ fontSize: 13, color: '#7a7469', marginBottom: 24, lineHeight: 1.6 }}>Kamu sudah bisa mulai mencatat transaksi dan mengundang anggota ke workspace.</p>
            <div style={{ background: '#FAFAF8', border: '1px solid #E3DED6', borderRadius: 12, padding: 16, marginBottom: 24, textAlign: 'left' }}>
              {[{ k: 'Nama', v: wsName }, { k: 'Tipe', v: selectedType?.label }].map(r => (
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
            <button onClick={() => router.push('/dashboard')} className="btn-press"
              style={{ width: '100%', padding: '12px', background: GREEN, color: '#fff', border: 'none', borderRadius: 12, fontSize: 14, fontWeight: 600, cursor: 'pointer', fontFamily: 'inherit', marginBottom: 10 }}>
              Ke Dashboard →
            </button>
            <button onClick={() => router.push('/dashboard/anggota')} className="btn-press"
              style={{ width: '100%', padding: '10px', background: 'transparent', color: '#7a7469', border: '1px solid #E3DED6', borderRadius: 12, fontSize: 13, fontWeight: 500, cursor: 'pointer', fontFamily: 'inherit' }}>
              Undang anggota sekarang
            </button>
          </div>
        )}
      </div>
    </div>
  )
}