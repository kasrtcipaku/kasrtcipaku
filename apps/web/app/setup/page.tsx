'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { createClient } from '@/lib/supabase/client'

const types = [
  { value: 'rt',       label: 'RT / RW',       icon: '🏘️', desc: 'Kelola kas dan iuran warga' },
  { value: 'kosan',    label: 'Kosan',          icon: '🏠', desc: 'Kelola keuangan kos-kosan' },
  { value: 'warteg',   label: 'Warteg / Usaha', icon: '🍽️', desc: 'Kelola keuangan usaha kecil' },
  { value: 'personal', label: 'Personal',       icon: '👤', desc: 'Catat keuangan pribadi' },
]

const examples = ['RT 05 Kel. Merdeka', 'Kosan Pak Budi', 'Warteg Bu Sri']

export default function SetupPage() {
  const router = useRouter()
  const [step, setStep]       = useState<1 | 2>(1)
  const [type, setType]       = useState('')
  const [name, setName]       = useState('')
  const [loading, setLoading] = useState(false)
  const [error, setError]     = useState('')

  const handleCreate = async () => {
    if (!type || !name.trim()) return
    setLoading(true)
    setError('')
    try {
      const supabase = createClient()
      const { data: { user } } = await supabase.auth.getUser()
      if (!user) { router.push('/login'); return }
      const { error: err } = await supabase
        .from('workspaces')
        .insert({ name: name.trim(), type, owner_id: user.id })
      if (err) throw err
      router.push('/dashboard')
      router.refresh()
    } catch (e: any) {
      setError(e.message || 'Terjadi kesalahan, coba lagi.')
      setLoading(false)
    }
  }

  return (
    <div style={{ minHeight: '100vh', background: '#F6F3EE', display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '32px 16px', fontFamily: 'system-ui, sans-serif' }}>
      <style>{`
        @keyframes slin { from { opacity:0; transform:translateX(10px) } to { opacity:1; transform:translateX(0) } }
        .step-in { animation: slin .22s ease both }
        .tcard { border-radius:12px; border:1px solid #E8E3DC; background:#FAFAF8; padding:14px 12px; cursor:pointer; text-align:left; position:relative; transition:border-color .15s, background .15s, transform .12s; width:100% }
        .tcard:hover { border-color:#2D5A27; transform:translateY(-1px) }
        .tcard.sel { border:1.5px solid #2D5A27; background:#EEF6EC }
        .chip { font-size:12px; padding:5px 11px; border-radius:99px; border:1px solid #E3DED6; background:#F5F2EB; color:#7A7469; cursor:pointer; transition:all .12s; font-family:inherit }
        .chip:hover, .chip.on { border-color:#2D5A27; background:#EEF6EC; color:#1A4017 }
        .inp { width:100%; padding:11px 48px 11px 14px; border:1px solid #E3DED6; border-radius:10px; font-size:14px; font-weight:500; color:#1A1A18; background:#FAFAF8; outline:none; font-family:inherit; box-sizing:border-box }
        .inp:focus { border-color:#2D5A27; box-shadow:0 0 0 3px rgba(45,90,39,.1) }
        .inp::placeholder { color:#C5BFB8; font-weight:400 }
        .btn-g { background:#2D5A27; color:#fff; border:none; border-radius:10px; padding:12px; font-size:14px; font-weight:500; cursor:pointer; width:100%; font-family:inherit; transition:background .15s, transform .12s }
        .btn-g:hover:not(:disabled) { background:#214A1D; transform:translateY(-1px) }
        .btn-g:disabled { opacity:.3; cursor:not-allowed; transform:none }
        .btn-ghost { background:transparent; color:#7A7469; border:1px solid #E3DED6; border-radius:10px; padding:12px; font-size:14px; font-weight:500; cursor:pointer; font-family:inherit; transition:color .12s, border-color .12s }
        .btn-ghost:hover { color:#1A1A18; border-color:#aaa }
      `}</style>

      <div style={{ width: '100%', maxWidth: 440 }}>

        {/* Logo */}
        <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 10, marginBottom: 28 }}>
          <div style={{ width: 42, height: 42, background: '#2D5A27', borderRadius: 10, display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 20, fontWeight: 700, color: '#fff', fontFamily: 'Georgia, serif' }}>
            K
          </div>
          <div style={{ textAlign: 'center' }}>
            <div style={{ fontSize: 20, fontWeight: 500, color: '#1A1A18', letterSpacing: '-.3px' }}>KasRT</div>
            <div style={{ fontSize: 13, color: '#7A7469', marginTop: 4, lineHeight: 1.5 }}>
              Buat workspace pertama kamu untuk<br />mulai mengelola keuangan bersama.
            </div>
          </div>
        </div>

        {/* Card */}
        <div style={{ background: '#fff', borderRadius: 16, border: '1px solid #E8E3DC', overflow: 'hidden' }}>

          {/* Progress bar */}
          <div style={{ height: 3, background: '#EDE9E3' }}>
            <div style={{ height: '100%', background: '#2D5A27', borderRadius: 99, width: step === 1 ? '50%' : '100%', transition: 'width .4s cubic-bezier(.22,1,.36,1)' }} />
          </div>

          <div style={{ padding: 24 }}>

            {/* Step indicator */}
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 20 }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                {/* Dot 1 */}
                <div style={{ width: 22, height: 22, borderRadius: '50%', background: '#2D5A27', color: '#fff', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 11, fontWeight: 600 }}>
                  {step > 1
                    ? <svg width="9" height="9" viewBox="0 0 9 9" fill="none"><path d="M1.5 4.5l2 2L7.5 2" stroke="#fff" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"/></svg>
                    : '1'}
                </div>
                <div style={{ width: 18, height: 1, background: '#E3DED6' }} />
                {/* Dot 2 */}
                <div style={{ width: 22, height: 22, borderRadius: '50%', background: step === 2 ? '#2D5A27' : '#EDE9E3', color: step === 2 ? '#fff' : '#9C9892', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 11, fontWeight: 600, transition: 'all .2s' }}>
                  2
                </div>
              </div>
              <span style={{ fontSize: 11, color: '#9C9892', letterSpacing: '.06em', textTransform: 'uppercase', fontWeight: 500 }}>
                {step === 1 ? 'Pilih tipe' : 'Beri nama'}
              </span>
            </div>

            {/* ── STEP 1 ── */}
            {step === 1 && (
              <div className="step-in">
                <div style={{ fontSize: 16, fontWeight: 500, color: '#1A1A18', marginBottom: 4 }}>Workspace untuk apa?</div>
                <div style={{ fontSize: 13, color: '#7A7469', marginBottom: 18, lineHeight: 1.5 }}>Pilih yang paling sesuai dengan kebutuhan kamu.</div>

                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10, marginBottom: 18 }}>
                  {types.map(t => (
                    <button
                      key={t.value}
                      className={`tcard${type === t.value ? ' sel' : ''}`}
                      onClick={() => setType(t.value)}
                    >
                      {type === t.value && (
                        <div style={{ position: 'absolute', top: 9, right: 9, width: 15, height: 15, background: '#2D5A27', borderRadius: '50%', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                          <svg width="8" height="8" viewBox="0 0 8 8" fill="none"><path d="M1.5 4l1.8 1.8L6.5 2" stroke="#fff" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"/></svg>
                        </div>
                      )}
                      <span style={{ fontSize: 20, display: 'block', marginBottom: 10, lineHeight: 1 }}>{t.icon}</span>
                      <span style={{ fontSize: 13, fontWeight: 500, color: '#1A1A18', display: 'block' }}>{t.label}</span>
                      <span style={{ fontSize: 12, color: '#7A7469', display: 'block', marginTop: 2, lineHeight: 1.35 }}>{t.desc}</span>
                    </button>
                  ))}
                </div>

                <button className="btn-g" disabled={!type} onClick={() => setStep(2)}>
                  Lanjutkan
                </button>
              </div>
            )}

            {/* ── STEP 2 ── */}
            {step === 2 && (
              <div className="step-in">
                <div style={{ fontSize: 16, fontWeight: 500, color: '#1A1A18', marginBottom: 4 }}>Nama workspace</div>
                <div style={{ fontSize: 13, color: '#7A7469', marginBottom: 16, lineHeight: 1.5 }}>Beri nama yang mudah dikenali anggota kamu.</div>

                {/* Chips */}
                <div style={{ display: 'flex', flexWrap: 'wrap', gap: 7, marginBottom: 12 }}>
                  {examples.map(ex => (
                    <button key={ex} className={`chip${name === ex ? ' on' : ''}`} onClick={() => setName(ex)}>
                      {ex}
                    </button>
                  ))}
                </div>

                {/* Input */}
                <div style={{ position: 'relative' }}>
                  <input
                    className="inp"
                    type="text"
                    value={name}
                    onChange={e => setName(e.target.value.slice(0, 48))}
                    placeholder="Nama workspace kamu..."
                    maxLength={48}
                    autoFocus
                    onKeyDown={e => e.key === 'Enter' && name.trim() && handleCreate()}
                  />
                  <span style={{ position: 'absolute', right: 12, top: '50%', transform: 'translateY(-50%)', fontSize: 11, color: '#B0AA9F', pointerEvents: 'none' }}>
                    {name.length}/48
                  </span>
                </div>

                {/* Error */}
                {error && (
                  <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginTop: 10, padding: '10px 12px', background: '#FEF2F2', border: '1px solid #FECACA', borderRadius: 8, fontSize: 12, fontWeight: 500, color: '#DC2626' }}>
                    <svg width="13" height="13" viewBox="0 0 13 13" fill="none" style={{ flexShrink: 0 }}>
                      <circle cx="6.5" cy="6.5" r="5.5" stroke="#DC2626" strokeWidth="1.3"/>
                      <path d="M6.5 3.5v3M6.5 9v.5" stroke="#DC2626" strokeWidth="1.3" strokeLinecap="round"/>
                    </svg>
                    {error}
                  </div>
                )}

                {/* Buttons */}
                <div style={{ display: 'flex', gap: 10, marginTop: 16 }}>
                  <button className="btn-ghost" style={{ flex: 1 }} onClick={() => { setStep(1); setError('') }}>
                    ← Kembali
                  </button>
                  <button
                    className="btn-g"
                    style={{ flex: 2 }}
                    disabled={!name.trim() || loading}
                    onClick={handleCreate}
                  >
                    {loading
                      ? <span style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 8 }}>
                          <span style={{ width: 13, height: 13, border: '2px solid rgba(255,255,255,.3)', borderTopColor: '#fff', borderRadius: '50%', display: 'inline-block', animation: 'spin .7s linear infinite' }} />
                          Menyimpan...
                        </span>
                      : 'Buat Workspace'
                    }
                  </button>
                </div>
              </div>
            )}
          </div>
        </div>

        <p style={{ textAlign: 'center', fontSize: 12, color: '#B0AA9F', marginTop: 16 }}>
          Kamu bisa menambah lebih banyak workspace nanti
        </p>
      </div>

      <style>{`@keyframes spin { to { transform: rotate(360deg) } }`}</style>
    </div>
  )
}