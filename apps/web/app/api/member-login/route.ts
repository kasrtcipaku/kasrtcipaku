// app/api/member-login/route.ts
import { createServiceClient } from '@/lib/supabase/server-service'
import { NextResponse } from 'next/server'

export async function POST(request: Request) {
  try {
    const { code } = await request.json()

    if (!code || typeof code !== 'string') {
      return NextResponse.json({ error: 'Kode tidak valid.' }, { status: 400 })
    }

    const normalizedCode = code.trim().toUpperCase()

    const supabase = createServiceClient()

    // Cari member berdasarkan kode
    const { data: member, error: memberErr } = await supabase
      .from('workspace_members')
      .select(`
        id,
        role,
        display_name,
        member_code,
        workspace_id,
        workspaces ( id, name, type )
      `)
      .eq('member_code', normalizedCode)
      .maybeSingle()

    if (memberErr) {
      console.error('member-login error:', memberErr)
      return NextResponse.json({ error: 'Terjadi kesalahan server.' }, { status: 500 })
    }

    if (!member) {
      return NextResponse.json(
        { error: 'Kode tidak ditemukan. Periksa kembali kode kamu.' },
        { status: 404 }
      )
    }

    // Hapus session lama yang expired untuk member ini (opsional cleanup)
    await supabase
      .from('member_sessions')
      .delete()
      .eq('member_id', member.id)
      .lt('expires_at', new Date().toISOString())

    // Buat session baru
    const { data: session, error: sessionErr } = await supabase
      .from('member_sessions')
      .insert({ member_id: member.id })
      .select('token, expires_at')
      .single()

    if (sessionErr || !session) {
      console.error('session insert error:', sessionErr)
      return NextResponse.json({ error: 'Gagal membuat sesi.' }, { status: 500 })
    }

    const workspace = (member as any).workspaces

    // Set cookie member_session
    const response = NextResponse.json({
      ok: true,
      workspace_name: workspace?.name || 'Workspace',
      display_name: member.display_name || null,
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
    console.error('member-login unexpected error:', e)
    return NextResponse.json({ error: 'Terjadi kesalahan.' }, { status: 500 })
  }
}