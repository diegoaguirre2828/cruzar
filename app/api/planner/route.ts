import { NextRequest, NextResponse } from 'next/server'
import { getServiceClient } from '@/lib/supabase'
import { portIdsForRegion, type RegionKey } from '@/lib/regionMatchers'
import { getPortMeta } from '@/lib/portMeta'

// Trip planner endpoint. Given a region + day-of-week + target hour,
// returns the expected wait at each bridge in that region based on
// the last 30 days of historical data, plus a "best hour nearby"
// suggestion if shifting the user's departure by a few hours would
// save meaningful time.
//
// The raw material is wait_time_readings — we already store every
// CBP reading with day_of_week and hour_of_day fields in port-local
// time. Grouping by those two gives us typical Friday-noon waits
// per port, which is exactly what trip planning needs.

export const revalidate = 900 // 15 min

interface ReadingRow {
  port_id: string
  vehicle_wait: number | null
  hour_of_day: number
}

interface BridgeResult {
  portId: string
  portName: string
  avgWaitMin: number
  samples: number
}

export async function GET(req: NextRequest) {
  const sp = req.nextUrl.searchParams
  const region = (sp.get('region') || 'rgv') as RegionKey
  const day = Math.max(0, Math.min(6, Number(sp.get('day') ?? new Date().getDay())))
  const targetHour = Math.max(0, Math.min(23, Number(sp.get('hour') ?? 12)))

  const portIds = portIdsForRegion(region)
  if (portIds.length === 0) {
    return NextResponse.json({ error: 'Invalid region' }, { status: 400 })
  }

  const db = getServiceClient()
  const since = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000).toISOString()

  // Pull every reading at these ports on the target day within a
  // wide hour window (±4 hours). One query feeds both the "at your
  // hour" ranking and the "shift your departure" suggestion.
  const { data, error } = await db
    .from('wait_time_readings')
    .select('port_id, vehicle_wait, hour_of_day')
    .in('port_id', portIds)
    .eq('day_of_week', day)
    .gte('recorded_at', since)
    .not('vehicle_wait', 'is', null)

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  const readings = (data || []) as ReadingRow[]

  // Group by port + hour so we can compute per-hour averages
  const perPortHourly = new Map<string, Map<number, { sum: number; count: number }>>()
  for (const r of readings) {
    if (r.vehicle_wait == null) continue
    let portMap = perPortHourly.get(r.port_id)
    if (!portMap) {
      portMap = new Map()
      perPortHourly.set(r.port_id, portMap)
    }
    const bucket = portMap.get(r.hour_of_day) || { sum: 0, count: 0 }
    bucket.sum += r.vehicle_wait
    bucket.count += 1
    portMap.set(r.hour_of_day, bucket)
  }

  // Helper — average wait at a given port and hour
  function avgAt(portId: string, hour: number): { avg: number; samples: number } | null {
    const bucket = perPortHourly.get(portId)?.get(hour)
    if (!bucket || bucket.count === 0) return null
    return { avg: bucket.sum / bucket.count, samples: bucket.count }
  }

  // Build the bridge ranking at the target hour. Smooth slightly by
  // including the hour before and after so a port with sparse data
  // at exactly targetHour still gets a reading.
  const bridges: BridgeResult[] = []
  for (const portId of portIds) {
    const meta = getPortMeta(portId)
    let sum = 0
    let count = 0
    for (const h of [targetHour - 1, targetHour, targetHour + 1]) {
      if (h < 0 || h > 23) continue
      const bucket = perPortHourly.get(portId)?.get(h)
      if (!bucket) continue
      sum += bucket.sum
      count += bucket.count
    }
    if (count < 3) continue // skip ports with nearly no data
    bridges.push({
      portId,
      portName: meta.localName || meta.city || portId,
      avgWaitMin: Math.round(sum / count),
      samples: count,
    })
  }
  bridges.sort((a, b) => a.avgWaitMin - b.avgWaitMin)

  // "Best hour nearby" suggestion — look for a time within ±3 hours
  // of the target where the top bridge is meaningfully faster than
  // the target hour. If such a shift exists, include it.
  let shift: { hour: number; avgWaitMin: number; savingsMin: number } | null = null
  if (bridges.length > 0) {
    const topPort = bridges[0]
    const topNow = avgAt(topPort.portId, targetHour)
    if (topNow) {
      let best: { hour: number; avg: number } | null = null
      for (let h = Math.max(0, targetHour - 3); h <= Math.min(23, targetHour + 3); h++) {
        if (h === targetHour) continue
        const candidate = avgAt(topPort.portId, h)
        if (!candidate || candidate.samples < 2) continue
        if (!best || candidate.avg < best.avg) best = { hour: h, avg: candidate.avg }
      }
      if (best && topNow.avg - best.avg >= 15) {
        shift = {
          hour: best.hour,
          avgWaitMin: Math.round(best.avg),
          savingsMin: Math.round(topNow.avg - best.avg),
        }
      }
    }
  }

  return NextResponse.json(
    {
      region,
      day,
      hour: targetHour,
      bridges: bridges.slice(0, 6),
      shift,
      totalSamples: bridges.reduce((s, b) => s + b.samples, 0),
    },
    { headers: { 'Cache-Control': 's-maxage=900, stale-while-revalidate=3600' } },
  )
}
