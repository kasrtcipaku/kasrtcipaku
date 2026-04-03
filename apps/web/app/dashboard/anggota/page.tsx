'use client'

import { useEffect, useState } from 'react'
import { createClient } from '@/lib/supabase/client'

type Member = {
  member_id: string
  user_id: string
  role: 'owner' | 'admin' | 'member' | 'viewer'
  joined_at: string
  full_name: string
  email: string
  avatar_url: string | null
}

type Invitation = {
  id: string
  email: string | null
  role: string
  token: string
  expires_at: string
  accepted_at: string | null
}

const ROLE_LABEL: Record<string, string> = {
  owner: 'Pemilik',
  admin: 'Admin',
  member: 'Anggota',
  viewer: 'Penonton',
}

const ROLE_COLOR: Record<string, string> = {
  owner: 'bg-[#f0fdf4] text-[#16a34a] border-[#bbf7d0]',
  admin: 'bg-[#eff6ff] text-[#2563eb] border-[#bfdbfe]',
  member: 'bg-[#f5f2eb] text-[#7a7469] border-[#d4cfc4]',
  viewer: 'bg-[#fefce8] text-[#ca8a04] border-[#fef08a]',
}

const fmt = (n: string) => new Date(n).toLocaleDateString('id-ID', { day: 'numeric', month: 'short', year: 'numeric' })

