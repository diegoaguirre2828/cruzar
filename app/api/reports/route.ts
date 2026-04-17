import { NextRequest, NextResponse } from 'next/server'
import { createServerClient } from '@supabase/ssr'
import { cookies } from 'next/headers'
import { getServiceClient } from '@/lib/supabase'
import { POINTS, getBadgesForProfile } from '@/lib/points'
import webpush from 'web-push'
import { getPortMeta } from '@/lib/portMeta'

if (process.env.VAPID_PUBLIC_KEY && process.env.VAPID_PRIVATE_KEY) {
  webpush.setVapidDetails(
    'mailto:cruzabusiness@gmail.com',
    process.env.VAPID_PUBLIC_KEY,
    process.env.VAPID_PRIVATE_KEY
  )
}

// When a circle member submits a Just Crossed report, push-notify every
// other member of their circle(s). This is the Life360 "Mom just made
// it home" moment — private utility, no public feed.
async function notifyCircleMembers(
  crosserId: string,
  portId: string,
  waitMinutes: number,
  laneType: string | null,
) {
  if (!process.env.VAPID_PUBLIC_KEY || !process.env.VAPID_PRIVATE_KEY) return

  const db = getServiceClient()

  // Find circles the crosser is in
  const { data: myMemberships } = await db
    .from('circle_members')
    .select('circle_id')
    .eq('user_id', crosserId)
  const circleIds = (myMemberships || []).map((m) => m.circle_id)
  if (circleIds.length === 0) return

  // Find other members of those circles
  const { data: otherMembers } = await db
    .from('circle_members')
    .select('user_id')
    .in('circle_id', circleIds)
    .neq('user_id', crosserId)
  const otherUserIds = [...new Set((otherMembers || []).map((m) => m.user_id))]
  if (otherUserIds.length === 0) return

  // Fetch push subscriptions for those users
  const { data: subs } = await db
    .from('push_subscriptions')
    .select('user_id, endpoint, p256dh, auth')
    .in('user_id', otherUserIds)
  if (!subs || subs.length === 0) return

  // Resolve crosser name (for notification body)
  const { data: crosserProfile } = await db
    .from('profiles')
    .select('display_name')
    .eq('id', crosserId)
    .maybeSingle()
  // Privacy fix 2026-04-14: never fall back to email prefix. The
  // random_handles SQL trigger populates display_name at signup, so
  // this should always be set.
  const displayName = crosserProfile?.display_name || 'Alguien'

  const meta = getPortMeta(portId)
  const portLabel = meta?.localName
    ? `${meta.city} (${meta.localName})`
    : meta?.city || portId

  const laneLabel =
    laneType === 'sentri' ? ' en SENTRI' :
    laneType === 'pedestrian' ? ' a pie' :
    laneType === 'commercial' ? ' en camión' :
    ''

  const title = `${displayName} acaba de cruzar`
  const body = `${portLabel}${laneLabel} · ${waitMinutes} min`

  await Promise.allSettled(
    subs.map(async (sub) => {
      try {
        await webpush.sendNotification(
          { endpoint: sub.endpoint, keys: { p256dh: sub.p256dh, auth: sub.auth } },
          JSON.stringify({
            title,
            body,
            url: `/port/${encodeURIComponent(portId)}`,
            tag: `circle-${crosserId}-${portId}`,
          })
        )
      } catch (err: unknown) {
        // Expired subscription — clean up
        if (err && typeof err === 'object' && 'statusCode' in err && (err as { statusCode: number }).statusCode === 410) {
          await db.from('push_subscriptions').delete().eq('user_id', sub.user_id)
        }
      }
    })
  )
}

