import { cache } from 'react'
import type { CbpPort, PortWaitTime } from '@/types'

const CBP_API_URL = 'https://bwt.cbp.gov/api/bwtnew'

// RGV port numbers from CBP API
const RGV_PORT_IDS = new Set([
  '240401', // Hidalgo
  '240501', // Pharr
  '240601', // Anzalduas
  '240801', // Progreso
  '240201', // Rio Grande City / Roma
  '230401', // Brownsville - Gateway
  '230501', // Brownsville - Veterans
  '230301', // Brownsville - B&M
  '230601', // Los Tomates (Brownsville)
  '230101', // Laredo - Gateway to Americas
  '230201', // Laredo - Juarez-Lincoln
  '230601', // Laredo - Colombia Solidarity
  '230701', // Laredo - World Trade Bridge
])

function parseLanes(value: string | undefined): number | null {
  if (!value || value === 'N/A') return null
  const n = parseInt(value, 10)
  return isNaN(n) ? null : n
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any
function getLaneTypes(lanes: any): any[] {
  if (!lanes) return []
  return [
    lanes.standard_lanes,
    lanes.ready_lanes,
    lanes.NEXUS_SENTRI_lanes ?? lanes.nexus_sentri_lanes,
    lanes.FAST_lanes ?? lanes.fast_lanes,
  ].filter(Boolean)
}

// Returns best (lowest) wait from any open lane type, plus whether bridge is closed or has no data
// eslint-disable-next-line @typescript-eslint/no-explicit-any
function getBestWait(lanes: any): { wait: number | null; isClosed: boolean; noData: boolean } {
  const laneTypes = getLaneTypes(lanes)
  if (laneTypes.length === 0) return { wait: null, isClosed: false, noData: true }

  const waits: number[] = []
  let hasRealData = false
  let hasOpenLanes = false

  for (const lane of laneTypes) {
    const opStatus: string = lane.operational_status ?? ''
    if (opStatus === 'N/A' || opStatus === '') continue

    hasRealData = true

    if (opStatus === 'Lanes Closed') continue

    const lanesOpen = parseInt(lane.lanes_open ?? '', 10)
    if (!isNaN(lanesOpen) && lanesOpen === 0) continue

    hasOpenLanes = true

    const delay = lane.delay_minutes
    if (opStatus === 'no delay' || opStatus === 'Update Pending' || delay === '0') {
      waits.push(0)
    } else if (delay && delay !== '') {
      const n = parseInt(delay, 10)
      if (!isNaN(n)) waits.push(n)
    }
  }

  if (!hasRealData) return { wait: null, isClosed: false, noData: true }
  if (!hasOpenLanes) return { wait: null, isClosed: true, noData: false }
  if (waits.length === 0) return { wait: null, isClosed: false, noData: true }
  return { wait: Math.min(...waits), isClosed: false, noData: false }
}

export const fetchRgvWaitTimes = cache(async function fetchRgvWaitTimes(): Promise<PortWaitTime[]> {
  const res = await fetch(CBP_API_URL, {
    next: { revalidate: 0 },
    headers: { Accept: 'application/json' },
  })

  if (!res.ok) throw new Error(`CBP API error: ${res.status}`)

  const data: CbpPort[] = await res.json()

  return data
    .filter((p) => p.border === 'Mexican Border')
    .map((p) => {
      const pvl = p.passenger_vehicle_lanes
      const pedl = p.pedestrian_lanes
      const cvl = p.commercial_vehicle_lanes

      const vehicleResult = getBestWait(pvl)
      const pedestrianResult = getBestWait(pedl)
      const commercialResult = getBestWait(cvl)

      // Bridge is closed if ALL lane types with real data are closed
      const isClosed = vehicleResult.isClosed && pedestrianResult.isClosed && commercialResult.isClosed
      const noData = vehicleResult.noData && pedestrianResult.noData && commercialResult.noData

      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const pvlAny = pvl as any
      const sentriLanes = pvlAny?.NEXUS_SENTRI_lanes ?? pvlAny?.nexus_sentri_lanes
      const sentriResult = getBestWait({ standard_lanes: sentriLanes })

      return {
        portId: p.port_number,
        portName: p.port_name,
        crossingName: p.crossing_name,
        city: p.port_name,
        vehicle: vehicleResult.wait,
        sentri: sentriResult.wait,
        pedestrian: pedestrianResult.wait,
        commercial: commercialResult.wait,
        vehicleLanesOpen: parseLanes(pvl?.standard_lanes?.lanes_open),
        sentriLanesOpen: parseLanes(sentriLanes?.lanes_open),
        pedestrianLanesOpen: parseLanes(pedl?.standard_lanes?.lanes_open),
        commercialLanesOpen: parseLanes(cvl?.standard_lanes?.lanes_open),
        isClosed,
        noData,
        vehicleClosed: vehicleResult.isClosed,
        pedestrianClosed: pedestrianResult.isClosed,
        commercialClosed: commercialResult.isClosed,
        recordedAt: p.date && p.time ? `${p.date} ${p.time}` : null,
      }
    })
})

export function getWaitLevel(minutes: number | null): 'low' | 'medium' | 'high' | 'closed' | 'unknown' {
  if (minutes === null) return 'unknown'
  if (minutes <= 20) return 'low'
  if (minutes <= 45) return 'medium'
  return 'high'
}

export function waitLevelColor(level: ReturnType<typeof getWaitLevel>): string {
  switch (level) {
    case 'low': return 'text-green-600 bg-green-50 border-green-200'
    case 'medium': return 'text-yellow-600 bg-yellow-50 border-yellow-200'
    case 'high': return 'text-red-600 bg-red-50 border-red-200'
    case 'closed': return 'text-gray-400 bg-gray-50 border-gray-200'
    default: return 'text-gray-400 bg-gray-50 border-gray-200'
  }
}

export function waitLevelDot(level: ReturnType<typeof getWaitLevel>): string {
  switch (level) {
    case 'low': return 'bg-green-500'
    case 'medium': return 'bg-yellow-500'
    case 'high': return 'bg-red-500'
    default: return 'bg-gray-300'
  }
}
