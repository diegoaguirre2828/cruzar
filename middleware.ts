import { createServerClient } from '@supabase/ssr'
import { NextResponse, type NextRequest } from 'next/server'

// Routes where we do NOT need to run the auth-refresh hit against Supabase
// on every request. These endpoints either don't look at the session at
// all, or do their own auth check internally. Skipping them here saves a
// massive amount of DB load under traffic spikes — every visit to the
// homepage fires /api/ports + /api/reports/recent, which would otherwise
// each trigger a getUser() call here.
const PUBLIC_API_PREFIXES = [
  '/api/ports',
  '/api/reports/recent',
  '/api/negocios',
  '/api/exchange',
  '/api/leaderboard',
  '/api/predict',
  '/api/predictions',
  '/api/widget',
  '/api/ingest',       // has its own admin/secret gate
  '/api/cron',          // has its own CRON_SECRET gate
  '/api/stripe/webhook', // has its own signature check
]

export async function middleware(request: NextRequest) {
  const path = request.nextUrl.pathname

  // Fast-path: public API routes that don't need an auth refresh
  if (PUBLIC_API_PREFIXES.some((p) => path.startsWith(p))) {
    return NextResponse.next({ request })
  }

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
          cookiesToSet.forEach(({ name, value }) => request.cookies.set(name, value))
          supabaseResponse = NextResponse.next({ request })
          cookiesToSet.forEach(({ name, value, options }) =>
            supabaseResponse.cookies.set(name, value, options)
          )
        },
      },
    }
  )

  // Refreshes the session token if expired — do not add logic between this
  // and the createServerClient call above or sessions will break randomly.
  await supabase.auth.getUser()

  return supabaseResponse
}

export const config = {
  matcher: [
    '/((?!_next/static|_next/image|favicon.ico|.*\\.(?:svg|png|jpg|jpeg|gif|webp)$).*)',
  ],
}
