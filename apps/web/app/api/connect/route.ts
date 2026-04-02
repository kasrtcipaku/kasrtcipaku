// app/api/connect/route.ts
import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { createClient as createServiceClient } from '@supabase/supabase-js'

// Paksa dynamic — jangan di-render saat build
export const dynamic = 'force-dynamic'

export async function POST(req: NextRequest) {
  try {
    const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL
    const serviceKey  = process.env.SUPABASE_SERVICE_ROLE_KEY

    if (!supabaseUrl || !serviceKey) {
      return NextResponse.json(
        { error: 'Server configuration error' },
        { status: 500 }
      )
    }

    const { code, workspace_id } = await req.json()

    if (!code || !workspace_id) {
      return NextResponse.json(
        { error: 'code dan workspace_id wajib diisi' },
        { status: 400 }
      )
    }

    // Cek user login
    const supabase = await createClient()
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    // Pastikan user adalah member workspace
    const { data: member } = await supabase
      .from('workspace_members')
      .select('role')
      .eq('workspace_id', workspace_id)
      .eq('user_id', user.id)
      .single()

    if (!member || !['owner', 'admin'].includes(member.role)) {
      return NextResponse.json({ error: 'Akses ditolak' }, { status: 403 })
    }

    // Service client untuk akses connect_codes (bypass RLS)
    const serviceClient = createServiceClient(supabaseUrl, serviceKey)

    // Cari connect code yang valid
    const { data: connectCode } = await serviceClient
      .from('connect_codes')
      .select('*')
      .eq('code', code.toUpperCase())
      .gt('expires_at', new Date().toISOString())
      .single()

    if (!connectCode) {
      return NextResponse.json(
        { error: 'Kode tidak valid atau sudah expired' },
        { status: 404 }
      )
    }

    // Simpan link telegram <-> workspace
    await serviceClient
      .from('telegram_links')
      .upsert({
        telegram_chat_id: connectCode.telegram_chat_id,
        workspace_id,
        user_id: user.id,
      })

    // Hapus kode setelah dipakai
    await serviceClient
      .from('connect_codes')
      .delete()
      .eq('code', code.toUpperCase())

    return NextResponse.json({ success: true })

  } catch (err: any) {
    console.error('Connect error:', err)
    return NextResponse.json({ error: err.message }, { status: 500 })
  }
}