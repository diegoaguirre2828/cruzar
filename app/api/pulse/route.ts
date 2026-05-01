// Border Tension Index (BTI) — public 0-100 aggregate score for the
// US-MX border RIGHT NOW. Inspired by GeoTrade's "Geopolitical Tension
// Index" (web-code.tech / @shreeyagupta11), applied to border crossings.
//
// Regime 1 (this endpoint): inputs we have today.
//   1. Wait anomalies — bridges currently >1.5× their DOW×hour baseline
//   2. Closures — bridges flagged isClosed by CBP
//   3. NASA EONET nearby natural events — wildfires/storms/floods within
//      100km of any tracked port
//   4. Wait magnitude — avg vehicle wait across major commercial bridges
//
// Regime 2 (deferred — needs new infrastructure):
//   - DOS travel advisories
//   - DOF MX gov bulletins
//
// Public read. Cached at the edge for 60s. Powers /pulse.

import { NextResponse } from 'next/server'
import { getServiceClient } from '@/lib/supabase'
import { getPortMeta } from '@/lib/portMeta'
import { fetchNearbyEvents, type NearbyNaturalEvent } from '@/lib/eonet'

export const runtime = 'nodejs'
export const revalidate = 60

// Tracked ports for BTI scoring. Mirror of the calibration loop's set —
// commercial-relevant RGV/Laredo/Eagle Pass/Brownsville bridges.
const TRACKED_PORT_IDS = [
  '230401', '230402', '230403',
  '230301', '230302',
  '230501', '230502', '230503',
  '230701', '230901', '230902', '231001',
  '535501', '535502', '535503', '535504',
]

// Major commercial bridges for the wait-magnitude average.
const COMMERCIAL_BRIDGES = ['230402', '230501', '230502', '230502', '535502', '535504']

const ANOMALY_RATIO = 1.5
const RECENT_READING_MIN = 60 // pull readings from the last hour
const BASELINE_DAYS = 30

// EONET severity weights — per-event point values to reflect how big a
// wait disruption each category typically causes at a US-MX bridge.
const EONET_SEVERITY: Record<string, number> = {
  wildfires: 4,
  severeStorms: 4,
  floods: 5,
  dustHaze: 2,
  volcanoes: 3,
  manmade: 3,
  earthquakes: 4,
  tempExtremes: 2,
  drought: 1,
  landslides: 3,
  snow: 2,
}

// Component caps so no single signal can run away with the full BTI.
const CAP_ANOMALY = 32
const CAP_CLOSURE = 24
const CAP_EONET = 24
const CAP_WAIT = 20

type Level = 'calm' | 'normal' | 'tense' | 'high' | 'severe'
function bucketLevel(bti: number): Level {
  if (bti <= 15) return 'calm'
  if (bti <= 35) return 'normal'
  if (bti <= 55) return 'tense'
  if (bti <= 75) return 'high'
  return 'severe'
}

interface PortSnapshot {
  port_id: string
  port_name: string
  current_wait: number | null
  baseline_avg: number | null
  baseline_n: number
  is_anomaly_high: boolean
  is_closed: boolean
  recorded_at: string | null
}

