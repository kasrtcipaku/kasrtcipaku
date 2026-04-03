// middleware.ts
import { createServerClient } from '@supabase/ssr'
import { NextResponse, type NextRequest } from 'next/server'

export async function middleware(request: NextRequest) {
  const { pathname } = request.nextUrl

  // ─── Bypass auth untuk API internal ───────────────────────────────────────
  if (pathname.startsWith('/api/')) {
    return NextResponse.next()
  }

  // ─── Cek member_session cookie dulu (login anggota tanpa Supabase Auth) ───
  const memberToken = request.cookies.get('member_session')?.value
  if (memberToken && pathname.startsWith('/dashboard')) {
    // Validasi token ke DB via Supabase service
    // Kita set header khusus agar layout bisa baca info member
    // Validasi ringan: cek apakah cookie ada — validasi penuh ada di layout
    // (middleware tidak bisa query DB tanpa service key, jadi kita pass through
    //  dan biarkan layout yang reject kalau token invalid/expired)
    return NextResponse.next()
  }

  // ─── Cek Supabase Auth session (owner/admin) ──────────────────────────────
  let supabaseResponse = NextResponse.next({ request })

  const supabase = createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        getAll() {
          return request.cookies.getAll()
        },
        setAll(cookiesToSet) {
          cookiesToSet.forEach(({ name, value }) =>
            request.cookies.set(name, value)
          )
          supabaseResponse = NextResponse.next({ request })
          cookiesToSet.forEach(({ name, value, options }) =>
            supabaseResponse.cookies.set(name, value, options)
          )
        },
      },
    }
  )

  const { data: { user } } = await supabase.auth.getUser()

  // Kalau tidak ada Supabase user DAN tidak ada member_session
  // → redirect ke login untuk halaman yang butuh auth
  if (
    !user &&
    !memberToken &&
    !pathname.startsWith('/login') &&
    !pathname.startsWith('/auth') &&
    !pathname.startsWith('/join') &&
    pathname !== '/'
  ) {
    const url = request.nextUrl.clone()
    url.pathname = '/login'
    return NextResponse.redirect(url)
  }

  return supabaseResponse
}

export const config = {
  matcher: [
    '/((?!_next/static|_next/image|favicon.ico|.*\\.(?:svg|png|jpg|jpeg|gif|webp)$).*)',
  ],
}