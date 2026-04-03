'use client'

// app/login/anggota/page.tsx
import { useState } from 'react'
import { useRouter } from 'next/navigation'
import Link from 'next/link'

type Status = 'idle' | 'loading' | 'success' | 'error'

export default function MemberLoginPage() {
  const router = useRouter()
  const [code, setCode]       = useState('')
  const [status, setStatus]   = useState<Status>('idle')
  const [error, setError]     = useState('')
  const [wsName, setWsName]   = useState('')

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    if (!code.trim()) return
    setStatus('loading')
    setError('')

    try {
      const res = await fetch('/api/member-login', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ code: code.trim() }),
        credentials: 'include',
      })
      const data = await res.json()

      if (!res.ok || !data.ok) {
        setError(data.error || 'Kode tidak valid.')
        setStatus('error')
        return
      }

      setWsName(data.workspace_name || '')
      setStatus('success')
      setTimeout(() => router.push('/dashboard'), 1800)
    } catch {
      setError('Terjadi kesalahan. Coba lagi.')
      setStatus('error')
    }
  }

  return (
    <div style={{
      minHeight: '100vh',
      background: '#F5F1EA',
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'center',
      padding: '24px 16px',
      fontFamily: "'Sora', sans-serif",
    }}>
      <style>{`
        @import url('https://fonts.googleapis.com/css2?family=Sora:wght@400;500;600;700;800&family=DM+Mono:wght@400;500&display=swap');

        @keyframes fadeUp {
          from { opacity: 0; transform: translateY(16px) scale(0.98); }
          to   { opacity: 1; transform: translateY(0) scale(1); }
        }
        @keyframes successPop {
          0%   { transform: scale(0.8); opacity: 0; }
          60%  { transform: scale(1.1); }
          100% { transform: scale(1); opacity: 1; }
        }
        @keyframes shake {
          0%,100% { transform: translateX(0); }
          20%     { transform: translateX(-6px); }
          40%     { transform: translateX(6px); }
          60%     { transform: translateX(-4px); }
          80%     { transform: translateX(4px); }
        }
        @keyframes spin {
          to { transform: rotate(360deg); }
        }

        .card {
          animation: fadeUp 0.4s cubic-bezier(0.34, 1.56, 0.64, 1) forwards;
        }
        .shake {
          animation: shake 0.4s ease;
        }
        .code-input {
          width: 100%;
          padding: 14px 16px;
          font-size: 20px;
          font-weight: 700;
          font-family: 'DM Mono', monospace;
          letter-spacing: 0.08em;
          text-align: center;
          text-transform: uppercase;
          background: #FAFAF8;
          border: 2px solid #E2DDD4;
          border-radius: 14px;
          color: #1A1A14;
          outline: none;
          transition: border-color 0.15s, box-shadow 0.15s;
          box-sizing: border-box;
        }
        .code-input:focus {
          border-color: #7AAACE;
          box-shadow: 0 0 0 4px rgba(122,170,206,0.15);
        }
        .code-input.error-state {
          border-color: #dc2626;
          box-shadow: 0 0 0 4px rgba(220,38,38,0.1);
        }
        .code-input::placeholder {
          color: #C4BFB8;
          font-weight: 400;
          letter-spacing: 0.02em;
          font-size: 16px;
        }
        .submit-btn {
          width: 100%;
          padding: 14px;
          background: #7AAACE;
          color: #fff;
          border: none;
          border-radius: 14px;
          font-size: 15px;
          font-weight: 700;
          font-family: 'Sora', sans-serif;
          cursor: pointer;
          transition: background 0.18s, transform 0.12s, box-shadow 0.18s;
          display: flex;
          align-items: center;
          justify-content: center;
          gap: 8px;
        }
        .submit-btn:hover:not(:disabled) {
          background: #5E96C0;
          transform: translateY(-1px);
          box-shadow: 0 6px 20px rgba(122,170,206,0.4);
        }
        .submit-btn:active:not(:disabled) {
          transform: translateY(0);
        }
        .submit-btn:disabled {
          opacity: 0.7;
          cursor: not-allowed;
        }
        .back-link {
          display: inline-flex;
          align-items: center;
          gap: 5px;
          font-size: 12.5px;
          color: #8B8478;
          text-decoration: none;
          transition: color 0.15s;
        }
        .back-link:hover { color: #1A1A14; }
      `}</style>

      <div className="card" style={{ width: '100%', maxWidth: 400 }}>

        {/* Back */}
        <div style={{ marginBottom: 24 }}>
          <Link href="/" className="back-link">
            <svg width="14" height="14" viewBox="0 0 14 14" fill="none">
              <path d="M9 2L4 7l5 5" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round"/>
            </svg>
            Kembali
          </Link>
        </div>

        {/* Card */}
        <div style={{
          background: '#fff',
          borderRadius: 24,
          border: '1px solid #E2DDD4',
          padding: '36px 32px',
          boxShadow: '0 4px 32px rgba(0,0,0,0.06)',
        }}>

          {/* Header */}
          <div style={{ marginBottom: 32 }}>
            {/* Logo */}
            <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 28 }}>
              <div style={{
                width: 36, height: 36, borderRadius: 10,
                background: '#7AAACE',
                display: 'flex', alignItems: 'center', justifyContent: 'center',
              }}>
                <span style={{ color: '#fff', fontWeight: 700, fontSize: 16, fontFamily: 'Georgia, serif' }}>K</span>
              </div>
              <div>
                <div style={{ fontSize: 15, fontWeight: 700, color: '#1A1A14', letterSpacing: '-0.3px' }}>KasRT</div>
                <div style={{ fontSize: 10.5, color: '#8B8478', fontFamily: 'DM Mono, monospace', marginTop: 1 }}>keuangan bersama</div>
              </div>
            </div>

            <h1 style={{ fontSize: 24, fontWeight: 800, color: '#1A1A14', letterSpacing: '-0.5px', marginBottom: 6 }}>
              Masuk sebagai<br/>Anggota
            </h1>
            <p style={{ fontSize: 13, color: '#8B8478', lineHeight: 1.6 }}>
              Masukkan kode anggota yang diberikan oleh ketua RT atau pengelola workspace.
            </p>
          </div>

          {/* Success state */}
          {status === 'success' ? (
            <div style={{ textAlign: 'center', padding: '16px 0' }}>
              <div style={{
                width: 64, height: 64, borderRadius: '50%',
                background: '#e8f4e8', border: '2px solid #b8d9b4',
                display: 'flex', alignItems: 'center', justifyContent: 'center',
                margin: '0 auto 16px',
                fontSize: 28,
                animation: 'successPop 0.5s cubic-bezier(0.34,1.56,0.64,1)',
              }}>✓</div>
              <div style={{ fontSize: 17, fontWeight: 700, color: '#1A1A14', marginBottom: 6 }}>Berhasil masuk!</div>
              <div style={{ fontSize: 13, color: '#8B8478' }}>
                Mengarahkan ke <strong style={{ color: '#1A1A14' }}>{wsName}</strong>...
              </div>
              <div style={{ marginTop: 16, display: 'flex', justifyContent: 'center' }}>
                <div style={{
                  width: 20, height: 20,
                  border: '2px solid #7AAACE',
                  borderTopColor: 'transparent',
                  borderRadius: '50%',
                  animation: 'spin 0.7s linear infinite',
                }} />
              </div>
            </div>
          ) : (
            <form onSubmit={handleSubmit} style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>

              {/* Label */}
              <div>
                <label style={{
                  display: 'block',
                  fontSize: 11, fontWeight: 600,
                  color: '#8B8478',
                  textTransform: 'uppercase',
                  letterSpacing: '0.08em',
                  marginBottom: 8,
                  fontFamily: 'DM Mono, monospace',
                }}>
                  Kode Anggota
                </label>
                <input
                  className={`code-input${status === 'error' ? ' error-state shake' : ''}`}
                  type="text"
                  placeholder="HIJAU-429"
                  value={code}
                  onChange={e => {
                    setCode(e.target.value.toUpperCase().replace(/[^A-Z0-9-]/g, ''))
                    if (status === 'error') setStatus('idle')
                    setError('')
                  }}
                  maxLength={12}
                  autoComplete="off"
                  spellCheck={false}
                  autoFocus
                  disabled={status === 'loading'}
                />
              </div>

              {/* Error */}
              {error && (
                <div style={{
                  display: 'flex', alignItems: 'center', gap: 8,
                  padding: '10px 12px',
                  background: '#fef2f2',
                  border: '1px solid #fecaca',
                  borderRadius: 10,
                  fontSize: 12.5,
                  color: '#dc2626',
                  fontWeight: 500,
                }}>
                  <span style={{ fontSize: 14 }}>⚠</span>
                  {error}
                </div>
              )}

              {/* Submit */}
              <button
                type="submit"
                className="submit-btn"
                disabled={status === 'loading' || !code.trim()}
              >
                {status === 'loading' ? (
                  <>
                    <div style={{
                      width: 16, height: 16,
                      border: '2px solid rgba(255,255,255,0.4)',
                      borderTopColor: '#fff',
                      borderRadius: '50%',
                      animation: 'spin 0.7s linear infinite',
                    }} />
                    Memeriksa kode...
                  </>
                ) : (
                  <>
                    Masuk ke Dashboard
                    <svg width="14" height="14" viewBox="0 0 14 14" fill="none">
                      <path d="M3 7h8M7 3l4 4-4 4" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round"/>
                    </svg>
                  </>
                )}
              </button>

              {/* Hint */}
              <p style={{
                fontSize: 11.5, color: '#A8A39A',
                textAlign: 'center', lineHeight: 1.6,
                fontFamily: 'DM Mono, monospace',
              }}>
                Format kode: <span style={{ color: '#1A1A14', fontWeight: 600 }}>KATA-NNN</span><br/>
                Contoh: HIJAU-429 · BINTANG-071
              </p>
            </form>
          )}
        </div>

        {/* Footer note */}
        <p style={{
          textAlign: 'center',
          fontSize: 12,
          color: '#A8A39A',
          marginTop: 20,
          lineHeight: 1.6,
        }}>
          Punya workspace sendiri?{' '}
          <Link href="/login" style={{ color: '#2d5a27', fontWeight: 600, textDecoration: 'none' }}>
            Masuk sebagai pemilik
          </Link>
        </p>
      </div>
    </div>
  )
}
