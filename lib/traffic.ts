// Traffic-derived wait time estimates via HERE Maps Routing API.
//
// How it works:
// We pick two coordinates per bridge — a "queue start" point ~1.5 km back on
// the road approach, and an "inspection booth" point at the actual border.
// Then we ask HERE for the live, traffic-aware driving time between them.
// Free-flow time for that ~1.5 km is roughly 90 seconds. Anything beyond that
// is queue time.
//
// Free tier: HERE Routing v8 gives 250k requests/month. With ~14 bridges and
// a 5 minute cache, that's well under the limit.

const HERE_KEY = process.env.HERE_API_KEY

// approach.lat/lng = queue start (Mexican side, ~1.5 km back)
// border.lat/lng   = US-side inspection booth
type CalibrationPoint = {
  approach: { lat: number; lng: number }
  border: { lat: number; lng: number }
}

const CALIBRATION: Record<string, CalibrationPoint> = {
  // Hidalgo / McAllen
  '230501': {
    approach: { lat: 26.0928, lng: -98.2728 }, // Reynosa side, on Av Sendero Nacional
    border:   { lat: 26.1080, lng: -98.2708 },
  },
  // Pharr · Reynosa
  '230502': {
    approach: { lat: 26.1620, lng: -98.1860 },
    border:   { lat: 26.1764, lng: -98.1836 },
  },
  // Anzaldúas
  '230503': {
    approach: { lat: 26.0290, lng: -98.3660 },
    border:   { lat: 26.0432, lng: -98.3647 },
  },
  // Progreso
  '230901': {
    approach: { lat: 26.0760, lng: -97.9760 },
    border:   { lat: 26.0905, lng: -97.9736 },
  },
  // Donna
  '230902': {
    approach: { lat: 26.1500, lng: -98.0510 },
    border:   { lat: 26.1649, lng: -98.0492 },
  },
  // Brownsville Gateway International
  '535501': {
    approach: { lat: 25.8870, lng: -97.4945 },
    border:   { lat: 25.9007, lng: -97.4935 },
  },
  // Brownsville Veterans International
  '535502': {
    approach: { lat: 25.8590, lng: -97.4880 },
    border:   { lat: 25.8726, lng: -97.4866 },
  },
  // Brownsville Los Tomates
  '535503': {
    approach: { lat: 26.0285, lng: -97.7385 },
    border:   { lat: 26.0416, lng: -97.7367 },
  },
  // Gateway to the Americas (Brownsville B&M)
  '535504': {
    approach: { lat: 25.8910, lng: -97.5050 },
    border:   { lat: 25.9044, lng: -97.5040 },
  },
}

// In-memory cache so we don't hammer HERE on every request
const cache = new Map<string, { value: number | null; expiresAt: number }>()
const CACHE_TTL_MS = 4 * 60 * 1000 // 4 minutes — fresh enough, well under quota

interface HereSummary {
  routes?: Array<{
    sections?: Array<{
      summary?: {
        duration?: number          // free-flow seconds
        baseDuration?: number      // ≈ free flow without traffic
        trafficDuration?: number   // with current traffic
      }
    }>
  }>
}

async function fetchOneBridge(portId: string, point: CalibrationPoint): Promise<number | null> {
  const cached = cache.get(portId)
  if (cached && cached.expiresAt > Date.now()) return cached.value

  if (!HERE_KEY) return null

  const origin = `${point.approach.lat},${point.approach.lng}`
  const dest = `${point.border.lat},${point.border.lng}`
  const url =
    `https://router.hereapi.com/v8/routes` +
    `?transportMode=car&origin=${origin}&destination=${dest}` +
    `&return=summary&departureTime=any&apiKey=${HERE_KEY}`

  try {
    const res = await fetch(url, { cache: 'no-store' })
    if (!res.ok) {
      cache.set(portId, { value: null, expiresAt: Date.now() + CACHE_TTL_MS })
      return null
    }
    const data: HereSummary = await res.json()
    const summary = data.routes?.[0]?.sections?.[0]?.summary
    if (!summary) {
      cache.set(portId, { value: null, expiresAt: Date.now() + CACHE_TTL_MS })
      return null
    }

    const traffic = summary.trafficDuration ?? summary.duration ?? null
    const baseline = summary.baseDuration ?? null
    if (traffic == null || baseline == null) {
      cache.set(portId, { value: null, expiresAt: Date.now() + CACHE_TTL_MS })
      return null
    }

    // Wait = (traffic time - free-flow time), in minutes, floored at 0
    const waitMin = Math.max(0, Math.round((traffic - baseline) / 60))
    cache.set(portId, { value: waitMin, expiresAt: Date.now() + CACHE_TTL_MS })
    return waitMin
  } catch {
    cache.set(portId, { value: null, expiresAt: Date.now() + CACHE_TTL_MS })
    return null
  }
}

export async function fetchTrafficWaits(portIds: string[]): Promise<Map<string, number>> {
  const result = new Map<string, number>()
  if (!HERE_KEY) return result

  const calibrated = portIds.filter((id) => CALIBRATION[id])
  const settled = await Promise.all(
    calibrated.map((id) => fetchOneBridge(id, CALIBRATION[id]).then((v) => [id, v] as const)),
  )
  for (const [id, v] of settled) {
    if (v != null) result.set(id, v)
  }
  return result
}

export function isTrafficConfigured(): boolean {
  return !!HERE_KEY
}
