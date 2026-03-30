export interface PortMeta {
  city: string
  region: string
  lat: number
  lng: number
}

export const PORT_META: Record<string, PortMeta> = {
  // McAllen / Hidalgo area
  '230501': { city: 'McAllen', region: 'McAllen / Hidalgo', lat: 26.0612, lng: -98.2932 },
  '230502': { city: 'Pharr',   region: 'McAllen / Hidalgo', lat: 26.1764, lng: -98.1836 },
  '230503': { city: 'McAllen', region: 'McAllen / Hidalgo', lat: 26.0694, lng: -98.3758 },

  // Progreso / Donna
  '230901': { city: 'Progreso', region: 'Progreso / Donna', lat: 26.0901, lng: -97.9600 },
  '230902': { city: 'Donna',    region: 'Progreso / Donna', lat: 26.1698, lng: -98.0527 },

  // Brownsville
  '535501': { city: 'Brownsville', region: 'Brownsville', lat: 25.9306, lng: -97.4867 },
  '535502': { city: 'Brownsville', region: 'Brownsville', lat: 25.9275, lng: -97.4932 },
  '535503': { city: 'Brownsville', region: 'Brownsville', lat: 26.0562, lng: -97.6693 },
  '535504': { city: 'Brownsville', region: 'Brownsville', lat: 25.9350, lng: -97.5050 },

  // Laredo
  '230401': { city: 'Laredo', region: 'Laredo', lat: 27.5036, lng: -99.5075 },
  '230402': { city: 'Laredo', region: 'Laredo', lat: 27.5139, lng: -99.5019 },
  '230403': { city: 'Laredo', region: 'Laredo', lat: 27.6506, lng: -99.5539 },
  '230404': { city: 'Laredo', region: 'Laredo', lat: 27.5533, lng: -99.4786 },

  // Roma
  '231001': { city: 'Roma', region: 'Roma', lat: 26.4079, lng: -99.0158 },
}

export const ALL_REGIONS = [
  'All',
  'McAllen / Hidalgo',
  'Progreso / Donna',
  'Brownsville',
  'Laredo',
  'Roma',
]

export function getPortMeta(portId: string): PortMeta {
  return PORT_META[portId] ?? {
    city: 'Other',
    region: 'Other',
    lat: 26.2034,
    lng: -98.2300,
  }
}
