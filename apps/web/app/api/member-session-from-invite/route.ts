// app/api/member-session-from-invite/route.ts
import { createServiceClient } from '@/lib/supabase/server-service'
import { createClient } from '@/lib/supabase/server'
import { NextResponse } from 'next/server'

export async function POST(request: Request) {
  try {
    const supabase = await createClient()
    const { data: { user } } = await supabase.auth.getUser()

    if (!user) {
      return NextResponse.json({ error: 'Tidak ada sesi login.' }, { status: 401 })
    }

    const serviceClient = createServiceClient()

    // Link user_id ke workspace_members berdasarkan email
    await serviceClient
      .from('workspace_members')
      .update({ user_id: user.id })
      .eq('email', user.email!)
      .is('user_id', null)

    // Cari workspace_member record untuk user ini
    const { data: member, error: memberErr } = await serviceClient
      .from('workspace_members')
      .select('id, role, display_name, workspace_id, workspaces(name)')
      .eq('user_id', user.id)
      .neq('role', 'owner')
      .limit(1)
      .maybeSingle()

    if (memberErr || !member) {
      return NextResponse.json({ error: 'Data anggota tidak ditemukan.' }, { status: 404 })
    }

    // Hapus session lama yang expired
    await serviceClient
      .from('member_sessions')
      .delete()
      .eq('member_id', member.id)
      .lt('expires_at', new Date().toISOString())

    // Buat member_session baru
    const { data: session, error: sessionErr } = await serviceClient
      .from('member_sessions')
      .insert({ member_id: member.id })
      .select('token, expires_at')
      .single()

    if (sessionErr || !session) {
      console.error('session insert error:', sessionErr)
      return NextResponse.json({ error: 'Gagal membuat sesi.' }, { status: 500 })
    }

    // Sign out dari Supabase Auth
    await supabase.auth.signOut()

    const workspaceName = (member as any).workspaces?.name || 'Workspace'

    const response = NextResponse.json({
      ok: true,
      workspace_name: workspaceName,
      display_name: member.display_name || user.user_metadata?.full_name || null,
      role: member.role,
    })

    response.cookies.set('member_session', session.token, {
      httpOnly: true,
      secure: process.env.NODE_ENV === 'production',
      sameSite: 'lax',
      path: '/',
      expires: new Date(session.expires_at),
    })

    return response
  } catch (e) {
    console.error('member-session-from-invite error:', e)
    return NextResponse.json({ error: 'Terjadi kesalahan.' }, { status: 500 })
  }
}