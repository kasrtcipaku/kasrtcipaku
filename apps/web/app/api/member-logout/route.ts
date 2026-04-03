// app/api/member-logout/route.ts
import { createServiceClient } from '@/lib/supabase/server-service'
import { NextResponse } from 'next/server'
import { cookies } from 'next/headers'

export async function POST() {
  const cookieStore = await cookies()
  const token = cookieStore.get('member_session')?.value

  if (token) {
    const supabase = createServiceClient()
    // Hapus session dari DB
    await supabase
      .from('member_sessions')
      .delete()
      .eq('token', token)
  }

  const response = NextResponse.json({ ok: true })
  response.cookies.set('member_session', '', {
    httpOnly: true,
    secure: process.env.NODE_ENV === 'production',
    sameSite: 'lax',
    path: '/',
    maxAge: 0,
  })
  return response
}