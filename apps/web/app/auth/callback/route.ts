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
        // Login Google = jalur owner saja
        // Kalau tidak punya workspace sebagai owner (termasuk yang cuma jadi anggota) → setup
        const { data: ownerMember } = await supabase
          .from('workspace_members')
          .select('workspace_id')
          .eq('user_id', user.id)
          .eq('role', 'owner')
          .limit(1)
          .maybeSingle()

        if (ownerMember?.workspace_id) {
          return NextResponse.redirect(`${origin}/dashboard`)
        }

        return NextResponse.redirect(`${origin}/setup`)
      }
    }
  }

  return NextResponse.redirect(`${origin}/login?error=auth_failed`)
}