import { NextRequest, NextResponse } from 'next/server'
import { createServerClient } from '@supabase/ssr'
import { cookies } from 'next/headers'
import { getServiceClient } from '@/lib/supabase'

export const dynamic = 'force-dynamic'

const ADMIN_EMAIL = 'cruzabusiness@gmail.com'

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

  const now = new Date()
  const ago7  = new Date(now.getTime() - 7  * 24 * 60 * 60 * 1000).toISOString()
  const ago30 = new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000).toISOString()

  const [
    profilesAll,
    newUsers7,
    newUsers30,
    reportsAll,
    reports7,
    reports30,
    activeUsers7,
    activeUsers30,
    tierCounts,
    recentReports,
  ] = await Promise.all([
    db.from('profiles').select('id', { count: 'exact', head: true }),
    db.from('profiles').select('id', { count: 'exact', head: true }).gte('created_at', ago7),
    db.from('profiles').select('id', { count: 'exact', head: true }).gte('created_at', ago30),
    db.from('crossing_reports').select('id', { count: 'exact', head: true }),
    db.from('crossing_reports').select('id', { count: 'exact', head: true }).gte('created_at', ago7),
    db.from('crossing_reports').select('id', { count: 'exact', head: true }).gte('created_at', ago30),
    db.from('crossing_reports').select('user_id').gte('created_at', ago7).not('user_id', 'is', null),
    db.from('crossing_reports').select('user_id').gte('created_at', ago30).not('user_id', 'is', null),
    db.from('profiles').select('tier'),
    db.from('crossing_reports')
      .select('id, port_id, report_type, wait_minutes, created_at')
      .order('created_at', { ascending: false })
      .limit(20),
  ])

  const activeUsers7Count  = new Set((activeUsers7.data  || []).map(r => r.user_id)).size
  const activeUsers30Count = new Set((activeUsers30.data || []).map(r => r.user_id)).size

  const tiers: Record<string, number> = {}
  for (const p of (tierCounts.data || [])) {
    const t = p.tier || 'free'
    tiers[t] = (tiers[t] || 0) + 1
  }

  // Recent signups via auth admin API
  const { data: authUsers } = await db.auth.admin.listUsers({ page: 1, perPage: 20 })
  const recentUsers = (authUsers?.users || [])
    .sort((a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime())
    .slice(0, 15)
    .map(u => ({
      id: u.id,
      email: u.email ?? '',
      created_at: u.created_at,
    }))

  // Attach tier from profiles
  const profileTiers: Record<string, string> = {}
  const { data: allProfiles } = await db.from('profiles').select('id, tier')
  for (const p of (allProfiles || [])) profileTiers[p.id] = p.tier

  const recentUsersWithTier = recentUsers.map(u => ({
    ...u,
    tier: profileTiers[u.id] || 'free',
  }))

  return NextResponse.json({
    users: {
      total:    profilesAll.count ?? 0,
      new7:     newUsers7.count   ?? 0,
      new30:    newUsers30.count  ?? 0,
      active7:  activeUsers7Count,
      active30: activeUsers30Count,
      byTier:   tiers,
    },
    reports: {
      total:  reportsAll.count ?? 0,
      last7:  reports7.count  ?? 0,
      last30: reports30.count ?? 0,
      recent: recentReports.data || [],
    },
    recentUsers: recentUsersWithTier,
  })
}
