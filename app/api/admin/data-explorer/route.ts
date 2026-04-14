import { NextResponse } from 'next/server'
import { createServerClient } from '@supabase/ssr'
import { cookies } from 'next/headers'
import { getServiceClient } from '@/lib/supabase'

export const dynamic = 'force-dynamic'

// The admin Data Explorer — the single most important analytical endpoint
// in the app. Diego's 2026-04-14 directive: make the sensor-network moat
// VISIBLE. Every slice he might want to see about how users interact with
// the app and what the capture pipeline is actually collecting.
//
// Returns:
//   - user.byTier: total signups per tier
//   - user.byHomeRegion: signups per mega region
//   - portAffinity.savedByTier: top 10 most-saved ports, broken down by tier
//   - portAffinity.reportsByTier: top 10 most-reported ports (last 30d) by tier
//   - portAffinity.alertsByTier: top 10 ported alerts by tier
//   - capture.reportsTotals: all-time / 30d / 7d / today
//   - capture.reportsByLaneType: lane_type bucket counts
//   - capture.xRayObservations: x_ray_active counts
//   - capture.sensorFieldsFilled: per-field capture rate for new sensor columns
//   - capture.reportsByIncidentFlag: incident_flag bucket counts
//   - capture.reportsBySource: source enum bucket counts
//   - capture.reportsByLocationConfidence: location_confidence buckets
//   - capture.topPortsLast7Days: ports with most reports in the last 7 days
//   - cbp.readingsTotal + cbp.readings7d + cbp.nullRatePerPort
//   - activity.dailySignups30: signups per day over the last 30 days
//   - activity.dailyReports30: reports per day over the last 30 days
//   - activity.pwaInstalls: pwa_installed_at counts per day (last 30d)
//   - activity.topReporters: top 10 reporters by reports_count
//   - events.eventsByName7d: app_events counts by event_name over last 7 days
//   - events.recentEvents: last 100 app_events rows
//
// All queries run in parallel via Promise.all. Heavy for sure — this is a
// Diego-only endpoint so we accept the cost for the comprehensiveness.

const ADMIN_EMAIL = 'cruzabusiness@gmail.com'

