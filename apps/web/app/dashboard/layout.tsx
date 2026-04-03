'use client'

// app/dashboard/layout.tsx
import { useEffect, useState } from 'react'
import { useRouter, usePathname } from 'next/navigation'
import { createClient } from '@/lib/supabase/client'
import { DM_Sans } from 'next/font/google'
import Link from 'next/link'

const dmSans = DM_Sans({
  subsets: ['latin'],
  weight: ['400', '500', '600'],
  display: 'swap',
})

// ── Tipe session yang bisa masuk dashboard ────────────────────────────────────
type SessionType = 'owner' | 'member' | null

interface MemberInfo {
  sessionType: SessionType
  displayName: string
  email?: string
  initials: string
  workspaceName?: string
  role?: string
}

const navItems = [
  {
    href: '/dashboard',
    label: 'Ringkasan',
    icon: (
      <svg width="16" height="16" viewBox="0 0 16 16" fill="none">
        <rect x="1" y="1" width="6" height="6" rx="1.5" fill="currentColor" opacity="0.9"/>
        <rect x="9" y="1" width="6" height="6" rx="1.5" fill="currentColor" opacity="0.5"/>
        <rect x="1" y="9" width="6" height="6" rx="1.5" fill="currentColor" opacity="0.5"/>
        <rect x="9" y="9" width="6" height="6" rx="1.5" fill="currentColor" opacity="0.7"/>
      </svg>
    ),
  },
  {
    href: '/dashboard/transaksi',
    label: 'Transaksi',
    icon: (
      <svg width="16" height="16" viewBox="0 0 16 16" fill="none">
        <path d="M3 5h10M3 8h6M3 11h8" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round"/>
        <path d="M12 9l2 2-2 2" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"/>
      </svg>
    ),
  },
  {
    href: '/dashboard/tagihan',
    label: 'Tagihan',
    icon: (
      <svg width="16" height="16" viewBox="0 0 16 16" fill="none">
        <rect x="2" y="2" width="12" height="12" rx="2" stroke="currentColor" strokeWidth="1.5"/>
        <path d="M5 8h6M5 5.5h4M5 10.5h3" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round"/>
      </svg>
    ),
  },
  {
    href: '/dashboard/laporan',
    label: 'Laporan',
    icon: (
      <svg width="16" height="16" viewBox="0 0 16 16" fill="none">
        <path d="M2 12L5.5 8l3 2.5L12 5" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"/>
        <path d="M2 14h12" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" opacity="0.4"/>
      </svg>
    ),
  },
  {
    href: '/dashboard/anggota',
    label: 'Anggota',
    icon: (
      <svg width="16" height="16" viewBox="0 0 16 16" fill="none">
        <circle cx="6" cy="5" r="2.5" stroke="currentColor" strokeWidth="1.5"/>
        <path d="M1.5 13c0-2.485 2.015-4.5 4.5-4.5s4.5 2.015 4.5 4.5" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round"/>
        <circle cx="12" cy="5.5" r="1.75" stroke="currentColor" strokeWidth="1.25" opacity="0.6"/>
        <path d="M14.5 13c0-1.657-1.12-3-2.5-3" stroke="currentColor" strokeWidth="1.25" strokeLinecap="round" opacity="0.6"/>
      </svg>
    ),
  },
  {
    href: '/dashboard/pengaturan',
    label: 'Pengaturan',
    icon: (
      <svg width="16" height="16" viewBox="0 0 16 16" fill="none">
        <circle cx="8" cy="8" r="2" stroke="currentColor" strokeWidth="1.5"/>
        <path d="M8 2v1.5M8 12.5V14M14 8h-1.5M3.5 8H2M12.243 3.757l-1.06 1.06M4.818 11.182l-1.061 1.061M12.243 12.243l-1.06-1.06M4.818 4.818L3.757 3.757" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round"/>
      </svg>
    ),
  },
]

// Nav items yang boleh diakses member (role: member/viewer)
const MEMBER_ALLOWED_HREFS = [
  '/dashboard',
  '/dashboard/transaksi',
  '/dashboard/tagihan',
  '/dashboard/laporan',
]

function getPageLabel(pathname: string): string {
  const exact = navItems.find((item) => item.href === pathname)
  if (exact) return exact.label
  const match = navItems
    .filter((item) => item.href !== '/dashboard' && pathname.startsWith(item.href))
    .sort((a, b) => b.href.length - a.href.length)[0]
  if (match) return match.label
  return 'Ringkasan'
}

