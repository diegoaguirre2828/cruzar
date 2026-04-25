import { NextResponse } from 'next/server'
import { createServerClient } from '@supabase/ssr'
import { cookies } from 'next/headers'
import { getServiceClient } from '@/lib/supabase'

export const dynamic = 'force-dynamic'

const ADMIN_EMAIL = 'cruzabusiness@gmail.com'

// /api/admin/auto-crossings-stats
//
// Visibility into the auto-crossing data flywheel for the admin
// dashboard. Surfaces (1) the cumulative count, (2) recent volume,
// (3) per-platform breakdown, (4) per-port breakdown, and (5) the
// inland checkpoint counts. Mirror of /api/admin/ops-glance shape.

async function requireAdmin() {
  const cookieStore = await cookies()
  const supabase = createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    { cookies: { getAll: () => cookieStore.getAll() } }
  )
  const { data: { user } } = await supabase.auth.getUser()
  if (!user || user.email !== ADMIN_EMAIL) return null
  return user
}

export async function GET() {
  const admin = await requireAdmin()
  if (!admin) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const db = getServiceClient()
  const now = Date.now()
  const iso24h = new Date(now - 24 * 60 * 60 * 1000).toISOString()
  const iso7d  = new Date(now - 7 * 24 * 60 * 60 * 1000).toISOString()

  const [
    totalAuto,
    auto24h,
    auto7d,
    inlandTotal,
    inland24h,
    inland7d,
    optedIn,
  ] = await Promise.all([
    db.from('wait_time_readings')
      .select('*', { count: 'exact', head: true })
      .eq('source', 'auto_geofence'),
    db.from('wait_time_readings')
      .select('*', { count: 'exact', head: true })
      .eq('source', 'auto_geofence')
      .gte('recorded_at', iso24h),
    db.from('wait_time_readings')
      .select('*', { count: 'exact', head: true })
      .eq('source', 'auto_geofence')
      .gte('recorded_at', iso7d),
    db.from('inland_checkpoint_readings')
      .select('*', { count: 'exact', head: true }),
    db.from('inland_checkpoint_readings')
      .select('*', { count: 'exact', head: true })
      .gte('recorded_at', iso24h),
    db.from('inland_checkpoint_readings')
      .select('*', { count: 'exact', head: true })
      .gte('recorded_at', iso7d),
    db.from('profiles')
      .select('*', { count: 'exact', head: true })
      .eq('auto_geofence_opt_in', true),
  ])

  // Per-port + per-platform breakdowns over the last 7d. Capped pulls
  // so a future high-volume table doesn't OOM the route — at SMB
  // scale (the foreseeable horizon) 5k rows is plenty.
  const { data: rows7d } = await db
    .from('wait_time_readings')
    .select('port_id, port_name, platform, lane_guess, reason_tag, dt:vehicle_wait, sentri_wait, commercial_wait, pedestrian_wait')
    .eq('source', 'auto_geofence')
    .gte('recorded_at', iso7d)
    .limit(5000)

  const byPort: Record<string, { name: string; count: number }> = {}
  const byPlatform: Record<string, number> = {}
  const byLane: Record<string, number> = {}
  const byReason: Record<string, number> = {}
  let withReason = 0
  for (const r of rows7d || []) {
    const pid = String(r.port_id)
    const pname = String(r.port_name)
    if (!byPort[pid]) byPort[pid] = { name: pname, count: 0 }
    byPort[pid].count++
    const plat = (r.platform as string | null) ?? 'unknown'
    byPlatform[plat] = (byPlatform[plat] || 0) + 1
    const lane = (r.lane_guess as string | null) ?? 'unknown'
    byLane[lane] = (byLane[lane] || 0) + 1
    const reason = r.reason_tag as string | null
    if (reason) {
      byReason[reason] = (byReason[reason] || 0) + 1
      withReason++
    }
  }

  const { data: inlandRows7d } = await db
    .from('inland_checkpoint_readings')
    .select('checkpoint_zone, direction, dt_minutes, platform')
    .gte('recorded_at', iso7d)
    .limit(5000)

  const byZone: Record<string, { count: number; avgMin: number; sumMin: number }> = {}
  for (const r of inlandRows7d || []) {
    const z = String(r.checkpoint_zone)
    if (!byZone[z]) byZone[z] = { count: 0, avgMin: 0, sumMin: 0 }
    byZone[z].count++
    byZone[z].sumMin += Number(r.dt_minutes) || 0
    byZone[z].avgMin = Math.round(byZone[z].sumMin / byZone[z].count)
  }
  for (const z of Object.keys(byZone)) {
    delete (byZone[z] as Record<string, unknown>).sumMin
  }

  return NextResponse.json({
    crossings: {
      total: totalAuto.count ?? 0,
      last24h: auto24h.count ?? 0,
      last7d: auto7d.count ?? 0,
    },
    inland: {
      total: inlandTotal.count ?? 0,
      last24h: inland24h.count ?? 0,
      last7d: inland7d.count ?? 0,
    },
    optedInProfiles: optedIn.count ?? 0,
    breakdown7d: {
      byPort,
      byPlatform,
      byLane,
      byReason,
      reasonCoverage: rows7d?.length ? Math.round((withReason / rows7d.length) * 100) : 0,
    },
    inland7d: {
      byZone,
    },
    generatedAt: new Date().toISOString(),
  })
}