export default function AnggotaPage() {
  const [members, setMembers]       = useState<Member[]>([])
  const [invitations, setInvitations] = useState<Invitation[]>([])
  const [loading, setLoading]       = useState(true)
  const [workspaceId, setWorkspaceId] = useState<string | null>(null)
  const [myRole, setMyRole]         = useState<string>('')
  const [myUserId, setMyUserId]     = useState<string>('')

  // Form undang
  const [showInvite, setShowInvite] = useState(false)
  const [inviteEmail, setInviteEmail] = useState('')
  const [inviteRole, setInviteRole]  = useState<'admin' | 'member' | 'viewer'>('member')
  const [inviting, setInviting]     = useState(false)
  const [inviteLink, setInviteLink] = useState('')
  const [inviteError, setInviteError] = useState('')

  // Update role
  const [updatingId, setUpdatingId] = useState<string | null>(null)

  // Kick
  const [kickId, setKickId]   = useState<string | null>(null)
  const [kicking, setKicking] = useState(false)

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

      if (!m?.length) return
      setWorkspaceId(m[0].workspace_id)
      setMyRole(m[0].role)
      fetchAll(m[0].workspace_id)
    })
  }, [])

  const fetchAll = async (wsId: string) => {
    setLoading(true)
    const supabase = createClient()

    const [membRes, invRes] = await Promise.all([
      supabase.rpc('get_workspace_members', { p_workspace_id: wsId }),
      supabase.from('invitations')
        .select('id, email, role, token, expires_at, accepted_at')
        .eq('workspace_id', wsId)
        .is('accepted_at', null)
        .gt('expires_at', new Date().toISOString())
        .order('created_at', { ascending: false }),
    ])

    setMembers((membRes.data as Member[]) || [])
    setInvitations((invRes.data as Invitation[]) || [])
    setLoading(false)
  }

  const handleInvite = async () => {
    if (!workspaceId) return
    setInviting(true)
    setInviteError('')
    setInviteLink('')

    const supabase = createClient()
    const { data, error } = await supabase
      .from('invitations')
      .insert({
        workspace_id: workspaceId,
        email: inviteEmail.trim() || null,
        role: inviteRole,
      })
      .select('token')
      .single()

    if (error) {
      setInviteError(error.message)
      setInviting(false)
      return
    }

    const link = `${window.location.origin}/join?token=${data.token}`
    setInviteLink(link)
    setInviteEmail('')
    setInviting(false)
    fetchAll(workspaceId)
  }

  const handleUpdateRole = async (memberId: string, userId: string, newRole: string) => {
    if (!workspaceId || userId === myUserId) return
    setUpdatingId(memberId)
    const supabase = createClient()
    await supabase
      .from('workspace_members')
      .update({ role: newRole })
      .eq('id', memberId)
    setUpdatingId(null)
    fetchAll(workspaceId)
  }

  const handleKick = async () => {
    if (!kickId || !workspaceId) return
    setKicking(true)
    const supabase = createClient()
    await supabase.from('workspace_members').delete().eq('id', kickId)
    setKickId(null)
    setKicking(false)
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
  }

  const canManage = myRole === 'owner' || myRole === 'admin'

  return (
    <div className="max-w-3xl mx-auto space-y-6">
      <style>{`
        @keyframes slideDown { from{opacity:0;transform:translateY(-12px)} to{opacity:1;transform:none} }
        @keyframes bounceIn { 0%{opacity:0;transform:scale(0.8)} 60%{opacity:1;transform:scale(1.04)} 100%{transform:scale(1)} }
        .slide-down { animation: slideDown 0.3s cubic-bezier(0.34,1.2,0.64,1) forwards; }
        .bounce-in { animation: bounceIn 0.4s cubic-bezier(0.34,1.56,0.64,1) forwards; }
        .btn-press:active { transform: scale(0.93); }
        .btn-press { transition: transform 0.15s cubic-bezier(0.34,1.56,0.64,1); }
        .row-enter { animation: slideDown 0.25s ease forwards; }
      `}</style>

      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-2xl font-serif font-semibold text-[#0f0e0c]">Anggota</h2>
          <p className="text-sm text-[#7a7469] mt-0.5">{members.length} anggota aktif</p>
        </div>
        {canManage && (
          <button
            onClick={() => { setShowInvite(!showInvite); setInviteLink(''); setInviteError('') }}
            className="btn-press flex items-center gap-2 px-4 py-2.5 bg-[#2d5a27] text-white rounded-xl text-sm font-bold hover:bg-[#1e3d1a] transition-colors shadow-sm"
          >
            + Undang Anggota
          </button>
        )}
      </div>

      {/* Form undang */}
      {showInvite && canManage && (
        <div className="bg-white rounded-2xl border border-[#d4cfc4] p-6 shadow-sm slide-down">
          <h3 className="text-base font-semibold text-[#0f0e0c] mb-4">Undang Anggota Baru</h3>

          <div className="space-y-4">
            <div>
              <label className="text-xs text-[#7a7469] uppercase tracking-wide font-medium block mb-1.5">
                Email <span className="normal-case text-[10px]">(kosongkan untuk link universal)</span>
              </label>
              <input
                type="email"
                value={inviteEmail}
                onChange={e => setInviteEmail(e.target.value)}
                placeholder="email@contoh.com"
                className="w-full px-4 py-2.5 border border-[#d4cfc4] rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-[#2d5a27] transition-all"
              />
            </div>

            <div>
              <label className="text-xs text-[#7a7469] uppercase tracking-wide font-medium block mb-2">Role</label>
              <div className="flex gap-2">
                {(['admin', 'member', 'viewer'] as const).map(r => (
                  <button
                    key={r}
                    onClick={() => setInviteRole(r)}
                    className={`btn-press flex-1 py-2 rounded-xl text-xs font-semibold border transition-all ${
                      inviteRole === r ? 'bg-[#2d5a27] text-white border-[#2d5a27]' : 'border-[#d4cfc4] text-[#7a7469] hover:bg-[#f5f2eb]'
                    }`}
                  >
                    {ROLE_LABEL[r]}
                  </button>
                ))}
              </div>
              <p className="text-xs text-[#7a7469] mt-2">
                {inviteRole === 'admin' && '✏️ Admin: bisa tambah, edit, hapus transaksi dan tagihan'}
                {inviteRole === 'member' && '📝 Anggota: bisa tambah transaksi, tidak bisa hapus'}
                {inviteRole === 'viewer' && '👁️ Penonton: hanya bisa lihat data, tidak bisa edit'}
              </p>
            </div>

            {inviteError && (
              <p className="text-xs text-[#dc2626] bg-[#fef2f2] px-3 py-2 rounded-lg">{inviteError}</p>
            )}

            {inviteLink && (
              <div className="bounce-in bg-[#f0fdf4] border border-[#bbf7d0] rounded-xl p-4">
                <p className="text-xs font-semibold text-[#16a34a] mb-2">✅ Link undangan berhasil dibuat!</p>
                <div className="flex items-center gap-2">
                  <code className="flex-1 text-xs bg-white border border-[#d4cfc4] rounded-lg px-3 py-2 truncate text-[#0f0e0c]">
                    {inviteLink}
                  </code>
                  <button
                    onClick={() => copyLink(inviteLink)}
                    className="btn-press px-3 py-2 bg-[#2d5a27] text-white rounded-lg text-xs font-semibold hover:bg-[#1e3d1a]"
                  >
                    Copy
                  </button>
                </div>
                <p className="text-xs text-[#7a7469] mt-2">Berlaku 7 hari. Bagikan link ini ke anggota yang ingin diundang.</p>
              </div>
            )}

            <div className="flex gap-3">
              <button onClick={() => setShowInvite(false)} className="btn-press flex-1 py-2.5 border border-[#d4cfc4] text-[#3d3a35] rounded-xl text-sm font-semibold hover:bg-[#f5f2eb]">
                Batal
              </button>
              <button
                onClick={handleInvite}
                disabled={inviting}
                className="btn-press flex-1 py-2.5 bg-[#2d5a27] text-white rounded-xl text-sm font-bold disabled:opacity-40 hover:bg-[#1e3d1a]"
              >
                {inviting ? 'Membuat link...' : '🔗 Buat Link Undangan'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Pending invitations */}
      {invitations.length > 0 && canManage && (
        <div className="bg-white rounded-2xl border border-[#d4cfc4] overflow-hidden">
          <div className="px-5 py-3 border-b border-[#f0ede6] bg-[#fafaf8]">
            <h3 className="text-sm font-semibold text-[#0f0e0c]">Undangan Menunggu ({invitations.length})</h3>
          </div>
          <div className="divide-y divide-[#f0ede6]">
            {invitations.map(inv => (
              <div key={inv.id} className="flex items-center gap-3 px-5 py-3">
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-medium text-[#0f0e0c] truncate">
                    {inv.email || '🔗 Link universal'}
                  </p>
                  <p className="text-xs text-[#7a7469]">
                    {ROLE_LABEL[inv.role]} · Exp: {fmt(inv.expires_at)}
                  </p>
                </div>
                <button
                  onClick={() => copyLink(`${window.location.origin}/join?token=${inv.token}`)}
                  className="btn-press text-xs px-2.5 py-1.5 rounded-lg border border-[#d4cfc4] text-[#7a7469] hover:bg-[#f5f2eb]"
                >
                  Copy
                </button>
                <button
                  onClick={() => handleRevokeInvite(inv.id)}
                  className="btn-press text-xs px-2.5 py-1.5 rounded-lg bg-[#fef2f2] text-[#dc2626] hover:bg-[#fee2e2]"
                >
                  Cabut
                </button>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Member list */}
      <div className="bg-white rounded-2xl border border-[#d4cfc4] overflow-hidden">
        <div className="px-5 py-3 border-b border-[#f0ede6] bg-[#fafaf8]">
          <h3 className="text-sm font-semibold text-[#0f0e0c]">Daftar Anggota</h3>
        </div>

        {loading ? (
          <div className="p-5 space-y-3">
            {[...Array(3)].map((_, i) => (
              <div key={i} className="flex items-center gap-3 animate-pulse">
                <div className="w-10 h-10 rounded-full bg-[#e8e4dc]" />
                <div className="flex-1 space-y-2">
                  <div className="h-3.5 bg-[#e8e4dc] rounded w-32" />
                  <div className="h-3 bg-[#e8e4dc] rounded w-44" />
                </div>
              </div>
            ))}
          </div>
        ) : (
          <div className="divide-y divide-[#f0ede6]">
            {members.map((m, i) => (
              <div key={m.member_id} className="flex items-center gap-4 px-5 py-4 row-enter" style={{ animationDelay: `${i * 0.05}s` }}>
                {/* Avatar */}
                <div className="w-10 h-10 rounded-full bg-[#2d5a27] flex items-center justify-center text-white text-sm font-bold shrink-0">
                  {m.full_name?.[0]?.toUpperCase() || m.email?.[0]?.toUpperCase() || '?'}
                </div>

                {/* Info */}
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2">
                    <p className="text-sm font-semibold text-[#0f0e0c] truncate">{m.full_name}</p>
                    {m.user_id === myUserId && (
                      <span className="text-[10px] text-[#7a7469] bg-[#f5f2eb] px-1.5 py-0.5 rounded-full">Kamu</span>
                    )}
                  </div>
                  <p className="text-xs text-[#7a7469] truncate">{m.email}</p>
                  <p className="text-[11px] text-[#a8a39a] mt-0.5">Bergabung {fmt(m.joined_at)}</p>
                </div>

                {/* Role badge / selector */}
                {canManage && m.role !== 'owner' && m.user_id !== myUserId ? (
                  <select
                    value={m.role}
                    onChange={e => handleUpdateRole(m.member_id, m.user_id, e.target.value)}
                    disabled={updatingId === m.member_id}
                    className={`text-xs font-semibold px-2.5 py-1.5 rounded-lg border cursor-pointer focus:outline-none focus:ring-2 focus:ring-[#2d5a27] transition-all ${ROLE_COLOR[m.role]}`}
                  >
                    <option value="admin">Admin</option>
                    <option value="member">Anggota</option>
                    <option value="viewer">Penonton</option>
                  </select>
                ) : (
                  <span className={`text-xs font-semibold px-2.5 py-1.5 rounded-lg border ${ROLE_COLOR[m.role]}`}>
                    {ROLE_LABEL[m.role]}
                  </span>
                )}

                {/* Kick button */}
                {canManage && m.role !== 'owner' && m.user_id !== myUserId && (
                  <button
                    onClick={() => setKickId(m.member_id)}
                    className="btn-press p-2 rounded-lg hover:bg-[#fef2f2] text-[#7a7469] hover:text-[#dc2626] transition-colors"
                    title="Keluarkan anggota"
                  >
                    ✕
                  </button>
                )}

                {/* Leave button for self (non-owner) */}
                {m.user_id === myUserId && m.role !== 'owner' && (
                  <button
                    onClick={() => setKickId(m.member_id)}
                    className="btn-press text-xs px-3 py-1.5 rounded-lg border border-[#fecaca] text-[#dc2626] hover:bg-[#fef2f2] transition-colors"
                  >
                    Keluar
                  </button>
                )}
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Kick / Leave confirmation modal */}
      {kickId && (
        <div className="fixed inset-0 bg-black/40 z-50 flex items-end sm:items-center justify-center p-4" onClick={() => setKickId(null)}>
          <div className="bounce-in bg-white rounded-2xl p-6 w-full max-w-sm shadow-2xl" onClick={e => e.stopPropagation()}>
            <div className="text-3xl mb-3 text-center">⚠️</div>
            <h3 className="text-base font-semibold text-center mb-1">
              {members.find(m => m.member_id === kickId)?.user_id === myUserId
                ? 'Keluar dari workspace?'
                : 'Keluarkan anggota ini?'}
            </h3>
            <p className="text-xs text-[#7a7469] text-center mb-5">
              Anggota tidak akan bisa akses workspace lagi.
            </p>
            <div className="flex gap-3">
              <button onClick={() => setKickId(null)} className="btn-press flex-1 py-2.5 border border-[#d4cfc4] rounded-xl text-sm font-semibold hover:bg-[#f5f2eb]">Batal</button>
              <button onClick={handleKick} disabled={kicking} className="btn-press flex-1 py-2.5 bg-[#dc2626] text-white rounded-xl text-sm font-bold disabled:opacity-50 hover:bg-[#b91c1c]">
                {kicking ? 'Memproses...' : 'Ya, Lanjutkan'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
