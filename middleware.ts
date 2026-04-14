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

// Routes that require a signed-in session. Unauthenticated visitors are
// redirected to /signup?next=<original-path>, so they land back where they
// started after completing signup. Per Diego's 2026-04-14 direction:
// guests should only see the home page, the read-only /mapa "all bridges"
// view, and the auth pages themselves (signup, login, welcome, reset).
// Every other surface is gated.
//
// Prefix matching rules:
//   - entries ending in "/" match anything below (e.g. "/port/" → /port/123)
//   - entries without trailing slash match the exact path OR sub-paths
//     (e.g. "/planner" → /planner, /planner/settings)
const PROTECTED_ROUTE_PREFIXES = [
  '/port/',
  '/planner',
  '/chat',
  '/rewards',
  '/leaderboard',
  '/negocios',
  '/services',
  '/guide',
  '/insurance',
  '/for-fleets',
  '/fleet',
  '/features',
  '/dashboard',
  '/promoter',
  '/datos',
]

function isProtectedPath(path: string): boolean {
  return PROTECTED_ROUTE_PREFIXES.some((p) => {
    if (p.endsWith('/')) return path.startsWith(p)
    return path === p || path.startsWith(p + '/')
  })
}

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

  // Refresh session + capture user. 2.5s ceiling avoids MIDDLEWARE_INVOCATION_TIMEOUT
  // in degraded Supabase scenarios. When the check times out we treat the
  // request as unauthenticated — safer than letting a stale/unverified
  // session through a protected route. The trade-off: on degraded auth,
  // a legitimate signed-in user on a protected page gets bounced to
  // /signup once, then the retry lands them normally when auth recovers.
  let user: { id: string } | null = null
  try {
    const result = await Promise.race([
      supabase.auth.getUser(),
      new Promise<null>((resolve) => setTimeout(() => resolve(null), 2500)),
    ])
    if (result && 'data' in result) {
      user = result.data.user
    }
  } catch {
    /* auth error — treat as unauthenticated */
  }

  // Route guard: redirect unauthenticated users away from protected pages.
  if (!user && isProtectedPath(path)) {
    const url = request.nextUrl.clone()
    url.pathname = '/signup'
    // Preserve any query string on the original path so returning users
    // land back with their filters intact.
    const nextPath = path + request.nextUrl.search
    url.search = `?next=${encodeURIComponent(nextPath)}`
    return NextResponse.redirect(url)
  }

  return supabaseResponse
}

export const config = {
  matcher: [
    '/((?!_next/static|_next/image|favicon.ico|.*\\.(?:svg|png|jpg|jpeg|gif|webp)$).*)',
  ],
}
