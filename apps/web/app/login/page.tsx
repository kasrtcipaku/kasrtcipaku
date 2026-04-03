import { createClient } from '@/lib/supabase/server'
import { redirect } from 'next/navigation'
import LoginForm from './login-form'

export default async function LoginPage() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()

  if (user) redirect('/dashboard')

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

      </div>
    </div>
  )
}
