'use client'

// app/dashboard/connect/page.tsx
// Halaman konfirmasi pairing bot Telegram ke workspace

import { useEffect, useState } from 'react'
import { useRouter, useSearchParams } from 'next/navigation'
import { createClient } from '@/lib/supabase/client'

type Workspace = { id: string; name: string; type: string }

const typeLabel: Record<string, string> = {
  rt: 'RT/RW', kosan: 'Kosan', warteg: 'Warteg/Usaha', personal: 'Personal'
}

export default function ConnectPage() {
  const router       = useRouter()
  const searchParams = useSearchParams()
  const code         = searchParams.get('code')?.toUpperCase()

  const [workspaces, setWorkspaces] = useState<Workspace[]>([])
  const [selected,   setSelected]   = useState('')
  const [loading,    setLoading]    = useState(false)
  const [success,    setSuccess]    = useState(false)
  const [error,      setError]      = useState('')

  useEffect(() => {
    if (!code) { router.push('/dashboard'); return }
    const supabase = createClient()
    supabase.auth.getUser().then(async ({ data: { user } }) => {
      if (!user) { router.push('/login'); return }
      const { data: m } = await supabase
        .from('workspace_members')
        .select('workspace_id, role, workspaces(id, name, type)')
        .eq('user_id', user.id)
        .in('role', ['owner', 'admin'])
      const list = (m || []).map((x: any) => x.workspaces).filter(Boolean)
      setWorkspaces(list)
      if (list.length === 1) setSelected(list[0].id)
    })
  }, [code])

  const handleConfirm = async () => {
    if (!selected || !code) return
    setLoading(true)
    setError('')
    try {
      const res = await fetch('/api/connect', {
        method:  'POST',
        headers: { 'Content-Type': 'application/json' },
        body:    JSON.stringify({ code, workspace_id: selected }),
      })
      const json = await res.json()
      if (!res.ok) throw new Error(json.error)
      setSuccess(true)
    } catch (e: any) {
      setError(e.message)
    }
    setLoading(false)
  }

  if (success) return (
    <div className="min-h-screen bg-[#f5f2eb] flex items-center justify-center p-4">
      <div className="bg-white rounded-2xl border border-[#d4cfc4] p-8 max-w-sm w-full text-center shadow-sm"
        style={{ animation: 'bounceIn .5s cubic-bezier(.34,1.56,.64,1)' }}>
        <style>{`@keyframes bounceIn{0%{opacity:0;transform:scale(.7)}60%{opacity:1;transform:scale(1.05)}100%{transform:scale(1)}}`}</style>
        <div className="text-5xl mb-4">🎉</div>
        <h2 className="text-lg font-semibold text-[#0f0e0c] mb-2">Bot Terhubung!</h2>
        <p className="text-sm text-[#7a7469] mb-6">
          Bot Telegram kamu sudah terhubung ke workspace.
          Coba kirim pesan ke bot untuk mencatat transaksi pertama.
        </p>
        <button
          onClick={() => router.push('/dashboard')}
          className="w-full py-2.5 bg-[#2d5a27] text-white rounded-xl text-sm font-semibold hover:bg-[#1e3d1a] transition-colors"
        >
          Ke Dashboard →
        </button>
      </div>
    </div>
  )

  return (
    <div className="min-h-screen bg-[#f5f2eb] flex items-center justify-center p-4">
      <div className="bg-white rounded-2xl border border-[#d4cfc4] p-8 max-w-sm w-full shadow-sm">
        <div className="text-center mb-6">
          <div className="text-4xl mb-3">🤖</div>
          <h2 className="text-xl font-serif font-semibold text-[#0f0e0c]">Hubungkan Bot Telegram</h2>
          <p className="text-sm text-[#7a7469] mt-1">
            Kode: <span className="font-mono font-bold text-[#2d5a27]">{code}</span>
          </p>
        </div>

        {workspaces.length === 0 ? (
          <p className="text-sm text-[#7a7469] text-center py-4">Memuat workspace...</p>
        ) : (
          <>
            <p className="text-xs text-[#7a7469] uppercase tracking-wide font-medium mb-3">
              Pilih Workspace
            </p>
            <div className="space-y-2 mb-6">
              {workspaces.map(ws => (
                <button
                  key={ws.id}
                  onClick={() => setSelected(ws.id)}
                  className={`w-full p-3.5 rounded-xl border-2 text-left transition-all ${
                    selected === ws.id
                      ? 'border-[#2d5a27] bg-[#f0fdf4]'
                      : 'border-[#e8e4dc] hover:border-[#a8a39a]'
                  }`}
                >
                  <p className="text-sm font-semibold text-[#0f0e0c]">{ws.name}</p>
                  <p className="text-xs text-[#7a7469] mt-0.5">{typeLabel[ws.type] || ws.type}</p>
                </button>
              ))}
            </div>

            {error && (
              <p className="text-xs text-[#dc2626] bg-[#fef2f2] px-3 py-2 rounded-lg mb-4">{error}</p>
            )}

            <button
              onClick={handleConfirm}
              disabled={!selected || loading}
              className="w-full py-3 bg-[#2d5a27] text-white rounded-xl text-sm font-bold hover:bg-[#1e3d1a] disabled:opacity-40 transition-colors"
            >
              {loading ? 'Menghubungkan...' : '🔗 Konfirmasi Koneksi'}
            </button>
          </>
        )}
      </div>
    </div>
  )
}
