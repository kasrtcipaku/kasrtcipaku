'use client'

import { useState } from 'react'
import { createClient } from '@/lib/supabase/client'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'

export default function LoginForm() {
  const [email, setEmail] = useState('')
  const [loading, setLoading] = useState(false)
  const [sent, setSent] = useState(false)
  const [error, setError] = useState('')

  const supabase = createClient()

  async function handleMagicLink() {
    if (!email) return setError('Email tidak boleh kosong')
    setLoading(true)
    setError('')

    const { error } = await supabase.auth.signInWithOtp({
      email,
      options: { emailRedirectTo: `${location.origin}/auth/callback` }
    })

    if (error) {
      setError(error.message)
    } else {
      setSent(true)
    }
    setLoading(false)
  }

  async function handleGoogle() {
    setLoading(true)
    await supabase.auth.signInWithOAuth({
      provider: 'google',
      options: { redirectTo: `${location.origin}/auth/callback` }
    })
  }

  if (sent) {
    return (
      <div className="text-center py-4">
        <div className="text-4xl mb-4">📬</div>
        <h3 className="font-semibold text-[#0f0e0c] mb-2">Cek email kamu!</h3>
        <p className="text-sm text-[#7a7469]">
          Link masuk sudah dikirim ke <strong>{email}</strong>.<br />
          Klik link tersebut untuk melanjutkan.
        </p>
      </div>
    )
  }

  return (
    <div className="flex flex-col gap-4">
      {/* Google OAuth */}
      <Button
        variant="outline"
        className="w-full flex gap-2 items-center justify-center"
        onClick={handleGoogle}
        disabled={loading}
      >
        <svg width="18" height="18" viewBox="0 0 18 18">
          <path fill="#4285F4" d="M17.64 9.2c0-.637-.057-1.251-.164-1.84H9v3.481h4.844c-.209 1.125-.843 2.078-1.796 2.717v2.258h2.908c1.702-1.567 2.684-3.874 2.684-6.615z"/>
          <path fill="#34A853" d="M9 18c2.43 0 4.467-.806 5.956-2.184l-2.908-2.258c-.806.54-1.837.86-3.048.86-2.344 0-4.328-1.584-5.036-3.711H.957v2.332C2.438 15.983 5.482 18 9 18z"/>
          <path fill="#FBBC05" d="M3.964 10.707c-.18-.54-.282-1.117-.282-1.707s.102-1.167.282-1.707V4.961H.957C.347 6.175 0 7.55 0 9s.348 2.825.957 4.039l3.007-2.332z"/>
          <path fill="#EA4335" d="M9 3.58c1.321 0 2.508.454 3.44 1.345l2.582-2.58C13.463.891 11.426 0 9 0 5.482 0 2.438 2.017.957 4.961L3.964 7.293C4.672 5.166 6.656 3.58 9 3.58z"/>
        </svg>
        Masuk dengan Google
      </Button>

      <div className="flex items-center gap-3 my-1">
        <div className="flex-1 h-px bg-[#d4cfc4]" />
        <span className="text-xs text-[#7a7469]">atau</span>
        <div className="flex-1 h-px bg-[#d4cfc4]" />
      </div>

      {/* Magic Link */}
      <div className="flex flex-col gap-2">
        <label className="text-sm font-medium text-[#0f0e0c]">Email</label>
        <Input
          type="email"
          placeholder="nama@email.com"
          value={email}
          onChange={(e) => setEmail(e.target.value)}
          onKeyDown={(e) => e.key === 'Enter' && handleMagicLink()}
          disabled={loading}
        />
        {error && <p className="text-xs text-red-500">{error}</p>}
        <Button
          className="w-full bg-[#2d5a27] hover:bg-[#24481f] text-white"
          onClick={handleMagicLink}
          disabled={loading}
        >
          {loading ? 'Mengirim...' : 'Kirim Magic Link'}
        </Button>
      </div>

      <p className="text-xs text-[#7a7469] text-center">
        Kami kirim link login ke email kamu — tanpa password.
      </p>
    </div>
  )
}
