'use client'

import { useEffect, useState } from 'react'

const ACCENT = '#7AAACE'

export default function MemberDashboardPlaceholder() {
  const [memberCode, setMemberCode]       = useState<string | null>(null)
  const [workspaceName, setWorkspaceName] = useState<string | null>(null)
  const [copied, setCopied]               = useState(false)

  useEffect(() => {
    fetch('/api/member-session', { credentials: 'include' })
      .then(r => r.json())
      .then(d => {
        if (d.valid) {
          if (d.member_code)    setMemberCode(d.member_code)
          if (d.workspace_name) setWorkspaceName(d.workspace_name)
        }
      })
  }, [])

  const copyCode = () => {
    if (!memberCode) return
    navigator.clipboard.writeText(memberCode)
    setCopied(true)
    setTimeout(() => setCopied(false), 2000)
  }

  return (
    <div style={{ maxWidth: 860, margin: '0 auto' }}>
      {/* Header */}
      <div style={{
        display: 'flex', alignItems: 'flex-start',
        justifyContent: 'space-between', marginBottom: 24,
        flexWrap: 'wrap', gap: 12,
      }}>
        <div>
          <div style={{ fontSize: 10.5, fontWeight: 600, color: '#8B7E6E', textTransform: 'uppercase', letterSpacing: '0.07em', marginBottom: 4 }}>
            Mode Anggota
          </div>
          <h2 style={{ fontSize: 22, fontWeight: 600, color: '#1A1A18', letterSpacing: '-0.4px', margin: '0 0 4px' }}>
            Dashboard Anggota
          </h2>
          <p style={{ fontSize: 12, color: '#8B7E6E', margin: 0 }}>
            {workspaceName ? `Workspace: ${workspaceName}` : 'Kamu masuk sebagai anggota workspace.'}
          </p>
        </div>

        {/* Kode unik */}
        {memberCode && (
          <button
            onClick={copyCode}
            title="Klik untuk salin kode"
            style={{
              display: 'flex', alignItems: 'center', gap: 10,
              background: copied ? '#F0FDF4' : '#F5F2EB',
              border: `1.5px solid ${copied ? '#BBF7D0' : '#D4CFC4'}`,
              borderRadius: 12, padding: '10px 16px',
              cursor: 'pointer', fontFamily: 'inherit',
              transition: 'all 0.2s',
            }}
          >
            <div style={{ textAlign: 'left' }}>
              <div style={{ fontSize: 10, fontWeight: 600, color: '#7a7469', textTransform: 'uppercase', letterSpacing: '0.08em', marginBottom: 2 }}>
                Kode Login Kamu
              </div>
              <div style={{ fontSize: 18, fontWeight: 700, fontFamily: 'monospace', color: copied ? '#16a34a' : '#1A1A18', letterSpacing: '0.1em' }}>
                {memberCode}
              </div>
            </div>
            <div style={{ color: copied ? '#16a34a' : '#7a7469', fontSize: 12, fontWeight: 600, flexShrink: 0 }}>
              {copied ? '✓ Tersalin' : '📋 Salin'}
            </div>
          </button>
        )}
      </div>

      {/* Info card */}
      <div style={{
        background: '#fff', borderRadius: 12,
        border: '1px solid #E8E0D4', padding: '28px 24px',
        textAlign: 'center', marginBottom: 16,
      }}>
        <div style={{ fontSize: 36, marginBottom: 12 }}>👋</div>
        <p style={{ fontSize: 14, color: '#8B7E6E', margin: '0 0 20px', lineHeight: 1.6 }}>
          Gunakan menu di sidebar untuk melihat transaksi,<br />tagihan, dan laporan workspace kamu.
        </p>
        <div style={{ display: 'flex', gap: 10, justifyContent: 'center', flexWrap: 'wrap' }}>
          {[
            { href: '/dashboard/transaksi', label: '📋 Transaksi', bg: ACCENT, color: '#fff' },
            { href: '/dashboard/tagihan',   label: '🧾 Tagihan',   bg: '#F5F2EB', color: '#3d3a35' },
            { href: '/dashboard/laporan',   label: '📊 Laporan',   bg: '#F5F2EB', color: '#3d3a35' },
          ].map(a => (
            <a key={a.href} href={a.href} style={{
              display: 'inline-flex', alignItems: 'center', gap: 5,
              padding: '9px 18px', borderRadius: 9,
              fontSize: 13, fontWeight: 500, textDecoration: 'none',
              background: a.bg, color: a.color,
              border: a.bg === ACCENT ? 'none' : '1px solid #D4CFC4',
            }}>
              {a.label}
            </a>
          ))}
        </div>
      </div>

      {/* Hint kode */}
      {memberCode && (
        <div style={{
          background: '#EBF4FB', border: '1px solid #B5D4F4',
          borderRadius: 10, padding: '12px 16px',
          display: 'flex', alignItems: 'center', gap: 10,
        }}>
          <span style={{ fontSize: 18 }}>💡</span>
          <p style={{ fontSize: 12, color: '#1d4ed8', margin: 0, lineHeight: 1.5 }}>
            Simpan kode <strong style={{ fontFamily: 'monospace' }}>{memberCode}</strong> untuk login berikutnya tanpa perlu undangan ulang.
          </p>
        </div>
      )}
    </div>
  )
}