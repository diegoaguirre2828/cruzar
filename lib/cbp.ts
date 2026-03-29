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

function parseWait(value: string | undefined): number | null {
  if (!value || value === '' || value === 'N/A') return null
  const n = parseInt(value, 10)
  return isNaN(n) ? null : n
}

export async function fetchRgvWaitTimes(): Promise<PortWaitTime[]> {
  const res = await fetch(CBP_API_URL, {
    next: { revalidate: 0 },
    headers: { Accept: 'application/json' },
  })

  if (!res.ok) throw new Error(`CBP API error: ${res.status}`)

  const data: CbpPort[] = await res.json()

  return data
    .filter((p) => p.border === 'US-Mexico')
    .map((p) => ({
      portId: p.port_number,
      portName: p.port_name,
      crossingName: p.crossing_name,
      city: p.port_name,
      vehicle: parseWait(p.passenger_vehicle_lanes?.standard_lanes?.delay_minutes),
      sentri: parseWait(p.passenger_vehicle_lanes?.nexus_sentri_lanes?.delay_minutes),
      pedestrian: parseWait(p.pedestrian_lanes?.standard_lanes?.delay_minutes),
      commercial: parseWait(p.commercial_vehicle_lanes?.standard_lanes?.delay_minutes),
      recordedAt: p.date_time,
    }))
}

export function getWaitLevel(minutes: number | null): 'low' | 'medium' | 'high' | 'closed' | 'unknown' {
  if (minutes === null) return 'unknown'
  if (minutes === 0) return 'closed'
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
