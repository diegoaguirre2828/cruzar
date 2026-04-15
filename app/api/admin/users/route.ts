import { NextRequest, NextResponse } from 'next/server'
import { createServerClient } from '@supabase/ssr'
import { cookies } from 'next/headers'
import { getServiceClient } from '@/lib/supabase'

export const dynamic = 'force-dynamic'

const ADMIN_EMAIL = 'cruzabusiness@gmail.com'

type SortKey = 'created_desc' | 'created_asc' | 'reports_desc' | 'points_desc' | 'last_active_desc' | 'last_signin_desc' | 'last_seen_desc'

export async function GET(req: NextRequest) {
  const cookieStore = await cookies()
  const supabase = createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    { cookies: { getAll: () => cookieStore.getAll() } }
  )
  const { data: { user } } = await supabase.auth.getUser()
  if (!user || user.email !== ADMIN_EMAIL) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  const db = getServiceClient()
  const url = new URL(req.url)
  const search = (url.searchParams.get('search') || '').toLowerCase().trim()
  const tierFilter = url.searchParams.get('tier') || 'all'
  const osFilter = url.searchParams.get('os') || 'all'
  const deviceFilter = url.searchParams.get('device') || 'all'
  const installFilter = url.searchParams.get('install_state') || 'all'
  const regionFilter = url.searchParams.get('home_region') || 'all'
  const activityFilter = url.searchParams.get('activity') || 'all'
  const sort = (url.searchParams.get('sort') || 'created_desc') as SortKey
  const page = Math.max(1, parseInt(url.searchParams.get('page') || '1', 10))
  const pageSize = Math.min(100, Math.max(10, parseInt(url.searchParams.get('pageSize') || '25', 10)))

  // Pull up to 1000 auth users (covers Diego's 1k-in-3-months goal; paginate if we blow past)
  const { data: authData } = await db.auth.admin.listUsers({ page: 1, perPage: 1000 })
  const authUsers = authData?.users || []
  const authById = new Map(authUsers.map(u => [u.id, u]))

  // Profiles. last_seen_* + install_state are added by v27 migration.
  // Query tolerates the columns being absent (Supabase ignores unknown
  // columns by returning undefined) but still requests them.
  const { data: profiles } = await db
    .from('profiles')
    .select('id, display_name, tier, points, reports_count, badges, created_at, home_region, last_seen_at, last_seen_device, last_seen_os, last_seen_browser, install_state, first_seen_at')

  // Report aggregates (count + most recent timestamp per user)
  const { data: reportRows } = await db
    .from('crossing_reports')
    .select('user_id, created_at')
    .not('user_id', 'is', null)

  const reportStats = new Map<string, { count: number; lastAt: string | null }>()
  for (const r of reportRows || []) {
    if (!r.user_id) continue
    const s = reportStats.get(r.user_id) || { count: 0, lastAt: null }
    s.count++
    if (!s.lastAt || (r.created_at && r.created_at > s.lastAt)) s.lastAt = r.created_at
    reportStats.set(r.user_id, s)
  }

  // Active subscriptions
  const { data: subRows } = await db
    .from('subscriptions')
    .select('user_id, tier, status, current_period_end')

  const subById = new Map((subRows || []).map(s => [s.user_id, s]))

  // Join
  type ProfileRow = typeof profiles extends (infer U)[] | null ? U : never
  const now = Date.now()
  let rows = (profiles || []).map((p: ProfileRow) => {
    const auth = authById.get(p.id as string)
    const stats = reportStats.get(p.id as string)
    const lastSeenAt = (p as { last_seen_at?: string | null }).last_seen_at ?? null
    const lastSeenMs = lastSeenAt ? new Date(lastSeenAt).getTime() : null
    const lastSeenAgeDays = lastSeenMs != null ? Math.floor((now - lastSeenMs) / (1000 * 60 * 60 * 24)) : null
    return {
      id: p.id as string,
      email: auth?.email || (p as { display_name?: string | null }).display_name || '',
      display_name: (p as { display_name?: string | null }).display_name || null,
      tier: (p as { tier?: string | null }).tier || 'free',
      points: (p as { points?: number | null }).points || 0,
      reports_count: stats?.count || (p as { reports_count?: number | null }).reports_count || 0,
      last_report_at: stats?.lastAt || null,
      last_sign_in_at: auth?.last_sign_in_at || null,
      created_at: (p as { created_at?: string | null }).created_at || auth?.created_at || null,
      badges: (p as { badges?: string[] | null }).badges || [],
      sub_status: subById.get(p.id as string)?.status || null,
      sub_tier: subById.get(p.id as string)?.tier || null,
      home_region: (p as { home_region?: string | null }).home_region || null,
      last_seen_at: lastSeenAt,
      last_seen_age_days: lastSeenAgeDays,
      last_seen_device: (p as { last_seen_device?: string | null }).last_seen_device || null,
      last_seen_os: (p as { last_seen_os?: string | null }).last_seen_os || null,
      last_seen_browser: (p as { last_seen_browser?: string | null }).last_seen_browser || null,
      install_state: (p as { install_state?: string | null }).install_state || null,
      first_seen_at: (p as { first_seen_at?: string | null }).first_seen_at || null,
    }
  })

  // Filter
  if (tierFilter !== 'all') rows = rows.filter(r => r.tier === tierFilter)
  if (osFilter !== 'all') rows = rows.filter(r => r.last_seen_os === osFilter)
  if (deviceFilter !== 'all') rows = rows.filter(r => r.last_seen_device === deviceFilter)
  if (installFilter !== 'all') {
    if (installFilter === 'installed') {
      rows = rows.filter(r => r.install_state && r.install_state !== 'web')
    } else {
      rows = rows.filter(r => r.install_state === installFilter)
    }
  }
  if (regionFilter !== 'all') {
    if (regionFilter === 'unset') rows = rows.filter(r => !r.home_region)
    else rows = rows.filter(r => r.home_region === regionFilter)
  }
  if (activityFilter !== 'all') {
    const days = activityFilter === '24h' ? 1 : activityFilter === '7d' ? 7 : activityFilter === '30d' ? 30 : 0
    if (activityFilter === 'inactive') {
      rows = rows.filter(r => r.last_seen_age_days == null || r.last_seen_age_days > 30)
    } else if (days > 0) {
      rows = rows.filter(r => r.last_seen_age_days != null && r.last_seen_age_days <= days)
    }
  }
  if (search) {
    rows = rows.filter(r =>
      r.email.toLowerCase().includes(search) ||
      (r.display_name || '').toLowerCase().includes(search)
    )
  }

  // Sort
  const cmpStr = (a: string | null, b: string | null) => (b || '').localeCompare(a || '')
  const sorters: Record<SortKey, (a: typeof rows[number], b: typeof rows[number]) => number> = {
    created_desc:     (a, b) => cmpStr(a.created_at, b.created_at),
    created_asc:      (a, b) => cmpStr(b.created_at, a.created_at),
    reports_desc:     (a, b) => b.reports_count - a.reports_count,
    points_desc:      (a, b) => b.points - a.points,
    last_active_desc: (a, b) => cmpStr(a.last_report_at, b.last_report_at),
    last_signin_desc: (a, b) => cmpStr(a.last_sign_in_at, b.last_sign_in_at),
    last_seen_desc:   (a, b) => cmpStr(a.last_seen_at, b.last_seen_at),
  }
  rows.sort(sorters[sort] || sorters.created_desc)

  const total = rows.length
  const paged = rows.slice((page - 1) * pageSize, page * pageSize)

  return NextResponse.json({ users: paged, total, page, pageSize })
}
