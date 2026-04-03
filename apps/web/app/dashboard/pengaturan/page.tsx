'use client'

import { useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'
import { createClient } from '@/lib/supabase/client'
import Link from 'next/link'

const TYPE_LABEL: Record<string, string> = {
  rt: 'RT/RW', kosan: 'Kosan', warteg: 'Warteg/Usaha', personal: 'Personal'
}

export default function PengaturanPage() {
  const router = useRouter()
  const [workspace, setWorkspace] = useState<{ id: string; name: string; type: string } | null>(null)
  const [myRole, setMyRole]       = useState('')
  const [name, setName]           = useState('')
  const [saving, setSaving]       = useState(false)
  const [saved, setSaved]         = useState(false)
  const [error, setError]         = useState('')
  const [showDelete, setShowDelete] = useState(false)
  const [deleting, setDeleting]   = useState(false)
  const [confirmName, setConfirmName] = useState('')

  useEffect(() => {
    const supabase = createClient()
    supabase.auth.getUser().then(async ({ data: { user } }) => {
      if (!user) { router.push('/login'); return }

      const { data: m } = await supabase
        .from('workspace_members')
        .select('workspace_id, role, workspaces(id, name, type)')
        .eq('user_id', user.id)
        .limit(1)

      if (!m?.length) { router.push('/dashboard/setup'); return }

      const ws = (m[0] as any).workspaces
      setWorkspace(ws)
      setMyRole(m[0].role)
      setName(ws.name)
    })
  }, [])

  const handleSave = async () => {
    if (!workspace || !name.trim()) return
    setSaving(true)
    setError('')
    const supabase = createClient()
    const { error: err } = await supabase
      .from('workspaces').update({ name: name.trim() }).eq('id', workspace.id)
    setSaving(false)
    if (err) { setError(err.message); return }
    setSaved(true)
    setTimeout(() => setSaved(false), 2000)
    setWorkspace({ ...workspace, name: name.trim() })
  }

  const handleDelete = async () => {
    if (!workspace || confirmName !== workspace.name) return
    setDeleting(true)
    const supabase = createClient()
    await supabase.from('workspaces').delete().eq('id', workspace.id)
    router.push('/dashboard/setup')
  }

  if (!workspace) return (
    <div className="flex items-center justify-center min-h-64">
      <div className="text-sm text-[#7a7469] animate-pulse">Memuat...</div>
    </div>
  )

  const isOwner = myRole === 'owner'

  return (
    <div className="max-w-2xl mx-auto space-y-6">
      <style>{`
        @keyframes fadeSlide { from{opacity:0;transform:translateY(10px)} to{opacity:1;transform:none} }
        .fade-in { animation: fadeSlide 0.3s ease forwards; }
        .btn-press:active { transform: scale(0.93); }
        .btn-press { transition: transform 0.15s cubic-bezier(0.34,1.56,0.64,1); }
      `}</style>

      <div className="fade-in">
        <h2 className="text-2xl font-serif font-semibold text-[#0f0e0c]">Pengaturan</h2>
        <p className="text-sm text-[#7a7469] mt-0.5">{TYPE_LABEL[workspace.type]} · {myRole === 'owner' ? 'Pemilik' : myRole}</p>
      </div>

      {/* Info workspace */}
      <div className="bg-white rounded-2xl border border-[#d4cfc4] p-6 fade-in" style={{ animationDelay: '0.05s' }}>
        <h3 className="text-sm font-semibold text-[#0f0e0c] mb-4">Info Workspace</h3>
        <div className="space-y-4">
          <div>
            <label className="text-xs text-[#7a7469] uppercase tracking-wide font-medium block mb-1.5">
              Nama Workspace
            </label>
            <input
              type="text"
              value={name}
              onChange={e => setName(e.target.value)}
              disabled={!isOwner}
              className="w-full px-4 py-2.5 border border-[#d4cfc4] rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-[#2d5a27] disabled:bg-[#f5f2eb] disabled:cursor-not-allowed transition-all"
            />
          </div>
          <div>
            <label className="text-xs text-[#7a7469] uppercase tracking-wide font-medium block mb-1.5">Tipe</label>
            <div className="px-4 py-2.5 border border-[#d4cfc4] rounded-xl text-sm bg-[#f5f2eb] text-[#7a7469]">
              {TYPE_LABEL[workspace.type]}
            </div>
          </div>
          {error && <p className="text-xs text-[#dc2626] bg-[#fef2f2] px-3 py-2 rounded-lg">{error}</p>}
          {saved && <p className="text-xs text-[#16a34a] bg-[#f0fdf4] px-3 py-2 rounded-lg">✅ Perubahan disimpan!</p>}
          {isOwner && (
            <button
              onClick={handleSave}
              disabled={saving || name.trim() === workspace.name}
              className="btn-press w-full py-2.5 bg-[#2d5a27] text-white rounded-xl text-sm font-bold disabled:opacity-40 hover:bg-[#1e3d1a] transition-all"
            >
              {saving ? 'Menyimpan...' : 'Simpan Perubahan'}
            </button>
          )}
        </div>
      </div>

      {/* Quick links */}
      <div className="bg-white rounded-2xl border border-[#d4cfc4] p-6 fade-in" style={{ animationDelay: '0.1s' }}>
        <h3 className="text-sm font-semibold text-[#0f0e0c] mb-4">Kelola Workspace</h3>
        <div className="space-y-2">
          {[
            { href: '/dashboard/anggota', label: '👥 Kelola Anggota', desc: 'Undang dan atur role anggota' },
            { href: '/dashboard/transaksi', label: '💸 Semua Transaksi', desc: 'Lihat dan kelola transaksi' },
            { href: '/dashboard/laporan', label: '📊 Laporan Keuangan', desc: 'Export laporan PDF' },
          ].map(item => (
            <Link key={item.href} href={item.href}
              className="flex items-center gap-3 p-3 rounded-xl hover:bg-[#f5f2eb] transition-colors group"
            >
              <div className="flex-1">
                <p className="text-sm font-semibold text-[#0f0e0c]">{item.label}</p>
                <p className="text-xs text-[#7a7469]">{item.desc}</p>
              </div>
              <span className="text-[#7a7469] group-hover:text-[#0f0e0c] transition-colors">→</span>
            </Link>
          ))}
        </div>
      </div>

      {/* Danger zone — owner only */}
      {isOwner && (
        <div className="bg-white rounded-2xl border border-[#fecaca] p-6 fade-in" style={{ animationDelay: '0.15s' }}>
          <h3 className="text-sm font-semibold text-[#dc2626] mb-1">Zona Berbahaya</h3>
          <p className="text-xs text-[#7a7469] mb-4">Tindakan ini tidak bisa dibatalkan.</p>

          {!showDelete ? (
            <button
              onClick={() => setShowDelete(true)}
              className="btn-press px-4 py-2 border border-[#fecaca] text-[#dc2626] rounded-xl text-sm font-semibold hover:bg-[#fef2f2] transition-colors"
            >
              🗑️ Hapus Workspace
            </button>
          ) : (
            <div className="space-y-3">
              <p className="text-xs text-[#dc2626]">
                Ketik <strong>{workspace.name}</strong> untuk konfirmasi:
              </p>
              <input
                type="text"
                value={confirmName}
                onChange={e => setConfirmName(e.target.value)}
                placeholder={workspace.name}
                className="w-full px-4 py-2.5 border border-[#fecaca] rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-[#dc2626] transition-all"
              />
              <div className="flex gap-3">
                <button onClick={() => { setShowDelete(false); setConfirmName('') }}
                  className="btn-press flex-1 py-2.5 border border-[#d4cfc4] rounded-xl text-sm font-semibold hover:bg-[#f5f2eb]">
                  Batal
                </button>
                <button
                  onClick={handleDelete}
                  disabled={confirmName !== workspace.name || deleting}
                  className="btn-press flex-1 py-2.5 bg-[#dc2626] text-white rounded-xl text-sm font-bold disabled:opacity-40 hover:bg-[#b91c1c]"
                >
                  {deleting ? 'Menghapus...' : 'Hapus Workspace'}
                </button>
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  )
}
