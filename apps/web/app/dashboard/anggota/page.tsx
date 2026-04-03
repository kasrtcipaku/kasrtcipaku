'use client'

import { useEffect, useState, useCallback } from 'react'
import { createClient } from '@/lib/supabase/client'

type Member = {
  member_id: string
  user_id: string
  role: 'owner' | 'admin' | 'member' | 'viewer'
  joined_at: string
  full_name: string
  email: string
}

type Invitation = {
  id: string
  email: string | null
  role: string
  token: string
  expires_at: string
}

const ROLE_LABEL: Record<string, string> = {
  owner: 'Pemilik', admin: 'Admin', member: 'Anggota', viewer: 'Penonton',
}

const ROLE_COLOR: Record<string, { bg: string; text: string; border: string }> = {
  owner:  { bg: '#f0fdf4', text: '#16a34a', border: '#bbf7d0' },
  admin:  { bg: '#eff6ff', text: '#2563eb', border: '#bfdbfe' },
  member: { bg: '#f5f2eb', text: '#7a7469', border: '#d4cfc4' },
  viewer: { bg: '#fefce8', text: '#ca8a04', border: '#fef08a' },
}

const fmt = (n: string) => new Date(n).toLocaleDateString('id-ID', {
  day: 'numeric', month: 'short', year: 'numeric'
})

const getInitials = (name: string, email: string) =>
  (name?.[0] || email?.[0] || '?').toUpperCase()

const AVATAR_COLORS = ['#2d5a27', '#1d4ed8', '#7c3aed', '#b45309', '#be123c', '#0e7490']
const avatarColor = (id: string) => AVATAR_COLORS[id.charCodeAt(0) % AVATAR_COLORS.length]

