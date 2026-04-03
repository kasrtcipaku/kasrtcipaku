import { createClient } from '@/lib/supabase/server'
import { NextResponse } from 'next/server'

export async function GET(request: Request) {
  const { searchParams, origin } = new URL(request.url)
  const code = searchParams.get('code')

  if (code) {
    const supabase = await createClient()
    const { error } = await supabase.auth.exchangeCodeForSession(code)

    if (!error) {
      const { data: { user } } = await supabase.auth.getUser()
      if (user) {
        const { data: member } = await supabase
          .from('workspace_members')
          .select('workspace_id, role')
          .eq('user_id', user.id)
          .limit(1)
          .maybeSingle()

        // Punya workspace sebagai owner → dashboard
        // Belum punya / bukan owner → setup (buat workspace baru)
        const redirectTo = (member?.role === 'owner' && member?.workspace_id)
          ? '/dashboard'
          : '/setup'
        return NextResponse.redirect(`${origin}${redirectTo}`)
      }
    }
  }

  return NextResponse.redirect(`${origin}/login?error=auth_failed`)
}