// Fire push notifications immediately when an urgent incident is
// reported at a port (accident, inspection, hazard). Only users who
// have an active alert preference for the port get notified, and we
// rate-limit per (user, port, type) via alert_preferences.last_triggered_at
// to avoid spam if multiple reports come in for the same incident.
async function notifyUrgentSubscribers(
  portId: string,
  reportType: string,
  description: string | null,
) {
  if (!process.env.VAPID_PUBLIC_KEY || !process.env.VAPID_PRIVATE_KEY) return

  const URGENT_TYPES = ['accident', 'inspection', 'road_hazard', 'reckless_driver', 'officer_secondary', 'officer_k9']
  if (!URGENT_TYPES.includes(reportType)) return

  const db = getServiceClient()
  const fifteenMinAgo = new Date(Date.now() - 15 * 60 * 1000).toISOString()

  // Find active alert preferences for this port that haven't been
  // urgently triggered in the last 15 minutes.
  const { data: alerts } = await db
    .from('alert_preferences')
    .select('id, user_id, last_urgent_at')
    .eq('port_id', portId)
    .eq('active', true)
    .or(`last_urgent_at.is.null,last_urgent_at.lt.${fifteenMinAgo}`)

  if (!alerts || alerts.length === 0) return

  const userIds = [...new Set(alerts.map(a => a.user_id))]
  const { data: subs } = await db
    .from('push_subscriptions')
    .select('user_id, endpoint, p256dh, auth')
    .in('user_id', userIds)

  if (!subs || subs.length === 0) return

  const meta = getPortMeta(portId)
  const portLabel = meta?.localName ? `${meta.city} (${meta.localName})` : meta?.city || portId

  const typeLabel: Record<string, { es: string; en: string; emoji: string }> = {
    accident: { es: 'Accidente', en: 'Accident', emoji: '🚨' },
    inspection: { es: 'Inspección', en: 'Inspection', emoji: '🛂' },
    road_hazard: { es: 'Peligro en el camino', en: 'Road hazard', emoji: '⚠️' },
    reckless_driver: { es: 'Conductor peligroso', en: 'Reckless driver', emoji: '⚠️' },
    officer_secondary: { es: 'Inspección secundaria', en: 'Secondary inspection', emoji: '🛂' },
    officer_k9: { es: 'Unidad K9', en: 'K9 unit', emoji: '🐕' },
  }
  const t = typeLabel[reportType] || { es: 'Alerta', en: 'Alert', emoji: '⚠️' }

  const title = `${t.emoji} ${t.es} en ${portLabel}`
  const body = description?.slice(0, 120) || `Reporte urgente — ${t.es.toLowerCase()}`

  await Promise.allSettled(
    subs.map(async (sub) => {
      try {
        await webpush.sendNotification(
          { endpoint: sub.endpoint, keys: { p256dh: sub.p256dh, auth: sub.auth } },
          JSON.stringify({
            title,
            body,
            url: `/port/${encodeURIComponent(portId)}`,
            tag: `urgent-${portId}-${reportType}`,
            requireInteraction: true,
          }),
          { urgency: 'high', TTL: 900 }
        )
      } catch (err: unknown) {
        if (err && typeof err === 'object' && 'statusCode' in err && (err as { statusCode: number }).statusCode === 410) {
          await db.from('push_subscriptions').delete().eq('user_id', sub.user_id)
        }
      }
    })
  )

  // Mark all triggered alerts so we don't re-fire within 15 min
  const now = new Date().toISOString()
  await db
    .from('alert_preferences')
    .update({ last_urgent_at: now })
    .in('id', alerts.map(a => a.id))
}

async function getUser() {
  const cookieStore = await cookies()
  const supabase = createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    { cookies: { getAll: () => cookieStore.getAll() } }
  )
  const { data: { user } } = await supabase.auth.getUser()
  return user
}

async function awardPoints(userId: string, pts: number, reportsCount: number) {
  const db = getServiceClient()
  const newCount = reportsCount + 1
  const { data: profile } = await db
    .from('profiles')
    .select('points')
    .eq('id', userId)
    .single()

  const newPoints = (profile?.points || 0) + pts
  const badges = getBadgesForProfile(newCount, 0)

  await db.from('profiles').update({
    points: newPoints,
    reports_count: newCount,
    badges,
  }).eq('id', userId)

  return { newPoints, badges }
}