const SB = '#7AAACE'
const SIDEBAR_W = 232

export default function DashboardLayout({ children }: { children: React.ReactNode }) {
  const router   = useRouter()
  const pathname = usePathname()

  const [info, setInfo]               = useState<MemberInfo | null>(null)
  const [sidebarOpen, setSidebarOpen] = useState(false)
  const [hoveredNav, setHoveredNav]   = useState<string | null>(null)
  const [logoutHover, setLogoutHover] = useState(false)

  useEffect(() => {
    async function checkAuth() {
      // 1. Coba Supabase Auth dulu (owner/admin)
      const supabase = createClient()
      const { data: { user } } = await supabase.auth.getUser()

      if (user) {
        setInfo({
          sessionType: 'owner',
          displayName: user.user_metadata?.full_name || 'Pengguna',
          email: user.email,
          initials: (user.user_metadata?.full_name?.[0] || user.email?.[0] || '?').toUpperCase(),
        })
        return
      }

      // 2. Coba member_session cookie (anggota)
      const res = await fetch('/api/member-session', { credentials: 'include' })
      if (res.ok) {
        const data = await res.json()
        if (data.valid) {
          // Cek apakah halaman ini diizinkan untuk member
          const allowed = MEMBER_ALLOWED_HREFS.some(
            href => pathname === href || (href !== '/dashboard' && pathname.startsWith(href))
          )
          if (!allowed) {
            router.replace('/dashboard')
            return
          }
          setInfo({
            sessionType: 'member',
            displayName: data.display_name || 'Anggota',
            initials: (data.display_name?.[0] || 'A').toUpperCase(),
            workspaceName: data.workspace_name,
            role: data.role,
          })
          return
        }
      }

      // 3. Tidak ada session valid → redirect
      router.push('/')
    }

    checkAuth()
  }, [pathname])

  const handleLogout = async () => {
    if (info?.sessionType === 'member') {
      await fetch('/api/member-logout', { method: 'POST', credentials: 'include' })
      router.push('/')
    } else {
      const supabase = createClient()
      await supabase.auth.signOut()
      router.push('/login')
    }
  }

  if (!info) return (
    <div style={{ minHeight: '100vh', display: 'flex', alignItems: 'center', justifyContent: 'center', background: '#FAFAF9', fontFamily: 'system-ui, sans-serif' }}>
      <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 14 }}>
        <div style={{ width: 42, height: 42, borderRadius: 12, background: SB, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
          <span style={{ color: '#fff', fontWeight: 700, fontSize: 20, fontFamily: 'Georgia, serif' }}>K</span>
        </div>
        <p style={{ color: '#9C9892', fontSize: 13 }}>Memuat...</p>
      </div>
    </div>
  )

  const pageLabel = getPageLabel(pathname)
  const isMember  = info.sessionType === 'member'

  // Filter nav untuk member
  const visibleNavItems = isMember
    ? navItems.filter(item => MEMBER_ALLOWED_HREFS.includes(item.href))
    : navItems

  return (
    <>
      <style>{`
        *, *::before, *::after { box-sizing: border-box; }
        body { margin: 0; }
        .kasrt-root { min-height: 100vh; background: #FAFAF9; display: flex; font-family: 'DM Sans', system-ui, sans-serif; }
        .kasrt-sidebar { width: ${SIDEBAR_W}px; background: ${SB}; display: flex; flex-direction: column; flex-shrink: 0; position: fixed; top: 0; left: 0; height: 100vh; z-index: 30; transition: transform 0.28s cubic-bezier(0.22,1,0.36,1); }
        .kasrt-main { flex: 1; display: flex; flex-direction: column; min-width: 0; margin-left: ${SIDEBAR_W}px; }
        .kasrt-overlay { display: none; }
        @media (max-width: 1023px) {
          .kasrt-sidebar { transform: translateX(-100%); }
          .kasrt-sidebar.open { transform: translateX(0); }
          .kasrt-main { margin-left: 0; }
          .kasrt-overlay { display: block; position: fixed; inset: 0; background: rgba(0,0,0,0.3); z-index: 20; }
          .kasrt-mobile-menu-btn { display: flex !important; }
          .kasrt-mobile-logo { display: flex !important; }
          .kasrt-breadcrumb { display: none !important; }
          .kasrt-topbar-search { display: none !important; }
        }
      `}</style>

      <div className={`kasrt-root ${dmSans.className}`}>
        {sidebarOpen && <div className="kasrt-overlay" onClick={() => setSidebarOpen(false)} />}

        {/* ── SIDEBAR ── */}
        <aside className={`kasrt-sidebar${sidebarOpen ? ' open' : ''}`}>
          {/* Logo */}
          <div style={{ padding: '0 16px', height: 56, display: 'flex', alignItems: 'center', borderBottom: '1px solid rgba(255,255,255,0.14)', flexShrink: 0 }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
              <div style={{ width: 32, height: 32, borderRadius: 9, background: 'rgba(255,255,255,0.2)', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
                <span style={{ color: '#fff', fontWeight: 700, fontSize: 14, fontFamily: 'Georgia, serif' }}>K</span>
              </div>
              <div>
                <div style={{ fontSize: 14, fontWeight: 600, color: '#fff', letterSpacing: '-0.2px', lineHeight: 1 }}>KasRT</div>
                <div style={{ fontSize: 10, color: 'rgba(255,255,255,0.5)', marginTop: 3 }}>
                  {isMember ? info.workspaceName || 'Keuangan Bersama' : 'Keuangan Bersama'}
                </div>
              </div>
            </div>
          </div>

          {/* Badge member */}
          {isMember && (
            <div style={{ margin: '8px 10px 0', padding: '6px 10px', background: 'rgba(255,255,255,0.12)', borderRadius: 8, border: '1px solid rgba(255,255,255,0.18)' }}>
              <div style={{ fontSize: 9.5, fontWeight: 600, color: 'rgba(255,255,255,0.5)', textTransform: 'uppercase', letterSpacing: '0.08em', marginBottom: 2 }}>Mode Anggota</div>
              <div style={{ fontSize: 11.5, fontWeight: 600, color: '#fff' }}>{info.role === 'viewer' ? '👁 Hanya lihat' : '✏️ Bisa catat transaksi'}</div>
            </div>
          )}

          {/* Nav items */}
          <nav style={{ flex: 1, padding: '10px 8px', overflowY: 'auto' }}>
            <div style={{ fontSize: 9.5, fontWeight: 600, color: 'rgba(255,255,255,0.35)', textTransform: 'uppercase', letterSpacing: '0.09em', padding: '2px 8px 8px' }}>
              Menu
            </div>
            {visibleNavItems.map((item) => {
              const active  = pathname === item.href || (item.href !== '/dashboard' && pathname.startsWith(item.href))
              const hovered = hoveredNav === item.href
              return (
                <Link
                  key={item.href}
                  href={item.href}
                  onClick={() => setSidebarOpen(false)}
                  onMouseEnter={() => setHoveredNav(item.href)}
                  onMouseLeave={() => setHoveredNav(null)}
                  style={{
                    display: 'flex', alignItems: 'center', gap: 10,
                    padding: '8px 10px', borderRadius: 8,
                    fontSize: 13, fontWeight: 500,
                    color: active || hovered ? '#fff' : 'rgba(255,255,255,0.65)',
                    background: active ? 'rgba(255,255,255,0.22)' : hovered ? 'rgba(255,255,255,0.12)' : 'transparent',
                    textDecoration: 'none', marginBottom: 2,
                    transition: 'background 0.12s, color 0.12s',
                  }}
                >
                  <span style={{ flexShrink: 0, opacity: active ? 1 : 0.65 }}>{item.icon}</span>
                  {item.label}
                </Link>
              )
            })}
          </nav>

          {/* User section */}
          <div style={{ padding: '8px 8px', borderTop: '1px solid rgba(255,255,255,0.14)', flexShrink: 0 }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 9, padding: '6px 8px' }}>
              <div style={{ width: 28, height: 28, borderRadius: '50%', background: 'rgba(255,255,255,0.25)', display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#fff', fontSize: 11, fontWeight: 700, flexShrink: 0 }}>
                {info.initials}
              </div>
              <div style={{ flex: 1, minWidth: 0 }}>
                <div style={{ fontSize: 12.5, fontWeight: 600, color: '#fff', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{info.displayName}</div>
                <div style={{ fontSize: 10.5, color: 'rgba(255,255,255,0.5)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', marginTop: 2 }}>
                  {isMember ? `Anggota · ${info.workspaceName}` : info.email}
                </div>
              </div>
            </div>
            <button
              onClick={handleLogout}
              onMouseEnter={() => setLogoutHover(true)}
              onMouseLeave={() => setLogoutHover(false)}
              style={{
                width: '100%', padding: '7px 10px',
                background: logoutHover ? 'rgba(255,255,255,0.1)' : 'transparent',
                border: 'none', color: logoutHover ? '#fff' : 'rgba(255,255,255,0.5)',
                fontSize: 12, fontWeight: 500, textAlign: 'left', cursor: 'pointer',
                borderRadius: 7, display: 'flex', alignItems: 'center', gap: 7,
                fontFamily: 'inherit', marginTop: 2, transition: 'background 0.12s, color 0.12s',
              }}
            >
              <svg width="13" height="13" viewBox="0 0 14 14" fill="none" style={{ flexShrink: 0 }}>
                <path d="M5 2H3a1 1 0 00-1 1v8a1 1 0 001 1h2M9.5 10L12 7m0 0L9.5 4M12 7H5" stroke="currentColor" strokeWidth="1.4" strokeLinecap="round" strokeLinejoin="round"/>
              </svg>
              Keluar
            </button>
          </div>
        </aside>

        {/* ── MAIN ── */}
        <div className="kasrt-main">
          <header style={{ height: 56, background: '#fff', borderBottom: '1px solid #EDE9E3', display: 'flex', alignItems: 'center', padding: '0 24px', gap: 10, position: 'sticky', top: 0, zIndex: 10, flexShrink: 0 }}>
            <button
              className="kasrt-mobile-menu-btn"
              onClick={() => setSidebarOpen(true)}
              style={{ display: 'none', padding: 7, border: 'none', background: 'none', cursor: 'pointer', color: '#6B6860', borderRadius: 7, marginLeft: -4, alignItems: 'center' }}
            >
              <svg width="18" height="18" viewBox="0 0 18 18" fill="none">
                <path d="M3 5h12M3 9h12M3 13h8" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round"/>
              </svg>
            </button>

            <div className="kasrt-mobile-logo" style={{ display: 'none', alignItems: 'center', gap: 7 }}>
              <div style={{ width: 24, height: 24, borderRadius: 6, background: SB, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                <span style={{ color: '#fff', fontWeight: 700, fontSize: 12, fontFamily: 'Georgia, serif' }}>K</span>
              </div>
              <span style={{ fontSize: 14, fontWeight: 600, color: '#0F0E0C' }}>KasRT</span>
            </div>

            <div className="kasrt-breadcrumb" style={{ display: 'flex', alignItems: 'center', gap: 5, fontSize: 13 }}>
              <span style={{ color: '#9C9892' }}>Dashboard</span>
              <span style={{ color: '#D4CFC4' }}>/</span>
              <span style={{ color: '#0F0E0C', fontWeight: 500 }}>{pageLabel}</span>
            </div>

            <div style={{ marginLeft: 'auto', display: 'flex', alignItems: 'center', gap: 8 }}>
              <div className="kasrt-topbar-search" style={{ display: 'flex', alignItems: 'center', gap: 7, background: '#F5F2EB', border: '1px solid #E3DED6', borderRadius: 8, padding: '6px 11px', fontSize: 12, color: '#9C9082', width: 160 }}>
                <svg width="12" height="12" viewBox="0 0 16 16" fill="none">
                  <circle cx="7" cy="7" r="4.5" stroke="currentColor" strokeWidth="1.5"/>
                  <path d="M10.5 10.5L13 13" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round"/>
                </svg>
                Cari...
              </div>
              {/* Tombol + Transaksi hanya muncul untuk non-viewer */}
              {(!isMember || info.role !== 'viewer') && (
                <a
                  href="/dashboard/transaksi/baru"
                  style={{ display: 'flex', alignItems: 'center', gap: 5, padding: '6px 14px', background: SB, color: '#fff', border: 'none', borderRadius: 8, fontSize: 12.5, fontWeight: 500, cursor: 'pointer', fontFamily: 'inherit', textDecoration: 'none' }}
                >
                  <span style={{ fontSize: 16, lineHeight: 1 }}>+</span>
                  Transaksi
                </a>
              )}
            </div>
          </header>

          <main style={{ flex: 1, padding: '28px 32px', overflowY: 'auto' }}>
            {children}
          </main>
        </div>
      </div>
    </>
  )
}