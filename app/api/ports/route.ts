import { NextResponse } from 'next/server'
import { fetchRgvWaitTimes } from '@/lib/cbp'
import { getServiceClient } from '@/lib/supabase'
import { fetchTrafficWaits } from '@/lib/traffic'
import { confidenceWeight } from '@/lib/geo'
import type { PortWaitTime } from '@/types'

// Removed `export const dynamic = 'force-dynamic'` so the Cache-Control
// headers we return actually get respected by Vercel's edge. The route
// still re-runs whenever the edge cache expires (every 15s) — we just
// don't re-run it on every single request. 80-95% DB load reduction
// under traffic spikes.

const REPORT_FRESH_MIN = 30
const CBP_STALE_MIN = 25
// "Very stale" = older than this, we stop showing the number entirely and
// just ask for a community report. Below this, we still show stale CBP with
// a loud staleness badge — bad data beats no data when the user can see it's old.
const CBP_VERY_STALE_MIN = 180
const DIVERGE_THRESHOLD_MIN = 15
// HERE traffic API doesn't reliably detect stationary border queues —
// cars parked at an inspection booth aren't seen as "congestion" on a road.
// So a sub-10min traffic estimate on its own is not trustworthy and we'd
// rather fall back to stale CBP than show a confident "<1 min".
const TRAFFIC_ONLY_TRUST_FLOOR_MIN = 10

interface RecentReport {
  port_id: string
  wait_minutes: number | null
  report_type: string
  created_at: string
  location_confidence?: string | null
}

function parseCbpRecorded(s: string | null): Date | null {
  if (!s) return null
  const d = new Date(s)
  if (!isNaN(d.getTime())) return d
  return null
}

function weightedAvg(items: { val: number; weight: number }[]): number {
  const totalW = items.reduce((s, i) => s + i.weight, 0)
  if (totalW === 0) return 0
  const sum = items.reduce((s, i) => s + i.val * i.weight, 0)
  return Math.round(sum / totalW)
}

