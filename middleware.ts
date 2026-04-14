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

// Routes that HARD-redirect to /signup when the visitor isn't
// authenticated. Kept intentionally short — per Diego's 2026-04-14
// late directive, guests should LAND on most routes and see a
// rich "feature locked" preview (via LockedFeatureWall) rather
// than bouncing to signup. That preserves the back button, lets
// them browse the feature index, and turns the moment of highest
// intent (they just tapped something) into a signup opportunity.
//
// Pages that render LockedFeatureWall themselves — /port/[id],
// /chat, /leaderboard, /rewards, /planner, /features — are NOT
// in this list. They handle the guest case in-page.
//
// Truly-gated destinations only:
//   - /dashboard → personal alerts + saved, requires auth
//   - /promoter  → promoter dashboard, requires is_promoter flag
//   - /datos     → Insights PRO, Pro-gated (still needs auth first)
//   - /fleet     → Business tier, requires business auth
//   - /business  → Business tier
//   - /admin     → Diego only
const PROTECTED_ROUTE_PREFIXES = [
  '/dashboard',
  '/promoter',
  '/datos',
  '/fleet',
  '/business',
  '/admin',
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
