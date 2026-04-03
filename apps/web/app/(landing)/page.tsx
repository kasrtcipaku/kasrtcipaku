'use client'

// app/page.tsx (landing page)
import { useEffect, useState } from 'react'
import Link from 'next/link'
import { useRouter } from 'next/navigation'

export default function LandingPage() {
  const router = useRouter()
  const [mounted, setMounted] = useState(false)
  const [mousePos, setMousePos] = useState({ x: 0, y: 0 })

  // ── Member login state ────────────────────────────────────────────────────
  const [memberCode, setMemberCode]   = useState('')
  const [loginLoading, setLoginLoading] = useState(false)
  const [loginError, setLoginError]   = useState('')

  useEffect(() => {
    setMounted(true)
    const handleMouse = (e: MouseEvent) => setMousePos({ x: e.clientX, y: e.clientY })
    window.addEventListener('mousemove', handleMouse)
    return () => window.removeEventListener('mousemove', handleMouse)
  }, [])

  async function handleMemberLogin(e: React.FormEvent) {
    e.preventDefault()
    if (!memberCode.trim()) return
    setLoginLoading(true)
    setLoginError('')

    try {
      const res = await fetch('/api/member-login', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ code: memberCode.trim() }),
        credentials: 'include',
      })
      const data = await res.json()
      if (!res.ok || !data.ok) {
        setLoginError(data.error || 'Kode tidak valid.')
        setLoginLoading(false)
        return
      }
      // Berhasil → ke dashboard
      router.push('/dashboard')
    } catch {
      setLoginError('Terjadi kesalahan. Coba lagi.')
      setLoginLoading(false)
    }
  }

  return (
    <>
      <style>{`
        @import url('https://fonts.googleapis.com/css2?family=Sora:wght@300;400;600;700;800&family=DM+Mono:wght@400;500&display=swap');

        *, *::before, *::after { box-sizing: border-box; margin: 0; padding: 0; }

        :root {
          --bg:      #F5F1EA;
          --card:    #FDFCF9;
          --green:   #2d5a27;
          --green-l: #4a8f42;
          --blue:    #7AAACE;
          --blue-l:  #A8C8E8;
          --ink:     #1A1A14;
          --muted:   #8B8478;
          --border:  #E2DDD4;
          --warm:    #F0EBE0;
        }

        body { background: var(--bg); font-family: 'Sora', sans-serif; }

        .glow {
          pointer-events: none; position: fixed; z-index: 0;
          width: 480px; height: 480px; border-radius: 50%;
          background: radial-gradient(circle, rgba(122,170,206,0.12) 0%, transparent 70%);
          transform: translate(-50%, -50%);
          transition: left 0.6s ease, top 0.6s ease;
        }

        .page { min-height: 100vh; padding: 28px 24px 48px; max-width: 1080px; margin: 0 auto; position: relative; z-index: 1; }

        /* ── Nav ── */
        .nav { display: flex; align-items: center; justify-content: space-between; margin-bottom: 40px; }
        .logo { display: flex; align-items: center; gap: 10px; }
        .logo-icon { width: 36px; height: 36px; border-radius: 10px; background: var(--green); display: flex; align-items: center; justify-content: center; color: #fff; font-size: 15px; font-family: 'DM Mono', monospace; font-weight: 500; letter-spacing: -1px; }
        .logo-text { font-size: 17px; font-weight: 700; color: var(--ink); letter-spacing: -0.4px; }
        .logo-sub { font-size: 11px; color: var(--muted); margin-top: 1px; font-family: 'DM Mono', monospace; }
        .btn-solid { padding: 8px 20px; border-radius: 99px; border: none; background: var(--green); color: #fff; font-size: 12.5px; font-weight: 600; font-family: 'Sora', sans-serif; cursor: pointer; text-decoration: none; transition: all 0.18s; }
        .btn-solid:hover { background: var(--green-l); transform: translateY(-1px); box-shadow: 0 6px 20px rgba(45,90,39,0.25); }

        /* ── Bento Grid ── */
        .bento { display: grid; grid-template-columns: repeat(12, 1fr); gap: 12px; }

        .cell {
          background: var(--card); border: 1px solid var(--border); border-radius: 20px;
          padding: 28px; overflow: hidden; position: relative;
          opacity: 0; transform: translateY(20px);
          transition: box-shadow 0.2s, transform 0.2s;
        }
        .cell:hover { box-shadow: 0 8px 32px rgba(0,0,0,0.08); transform: translateY(-2px) !important; }
        .cell.mounted { animation: cellIn 0.5s cubic-bezier(0.34,1.56,0.64,1) forwards; }

        @keyframes cellIn {
          from { opacity: 0; transform: translateY(24px) scale(0.97); }
          to   { opacity: 1; transform: translateY(0) scale(1); }
        }

        /* Grid positions */
        .c-hero   { grid-column: 1 / 13; grid-row: 1; min-height: 280px; background: var(--green); border-color: transparent; }
        .c-stat1  { grid-column: 1 / 4;  grid-row: 2; }
        .c-stat2  { grid-column: 4 / 7;  grid-row: 2; }
        .c-feat   { grid-column: 7 / 13; grid-row: 2; }
        .c-member { grid-column: 1 / 6;  grid-row: 3; min-height: 220px; background: var(--blue); border-color: transparent; }
        .c-quote  { grid-column: 6 / 13; grid-row: 3; }

        .d1 { animation-delay: 0.05s; }
        .d2 { animation-delay: 0.12s; }
        .d3 { animation-delay: 0.19s; }
        .d4 { animation-delay: 0.26s; }
        .d5 { animation-delay: 0.33s; }
        .d6 { animation-delay: 0.40s; }

        /* ── Hero ── */
        .hero-tag { display: inline-flex; align-items: center; gap: 6px; background: rgba(255,255,255,0.15); color: #fff; font-size: 10.5px; font-weight: 600; padding: 4px 10px; border-radius: 99px; margin-bottom: 20px; font-family: 'DM Mono', monospace; letter-spacing: 0.04em; }
        .hero-tag-dot { width: 6px; height: 6px; border-radius: 50%; background: #6effa0; animation: pulse 2s infinite; }
        @keyframes pulse { 0%,100%{opacity:1;transform:scale(1)} 50%{opacity:0.6;transform:scale(1.3)} }
        .hero-title { font-size: 34px; font-weight: 800; color: #fff; line-height: 1.15; letter-spacing: -1px; margin-bottom: 14px; }
        .hero-title span { color: #a8f0b0; }
        .hero-desc { font-size: 13px; color: rgba(255,255,255,0.7); line-height: 1.6; margin-bottom: 28px; max-width: 340px; }
        .hero-cta { display: inline-flex; align-items: center; gap: 8px; background: #fff; color: var(--green); font-size: 13px; font-weight: 700; padding: 11px 22px; border-radius: 99px; text-decoration: none; transition: all 0.2s; }
        .hero-cta:hover { transform: scale(1.04); box-shadow: 0 8px 28px rgba(0,0,0,0.2); }
        .hero-deco  { position: absolute; right: -20px; bottom: -20px; width: 160px; height: 160px; border-radius: 50%; background: rgba(255,255,255,0.06); }
        .hero-deco2 { position: absolute; right: 40px; bottom: 40px; width: 80px; height: 80px; border-radius: 50%; background: rgba(255,255,255,0.08); }

        /* ── Stats ── */
        .stat-icon  { font-size: 28px; margin-bottom: 12px; }
        .stat-num   { font-size: 32px; font-weight: 800; color: var(--ink); letter-spacing: -1px; line-height: 1; margin-bottom: 4px; }
        .stat-num span { font-size: 18px; font-weight: 600; }
        .stat-label { font-size: 12px; color: var(--muted); font-weight: 500; }
        .stat-bar   { height: 3px; background: var(--border); border-radius: 99px; margin-top: 14px; overflow: hidden; }
        .stat-bar-fill { height: 100%; border-radius: 99px; animation: barGrow 1.2s 0.6s cubic-bezier(0.34,1.56,0.64,1) forwards; transform-origin: left; transform: scaleX(0); }
        @keyframes barGrow { to { transform: scaleX(1); } }

        /* ── Features ── */
        .feat-title { font-size: 14px; font-weight: 700; color: var(--ink); margin-bottom: 16px; letter-spacing: -0.3px; }
        .feat-list  { display: flex; flex-direction: column; gap: 10px; }
        .feat-item  { display: flex; align-items: center; gap: 10px; }
        .feat-dot   { width: 28px; height: 28px; border-radius: 8px; display: flex; align-items: center; justify-content: center; font-size: 14px; flex-shrink: 0; }
        .feat-text  { font-size: 12.5px; color: var(--muted); font-weight: 500; }

        /* ── Member cell ── */
        .member-label { font-size: 10.5px; font-weight: 600; color: rgba(255,255,255,0.6); text-transform: uppercase; letter-spacing: 0.1em; font-family: 'DM Mono', monospace; margin-bottom: 10px; }
        .member-title { font-size: 20px; font-weight: 700; color: #fff; margin-bottom: 4px; letter-spacing: -0.5px; }
        .member-desc  { font-size: 12px; color: rgba(255,255,255,0.65); margin-bottom: 16px; line-height: 1.5; }

        /* Form kode anggota */
        .code-form { display: flex; flex-direction: column; gap: 8px; }
        .code-input-wrap { display: flex; gap: 6px; }
        .code-input {
          flex: 1; padding: 10px 12px;
          background: rgba(255,255,255,0.15);
          border: 1.5px solid rgba(255,255,255,0.25);
          border-radius: 10px; color: #fff;
          font-size: 14px; font-weight: 600;
          font-family: 'DM Mono', monospace;
          letter-spacing: 0.05em;
          outline: none;
          transition: border-color 0.15s, background 0.15s;
          text-transform: uppercase;
        }
        .code-input::placeholder { color: rgba(255,255,255,0.35); font-weight: 400; letter-spacing: 0; text-transform: none; font-size: 12.5px; }
        .code-input:focus { border-color: rgba(255,255,255,0.6); background: rgba(255,255,255,0.2); }
        .code-btn {
          padding: 10px 16px; background: rgba(255,255,255,0.95); color: var(--blue);
          border: none; border-radius: 10px; font-size: 13px; font-weight: 700;
          cursor: pointer; font-family: 'Sora', sans-serif; white-space: nowrap;
          transition: all 0.18s; flex-shrink: 0;
        }
        .code-btn:hover:not(:disabled) { background: #fff; transform: scale(1.03); }
        .code-btn:disabled { opacity: 0.6; cursor: not-allowed; }
        .code-error { font-size: 11.5px; color: #ffd6d6; font-weight: 500; padding: 6px 10px; background: rgba(255,80,80,0.15); border-radius: 8px; border: 1px solid rgba(255,100,100,0.25); }
        .code-hint { font-size: 11px; color: rgba(255,255,255,0.45); font-family: 'DM Mono', monospace; }

        .member-avatars { display: flex; margin-top: 16px; }
        .avatar { width: 28px; height: 28px; border-radius: 50%; border: 2px solid var(--blue); display: flex; align-items: center; justify-content: center; font-size: 11px; font-weight: 700; color: #fff; margin-left: -6px; }
        .avatar:first-child { margin-left: 0; }

        /* ── Quote ── */
        .quote-mark   { font-size: 48px; color: var(--border); font-family: Georgia, serif; line-height: 0.8; margin-bottom: 10px; }
        .quote-text   { font-size: 14px; color: var(--ink); line-height: 1.65; font-weight: 400; margin-bottom: 16px; }
        .quote-author { font-size: 11.5px; color: var(--muted); font-family: 'DM Mono', monospace; }
        .quote-tag    { display: inline-flex; align-items: center; gap: 5px; background: var(--warm); border: 1px solid var(--border); color: var(--muted); font-size: 10.5px; font-weight: 600; padding: 3px 9px; border-radius: 99px; margin-top: 12px; }

        /* ── Footer ── */
        .footer { display: flex; align-items: center; justify-content: space-between; margin-top: 20px; padding: 0 4px; }
        .footer-text { font-size: 11px; color: var(--muted); font-family: 'DM Mono', monospace; }
        .badge { display: inline-flex; align-items: center; gap: 5px; background: var(--warm); border: 1px solid var(--border); color: var(--muted); font-size: 10.5px; padding: 4px 10px; border-radius: 99px; font-family: 'DM Mono', monospace; }

        /* Mobile */
        @media (max-width: 768px) {
          .c-hero   { grid-column: 1 / 13; }
          .c-stat1  { grid-column: 1 / 7; }
          .c-stat2  { grid-column: 7 / 13; }
          .c-feat   { grid-column: 1 / 13; }
          .c-member { grid-column: 1 / 13; }
          .c-quote  { grid-column: 1 / 13; }
          .hero-title { font-size: 26px; }
        }
      `}</style>

      <div className="glow" style={{ left: mousePos.x, top: mousePos.y }} />

      <div className="page">
        {/* Nav */}
        <nav className="nav">
          <div className="logo">
            <div className="logo-icon">Ks</div>
            <div>
              <div className="logo-text">KasRT</div>
              <div className="logo-sub">keuangan bersama</div>
            </div>
          </div>
          <div>
            <Link href="/dashboard/setup" className="btn-solid">Mulai Gratis</Link>
          </div>
        </nav>

        {/* Bento */}
        <div className="bento">

          {/* Hero */}
          <div className={`cell c-hero d1 ${mounted ? 'mounted' : ''}`}>
            <div className="hero-deco" />
            <div className="hero-deco2" />
            <div style={{ position: 'relative', zIndex: 1 }}>
              <div className="hero-tag">
                <div className="hero-tag-dot" />
                Gratis untuk semua RT/RW
              </div>
              <h1 className="hero-title">
                Keuangan RT<br/>
                <span>lebih rapi,</span><br/>
                lebih transparan.
              </h1>
              <p className="hero-desc">
                Catat kas, tagihan, dan laporan warga dalam satu tempat.
                Akses dari mana saja, kapan saja.
              </p>
              <Link href="/dashboard/setup" className="hero-cta">
                Buat Workspace
                <svg width="14" height="14" viewBox="0 0 14 14" fill="none">
                  <path d="M3 7h8M7 3l4 4-4 4" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round"/>
                </svg>
              </Link>
            </div>
          </div>

          {/* Stat 1 */}
          <div className={`cell c-stat1 d2 ${mounted ? 'mounted' : ''}`}>
            <div className="stat-icon">💸</div>
            <div className="stat-num">Rp0<span> biaya</span></div>
            <div className="stat-label">Sepenuhnya gratis</div>
            <div className="stat-bar">
              <div className="stat-bar-fill" style={{ background: 'var(--green)', width: '100%' }} />
            </div>
          </div>

          {/* Stat 2 */}
          <div className={`cell c-stat2 d3 ${mounted ? 'mounted' : ''}`}>
            <div className="stat-icon">⚡</div>
            <div className="stat-num">3<span> menit</span></div>
            <div className="stat-label">Setup workspace</div>
            <div className="stat-bar">
              <div className="stat-bar-fill" style={{ background: 'var(--blue)', width: '60%' }} />
            </div>
          </div>

          {/* Features */}
          <div className={`cell c-feat d4 ${mounted ? 'mounted' : ''}`}>
            <div className="feat-title">Semua yang kamu butuhkan</div>
            <div className="feat-list">
              {[
                { icon: '📊', bg: '#f0fdf4', text: 'Laporan keuangan otomatis & export PDF' },
                { icon: '🤖', bg: '#eff6ff', text: 'Bot Telegram untuk catat transaksi cepat' },
                { icon: '👥', bg: '#fef9ee', text: 'Multi-anggota dengan kontrol akses' },
                { icon: '🔔', bg: '#fef2f2', text: 'Tagihan & notifikasi jatuh tempo' },
              ].map((f, i) => (
                <div key={i} className="feat-item">
                  <div className="feat-dot" style={{ background: f.bg }}>{f.icon}</div>
                  <div className="feat-text">{f.text}</div>
                </div>
              ))}
            </div>
          </div>

          {/* Member cell — form login kode anggota */}
          <div className={`cell c-member d5 ${mounted ? 'mounted' : ''}`}>
            <div className="member-label">sudah punya kode?</div>
            <div className="member-title">Masuk sebagai<br/>Anggota</div>
            <p className="member-desc">
              Masukkan kode anggota kamu (contoh: <span style={{ fontFamily: 'DM Mono, monospace', fontWeight: 600 }}>HIJAU-429</span>).
            </p>

            <form className="code-form" onSubmit={handleMemberLogin}>
              <div className="code-input-wrap">
                <input
                  className="code-input"
                  type="text"
                  placeholder="Contoh: HIJAU-429"
                  value={memberCode}
                  onChange={e => {
                    setMemberCode(e.target.value.toUpperCase())
                    setLoginError('')
                  }}
                  maxLength={12}
                  autoComplete="off"
                  spellCheck={false}
                  disabled={loginLoading}
                />
                <button
                  type="submit"
                  className="code-btn"
                  disabled={loginLoading || !memberCode.trim()}
                >
                  {loginLoading ? '...' : 'Masuk →'}
                </button>
              </div>
              {loginError && (
                <div className="code-error">⚠ {loginError}</div>
              )}
              <div className="code-hint">Kode diberikan oleh ketua RT / pengelola workspace</div>
            </form>

            <div className="member-avatars" style={{ marginTop: 20 }}>
              {['A','B','R','S','D'].map((l, i) => (
                <div key={i} className="avatar" style={{ background: ['#2d5a27','#7AAACE','#b45309','#7c3aed','#be123c'][i] }}>
                  {l}
                </div>
              ))}
              <div className="avatar" style={{ background: 'rgba(255,255,255,0.2)', color: 'rgba(255,255,255,0.8)', fontSize: 9 }}>+12</div>
            </div>
          </div>

          {/* Quote */}
          <div className={`cell c-quote d6 ${mounted ? 'mounted' : ''}`}>
            <div className="quote-mark">"</div>
            <p className="quote-text">
              KasRT membantu saya mengelola keuangan dengan lebih fleksibel.
            </p>
            <div className="quote-author">— Ibu Sudarsa, Ibu Rumah Tangga</div>
            <div>
              <span className="quote-tag">
                <svg width="9" height="9" viewBox="0 0 10 10" fill="none">
                  <circle cx="5" cy="5" r="4" stroke="currentColor" strokeWidth="1.2"/>
                  <path d="M5 3v2l1.5 1.5" stroke="currentColor" strokeWidth="1.2" strokeLinecap="round"/>
                </svg>
                Pengguna aktif sejak 2026
              </span>
            </div>
          </div>

        </div>

        {/* Footer */}
        <div className="footer">
          <span className="footer-text">© 2025 KasRT · keuangan bersama</span>
          <span className="badge">
            <svg width="8" height="8" viewBox="0 0 8 8" fill="none">
              <circle cx="4" cy="4" r="3" fill="#6effa0"/>
            </svg>
            sistem aktif
          </span>
        </div>
      </div>
    </>
  )
}
