'use client'

import { Suspense, useEffect, useState } from 'react'
import { useRouter, useSearchParams } from 'next/navigation'
import { createClient } from '@/lib/supabase/client'

const ROLE_LABEL: Record<string, string> = {
  admin: 'Admin',
  member: 'Anggota',
  viewer: 'Penonton',
}

const ROLE_DESC: Record<string, string> = {
  admin: 'Bisa tambah, edit, dan hapus transaksi',
  member: 'Bisa tambah transaksi, tidak bisa hapus',
  viewer: 'Hanya bisa melihat data',
}

// ── Komponen inner yang pakai useSearchParams ─────────────────────────────────
function JoinContent() {
  const router       = useRouter()
  const searchParams = useSearchParams()
  const token        = searchParams.get('token')

  const [status, setStatus]         = useState<'loading' | 'ready' | 'joining' | 'success' | 'error'>('loading')
  const [inviteInfo, setInviteInfo] = useState<{ workspace_name: string; role: string } | null>(null)
  const [errorMsg, setErrorMsg]     = useState('')

  useEffect(() => {
    if (!token) {
      setStatus('error')
      setErrorMsg('Token undangan tidak valid.')
      return
    }

    const supabase = createClient()
    supabase.auth.getUser().then(async ({ data: { user } }) => {
      if (!user) {
        sessionStorage.setItem('invite_token', token)
        router.push(`/login?redirect=/join?token=${token}`)
        return
      }

      const { data } = await supabase
        .from('invitations')
        .select('role, workspaces(name)')
        .eq('token', token)
        .is('accepted_at', null)
        .gt('expires_at', new Date().toISOString())
        .single()

      if (!data) {
        setStatus('error')
        setErrorMsg('Undangan tidak ditemukan atau sudah expired.')
        return
      }

      setInviteInfo({
        workspace_name: (data as any).workspaces?.name || 'Workspace',
        role: data.role,
      })
      setStatus('ready')
    })
  }, [token])

  const handleAccept = async () => {
    if (!token) return
    setStatus('joining')

    const supabase = createClient()
    const { data, error } = await supabase.rpc('accept_invitation', { p_token: token })

    if (error || data?.error) {
      setStatus('error')
      setErrorMsg(error?.message || data?.error || 'Gagal bergabung.')
      return
    }

    setStatus('success')
    setTimeout(() => router.push('/dashboard'), 2000)
  }

  return (
    <div className="bg-white rounded-2xl border border-[#d4cfc4] p-8 max-w-sm w-full shadow-sm bounce-in">

      {status === 'loading' && (
        <div className="text-center py-8">
          <div className="w-8 h-8 border-2 border-[#2d5a27] border-t-transparent rounded-full spin mx-auto mb-4" />
          <p className="text-sm text-[#7a7469]">Memuat undangan...</p>
        </div>
      )}

      {status === 'ready' && inviteInfo && (
        <div className="text-center">
          <div className="text-4xl mb-4">🎉</div>
          <h2 className="text-xl font-serif font-semibold text-[#0f0e0c] mb-1">
            Kamu diundang!
          </h2>
          <p className="text-sm text-[#7a7469] mb-6">
            Bergabung ke workspace
          </p>
          <div className="bg-[#f5f2eb] rounded-xl p-4 mb-6 text-left">
            <p className="text-xs text-[#7a7469] mb-1">Workspace</p>
            <p className="text-base font-bold text-[#0f0e0c]">{inviteInfo.workspace_name}</p>
            <div className="mt-3 pt-3 border-t border-[#d4cfc4]">
              <p className="text-xs text-[#7a7469] mb-1">Role kamu</p>
              <p className="text-sm font-semibold text-[#0f0e0c]">{ROLE_LABEL[inviteInfo.role]}</p>
              <p className="text-xs text-[#7a7469] mt-0.5">{ROLE_DESC[inviteInfo.role]}</p>
            </div>
          </div>
          <button
            onClick={handleAccept}
            className="btn-press w-full py-3 bg-[#2d5a27] text-white rounded-xl text-sm font-bold hover:bg-[#1e3d1a] transition-colors shadow-sm"
          >
            ✅ Terima Undangan
          </button>
          <button
            onClick={() => router.push('/')}
            className="btn-press w-full mt-3 py-2.5 text-[#7a7469] text-sm hover:text-[#0f0e0c] transition-colors"
          >
            Tolak
          </button>
        </div>
      )}

      {status === 'joining' && (
        <div className="text-center py-8">
          <div className="w-8 h-8 border-2 border-[#2d5a27] border-t-transparent rounded-full spin mx-auto mb-4" />
          <p className="text-sm text-[#7a7469]">Bergabung ke workspace...</p>
        </div>
      )}

      {status === 'success' && (
        <div className="text-center py-4">
          <div className="text-5xl mb-4" style={{ animation: 'bounceIn 0.6s ease' }}>🎊</div>
          <h2 className="text-xl font-serif font-semibold text-[#0f0e0c] mb-2">Berhasil bergabung!</h2>
          <p className="text-sm text-[#7a7469]">Mengalihkan ke dashboard...</p>
        </div>
      )}

      {status === 'error' && (
        <div className="text-center py-4">
          <div className="text-5xl mb-4">😕</div>
          <h2 className="text-base font-semibold text-[#0f0e0c] mb-2">Undangan tidak valid</h2>
          <p className="text-sm text-[#7a7469] mb-6">{errorMsg}</p>
          <button
            onClick={() => router.push('/dashboard')}
            className="btn-press w-full py-2.5 bg-[#2d5a27] text-white rounded-xl text-sm font-semibold hover:bg-[#1e3d1a]"
          >
            Ke Dashboard
          </button>
        </div>
      )}
    </div>
  )
}

// ── Fallback saat Suspense loading ────────────────────────────────────────────
function JoinFallback() {
  return (
    <div className="bg-white rounded-2xl border border-[#d4cfc4] p-8 max-w-sm w-full shadow-sm">
      <div className="text-center py-8">
        <div className="w-8 h-8 border-2 border-[#2d5a27] border-t-transparent rounded-full mx-auto mb-4"
          style={{ animation: 'spin 0.8s linear infinite' }} />
        <p className="text-sm text-[#7a7469]">Memuat undangan...</p>
      </div>
    </div>
  )
}

// ── Page utama — Suspense wajib di sini ──────────────────────────────────────
export default function JoinPage() {
  return (
    <div className="min-h-screen bg-[#f5f2eb] flex items-center justify-center p-4">
      <style>{`
        @keyframes bounceIn { 0%{opacity:0;transform:scale(0.8)} 60%{opacity:1;transform:scale(1.05)} 100%{transform:scale(1)} }
        @keyframes spin { to{transform:rotate(360deg)} }
        .bounce-in { animation: bounceIn 0.5s cubic-bezier(0.34,1.56,0.64,1); }
        .btn-press:active { transform: scale(0.93); }
        .btn-press { transition: transform 0.15s cubic-bezier(0.34,1.56,0.64,1); }
      `}</style>

      <Suspense fallback={<JoinFallback />}>
        <JoinContent />
      </Suspense>
    </div>
  )
}