export async function GET() {
  try {
    const ports = await fetchRgvWaitTimes()
    const cbpUpdatedAt = ports[0]?.recordedAt ?? null

    const db = getServiceClient()
    const sinceIso = new Date(Date.now() - REPORT_FRESH_MIN * 60 * 1000).toISOString()
    const portIds = ports.map((p) => p.portId)

    const [reportsRes, trafficWaits, overridesRes] = await Promise.all([
      db
        .from('crossing_reports')
        .select('port_id, wait_minutes, report_type, created_at, location_confidence')
        .in('port_id', portIds)
        .gte('created_at', sinceIso)
        .order('created_at', { ascending: false }),
      fetchTrafficWaits(portIds).catch(() => new Map<string, number>()),
      // Load local-name overrides so cards render whatever Diego set in the
      // admin Ports tab without needing a redeploy. Defaults to static
      // portMeta.localName if no override row exists.
      db.from('port_overrides').select('port_id, local_name'),
    ])
    // Historical averages were temporarily moved OUT of this hot path.
    // The wait_time_readings.hour_of_day column has no supporting index,
    // so `eq('hour_of_day', N)` was doing a full table scan on every
    // /api/ports request, saturating Supabase's connection pool and
    // triggering MIDDLEWARE_INVOCATION_TIMEOUT cascade failures on
    // 2026-04-14. A separate cached endpoint (`/api/ports/historical`)
    // will repopulate this once an index exists on (hour_of_day, port_id).
    const historicalByPort = new Map<string, number>()

    const overrideMap = new Map<string, string>()
    for (const o of overridesRes.data || []) {
      if (o.local_name) overrideMap.set(o.port_id, o.local_name)
    }

    const reportsByPort = new Map<string, RecentReport[]>()
    if (!reportsRes.error && reportsRes.data) {
      for (const r of reportsRes.data as RecentReport[]) {
        const arr = reportsByPort.get(r.port_id) ?? []
        arr.push(r)
        reportsByPort.set(r.port_id, arr)
      }
    }

    const now = Date.now()

    const blended: PortWaitTime[] = ports.map((p) => {
      const reports = reportsByPort.get(p.portId) ?? []
      // Drop reports flagged as 'far' (troll or wrong bridge). Weight the rest
      // by location confidence: near/nearby 3×, unknown 1×.
      const reportsWithWait = reports.filter(
        (r) => r.wait_minutes != null && r.wait_minutes >= 0 && r.location_confidence !== 'far',
      )
      const weightedItems = reportsWithWait.map((r) => ({
        val: r.wait_minutes as number,
        weight: confidenceWeight(r.location_confidence),
      }))
      const reportCount = reportsWithWait.length
      const communityVehicle =
        weightedItems.length > 0 ? weightedAvg(weightedItems) : null
      const lastReportMinAgo =
        reports.length > 0
          ? Math.round((now - new Date(reports[0].created_at).getTime()) / 60000)
          : null

      const trafficVehicle = trafficWaits.get(p.portId) ?? null

      const cbpDate = parseCbpRecorded(p.recordedAt)
      const cbpStaleMin = cbpDate ? Math.round((now - cbpDate.getTime()) / 60000) : null
      const cbpIsStale = cbpStaleMin != null && cbpStaleMin > CBP_STALE_MIN
      const cbpIsVeryStale = cbpStaleMin != null && cbpStaleMin > CBP_VERY_STALE_MIN

      const cbpVehicle = p.vehicle

      let chosen: number | null = cbpVehicle
      let source: PortWaitTime['source'] = 'cbp'

      // ────────────────────────────────────────────────────────
      // Pick the headline number.
      //
      // Trust order:
      //   1. Community reports (≥1 fresh report) — humans on the ground beat any sensor
      //   2. Otherwise: be CONSERVATIVE — pick the HIGHER of CBP / HERE
      //      so we never under-promise wait time and look wrong to people
      //      already at the bridge. Better to slightly over-state than to
      //      tell someone "0 min" when there's actually a 30 min line.
      //   3. If CBP is very stale AND the only other signal is a low
      //      traffic estimate, refuse to answer — show "unknown" and
      //      prompt a community report. HERE can't see stationary queues,
      //      so sub-10min traffic alone is worse than no data.
      // ────────────────────────────────────────────────────────
      if (communityVehicle != null && reportCount >= 1) {
        chosen = communityVehicle
        source = 'community'
      } else {
        const usableCbp = !cbpIsStale ? cbpVehicle : null
        const numerics: number[] = []
        if (usableCbp != null) numerics.push(usableCbp)
        if (trafficVehicle != null) numerics.push(trafficVehicle)

        if (numerics.length === 0) {
          // No fresh CBP, no HERE. Fall back to stale CBP if it's not
          // ancient — the card will show a loud "hace Xh" badge and a
          // "report now" CTA, so honesty is preserved.
          if (cbpVehicle != null && !cbpIsVeryStale) {
            chosen = cbpVehicle
            source = 'cbp'
          } else {
            chosen = null
            source = 'cbp'
          }
        } else if (numerics.length === 1) {
          const only = numerics[0]
          // Traffic-only estimate below the trust floor is noise (HERE can't
          // see stopped queues). Prefer stale CBP over a low HERE estimate.
          if (usableCbp == null && only < TRAFFIC_ONLY_TRUST_FLOOR_MIN) {
            if (cbpVehicle != null && !cbpIsVeryStale) {
              chosen = cbpVehicle
              source = 'cbp'
            } else {
              chosen = null
              source = 'traffic'
            }
          } else {
            chosen = only
            source = usableCbp != null ? 'cbp' : 'traffic'
          }
        } else {
          const max = Math.max(...numerics)
          chosen = max
          const diff = Math.abs(numerics[0] - numerics[1])
          if (diff < DIVERGE_THRESHOLD_MIN) {
            source = 'consensus'
          } else {
            source = max === usableCbp ? 'cbp' : 'traffic'
          }
        }
      }

      const accidentCount = reports.filter(
        (r) => r.report_type === 'accident' || r.report_type === 'inspection',
      ).length
      if (accidentCount >= 2 && chosen != null && chosen < 30) {
        chosen = Math.max(chosen, 30)
      }

      return {
        ...p,
        vehicle: chosen,
        source,
        cbpVehicle,
        communityVehicle,
        trafficVehicle,
        reportCount,
        lastReportMinAgo,
        cbpStaleMin,
        localNameOverride: overrideMap.get(p.portId) ?? null,
        historicalVehicle: historicalByPort.get(p.portId) ?? null,
      }
    })

    return NextResponse.json(
      {
        ports: blended,
        fetchedAt: new Date().toISOString(),
        cbpUpdatedAt,
      },
      {
        headers: {
          // Vercel edge cache: serve fresh for 30s, stale-while-revalidate
          // up to 2min. CBP data itself only updates every few minutes and
          // HERE traffic doesn't move second-to-second, so 30s is generous.
          // Bumped from 15s → 30s to halve the DB/CBP/HERE hit rate under
          // load after the Supabase disk-IO spike.
          'Cache-Control': 'public, s-maxage=30, stale-while-revalidate=120',
        },
      },
    )
  } catch (err) {
    console.error('Ports route error:', err)
    return NextResponse.json({ error: 'Failed to fetch wait times' }, { status: 502 })
  }
}
