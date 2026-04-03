import { createClient } from '@/lib/supabase/server'
import { NextResponse } from 'next/server'

export async function GET(request: Request) {
  const { searchParams, origin } = new URL(request.url)
  const code = searchParams.get('code')
  const next = searchParams.get('next') ?? searchParams.get('redirect') ?? null

  if (code) {
    const supabase = await createClient()
    const { error } = await supabase.auth.exchangeCodeForSession(code)

    if (!error) {
      const { data: { user } } = await supabase.auth.getUser()
      if (user) {

        // Ada next param (misal dari /join?token=...) — ikuti, jangan cek workspace
        if (next && next.startsWith('/')) {
          return NextResponse.redirect(`${origin}${next}`)
        }

        // Login normal tanpa redirect — jalur owner
        const { data: ownerMember } = await supabase
          .from('workspace_members')
          .select('workspace_id')
          .eq('user_id', user.id)
          .eq('role', 'owner')
          .limit(1)
          .maybeSingle()

        return NextResponse.redirect(`${origin}${ownerMember?.workspace_id ? '/dashboard' : '/setup'}`)
      }
    }
  }

  return NextResponse.redirect(`${origin}/login?error=auth_failed`)
}