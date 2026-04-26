import { NextRequest, NextResponse } from 'next/server'
import { getServiceClient } from '@/lib/supabase'
import { PORT_META } from '@/lib/portMeta'

export const dynamic = 'force-dynamic'
export const revalidate = 60

// GET /api/smart-route?lat=X&lng=Y&direction=northbound|southbound
//
// Ranks border crossings by total estimated time = wait_time +
// haversine-distance / 60 mph. Returns top 5. Free for everyone —
// fueling /smart-route page + Telegram /ruta command.

function haversineKm(lat1: number, lng1: number, lat2: number, lng2: number) {
  const R = 6371
  const dLat = (lat2 - lat1) * Math.PI / 180
  const dLng = (lng2 - lng1) * Math.PI / 180
  const a = Math.sin(dLat/2)**2 + Math.cos(lat1*Math.PI/180) * Math.cos(lat2*Math.PI/180) * Math.sin(dLng/2)**2
  return R * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1-a))
}

export async function GET(req: NextRequest) {
  const url = new URL(req.url)
  const lat = parseFloat(url.searchParams.get('lat') || '')
  const lng = parseFloat(url.searchParams.get('lng') || '')
  const direction = (url.searchParams.get('direction') || 'northbound').toLowerCase()
  const limit = Math.min(10, parseInt(url.searchParams.get('limit') || '5', 10) || 5)

  if (!Number.isFinite(lat) || !Number.isFinite(lng)) {
    return NextResponse.json({ error: 'lat + lng required' }, { status: 400 })
  }
  if (lat < 14 || lat > 50 || lng < -125 || lng > -85) {
    return NextResponse.json({ error: 'lat/lng out of US-MX corridor range' }, { status: 400 })
  }

  const db = getServiceClient()
  const since = new Date(Date.now() - 30 * 60 * 1000).toISOString()
  const { data: latest } = await db
    .from('wait_time_readings')
    .select('port_id, vehicle_wait, sentri_wait, pedestrian_wait, commercial_wait, recorded_at')
    .gte('recorded_at', since)
    .order('recorded_at', { ascending: false })
    .limit(1000)

  // Most recent reading per port
  const byPort = new Map<string, { wait: number | null; recorded: string }>()
  for (const r of latest || []) {
    if (byPort.has(String(r.port_id))) continue
    const candidates = [r.vehicle_wait, r.pedestrian_wait, r.commercial_wait, r.sentri_wait]
      .map((v) => (typeof v === 'number' && v >= 0 ? v : null))
      .filter((v): v is number => v != null)
    const wait = candidates.length > 0 ? Math.min(...candidates) : null
    byPort.set(String(r.port_id), { wait, recorded: r.recorded_at })
  }

  const ranked = Object.entries(PORT_META)
    .map(([portId, meta]) => {
      const distKm = haversineKm(lat, lng, meta.lat, meta.lng)
      const driveMin = Math.round((distKm / 96.6) * 60) // 60 mph = 96.6 km/h
      const w = byPort.get(portId)
      const waitMin = w?.wait
      const totalMin = (waitMin ?? 30) + driveMin // unknown wait = pessimistic 30
      return {
        port_id: portId,
        name: meta.localName || meta.city,
        city: meta.city,
        region: meta.region,
        megaRegion: meta.megaRegion,
        distKm: Math.round(distKm),
        driveMin,
        waitMin: waitMin ?? null,
        totalMin,
        recorded: w?.recorded ?? null,
        confidence: waitMin != null ? 'live' : 'no-data',
      }
    })
    .filter((r) => r.distKm <= 400) // ignore bridges >400km away
    .sort((a, b) => a.totalMin - b.totalMin)
    .slice(0, limit)

  return NextResponse.json({
    direction,
    origin: { lat, lng },
    rankedAt: new Date().toISOString(),
    routes: ranked,
  })
}
