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
        // Cek apakah punya workspace sebagai owner
        const { data: ownerMember } = await supabase
          .from('workspace_members')
          .select('workspace_id, role')
          .eq('user_id', user.id)
          .eq('role', 'owner')
          .limit(1)
          .maybeSingle()

        if (ownerMember?.workspace_id) {
          return NextResponse.redirect(`${origin}/dashboard`)
        }

        // Cek apakah jadi anggota di workspace lain
        const { data: anyMember } = await supabase
          .from('workspace_members')
          .select('workspace_id')
          .eq('user_id', user.id)
          .limit(1)
          .maybeSingle()

        if (anyMember?.workspace_id) {
          // Anggota di workspace lain → dashboard (layout handle selanjutnya)
          return NextResponse.redirect(`${origin}/dashboard`)
        }

        // Belum punya workspace sama sekali → setup
        return NextResponse.redirect(`${origin}/setup`)
      }
    }
  }

  return NextResponse.redirect(`${origin}/login?error=auth_failed`)
}