export default function AnggotaPage() {
  const [members, setMembers]         = useState<Member[]>([])
  const [invitations, setInvitations] = useState<Invitation[]>([])
  const [loading, setLoading]         = useState(true)
  const [workspaceId, setWorkspaceId] = useState<string | null>(null)
  const [myRole, setMyRole]           = useState('')
  const [myUserId, setMyUserId]       = useState('')

  const [showInvite, setShowInvite]   = useState(false)
  const [inviteEmail, setInviteEmail] = useState('')
  const [inviteRole, setInviteRole]   = useState<'admin' | 'member' | 'viewer'>('member')
  const [inviting, setInviting]       = useState(false)
  const [inviteLink, setInviteLink]   = useState('')
  const [inviteError, setInviteError] = useState('')
  const [copied, setCopied]           = useState(false)

  const [updatingId, setUpdatingId]   = useState<string | null>(null)
  const [kickId, setKickId]           = useState<string | null>(null)
  const [kicking, setKicking]         = useState(false)

  // ── Query langsung ke profiles — jauh lebih cepat dari RPC cross-schema ────
  const fetchAll = useCallback(async (wsId: string) => {
    setLoading(true)
    const supabase = createClient()

    const [membRes, invRes] = await Promise.all([
      supabase
        .from('workspace_members')
        .select('id, user_id, role, created_at, profiles(full_name, email)')
        .eq('workspace_id', wsId)
        .order('created_at', { ascending: true }),
      supabase
        .from('invitations')
        .select('id, email, role, token, expires_at')
        .eq('workspace_id', wsId)
        .is('accepted_at', null)
        .gt('expires_at', new Date().toISOString())
        .order('created_at', { ascending: false }),
    ])

    setMembers(
      (membRes.data || []).map((m: any) => ({
        member_id: m.id,
        user_id:   m.user_id,
        role:      m.role,
        joined_at: m.created_at,
        full_name: m.profiles?.full_name || '',
        email:     m.profiles?.email || '',
      }))
    )
    setInvitations((invRes.data as Invitation[]) || [])
    setLoading(false)
  }, [])

  useEffect(() => {
    const supabase = createClient()
    supabase.auth.getUser().then(async ({ data: { user } }) => {
      if (!user) return
      setMyUserId(user.id)
      const { data: m } = await supabase
        .from('workspace_members')
        .select('workspace_id, role')
        .eq('user_id', user.id)
        .limit(1)
        .single()
      if (!m) return
      setWorkspaceId(m.workspace_id)
      setMyRole(m.role)
      fetchAll(m.workspace_id)
    })
  }, [fetchAll])

  const handleInvite = async () => {
    if (!workspaceId) return
    setInviting(true); setInviteError(''); setInviteLink('')
    const supabase = createClient()
    const { data, error } = await supabase
      .from('invitations')
      .insert({ workspace_id: workspaceId, email: inviteEmail.trim() || null, role: inviteRole })
      .select('token').single()
    if (error) { setInviteError(error.message); setInviting(false); return }
    setInviteLink(`${window.location.origin}/join?token=${data.token}`)
    setInviteEmail(''); setInviting(false)
    fetchAll(workspaceId)
  }

  const handleUpdateRole = async (memberId: string, userId: string, newRole: string) => {
    if (!workspaceId || userId === myUserId) return
    setUpdatingId(memberId)
    const supabase = createClient()
    await supabase.from('workspace_members').update({ role: newRole }).eq('id', memberId)
    setUpdatingId(null)
    fetchAll(workspaceId)
  }

  const handleKick = async () => {
    if (!kickId || !workspaceId) return
    setKicking(true)
    const supabase = createClient()
    await supabase.from('workspace_members').delete().eq('id', kickId)
    setKickId(null); setKicking(false)
    fetchAll(workspaceId)
  }

  const handleRevokeInvite = async (invId: string) => {
    if (!workspaceId) return
    const supabase = createClient()
    await supabase.from('invitations').delete().eq('id', invId)
    fetchAll(workspaceId)
  }

  const copyLink = (text: string) => {
    navigator.clipboard.writeText(text)
    setCopied(true); setTimeout(() => setCopied(false), 2000)
  }

  const canManage = myRole === 'owner' || myRole === 'admin'

  return (
    <div style={{ maxWidth: 720, margin: '0 auto' }}>
      <style>{`
        @keyframes slideDown { from{opacity:0;transform:translateY(-10px)} to{opacity:1;transform:none} }
        @keyframes fadeUp    { from{opacity:0;transform:translateY(8px)}  to{opacity:1;transform:none} }
        @keyframes scaleIn   { from{opacity:0;transform:scale(0.95)}      to{opacity:1;transform:scale(1)} }
        @keyframes shimmer   { 0%{background-position:-400px 0} 100%{background-position:400px 0} }
        .slide-down { animation: slideDown 0.28s cubic-bezier(0.22,1,0.36,1) forwards; }
        .fade-up    { animation: fadeUp 0.3s ease forwards; }
        .scale-in   { animation: scaleIn 0.3s cubic-bezier(0.34,1.56,0.64,1) forwards; }
        .shimmer {
          background: linear-gradient(90deg,#ede9e0 25%,#f5f2eb 50%,#ede9e0 75%);
          background-size: 400px 100%;
          animation: shimmer 1.4s ease infinite;
        }
        .btn-press:active { transform: scale(0.93); }
        .btn-press { transition: transform 0.12s; }
        .member-row:hover { background: #fdfcfa; }
      `}</style>

      {/* Header */}
      <div style={{ display:'flex', alignItems:'center', justifyContent:'space-between', marginBottom:24 }} className="fade-up">
        <div>
          <h2 style={{ fontSize:26, fontWeight:700, color:'#0f0e0c', margin:0, letterSpacing:'-0.3px' }}>Anggota</h2>
          <p style={{ fontSize:13, color:'#7a7469', marginTop:3 }}>
            {loading ? 'Memuat...' : `${members.length} anggota aktif`}
          </p>
        </div>
        {canManage && (
          <button onClick={() => { setShowInvite(!showInvite); setInviteLink(''); setInviteError('') }}
            className="btn-press"
            style={{ display:'flex', alignItems:'center', gap:6, padding:'9px 16px', background:'#2d5a27', color:'#fff', border:'none', borderRadius:12, fontSize:13, fontWeight:600, cursor:'pointer', fontFamily:'inherit' }}>
            <span style={{ fontSize:16 }}>+</span> Undang Anggota
          </button>
        )}
      </div>

      {/* Form Undang */}
      {showInvite && canManage && (
        <div className="slide-down" style={{ background:'#fff', borderRadius:16, border:'1px solid #d4cfc4', padding:24, marginBottom:20, boxShadow:'0 2px 12px rgba(0,0,0,0.06)' }}>
          <h3 style={{ fontSize:15, fontWeight:700, color:'#0f0e0c', marginBottom:16 }}>🔗 Undang Anggota Baru</h3>
          <div style={{ marginBottom:14 }}>
            <label style={{ fontSize:11, fontWeight:600, color:'#7a7469', textTransform:'uppercase', letterSpacing:'0.07em', display:'block', marginBottom:6 }}>Email (opsional)</label>
            <input type="email" value={inviteEmail} onChange={e => setInviteEmail(e.target.value)}
              placeholder="email@contoh.com — kosongkan untuk link universal"
              style={{ width:'100%', padding:'10px 14px', border:'1px solid #d4cfc4', borderRadius:10, fontSize:13, outline:'none', fontFamily:'inherit', boxSizing:'border-box', color:'#0f0e0c', background:'#fafaf8' }} />
          </div>
          <div style={{ marginBottom:16 }}>
            <label style={{ fontSize:11, fontWeight:600, color:'#7a7469', textTransform:'uppercase', letterSpacing:'0.07em', display:'block', marginBottom:8 }}>Role</label>
            <div style={{ display:'flex', gap:8 }}>
              {(['admin','member','viewer'] as const).map(r => (
                <button key={r} onClick={() => setInviteRole(r)} className="btn-press" style={{
                  flex:1, padding:'8px 0', borderRadius:10, fontSize:12.5, fontWeight:600,
                  border:`1.5px solid ${inviteRole===r ? '#2d5a27' : '#d4cfc4'}`,
                  background: inviteRole===r ? '#2d5a27' : '#fafaf8',
                  color: inviteRole===r ? '#fff' : '#7a7469',
                  cursor:'pointer', fontFamily:'inherit', transition:'all 0.15s',
                }}>{ROLE_LABEL[r]}</button>
              ))}
            </div>
            <p style={{ fontSize:11.5, color:'#7a7469', marginTop:8 }}>
              {inviteRole==='admin'  && '✏️ Bisa tambah, edit, dan hapus transaksi & tagihan'}
              {inviteRole==='member' && '📝 Bisa tambah transaksi, tidak bisa hapus'}
              {inviteRole==='viewer' && '👁️ Hanya bisa lihat data, tidak bisa edit'}
            </p>
          </div>
          {inviteError && <p style={{ fontSize:12, color:'#dc2626', background:'#fef2f2', padding:'8px 12px', borderRadius:8, marginBottom:12 }}>{inviteError}</p>}
          {inviteLink && (
            <div className="scale-in" style={{ background:'#f0fdf4', border:'1px solid #bbf7d0', borderRadius:12, padding:14, marginBottom:14 }}>
              <p style={{ fontSize:12, fontWeight:600, color:'#16a34a', marginBottom:8 }}>✅ Link undangan berhasil dibuat!</p>
              <div style={{ display:'flex', gap:8, alignItems:'center' }}>
                <code style={{ flex:1, fontSize:11.5, background:'#fff', border:'1px solid #d4cfc4', borderRadius:8, padding:'8px 10px', overflow:'hidden', textOverflow:'ellipsis', whiteSpace:'nowrap', color:'#0f0e0c', display:'block' }}>
                  {inviteLink}
                </code>
                <button onClick={() => copyLink(inviteLink)} className="btn-press" style={{
                  padding:'8px 14px', background: copied ? '#16a34a' : '#2d5a27', color:'#fff',
                  border:'none', borderRadius:8, fontSize:12, fontWeight:600, cursor:'pointer', fontFamily:'inherit', whiteSpace:'nowrap', transition:'background 0.2s',
                }}>{copied ? '✓ Tersalin' : 'Salin'}</button>
              </div>
              <p style={{ fontSize:11, color:'#7a7469', marginTop:6 }}>Berlaku 7 hari.</p>
            </div>
          )}
          <div style={{ display:'flex', gap:10 }}>
            <button onClick={() => setShowInvite(false)} className="btn-press" style={{ flex:1, padding:'10px 0', border:'1px solid #d4cfc4', background:'#fff', borderRadius:10, fontSize:13, fontWeight:600, cursor:'pointer', fontFamily:'inherit', color:'#3d3a35' }}>Batal</button>
            <button onClick={handleInvite} disabled={inviting} className="btn-press" style={{ flex:1, padding:'10px 0', background: inviting ? '#a3c9a0' : '#2d5a27', color:'#fff', border:'none', borderRadius:10, fontSize:13, fontWeight:700, cursor: inviting ? 'not-allowed' : 'pointer', fontFamily:'inherit' }}>
              {inviting ? 'Membuat...' : '🔗 Buat Link Undangan'}
            </button>
          </div>
        </div>
      )}

      {/* Pending Invitations */}
      {invitations.length > 0 && canManage && (
        <div style={{ background:'#fff', borderRadius:16, border:'1px solid #d4cfc4', overflow:'hidden', marginBottom:20 }} className="fade-up">
          <div style={{ padding:'12px 20px', borderBottom:'1px solid #f0ede6', background:'#fdfcfa', display:'flex', alignItems:'center', gap:8 }}>
            <span style={{ width:7, height:7, borderRadius:'50%', background:'#f59e0b', display:'inline-block' }} />
            <h3 style={{ fontSize:13, fontWeight:700, color:'#0f0e0c', margin:0 }}>Undangan Menunggu ({invitations.length})</h3>
          </div>
          {invitations.map(inv => (
            <div key={inv.id} style={{ display:'flex', alignItems:'center', gap:12, padding:'12px 20px', borderBottom:'1px solid #f5f2eb' }}>
              <div style={{ width:36, height:36, borderRadius:'50%', background:'#fef3c7', display:'flex', alignItems:'center', justifyContent:'center', fontSize:16, flexShrink:0 }}>✉️</div>
              <div style={{ flex:1, minWidth:0 }}>
                <p style={{ fontSize:13, fontWeight:600, color:'#0f0e0c', margin:0, overflow:'hidden', textOverflow:'ellipsis', whiteSpace:'nowrap' }}>{inv.email || 'Link universal'}</p>
                <p style={{ fontSize:11.5, color:'#7a7469', margin:'2px 0 0' }}>{ROLE_LABEL[inv.role]} · Exp {fmt(inv.expires_at)}</p>
              </div>
              <button onClick={() => copyLink(`${window.location.origin}/join?token=${inv.token}`)} className="btn-press"
                style={{ padding:'6px 12px', border:'1px solid #d4cfc4', borderRadius:8, fontSize:12, cursor:'pointer', background:'#fafaf8', color:'#3d3a35', fontFamily:'inherit' }}>Salin</button>
              <button onClick={() => handleRevokeInvite(inv.id)} className="btn-press"
                style={{ padding:'6px 12px', border:'none', borderRadius:8, fontSize:12, cursor:'pointer', background:'#fef2f2', color:'#dc2626', fontFamily:'inherit' }}>Cabut</button>
            </div>
          ))}
        </div>
      )}

      {/* Member List */}
      <div style={{ background:'#fff', borderRadius:16, border:'1px solid #d4cfc4', overflow:'hidden' }}>
        <div style={{ padding:'14px 20px', borderBottom:'1px solid #f0ede6', background:'#fdfcfa', display:'flex', alignItems:'center', justifyContent:'space-between' }}>
          <h3 style={{ fontSize:13, fontWeight:700, color:'#0f0e0c', margin:0 }}>Daftar Anggota</h3>
          {!loading && <span style={{ fontSize:12, color:'#7a7469' }}>{members.length} orang</span>}
        </div>

        {/* Shimmer skeleton */}
        {loading && (
          <div style={{ padding:'8px 0' }}>
            {[...Array(3)].map((_,i) => (
              <div key={i} style={{ display:'flex', alignItems:'center', gap:14, padding:'14px 20px' }}>
                <div className="shimmer" style={{ width:42, height:42, borderRadius:'50%', flexShrink:0 }} />
                <div style={{ flex:1 }}>
                  <div className="shimmer" style={{ height:13, width:140, borderRadius:6, marginBottom:8 }} />
                  <div className="shimmer" style={{ height:11, width:200, borderRadius:6 }} />
                </div>
                <div className="shimmer" style={{ height:28, width:64, borderRadius:8 }} />
              </div>
            ))}
          </div>
        )}

        {!loading && members.length === 0 && (
          <div style={{ padding:'48px 20px', textAlign:'center' }}>
            <div style={{ fontSize:40, marginBottom:10 }}>👥</div>
            <p style={{ fontSize:14, color:'#7a7469' }}>Belum ada anggota</p>
          </div>
        )}

        {!loading && members.map((m, i) => {
          const rc = ROLE_COLOR[m.role]
          const isMe = m.user_id === myUserId
          return (
            <div key={m.member_id} className="member-row fade-up" style={{
              display:'flex', alignItems:'center', gap:14, padding:'14px 20px',
              borderBottom: i < members.length-1 ? '1px solid #f5f2eb' : 'none',
              transition:'background 0.12s', animationDelay:`${i*0.04}s`,
            }}>
              <div style={{
                width:42, height:42, borderRadius:'50%', background: avatarColor(m.user_id),
                display:'flex', alignItems:'center', justifyContent:'center',
                color:'#fff', fontSize:15, fontWeight:700, flexShrink:0,
              }}>
                {getInitials(m.full_name, m.email)}
              </div>
              <div style={{ flex:1, minWidth:0 }}>
                <div style={{ display:'flex', alignItems:'center', gap:6 }}>
                  <span style={{ fontSize:14, fontWeight:600, color:'#0f0e0c', overflow:'hidden', textOverflow:'ellipsis', whiteSpace:'nowrap' }}>
                    {m.full_name || 'Tanpa nama'}
                  </span>
                  {isMe && <span style={{ fontSize:10, background:'#f5f2eb', color:'#7a7469', padding:'2px 7px', borderRadius:99, fontWeight:600, flexShrink:0 }}>Kamu</span>}
                </div>
                <p style={{ fontSize:12, color:'#7a7469', margin:'2px 0 0', overflow:'hidden', textOverflow:'ellipsis', whiteSpace:'nowrap' }}>{m.email}</p>
                <p style={{ fontSize:11, color:'#a8a39a', margin:'2px 0 0' }}>Bergabung {fmt(m.joined_at)}</p>
              </div>

              {canManage && m.role !== 'owner' && !isMe ? (
                <select value={m.role} onChange={e => handleUpdateRole(m.member_id, m.user_id, e.target.value)}
                  disabled={updatingId === m.member_id}
                  style={{ fontSize:12, fontWeight:600, padding:'5px 10px', borderRadius:8, border:`1.5px solid ${rc.border}`, background:rc.bg, color:rc.text, cursor:'pointer', outline:'none', fontFamily:'inherit', opacity: updatingId===m.member_id ? 0.5 : 1 }}>
                  <option value="admin">Admin</option>
                  <option value="member">Anggota</option>
                  <option value="viewer">Penonton</option>
                </select>
              ) : (
                <span style={{ fontSize:12, fontWeight:600, padding:'5px 10px', borderRadius:8, border:`1.5px solid ${rc.border}`, background:rc.bg, color:rc.text, whiteSpace:'nowrap' }}>
                  {ROLE_LABEL[m.role]}
                </span>
              )}

              {canManage && m.role !== 'owner' && !isMe && (
                <button onClick={() => setKickId(m.member_id)} className="btn-press" title="Keluarkan" style={{
                  width:32, height:32, display:'flex', alignItems:'center', justifyContent:'center',
                  border:'none', background:'transparent', cursor:'pointer', borderRadius:8, color:'#c4bfb8', fontSize:14,
                }}>✕</button>
              )}
              {isMe && m.role !== 'owner' && (
                <button onClick={() => setKickId(m.member_id)} className="btn-press" style={{
                  fontSize:12, padding:'5px 12px', border:'1px solid #fecaca', borderRadius:8,
                  background:'transparent', color:'#dc2626', cursor:'pointer', fontFamily:'inherit', whiteSpace:'nowrap',
                }}>Keluar</button>
              )}
            </div>
          )
        })}
      </div>

      {/* Kick Modal */}
      {kickId && (
        <div onClick={() => setKickId(null)} style={{ position:'fixed', inset:0, background:'rgba(0,0,0,0.45)', zIndex:50, display:'flex', alignItems:'center', justifyContent:'center', padding:16 }}>
          <div className="scale-in" onClick={e => e.stopPropagation()} style={{ background:'#fff', borderRadius:20, padding:28, width:'100%', maxWidth:360, boxShadow:'0 20px 60px rgba(0,0,0,0.2)' }}>
            <div style={{ textAlign:'center', fontSize:40, marginBottom:12 }}>⚠️</div>
            <h3 style={{ textAlign:'center', fontSize:16, fontWeight:700, color:'#0f0e0c', marginBottom:6 }}>
              {members.find(m => m.member_id === kickId)?.user_id === myUserId ? 'Keluar dari workspace?' : 'Keluarkan anggota ini?'}
            </h3>
            <p style={{ textAlign:'center', fontSize:13, color:'#7a7469', marginBottom:24 }}>Anggota tidak akan bisa mengakses workspace lagi.</p>
            <div style={{ display:'flex', gap:10 }}>
              <button onClick={() => setKickId(null)} className="btn-press" style={{ flex:1, padding:'11px 0', border:'1px solid #d4cfc4', background:'#fff', borderRadius:12, fontSize:13, fontWeight:600, cursor:'pointer', fontFamily:'inherit', color:'#3d3a35' }}>Batal</button>
              <button onClick={handleKick} disabled={kicking} className="btn-press" style={{ flex:1, padding:'11px 0', background:'#dc2626', color:'#fff', border:'none', borderRadius:12, fontSize:13, fontWeight:700, cursor: kicking ? 'not-allowed' : 'pointer', fontFamily:'inherit', opacity: kicking ? 0.6 : 1 }}>
                {kicking ? 'Memproses...' : 'Ya, Lanjutkan'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}