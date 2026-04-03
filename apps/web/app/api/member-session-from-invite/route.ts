// app/api/member-session-from-invite/route.ts
import { createServiceClient } from '@/lib/supabase/server-service'
import { createClient } from '@/lib/supabase/server'
import { NextResponse } from 'next/server'

export async function POST() {
  try {
    // Ambil Supabase Auth user (masih aktif saat ini, sebelum sign out)
    const supabase = await createClient()
    const { data: { user } } = await supabase.auth.getUser()

    if (!user) {
      return NextResponse.json({ error: 'Tidak ada sesi login.' }, { status: 401 })
    }

    const serviceClient = createServiceClient()

    // Ambil workspace_member terbaru untuk user ini yang bukan owner
    const { data: member, error: memberErr } = await serviceClient
      .from('workspace_members')
      .select('id, role, display_name, workspace_id, workspaces(name)')
      .eq('user_id', user.id)
      .neq('role', 'owner')
      .order('created_at', { ascending: false })
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

    const workspaceName = (member as any).workspaces?.name || 'Workspace'
    const displayName   = member.display_name || user.user_metadata?.full_name || null

    // Simpan display_name dari Google ke workspace_members kalau belum ada
    if (!member.display_name && user.user_metadata?.full_name) {
      await serviceClient
        .from('workspace_members')
        .update({ display_name: user.user_metadata.full_name })
        .eq('id', member.id)
    }

    const response = NextResponse.json({
      ok: true,
      workspace_name: workspaceName,
      display_name: displayName,
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