export async function GET(req: NextRequest) {
  const portId = req.nextUrl.searchParams.get('portId')
  if (!portId) return NextResponse.json({ error: 'portId required' }, { status: 400 })

  const since = new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString()
  const db = getServiceClient()

  const { data, error } = await db
    .from('crossing_reports')
    .select('id, user_id, report_type, description, severity, upvotes, created_at, wait_minutes, username, source_meta')
    .eq('port_id', portId)
    .is('hidden_at', null)  // v35 moderation: skip reports an admin flagged
    .gte('created_at', since)
    .order('created_at', { ascending: false })
    .limit(30)

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })

  // Join reporter tier so the feed can flex a Pro badge next to paid users.
  // Free flex, not a gate — community features stay open.
  const userIds = [...new Set((data || []).map(r => r.user_id).filter((id): id is string => !!id))]
  let tierMap: Record<string, string> = {}
  if (userIds.length > 0) {
    const { data: profiles } = await db
      .from('profiles')
      .select('id, tier')
      .in('id', userIds)
    tierMap = Object.fromEntries((profiles || []).map(p => [p.id, p.tier]))
  }

  const reports = (data || []).map(({ user_id, ...rest }) => ({
    ...rest,
    reporter_tier: user_id ? (tierMap[user_id] || 'free') : null,
  }))

  // Edge cache — reports are fine to be ~30s stale on port detail
  // pages. This drops the per-port-page DB hit rate from "every
  // request" to "at most 2/min per port" regardless of traffic.
  // Was uncached before, which contributed to disk IO pressure
  // once the Pro-tier join added a second query per call.
  return NextResponse.json(
    { reports },
    {
      headers: {
        'Cache-Control': 'public, s-maxage=30, stale-while-revalidate=120',
      },
    },
  )
}

// Anti-spam: multiple layers to prevent point farming and data pollution.
//
// Layer 1: Per-user hourly cap (8 authenticated, 3 guest)
// Layer 2: Per-port cooldown (1 report per port per 10 min per user)
// Layer 3: Burst detection (max 3 reports in 5 minutes)
const reportRateLimit = new Map<string, { count: number; resetAt: number }>()
const portCooldown = new Map<string, number>() // key: "user:port" → timestamp
const burstTracker = new Map<string, number[]>() // key: userId → array of timestamps

function checkReportRateLimit(key: string, max: number): boolean {
  const now = Date.now()
  const entry = reportRateLimit.get(key)
  if (!entry || now > entry.resetAt) {
    reportRateLimit.set(key, { count: 1, resetAt: now + 60 * 60 * 1000 })
    return true
  }
  if (entry.count >= max) return false
  entry.count++
  return true
}

function checkPortCooldown(userKey: string, portId: string): boolean {
  const key = `${userKey}:${portId}`
  const last = portCooldown.get(key)
  if (last && Date.now() - last < 10 * 60 * 1000) return false // 10 min cooldown
  portCooldown.set(key, Date.now())
  return true
}

function checkBurst(userKey: string): boolean {
  const now = Date.now()
  const fiveMinAgo = now - 5 * 60 * 1000
  const stamps = (burstTracker.get(userKey) || []).filter(t => t > fiveMinAgo)
  if (stamps.length >= 3) return false // max 3 in 5 min
  stamps.push(now)
  burstTracker.set(userKey, stamps)
  return true
}

