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

        // Kalau ada redirect param (misal dari /join?token=...), ikuti dulu
        // tanpa cek workspace — biarkan halaman tujuan yang handle
        if (next && next.startsWith('/')) {
          return NextResponse.redirect(`${origin}${next}`)
        }

        // Login Google normal = jalur owner
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