export async function GET() {
  const cookieStore = await cookies()
  const supabase = createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    { cookies: { getAll: () => cookieStore.getAll() } },
  )
  const { data: { user } } = await supabase.auth.getUser()
  if (!user || user.email !== ADMIN_EMAIL) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  const db = getServiceClient()

  const now = new Date()
  const today  = new Date(now.toISOString().split('T')[0]).toISOString()
  const ago7   = new Date(now.getTime() - 7  * 24 * 60 * 60 * 1000).toISOString()
  const ago30  = new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000).toISOString()

  // ────────────────────────────────────────────────────────────
  // Query everything in parallel
  // ────────────────────────────────────────────────────────────
  const [
    profilesRes,
    savedRes,
    alertsRes,
    reportsAllCount,
    reports30Count,
    reports7Count,
    reportsTodayCount,
    reports30Full,
    reportsSensorSample,
    cbpTotalCount,
    cbp7Rows,
    signups30Rows,
    topReportersRes,
    pwaInstallsRows,
    eventsRes,
    recentEventsRes,
  ] = await Promise.all([
    db.from('profiles').select('id, tier, home_region, reports_count, display_name, pwa_installed_at, created_at'),
    db.from('saved_crossings').select('user_id, port_id'),
    db.from('alert_preferences').select('user_id, port_id, active').eq('active', true),
    db.from('crossing_reports').select('id', { count: 'exact', head: true }),
    db.from('crossing_reports').select('id', { count: 'exact', head: true }).gte('created_at', ago30),
    db.from('crossing_reports').select('id', { count: 'exact', head: true }).gte('created_at', ago7),
    db.from('crossing_reports').select('id', { count: 'exact', head: true }).gte('created_at', today),
    // Need full rows for the last 30d to count per port + join with user tiers
    db.from('crossing_reports')
      .select('port_id, user_id, report_type, created_at, location_confidence, source, lane_type, x_ray_active, incident_flag, idle_time_minutes, flow_rate_estimate, first_stop_to_booth_minutes')
      .gte('created_at', ago30)
      .limit(5000),
    // Separate small sample for all-time sensor-field capture rates
    db.from('crossing_reports')
      .select('lane_type, x_ray_active, incident_flag, idle_time_minutes, flow_rate_estimate, first_stop_to_booth_minutes, source, location_confidence')
      .order('created_at', { ascending: false })
      .limit(2000),
    db.from('wait_time_readings').select('id', { count: 'exact', head: true }),
    db.from('wait_time_readings')
      .select('port_id, vehicle_wait, recorded_at')
      .gte('recorded_at', ago7)
      .limit(5000),
    db.from('profiles').select('id, created_at').gte('created_at', ago30),
    db.from('profiles')
      .select('id, display_name, tier, points, reports_count')
      .order('reports_count', { ascending: false })
      .limit(10),
    db.from('profiles').select('pwa_installed_at').not('pwa_installed_at', 'is', null).gte('pwa_installed_at', ago30),
    db.from('app_events')
      .select('event_name')
      .gte('created_at', ago7)
      .limit(10000)
      .maybeSingle()
      .then(() => db.from('app_events').select('event_name').gte('created_at', ago7).limit(10000)),
    db.from('app_events')
      .select('event_name, created_at, user_id, port_id, context')
      .order('created_at', { ascending: false })
      .limit(100),
  ])

  // ────────────────────────────────────────────────────────────
  // Build per-user tier lookup map
  // ────────────────────────────────────────────────────────────
  const profiles = profilesRes.data || []
  const tierById = new Map<string, string>()
  for (const p of profiles) tierById.set(p.id, p.tier || 'free')

  // ────────────────────────────────────────────────────────────
  // Section 1: user distribution
  // ────────────────────────────────────────────────────────────
  const userByTier: Record<string, number> = {}
  const userByRegion: Record<string, number> = {}
  for (const p of profiles) {
    const tier = p.tier || 'free'
    userByTier[tier] = (userByTier[tier] || 0) + 1
    const region = p.home_region || 'unset'
    userByRegion[region] = (userByRegion[region] || 0) + 1
  }

  // ────────────────────────────────────────────────────────────
  // Section 2: port affinity by tier
  // ────────────────────────────────────────────────────────────
  type PortTierMap = Map<string, Record<string, number>>
  const savedByPortTier: PortTierMap = new Map()
  for (const s of (savedRes.data || [])) {
    const tier = tierById.get(s.user_id) || 'free'
    const portId = s.port_id
    if (!savedByPortTier.has(portId)) savedByPortTier.set(portId, {})
    const bucket = savedByPortTier.get(portId)!
    bucket[tier] = (bucket[tier] || 0) + 1
  }

  const alertsByPortTier: PortTierMap = new Map()
  for (const a of (alertsRes.data || [])) {
    const tier = tierById.get(a.user_id) || 'free'
    const portId = a.port_id
    if (!alertsByPortTier.has(portId)) alertsByPortTier.set(portId, {})
    const bucket = alertsByPortTier.get(portId)!
    bucket[tier] = (bucket[tier] || 0) + 1
  }

  const reportsByPortTier: PortTierMap = new Map()
  for (const r of (reports30Full.data || [])) {
    const tier = r.user_id ? (tierById.get(r.user_id) || 'free') : 'guest'
    const portId = r.port_id
    if (!reportsByPortTier.has(portId)) reportsByPortTier.set(portId, {})
    const bucket = reportsByPortTier.get(portId)!
    bucket[tier] = (bucket[tier] || 0) + 1
  }

  const flattenPortTier = (m: PortTierMap, limit = 15) => {
    const arr = Array.from(m.entries()).map(([portId, counts]) => ({
      portId,
      counts,
      total: Object.values(counts).reduce((s, n) => s + n, 0),
    }))
    arr.sort((a, b) => b.total - a.total)
    return arr.slice(0, limit)
  }

  // ────────────────────────────────────────────────────────────
  // Section 3: sensor-network capture stats
  // ────────────────────────────────────────────────────────────
  type Counter = Record<string, number>
  const reportsByLaneType: Counter = {}
  const xRayObservations: Counter = { true: 0, false: 0, null: 0 }
  const reportsByIncidentFlag: Counter = {}
  const reportsBySource: Counter = {}
  const reportsByLocationConfidence: Counter = {}
  let idleFilled = 0
  let flowFilled = 0
  let firstStopFilled = 0
  const sensorSample = reportsSensorSample.data || []
  for (const r of sensorSample) {
    const lt = r.lane_type || 'null'
    reportsByLaneType[lt] = (reportsByLaneType[lt] || 0) + 1

    if (r.x_ray_active === true) xRayObservations.true++
    else if (r.x_ray_active === false) xRayObservations.false++
    else xRayObservations.null++

    const inc = r.incident_flag || 'null'
    reportsByIncidentFlag[inc] = (reportsByIncidentFlag[inc] || 0) + 1

    const src = r.source || 'null'
    reportsBySource[src] = (reportsBySource[src] || 0) + 1

    const conf = r.location_confidence || 'null'
    reportsByLocationConfidence[conf] = (reportsByLocationConfidence[conf] || 0) + 1

    if (r.idle_time_minutes != null) idleFilled++
    if (r.flow_rate_estimate != null) flowFilled++
    if (r.first_stop_to_booth_minutes != null) firstStopFilled++
  }

  const sampleSize = sensorSample.length
  const fillRate = (count: number) => (sampleSize > 0 ? Math.round((count / sampleSize) * 100) : 0)
  const sensorFieldsFilled = {
    sampleSize,
    idleTimeMinutesPct: fillRate(idleFilled),
    flowRateEstimatePct: fillRate(flowFilled),
    firstStopToBoothMinutesPct: fillRate(firstStopFilled),
    laneTypePct: fillRate(sampleSize - (reportsByLaneType.null || 0)),
    xRayPct: fillRate(xRayObservations.true + xRayObservations.false),
    incidentFlagPct: fillRate(sampleSize - (reportsByIncidentFlag.null || 0)),
  }

  // Top ports last 7 days
  const reports7Buckets: Record<string, number> = {}
  for (const r of (reports30Full.data || [])) {
    const ts = new Date(r.created_at).getTime()
    if (ts < Date.now() - 7 * 24 * 60 * 60 * 1000) continue
    reports7Buckets[r.port_id] = (reports7Buckets[r.port_id] || 0) + 1
  }
  const topPortsLast7Days = Object.entries(reports7Buckets)
    .map(([portId, count]) => ({ portId, count }))
    .sort((a, b) => b.count - a.count)
    .slice(0, 15)

  // ────────────────────────────────────────────────────────────
  // Section 4: CBP capture stats
  // ────────────────────────────────────────────────────────────
  const cbp7 = cbp7Rows.data || []
  const cbpPortRows: Record<string, { total: number; nulls: number }> = {}
  for (const r of cbp7) {
    const bucket = cbpPortRows[r.port_id] || { total: 0, nulls: 0 }
    bucket.total++
    if (r.vehicle_wait == null) bucket.nulls++
    cbpPortRows[r.port_id] = bucket
  }
  const cbpNullRatePerPort = Object.entries(cbpPortRows)
    .map(([portId, { total, nulls }]) => ({
      portId,
      total,
      nulls,
      nullPct: total > 0 ? Math.round((nulls / total) * 100) : 0,
    }))
    .sort((a, b) => b.nullPct - a.nullPct)
    .slice(0, 20)

  // ────────────────────────────────────────────────────────────
  // Section 5: daily activity (last 30 days)
  // ────────────────────────────────────────────────────────────
  const dayKey = (iso: string) => iso.slice(0, 10)
  const dailySignups: Record<string, number> = {}
  for (const p of (signups30Rows.data || [])) {
    const key = dayKey(p.created_at)
    dailySignups[key] = (dailySignups[key] || 0) + 1
  }
  const dailyReports: Record<string, number> = {}
  for (const r of (reports30Full.data || [])) {
    const key = dayKey(r.created_at)
    dailyReports[key] = (dailyReports[key] || 0) + 1
  }
  const dailyInstalls: Record<string, number> = {}
  for (const p of (pwaInstallsRows.data || [])) {
    if (!p.pwa_installed_at) continue
    const key = dayKey(p.pwa_installed_at)
    dailyInstalls[key] = (dailyInstalls[key] || 0) + 1
  }

  // Build last-30-day ordered array
  const daySeries = (series: Record<string, number>) => {
    const out: Array<{ day: string; count: number }> = []
    for (let i = 29; i >= 0; i--) {
      const d = new Date(Date.now() - i * 24 * 60 * 60 * 1000)
      const key = d.toISOString().slice(0, 10)
      out.push({ day: key, count: series[key] || 0 })
    }
    return out
  }

  // ────────────────────────────────────────────────────────────
  // Section 6: events
  // ────────────────────────────────────────────────────────────
  const eventsByName: Counter = {}
  // eventsRes might be an error shape — guard
  const eventsRows = Array.isArray((eventsRes as unknown as { data?: unknown[] }).data)
    ? (eventsRes as unknown as { data: Array<{ event_name: string }> }).data
    : []
  for (const e of eventsRows) {
    eventsByName[e.event_name] = (eventsByName[e.event_name] || 0) + 1
  }
  const eventsByNameArr = Object.entries(eventsByName)
    .map(([name, count]) => ({ name, count }))
    .sort((a, b) => b.count - a.count)

  // ────────────────────────────────────────────────────────────
  // Response
  // ────────────────────────────────────────────────────────────
  return NextResponse.json({
    generatedAt: new Date().toISOString(),
    users: {
      total: profiles.length,
      byTier: userByTier,
      byHomeRegion: userByRegion,
    },
    portAffinity: {
      savedByTier: flattenPortTier(savedByPortTier),
      alertsByTier: flattenPortTier(alertsByPortTier),
      reportsByTier: flattenPortTier(reportsByPortTier),
    },
    capture: {
      reportsTotal: reportsAllCount.count ?? 0,
      reports30Days: reports30Count.count ?? 0,
      reports7Days: reports7Count.count ?? 0,
      reportsToday: reportsTodayCount.count ?? 0,
      reportsByLaneType,
      xRayObservations,
      reportsByIncidentFlag,
      reportsBySource,
      reportsByLocationConfidence,
      sensorFieldsFilled,
      topPortsLast7Days,
    },
    cbp: {
      readingsTotal: cbpTotalCount.count ?? 0,
      readings7Days: cbp7.length,
      nullRatePerPort: cbpNullRatePerPort,
    },
    activity: {
      dailySignups30: daySeries(dailySignups),
      dailyReports30: daySeries(dailyReports),
      dailyInstalls30: daySeries(dailyInstalls),
      topReporters: topReportersRes.data || [],
      pwaInstallsTotal: (pwaInstallsRows.data || []).length,
    },
    events: {
      byName7d: eventsByNameArr,
      recent: (recentEventsRes as unknown as { data?: unknown[] }).data || [],
    },
  })
}