export async function POST(req: NextRequest) {
  const body = await req.json()
  const {
    portId,
    reportType,
    condition,
    description,
    severity,
    waitMinutes,
    note,
    waitingMode,
    ref,
    laneType,
    laneInfo,
    extraTags,
    lat,
    lng,
    // Sensor-network fields — all optional, persisted to dedicated
    // columns added by supabase/sensor_network_20260414.sql. These
    // power the longitudinal moat: X-ray lanes nobody else reports,
    // idle time separate from total wait, flow rate observations.
    idleTimeMinutes,
    flowRateEstimate,
    firstStopToBoothMinutes,
    incidentFlag,
    reportSource,
    // Data moat fields — 2026-04-14 (supabase/data_moat_fields_20260414.sql).
    // Every one of these maps to a segment that would pay for the data.
    // Progressive disclosure in ReportForm.tsx surfaces these only to
    // experienced reporters (3+ previous reports) so first-timers aren't
    // overwhelmed by a giant form.
    vehicleType,
    tripPurpose,
    trustedTravelerProgram,
    secondaryInspection,
    madeItOnTime,
    satisfactionScore,
    partySize,
    vehicleOrigin,
    cargoSummary,
    boothNumber,
  } = body

  // Support both reportType and condition field names
  const type = reportType || condition || 'other'
  if (!portId) return NextResponse.json({ error: 'portId required' }, { status: 400 })

  // Sanitize description — strip HTML tags and limit length
  const rawDesc = (description || note) as string | undefined
  const sanitizedDesc = rawDesc
    ? rawDesc.replace(/<[^>]*>/g, '').replace(/[<>]/g, '').trim().slice(0, 500)
    : null

  // Contradiction check: reject "clear/fast" with wait > 60 min
  if ((type === 'clear' || type === 'fast') && waitMinutes != null && waitMinutes > 60) {
    return NextResponse.json({ error: 'Invalid report: "moving fast" with 60+ min wait' }, { status: 400 })
  }

  // Reject reports with all tags selected (spam signal)
  if (Array.isArray(extraTags) && extraTags.length > 5) {
    return NextResponse.json({ error: 'Too many tags selected' }, { status: 400 })
  }

  const validTypes = [
    'delay', 'accident', 'inspection', 'clear', 'other',
    'fast', 'normal', 'slow',
    'weather_fog', 'weather_rain', 'weather_wind', 'weather_dust',
    'officer_k9', 'officer_secondary',
    'road_construction', 'road_hazard',
    'reckless_driver',
  ]
  const mappedType = type === 'fast' ? 'clear' : type === 'slow' ? 'delay' : type === 'normal' ? 'other' : type
  if (!validTypes.includes(type) && !validTypes.includes(mappedType)) return NextResponse.json({ error: 'Invalid report type' }, { status: 400 })

  // Normalize extra tags — the multi-facet report form sends these
  // when the user picks more than one facet (e.g. "moving fast" +
  // "heavy rain" + "K9 dogs"). Primary tag becomes report_type;
  // extras get stored in source_meta.extra_tags and render as chips
  // in the feeds. Filtered against the valid type list to block
  // garbage.
  const normalizedExtraTags: string[] = Array.isArray(extraTags)
    ? [...new Set(
        (extraTags as unknown[])
          .filter((t): t is string => typeof t === 'string' && validTypes.includes(t) && t !== mappedType)
      )]
    : []

  const user = await getUser()

  // Ban gate — v35 moderation. A banned user's token is still valid
  // (Supabase Auth doesn't revoke sessions on our app-level ban), so
  // the check happens here at the write path. We look up the profile
  // once, early-exit with 403 if banned_until is in the future. Rate
  // limits + spam checks still run AFTER this, so a banned user who
  // tries to hammer the endpoint gets rejected cheaply before hitting
  // the slower Supabase inserts downstream.
  if (user) {
    const dbEarly = getServiceClient()
    const { data: bannedCheck } = await dbEarly
      .from('profiles')
      .select('banned_until, ban_reason')
      .eq('id', user.id)
      .maybeSingle()
    if (bannedCheck?.banned_until) {
      const until = new Date(bannedCheck.banned_until)
      if (until.getTime() > Date.now()) {
        return NextResponse.json(
          {
            error: 'Your account is temporarily suspended from reporting.',
            reason: bannedCheck.ban_reason || 'other',
            until: bannedCheck.banned_until,
          },
          { status: 403 },
        )
      }
    }
  }

  // Anti-spam: 3 layers
  const ip = req.headers.get('x-forwarded-for')?.split(',')[0] || 'unknown'
  const rateLimitKey = user ? `user:${user.id}` : `ip:${ip}`
  const rateLimitMax = user ? 8 : 3

  // Layer 1: Hourly cap
  if (!checkReportRateLimit(rateLimitKey, rateLimitMax)) {
    return NextResponse.json({ error: 'Too many reports this hour. Try again later.' }, { status: 429 })
  }

  // Layer 2: Per-port cooldown (10 min between reports on same port)
  if (!checkPortCooldown(rateLimitKey, portId)) {
    return NextResponse.json({ error: 'You already reported this bridge recently. Wait 10 minutes.' }, { status: 429 })
  }

  // Layer 3: Burst detection (max 3 reports in 5 minutes)
  if (!checkBurst(rateLimitKey)) {
    return NextResponse.json({ error: 'Slow down — max 3 reports in 5 minutes.' }, { status: 429 })
  }

  const db = getServiceClient()

  // Check if this is the first report at this port today (bonus points)
  const todayStart = new Date()
  todayStart.setHours(0, 0, 0, 0)
  const { count: todayCount } = await db
    .from('crossing_reports')
    .select('id', { count: 'exact', head: true })
    .eq('port_id', portId)
    .gte('created_at', todayStart.toISOString())

  const isFirstToday = (todayCount || 0) === 0

  // Get username for display
  let username: string | null = null
  let reportsCount = 0
  if (user) {
    const { data: profile } = await db
      .from('profiles')
      .select('display_name, reports_count')
      .eq('id', user.id)
      .single()
    // Privacy fix 2026-04-14: never fall back to email prefix.
    username = profile?.display_name || null
    reportsCount = profile?.reports_count || 0
  }

  const validLaneTypes = ['vehicle', 'sentri', 'pedestrian', 'commercial']
  const normalizedLaneType = validLaneTypes.includes(laneType) ? laneType : null

  // Normalize the optional lane-detail payload. These fields are the
  // moat feature nobody else has — how many lanes are open, how many
  // have X-ray, which lane type is slowest. Only captured when the
  // reporter fills the optional block in ReportForm. Validated tight
  // to prevent garbage — discard anything out-of-range rather than
  // error out.
  const validSlowLanes = new Set(['con_rayos', 'sin_rayos', 'sentri', 'parejo'])
  const normalizedLaneInfo = (() => {
    if (!laneInfo || typeof laneInfo !== 'object') return null
    const lanesOpen = typeof laneInfo.lanes_open === 'number' && laneInfo.lanes_open >= 1 && laneInfo.lanes_open <= 12
      ? laneInfo.lanes_open : null
    const lanesXray = typeof laneInfo.lanes_xray === 'number' && laneInfo.lanes_xray >= 0 && laneInfo.lanes_xray <= 12
      ? laneInfo.lanes_xray : null
    const slowLane = typeof laneInfo.slow_lane === 'string' && validSlowLanes.has(laneInfo.slow_lane)
      ? laneInfo.slow_lane : null
    if (lanesOpen == null && lanesXray == null && slowLane == null) return null
    return { lanes_open: lanesOpen, lanes_xray: lanesXray, slow_lane: slowLane }
  })()

  // source_meta bundles lane_type (legacy) + lane_info (new) +
  // extra_tags (multi-facet). Stored as a single JSONB column so no
  // schema migration is needed. extra_tags holds every tag the user
  // picked beyond the primary — feeds render these as chips.
  const hasExtraTags = normalizedExtraTags.length > 0
  const sourceMeta =
    normalizedLaneType || normalizedLaneInfo || hasExtraTags
      ? {
          ...(normalizedLaneType ? { lane_type: normalizedLaneType } : {}),
          ...(normalizedLaneInfo ? { lane_info: normalizedLaneInfo } : {}),
          ...(hasExtraTags ? { extra_tags: normalizedExtraTags } : {}),
        }
      : null

  // Geo-gate: compute distance from the port and classify the reporter's
  // location confidence. We intentionally only STORE the distance + bucket,
  // not the raw coords, to preserve privacy. Reports from too far away are
  // still accepted but will be dropped from the community blend.
  let locationConfidence: 'near' | 'nearby' | 'far' | 'unknown' = 'unknown'
  let reporterDistanceKm: number | null = null
  if (typeof lat === 'number' && typeof lng === 'number' && Number.isFinite(lat) && Number.isFinite(lng)) {
    const { getPortMeta } = await import('@/lib/portMeta')
    const { haversineKm, classifyDistance } = await import('@/lib/geo')
    const meta = getPortMeta(portId)
    if (meta?.lat && meta?.lng) {
      const km = haversineKm(lat, lng, meta.lat, meta.lng)
      reporterDistanceKm = Math.round(km * 10) / 10
      locationConfidence = classifyDistance(km)
    }
  }

  // Derive lane_type + x_ray_active + incident_flag from the rich
  // source_meta the form already sends, so existing clients don't
  // need changes. The new dedicated columns are queryable/indexable
  // where source_meta JSONB was not. See
  // supabase/sensor_network_20260414.sql for the migration.
  const LANE_MAP: Record<string, string> = {
    vehicle: 'standard',
    sentri: 'sentri',
    pedestrian: 'pedestrian',
    commercial: 'commercial',
  }
  const derivedLaneType = normalizedLaneType ? (LANE_MAP[normalizedLaneType] ?? normalizedLaneType) : null

  // X-ray active derivation:
  //   - Explicit `laneInfo.lanes_xray > 0` → true
  //   - Explicit `slow_lane === 'con_rayos'` → true
  //   - Explicit `slow_lane === 'sin_rayos'` → false (they checked, X-ray is off)
  //   - Otherwise: null (unknown)
  const xRayActive = (() => {
    if (normalizedLaneInfo?.lanes_xray != null && normalizedLaneInfo.lanes_xray > 0) return true
    if (normalizedLaneInfo?.slow_lane === 'con_rayos') return true
    if (normalizedLaneInfo?.slow_lane === 'sin_rayos') return false
    return null
  })()

  // Incident flag derivation from report_type — also honors explicit
  // incidentFlag override from future clients that want to split the
  // concerns (e.g. a "delay" report with an explicit "k9" tag).
  const INCIDENT_MAP: Record<string, string> = {
    accident: 'accident',
    inspection: 'inspection',
    officer_k9: 'k9',
    officer_secondary: 'inspection',
    road_hazard: 'road_hazard',
    road_construction: 'road_construction',
    reckless_driver: 'reckless_driver',
    weather_fog: 'weather',
    weather_rain: 'weather',
    weather_wind: 'weather',
    weather_dust: 'weather',
  }
  const derivedIncidentFlag =
    (typeof incidentFlag === 'string' && incidentFlag.length > 0 ? incidentFlag : null) ??
    INCIDENT_MAP[mappedType] ?? null

  // source enum: community / geofence_auto / sensor / cruzar (legacy).
  // Default to 'community' for current clients. 'waitingMode' flag
  // marks a geofence auto-prompted report.
  const normalizedSource = (() => {
    if (typeof reportSource === 'string' && ['community', 'geofence_auto', 'sensor'].includes(reportSource)) return reportSource
    if (waitingMode) return 'geofence_auto'
    return 'community'
  })()

  // Raw GPS coords — only persisted when the reporter actually shared
  // them (existing classifyDistance logic gates acceptance). Stored
  // as-is so we can re-derive confidence thresholds later without
  // asking users to re-report.
  const rawGpsLat = typeof lat === 'number' && Number.isFinite(lat) ? lat : null
  const rawGpsLng = typeof lng === 'number' && Number.isFinite(lng) ? lng : null

  // Clamp the optional numeric fields so a user can't smuggle
  // garbage into the dataset. Ceiling at 300 minutes (5 hours) —
  // longer than that and either the user is lying or the bridge
  // is closed and should use a different report type.
  const clampInt = (v: unknown, min: number, max: number): number | null => {
    if (typeof v !== 'number' || !Number.isFinite(v)) return null
    const rounded = Math.round(v)
    if (rounded < min || rounded > max) return null
    return rounded
  }

  // Data moat enum validators
  const validString = (v: unknown, allowed: readonly string[]): string | null => {
    if (typeof v !== 'string') return null
    const lower = v.toLowerCase().trim()
    return allowed.includes(lower) ? lower : null
  }
  const VEHICLE_TYPES = ['passenger_car', 'pickup', 'suv', 'cargo_van', 'semi_truck', 'rv', 'trailer', 'motorcycle', 'pedestrian', 'bicycle'] as const
  const TRIP_PURPOSES = ['commute', 'leisure', 'commercial', 'medical', 'shopping', 'family', 'other'] as const
  const TRUSTED_TRAVELER = ['none', 'sentri', 'nexus', 'fast', 'global_entry', 'ready'] as const
  const VEHICLE_ORIGINS = ['us_plate', 'mx_plate', 'other'] as const
  const CARGO_SUMMARIES = ['empty', 'perishable', 'electronics', 'auto_parts', 'hazmat', 'household', 'mixed'] as const

  const normalizedVehicleType     = validString(vehicleType, VEHICLE_TYPES)
  const normalizedTripPurpose     = validString(tripPurpose, TRIP_PURPOSES)
  const normalizedTrustedTraveler = validString(trustedTravelerProgram, TRUSTED_TRAVELER)
  const normalizedVehicleOrigin   = validString(vehicleOrigin, VEHICLE_ORIGINS)
  const normalizedCargoSummary    = validString(cargoSummary, CARGO_SUMMARIES)

  // Weather snapshot — fire-and-resolve, non-blocking on failure.
  // 3s abort inside the helper so a flaky OpenWeatherMap can't delay
  // the report submission path. Null if no API key set or fetch fails.
  const { fetchWeatherSnapshot } = await import('@/lib/weather')
  const weatherSnapshot = rawGpsLat != null && rawGpsLng != null
    ? await fetchWeatherSnapshot(rawGpsLat, rawGpsLng)
    : null

  const { data: inserted, error } = await db.from('crossing_reports').insert({
    port_id: portId,
    report_type: mappedType,
    description: sanitizedDesc || null,
    severity: severity || 'medium',
    user_id: user?.id || null,
    wait_minutes: waitMinutes || null,
    username,
    // Legacy 'source' column still exists pre-migration; post-migration
    // the new sensor-network source enum uses different values. Write
    // both shapes so the insert works whether the migration has run
    // or not.
    source: 'cruzar',
    source_meta: sourceMeta,
    location_confidence: locationConfidence,
    reporter_distance_km: reporterDistanceKm,
    // Sensor-network columns (added by migration). Supabase silently
    // drops unknown columns in the Dashboard SQL editor view, but the
    // PostgREST client errors on insert if they don't exist. If Diego
    // hasn't run the SQL yet, the whole insert fails. Guard below
    // strips these fields when the migration hasn't happened — it
    // retries once on column-not-found errors.
    lane_type: derivedLaneType,
    x_ray_active: xRayActive,
    idle_time_minutes: clampInt(idleTimeMinutes, 0, 300),
    flow_rate_estimate: clampInt(flowRateEstimate, 0, 60),
    first_stop_to_booth_minutes: clampInt(firstStopToBoothMinutes, 0, 300),
    incident_flag: derivedIncidentFlag,
    gps_lat: rawGpsLat,
    gps_lng: rawGpsLng,
    // Data moat fields — data_moat_fields_20260414.sql. All optional.
    // Validated + normalized by the helpers below. Graceful-fallback
    // path strips these if the migration hasn't been applied.
    vehicle_type: normalizedVehicleType,
    trip_purpose: normalizedTripPurpose,
    trusted_traveler_program: normalizedTrustedTraveler,
    secondary_inspection: typeof secondaryInspection === 'boolean' ? secondaryInspection : null,
    made_it_on_time: typeof madeItOnTime === 'boolean' ? madeItOnTime : null,
    satisfaction_score: clampInt(satisfactionScore, 1, 5),
    party_size: clampInt(partySize, 1, 20),
    vehicle_origin: normalizedVehicleOrigin,
    cargo_summary: normalizedCargoSummary,
    booth_number: clampInt(boothNumber, 1, 50),
    weather_snapshot: weatherSnapshot,
  }).select('id').single().then(async (result) => {
    // Graceful fallback — if the migration hasn't been applied yet,
    // PostgREST returns a 400 with "column does not exist". Retry
    // with only the legacy columns so reporting keeps working.
    if (result.error && /column .* does not exist/i.test(result.error.message)) {
      console.warn('Sensor-network columns missing — retrying legacy insert. Run supabase/sensor_network_20260414.sql to capture the new fields.')
      return db.from('crossing_reports').insert({
        port_id: portId,
        report_type: mappedType,
        description: sanitizedDesc || null,
        severity: severity || 'medium',
        user_id: user?.id || null,
        wait_minutes: waitMinutes || null,
        username,
        source: 'cruzar',
        source_meta: sourceMeta,
        location_confidence: locationConfidence,
        reporter_distance_km: reporterDistanceKm,
      }).select('id').single()
    }
    return result
  })
  // normalizedSource kept for future clients that explicitly pass reportSource;
  // currently derived but not written until the legacy 'source' column is
  // renamed — avoids a clash between the legacy hardcoded value and the enum.
  void normalizedSource

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })

  // Increment share counter / report counter / notify circle members
  // Only fire circle notifications if this is an actual crossing report
  // (clear / delay / normal) with wait minutes. Skip for hazards/accidents
  // that aren't personal crossings.
  const isPersonalCrossing = user && waitMinutes != null && ['clear', 'delay', 'other'].includes(mappedType)
  if (isPersonalCrossing) {
    // Fire-and-forget — don't block the submit response on notifications
    notifyCircleMembers(user.id, portId, waitMinutes as number, normalizedLaneType).catch((err) => {
      console.error('circle notify failed:', err)
    })
  }

  // Urgent fan-out: accident/inspection/hazard reports get pushed
  // immediately to anyone with an active alert pref on this port.
  notifyUrgentSubscribers(portId, mappedType, (description || note) || null).catch((err) => {
    console.error('urgent notify failed:', err)
  })

  // Award points if logged in
  let pointsEarned = 0
  let newBadges: string[] = []
  if (user) {
    let pts = POINTS.report_submitted
    if (waitMinutes) pts += POINTS.report_with_wait_time - POINTS.report_submitted
    if (isFirstToday) pts += POINTS.first_report_of_day
    if (waitingMode) pts += POINTS.waiting_mode_bonus

    // Check if this is a founder (first 100 reporters ever)
    const { count: totalReporters } = await db
      .from('profiles')
      .select('id', { count: 'exact', head: true })
      .gt('reports_count', 0)
    const isFounder = (totalReporters || 0) <= 100

    const result = await awardPoints(user.id, pts, reportsCount)

    // Grant founder badge if eligible
    if (isFounder && !result.badges.includes('founder')) {
      result.badges = ['founder', ...result.badges]
      await db.from('profiles').update({ badges: result.badges }).eq('id', user.id)
    }
    pointsEarned = pts
    newBadges = result.badges
  }

  // Award referral points if a valid ref was provided and user is logged in
  if (user && ref && typeof ref === 'string' && ref.length > 10 && ref !== user.id) {
    try {
      const { data: existing } = await db
        .from('referral_events')
        .select('id')
        .eq('referrer_id', ref)
        .eq('referred_user_id', user.id)
        .eq('event_type', 'report')
        .maybeSingle()

      if (!existing) {
        const { data: referrerProfile } = await db
          .from('profiles')
          .select('points')
          .eq('id', ref)
          .maybeSingle()

        if (referrerProfile) {
          await db.from('profiles').update({
            points: (referrerProfile.points || 0) + POINTS.referral_report,
          }).eq('id', ref)

          await db.from('referral_events').insert({
            referrer_id: ref,
            referred_user_id: user.id,
            event_type: 'report',
            port_id: portId,
            points_awarded: POINTS.referral_report,
          })
        }
      }
    } catch { /* non-critical — don't fail the report */ }
  }

  return NextResponse.json({ success: true, id: inserted?.id, pointsEarned, newBadges })
}
