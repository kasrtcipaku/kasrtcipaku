import { createClient } from '@/lib/supabase/server'
import { NextResponse } from 'next/server'

export async function GET(request: Request) {
  const { searchParams, origin } = new URL(request.url)
  const code = searchParams.get('code')

  if (code) {
    const supabase = await createClient()
    const { error } = await supabase.auth.exchangeCodeForSession(code)

    if (!error) {
      // Cek apakah user sudah punya workspace
      const { data: { user } } = await supabase.auth.getUser()
      if (user) {
        const { data: member } = await supabase
          .from('workspace_members')
          .select('workspace_id')
          .eq('user_id', user.id)
          .limit(1)
          .maybeSingle()

        // Punya workspace → dashboard, belum punya → setup
        const redirectTo = member?.workspace_id ? '/dashboard' : '/dashboard/setup'
        return NextResponse.redirect(`${origin}${redirectTo}`)
      }
    }
  }

  return NextResponse.redirect(`${origin}/login?error=auth_failed`)
}