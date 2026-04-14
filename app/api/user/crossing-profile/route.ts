import { NextResponse } from 'next/server'
import { createServerClient } from '@supabase/ssr'
import { cookies } from 'next/headers'
import { getServiceClient } from '@/lib/supabase'

export const dynamic = 'force-dynamic'

// Personalization rollup for the signed-in user.
//
// Aggregates their last 200 crossing reports into a compact profile:
//   - totalReports
//   - mostFrequentPortId + name/city (for "you usually cross X")
//   - mostFrequentDow (0=Sun .. 6=Sat)
//   - mostFrequentHourLabel (e.g. "06:00-07:00")
//   - avgWaitReported (their personal avg)
//   - publicAvgWait (aggregate average across all users for the same
//     port + dow + hour bucket — so we can show "your typical wait:
//     18 min · public average: 34 min")
//   - typicalTripPurpose
//   - topPorts (array of up to 3 most-reported ports)
//
// Returns null fields for rows where the user has no signal yet.
// Client should hide the insights card entirely if totalReports < 3.
//
// Results cached server-side for 5 min — a user's pattern changes
// slowly so 5-min freshness is plenty.

interface CrossingReportRow {
  port_id: string
  wait_minutes: number | null
  created_at: string
  trip_purpose: string | null
}

interface ProfileResponse {
  totalReports: number
  mostFrequentPortId: string | null
  mostFrequentPortCity: string | null
  mostFrequentDow: number | null
  mostFrequentHourLabel: string | null
  avgWaitReported: number | null
  publicAvgWait: number | null
  typicalTripPurpose: string | null
  topPorts: Array<{ portId: string; city: string | null; count: number }>
}

export async function GET() {
  const cookieStore = await cookies()
  const supabase = createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    { cookies: { getAll: () => cookieStore.getAll() } },
  )
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const db = getServiceClient()

  // Last 200 personal reports — enough to establish a pattern
  // without loading the user's entire history.
  const { data: reports, error } = await db
    .from('crossing_reports')
    .select('port_id, wait_minutes, created_at, trip_purpose')
    .eq('user_id', user.id)
    .order('created_at', { ascending: false })
    .limit(200)

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })

  const rows = (reports || []) as CrossingReportRow[]
  const totalReports = rows.length

  if (totalReports === 0) {
    const emptyProfile: ProfileResponse = {
      totalReports: 0,
      mostFrequentPortId: null,
      mostFrequentPortCity: null,
      mostFrequentDow: null,
      mostFrequentHourLabel: null,
      avgWaitReported: null,
      publicAvgWait: null,
      typicalTripPurpose: null,
      topPorts: [],
    }
    return NextResponse.json(emptyProfile, {
      headers: { 'Cache-Control': 'private, max-age=300' },
    })
  }

  // ── Port frequency ──
  const portCounts = new Map<string, number>()
  for (const r of rows) {
    portCounts.set(r.port_id, (portCounts.get(r.port_id) || 0) + 1)
  }
  const sortedPorts = Array.from(portCounts.entries())
    .sort((a, b) => b[1] - a[1])
  const mostFrequentPortId = sortedPorts[0]?.[0] || null
  const topPortIds = sortedPorts.slice(0, 3).map(([id]) => id)

  // ── Day-of-week + hour-of-day frequency ──
  const dowCounts = new Map<number, number>()
  const hourCounts = new Map<number, number>()
  for (const r of rows) {
    const d = new Date(r.created_at)
    const dow = d.getDay()
    const hour = d.getHours()
    dowCounts.set(dow, (dowCounts.get(dow) || 0) + 1)
    hourCounts.set(hour, (hourCounts.get(hour) || 0) + 1)
  }
  const mostFrequentDow = Array.from(dowCounts.entries())
    .sort((a, b) => b[1] - a[1])[0]?.[0] ?? null
  const mostFrequentHour = Array.from(hourCounts.entries())
    .sort((a, b) => b[1] - a[1])[0]?.[0] ?? null
  const mostFrequentHourLabel = mostFrequentHour != null
    ? `${String(mostFrequentHour).padStart(2, '0')}:00-${String((mostFrequentHour + 1) % 24).padStart(2, '0')}:00`
    : null

  // ── Personal avg wait ──
  const waitsReported = rows
    .map((r) => r.wait_minutes)
    .filter((w): w is number => typeof w === 'number' && w >= 0)
  const avgWaitReported = waitsReported.length > 0
    ? Math.round(waitsReported.reduce((s, n) => s + n, 0) / waitsReported.length)
    : null

  // ── Typical trip purpose ──
  const tripCounts = new Map<string, number>()
  for (const r of rows) {
    if (!r.trip_purpose) continue
    tripCounts.set(r.trip_purpose, (tripCounts.get(r.trip_purpose) || 0) + 1)
  }
  const typicalTripPurpose = Array.from(tripCounts.entries())
    .sort((a, b) => b[1] - a[1])[0]?.[0] ?? null

  // ── Public average for comparison ──
  // Same-port + same-dow + same-hour bucket across all users, last 90
  // days. Gives the "your typical wait vs public average" delta.
  let publicAvgWait: number | null = null
  if (mostFrequentPortId && mostFrequentDow != null && mostFrequentHour != null) {
    const ninetyDaysAgo = new Date(Date.now() - 90 * 24 * 60 * 60 * 1000).toISOString()
    const { data: publicRows } = await db
      .from('wait_time_readings')
      .select('vehicle_wait')
      .eq('port_id', mostFrequentPortId)
      .eq('day_of_week', mostFrequentDow)
      .eq('hour_of_day', mostFrequentHour)
      .gte('recorded_at', ninetyDaysAgo)
      .not('vehicle_wait', 'is', null)
      .limit(500)
    const publicWaits = (publicRows || [])
      .map((r) => r.vehicle_wait)
      .filter((w): w is number => typeof w === 'number' && w >= 0)
    if (publicWaits.length > 0) {
      publicAvgWait = Math.round(publicWaits.reduce((s, n) => s + n, 0) / publicWaits.length)
    }
  }

  // ── Resolve port city names ──
  const { getPortMeta } = await import('@/lib/portMeta')
  const mostFrequentPortCity = mostFrequentPortId
    ? (getPortMeta(mostFrequentPortId).city || null)
    : null
  const topPorts = topPortIds.map((portId) => ({
    portId,
    city: getPortMeta(portId).city || null,
    count: portCounts.get(portId) || 0,
  }))

  const profile: ProfileResponse = {
    totalReports,
    mostFrequentPortId,
    mostFrequentPortCity,
    mostFrequentDow,
    mostFrequentHourLabel,
    avgWaitReported,
    publicAvgWait,
    typicalTripPurpose,
    topPorts,
  }

  return NextResponse.json(profile, {
    headers: { 'Cache-Control': 'private, max-age=300' },
  })
}
