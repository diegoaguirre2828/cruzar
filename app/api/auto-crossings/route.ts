import { NextRequest, NextResponse } from 'next/server'
import { createServerClient } from '@supabase/ssr'
import { cookies } from 'next/headers'
import { getServiceClient } from '@/lib/supabase'
import { PORT_META } from '@/lib/portMeta'
import { POINTS } from '@/lib/points'
import { checkRateLimit, keyFromRequest } from '@/lib/ratelimit'

export const dynamic = 'force-dynamic'

// POST /api/auto-crossings
//
// Anonymized bridge-crossing observation produced by the in-app
// auto-detection (useCrossingDetector). The user's session cookie is
// used ONLY to:
//   1. honor the per-profile opt-in flag, and
//   2. award points to the contributing profile,
// and is then dropped — the wait_time_readings row never carries a
// user_id, so the dataset is anonymous at rest. See thinker session
// 2026-04-25 for the privacy posture rationale.

const ALLOWED_LANES = new Set(['general', 'sentri', 'commercial', 'pedestrian'])
const ALLOWED_SIDES = new Set(['US', 'MX'])

export async function POST(req: NextRequest) {
  const cookieStore = await cookies()
  const supabase = createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    { cookies: { getAll: () => cookieStore.getAll() } }
  )
  const { data: { user } } = await supabase.auth.getUser()

  // Per-IP / per-user limit so a buggy client (or hostile script) can't
  // pollute the dataset with phantom crossings. 30/hr burst 5 matches
  // the /api/ads pattern.
  const rl = await checkRateLimit(keyFromRequest(req, user?.id), 30, 5)
  if (!rl.ok) {
    return NextResponse.json(
      { error: 'Too many submissions. Slow down.' },
      { status: 429, headers: { 'Retry-After': String(rl.retryAfterSeconds) } },
    )
  }

  let body: {
    port_id?: string
    side_in?: string
    side_out?: string
    dt_minutes?: number
    lane_guess?: string
  }
  try {
    body = await req.json()
  } catch {
    return NextResponse.json({ error: 'Invalid JSON' }, { status: 400 })
  }

  const portId = (body.port_id || '').trim()
  const sideIn = (body.side_in || '').trim()
  const sideOut = (body.side_out || '').trim()
  const dt = typeof body.dt_minutes === 'number' && Number.isFinite(body.dt_minutes)
    ? Math.round(body.dt_minutes)
    : null
  const laneRaw = typeof body.lane_guess === 'string' ? body.lane_guess.trim().toLowerCase() : 'general'
  const lane = ALLOWED_LANES.has(laneRaw) ? laneRaw : 'general'

  if (!portId || !PORT_META[portId]) {
    return NextResponse.json({ error: 'Unknown port_id' }, { status: 400 })
  }
  if (!ALLOWED_SIDES.has(sideIn) || !ALLOWED_SIDES.has(sideOut) || sideIn === sideOut) {
    return NextResponse.json({ error: 'side_in / side_out must be different (US ↔ MX)' }, { status: 400 })
  }
  if (dt == null || dt < 1 || dt > 720) {
    return NextResponse.json({ error: 'dt_minutes must be between 1 and 720' }, { status: 400 })
  }

  const direction = sideIn === 'MX' && sideOut === 'US' ? 'northbound' : 'southbound'

  const db = getServiceClient()

  // For authed contributors: respect the opt-in flag + award points.
  // The opt-in check is also enforced client-side, but this is the
  // load-bearing copy.
  let pointsEarned = 0
  if (user) {
    const { data: profile } = await db
      .from('profiles')
      .select('points, auto_geofence_opt_in')
      .eq('id', user.id)
      .maybeSingle()
    if (!profile?.auto_geofence_opt_in) {
      return NextResponse.json(
        { error: 'Auto-crossing detection is off for this profile' },
        { status: 403 },
      )
    }
    pointsEarned = POINTS.auto_geofence_crossing
    await db
      .from('profiles')
      .update({ points: (profile.points || 0) + pointsEarned })
      .eq('id', user.id)
  }

  // Anonymized write: NO user_id, NO position, only the structured
  // observation. now() is the recorded_at default on wait_time_readings.
  const meta = PORT_META[portId]
  const now = new Date()
  const { error } = await db.from('wait_time_readings').insert({
    port_id: portId,
    crossing_name: meta.localName || meta.city,
    vehicle_wait: direction === 'northbound' ? dt : null,
    sentri_wait: lane === 'sentri' ? dt : null,
    pedestrian_wait: lane === 'pedestrian' ? dt : null,
    commercial_wait: lane === 'commercial' ? dt : null,
    recorded_at: now.toISOString(),
    day_of_week: now.getUTCDay(),
    hour_of_day: now.getUTCHours(),
    source: 'auto_geofence',
    lane_guess: lane,
  })

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 })
  }

  return NextResponse.json({ ok: true, direction, pointsEarned })
}