export async function GET() {
  const sb = getServiceClient()
  const now = new Date()
  const nowIso = now.toISOString()

  // ───────── 1. Pull latest readings per port ─────────
  const sinceIso = new Date(now.getTime() - RECENT_READING_MIN * 60 * 1000).toISOString()
  const { data: recent } = await sb
    .from('wait_time_readings')
    .select('port_id, vehicle_wait, port_name, recorded_at')
    .in('port_id', TRACKED_PORT_IDS)
    .gte('recorded_at', sinceIso)
    .order('recorded_at', { ascending: false })

  // De-dupe to most recent per port
  const latestByPort = new Map<string, { vehicle_wait: number | null; port_name: string; recorded_at: string }>()
  for (const r of recent ?? []) {
    if (latestByPort.has(r.port_id)) continue
    latestByPort.set(r.port_id, {
      vehicle_wait: r.vehicle_wait,
      port_name: r.port_name,
      recorded_at: r.recorded_at,
    })
  }

  // ───────── 2. Baseline per port (DOW × hour, last 30 days) ─────────
  const dow = now.getUTCDay()
  const hour = now.getUTCHours()
  const baselineSinceIso = new Date(now.getTime() - BASELINE_DAYS * 24 * 60 * 60 * 1000).toISOString()
  const { data: baselineRows } = await sb
    .from('wait_time_readings')
    .select('port_id, vehicle_wait')
    .in('port_id', TRACKED_PORT_IDS)
    .eq('day_of_week', dow)
    .eq('hour_of_day', hour)
    .gte('recorded_at', baselineSinceIso)

  const baselineSums = new Map<string, { sum: number; count: number }>()
  for (const r of baselineRows ?? []) {
    if (r.vehicle_wait == null) continue
    const cur = baselineSums.get(r.port_id) ?? { sum: 0, count: 0 }
    cur.sum += r.vehicle_wait
    cur.count++
    baselineSums.set(r.port_id, cur)
  }

  // ───────── 3. Build per-port snapshot ─────────
  const snapshots: PortSnapshot[] = []
  for (const portId of TRACKED_PORT_IDS) {
    const latest = latestByPort.get(portId)
    const base = baselineSums.get(portId)
    const baselineAvg = base && base.count >= 3 ? base.sum / base.count : null
    const wait = latest?.vehicle_wait ?? null
    const meta = getPortMeta(portId)

    const isAnomalyHigh =
      wait != null && baselineAvg != null && baselineAvg > 0 && wait / baselineAvg >= ANOMALY_RATIO

    snapshots.push({
      port_id: portId,
      port_name: latest?.port_name ?? meta?.localName ?? portId,
      current_wait: wait,
      baseline_avg: baselineAvg != null ? Math.round(baselineAvg) : null,
      baseline_n: base?.count ?? 0,
      is_anomaly_high: isAnomalyHigh,
      // CBP-side closure detection — we don't have a live "isClosed" flag
      // in wait_time_readings; treat null wait as closed when the port has
      // baseline data (so it's an active port that should report) AND no
      // readings in the recent window.
      is_closed: latest == null && (base?.count ?? 0) > 0,
      recorded_at: latest?.recorded_at ?? null,
    })
  }

  // ───────── 4. EONET nearby events (per tracked port, deduped) ─────────
  // Sample 4 anchor points across the corridor instead of querying once
  // per port — keeps total fetches at 4 (already cached 1h server-side).
  const eonetAnchors = [
    { name: 'Laredo', lat: 27.5628, lng: -99.5019 },
    { name: 'McAllen-Pharr', lat: 26.1764, lng: -98.1836 },
    { name: 'Brownsville', lat: 25.8726, lng: -97.4866 },
    { name: 'Eagle Pass', lat: 28.7091, lng: -100.4977 },
  ]

  const eonetEventMap = new Map<string, NearbyNaturalEvent>()
  for (const a of eonetAnchors) {
    const events = await fetchNearbyEvents({ lat: a.lat, lng: a.lng }, 100, 7, 'open')
    for (const e of events) {
      if (!eonetEventMap.has(e.id)) eonetEventMap.set(e.id, e)
    }
  }
  const eonetEvents = [...eonetEventMap.values()]

  // ───────── 5. Score components ─────────
  const anomalyCount = snapshots.filter((s) => s.is_anomaly_high).length
  const closureCount = snapshots.filter((s) => s.is_closed).length
  const anomalyScore = Math.min(anomalyCount * 8, CAP_ANOMALY)
  const closureScore = Math.min(closureCount * 12, CAP_CLOSURE)

  let eonetScore = 0
  for (const e of eonetEvents) {
    eonetScore += EONET_SEVERITY[e.category] ?? 1
  }
  eonetScore = Math.min(eonetScore, CAP_EONET)

  const commercialWaits = snapshots
    .filter((s) => COMMERCIAL_BRIDGES.includes(s.port_id) && s.current_wait != null)
    .map((s) => s.current_wait as number)
  const avgCommercial =
    commercialWaits.length > 0
      ? commercialWaits.reduce((a, b) => a + b, 0) / commercialWaits.length
      : null
  let waitScore = 0
  if (avgCommercial != null) {
    if (avgCommercial > 90) waitScore = CAP_WAIT
    else if (avgCommercial > 45) waitScore = 10
    else if (avgCommercial > 20) waitScore = 5
  }

  const bti = Math.min(100, anomalyScore + closureScore + eonetScore + waitScore)
  const level = bucketLevel(bti)

  // ───────── 6. Unified event feed ─────────
  type FeedEvent =
    | { kind: 'anomaly'; port_id: string; port_name: string; current: number; baseline: number; ratio: number; recorded_at: string }
    | { kind: 'closure'; port_id: string; port_name: string; last_seen_at: string | null }
    | { kind: 'natural'; id: string; title: string; category: string; distance_km: number; source: string; source_url: string | null; last_observed_at: string }

  const feed: FeedEvent[] = []
  for (const s of snapshots) {
    if (s.is_anomaly_high && s.current_wait != null && s.baseline_avg != null) {
      feed.push({
        kind: 'anomaly',
        port_id: s.port_id,
        port_name: s.port_name,
        current: s.current_wait,
        baseline: s.baseline_avg,
        ratio: Math.round((s.current_wait / s.baseline_avg) * 10) / 10,
        recorded_at: s.recorded_at!,
      })
    }
    if (s.is_closed) {
      feed.push({ kind: 'closure', port_id: s.port_id, port_name: s.port_name, last_seen_at: s.recorded_at })
    }
  }
  for (const e of eonetEvents) {
    feed.push({
      kind: 'natural',
      id: e.id,
      title: e.title,
      category: e.category_title,
      distance_km: e.distance_km,
      source: e.source,
      source_url: e.source_url,
      last_observed_at: e.last_observed_at,
    })
  }

  return NextResponse.json(
    {
      bti,
      level,
      components: {
        anomaly: { score: anomalyScore, cap: CAP_ANOMALY, count: anomalyCount },
        closure: { score: closureScore, cap: CAP_CLOSURE, count: closureCount },
        natural_events: { score: eonetScore, cap: CAP_EONET, count: eonetEvents.length },
        wait_magnitude: { score: waitScore, cap: CAP_WAIT, avg_commercial_min: avgCommercial != null ? Math.round(avgCommercial) : null },
      },
      snapshots,
      events: feed,
      regime: 1,
      regime_2_pending: [
        'DOS travel advisories',
        'DOF MX gov bulletins',
        'CBP secondary inspection counts',
      ],
      calculated_at: nowIso,
    },
    {
      headers: {
        'Cache-Control': 'public, s-maxage=60, stale-while-revalidate=120',
      },
    },
  )
}
