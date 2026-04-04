// app/api/member-transactions/route.ts
// Fetch transaksi untuk anggota yang login via member_session (bypass RLS pakai service role)

import { createServiceClient } from '@/lib/supabase/server-service'
import { NextResponse } from 'next/server'
import { cookies } from 'next/headers'

export async function GET(request: Request) {
  // Validasi member_session dulu
  const cookieStore = await cookies()
  const token = cookieStore.get('member_session')?.value

  if (!token) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  const supabase = createServiceClient()

  // Validasi token dan ambil workspace_id
  const { data: session, error: sessionErr } = await supabase
    .from('member_sessions')
    .select('member_id, expires_at, workspace_members(workspace_id, role)')
    .eq('token', token)
    .gt('expires_at', new Date().toISOString())
    .maybeSingle()

  if (sessionErr || !session) {
    return NextResponse.json({ error: 'Session tidak valid' }, { status: 401 })
  }

  const workspaceId = (session as any).workspace_members?.workspace_id
  if (!workspaceId) {
    return NextResponse.json({ error: 'Workspace tidak ditemukan' }, { status: 404 })
  }

  // Ambil query params
  const { searchParams } = new URL(request.url)
  const from        = searchParams.get('from')
  const to          = searchParams.get('to')
  const type        = searchParams.get('type')
  const search      = searchParams.get('search')

  // Fetch transaksi pakai service role (bypass RLS)
  let query = supabase
    .from('transactions')
    .select('id, type, amount, description, date, categories(name, icon)')
    .eq('workspace_id', workspaceId)
    .order('date', { ascending: false })

  if (from) query = query.gte('date', from)
  if (to)   query = query.lte('date', to)
  if (type && type !== 'all') query = query.eq('type', type)
  if (search) query = query.ilike('description', `%${search}%`)

  const { data, error } = await query

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 })
  }

  return NextResponse.json({ data: data || [], workspaceId })
}
