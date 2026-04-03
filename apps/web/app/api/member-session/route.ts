// app/api/member-session/route.ts
// Dipanggil oleh dashboard layout untuk validasi member_session cookie
import { createServiceClient } from '@/lib/supabase/server-service'
import { NextResponse } from 'next/server'
import { cookies } from 'next/headers'

export async function GET() {
  const cookieStore = await cookies()
  const token = cookieStore.get('member_session')?.value

  if (!token) {
    return NextResponse.json({ valid: false }, { status: 401 })
  }

  const supabase = createServiceClient()

  const { data: session, error } = await supabase
    .from('member_sessions')
    .select(`
      id,
      expires_at,
      member_id,
      workspace_members (
        id,
        role,
        display_name,
        member_code,
        workspace_id,
        workspaces ( id, name )
      )
    `)
    .eq('token', token)
    .gt('expires_at', new Date().toISOString())
    .maybeSingle()

  if (error || !session) {
    return NextResponse.json({ valid: false }, { status: 401 })
  }

  const member = (session as any).workspace_members
  const workspace = member?.workspaces

  return NextResponse.json({
    valid: true,
    display_name: member?.display_name || null,
    role: member?.role || 'member',
    workspace_name: workspace?.name || null,
    workspace_id: member?.workspace_id || null,
    member_id: session.member_id,
  })
}