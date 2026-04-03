import { createClient } from '@/lib/supabase/server'
import { redirect } from 'next/navigation'
import Link from 'next/link'
import LoginForm from './login-form'

export default async function LoginPage({
  searchParams,
}: {
  searchParams: { redirect?: string; next?: string }
}) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()

  if (user) {
    // Kalau ada redirect param (misal balik dari /join?token=...), ikuti itu dulu
    const nextUrl = searchParams.redirect ?? searchParams.next ?? null
    if (nextUrl && nextUrl.startsWith('/')) {
      redirect(nextUrl)
    }

    // Login normal — cek workspace owner
    const { data: member } = await supabase
      .from('workspace_members')
      .select('workspace_id')
      .eq('user_id', user.id)
      .eq('role', 'owner')
      .limit(1)
      .maybeSingle()
    redirect(member?.workspace_id ? '/dashboard' : '/setup')
  }

  return (
    <div className="min-h-screen flex items-center justify-center bg-[#f5f2eb]">
      <div className="w-full max-w-md">
        <div className="text-center mb-8">
          <h1 className="text-3xl font-serif font-semibold text-[#0f0e0c] mb-2">KasRT</h1>
          <p className="text-sm text-[#7a7469]">Pencatatan keuangan RT/RW & usaha kecil</p>
        </div>
        <div className="bg-white rounded-xl border border-[#d4cfc4] p-8 shadow-sm">
          <h2 className="text-xl font-semibold mb-6 text-[#0f0e0c]">Masuk ke akun</h2>
          <LoginForm />
        </div>
        <p className="text-center text-sm text-[#7a7469] mt-5">
          Punya kode anggota?{' '}
          <Link href="/login/anggota" className="text-[#2d5a27] font-semibold hover:underline">
            Masuk sebagai Anggota
          </Link>
        </p>
      </div>
    </div>
  )
}