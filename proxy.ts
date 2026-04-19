import { createServerClient } from '@supabase/ssr'
import { NextResponse, type NextRequest } from 'next/server'

// NOTE 2026-04-18: the original PUBLIC_API_PREFIXES fast-path below (now
// removed) still incurred one edge invocation per hit because the proxy
// function ran before the early-return. We were on track to blow past
// Vercel's free-tier 1M edge-request cap this month. Public API routes
// are now excluded at the matcher level (see config.matcher) so the proxy
// never runs for them — zero edge invocations, same auth behavior since
// those routes never needed middleware session refresh anyway.

// Routes that HARD-redirect to /signup when the visitor isn't
// authenticated. Per Diego's 2026-04-14 late late directive, guests
// only get the main page (/) — everything else bounces to signup
// with ?next=<original path> so they return to the page they wanted
// after creating an account.
//
// Public surface kept intentionally tiny: home, auth pages, /mas
// (so the bottom nav still has a "more" tab guests can browse),
// /city/[slug] SEO landings, and the deferred-action routes (/fb /g).
const PROTECTED_ROUTE_PREFIXES = [
  '/dashboard',
  '/promoter',
  '/datos',
  '/fleet',
  '/business',
  '/admin',
  '/port',
  '/planner',
  '/chat',
  '/rewards',
  '/leaderboard',
  '/negocios',
  '/services',
  '/guide',
  '/insurance',
  '/for-fleets',
  '/features',
  '/favorites',
]

function isProtectedPath(path: string): boolean {
  return PROTECTED_ROUTE_PREFIXES.some((p) => {
    if (p.endsWith('/')) return path.startsWith(p)
    return path === p || path.startsWith(p + '/')
  })
}

export async function proxy(request: NextRequest) {
  const path = request.nextUrl.pathname

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
    // Exclude from edge-middleware invocation:
    //   - Next.js static/image pipelines
    //   - favicon + image assets (any extension)
    //   - .well-known (Digital Asset Links for TWA — must bypass auth)
    //   - SEO files (sitemap / robots / manifest)
    //   - Opengraph image generators (their output is cacheable, no auth)
    //   - Public API routes — each has its own auth/secret gate and never
    //     needed middleware session refresh. Before 2026-04-18 these hit
    //     the proxy and got a fast-path early-return, which still counted
    //     as an edge invocation against the free-tier 1M/mo cap.
    //
    // Everything else (pages + auth-touching /api/ routes like /api/alerts,
    // /api/saved, /api/profile, /api/reports, /api/stripe/checkout, etc.)
    // still runs through the proxy for session refresh + protected-route
    // guard.
    '/((?!_next/static|_next/image|favicon\\.ico|\\.well-known|sitemap\\.xml|robots\\.txt|manifest\\.(?:webmanifest|json)|opengraph-image|apple-icon|icon|api/ports|api/reports/recent|api/negocios|api/exchange|api/leaderboard|api/predict|api/predictions|api/widget|api/cron|api/stripe/webhook|api/ingest|api/admin/migrate|api/track/click|api/funnel|.*\\.(?:svg|png|jpg|jpeg|gif|webp|ico)$).*)',
  ],
}
