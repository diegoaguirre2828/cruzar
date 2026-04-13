// Shared region → port matcher. Used by the trip planner endpoint
// (and eventually other server-side region-aware queries) to map a
// region key like 'rgv' or 'tijuana' to the set of port IDs that
// belong in it. Lifted out of HeroGenerator so server routes can
// reuse the exact same grouping logic without importing a client
// component.

import { PORT_META } from './portMeta'

export type RegionKey =
  | 'rgv'
  | 'progreso'
  | 'roma'
  | 'brownsville'
  | 'laredo'
  | 'eagle_pass'
  | 'del_rio'
  | 'el_paso'
  | 'nogales'
  | 'douglas'
  | 'san_luis'
  | 'tijuana'
  | 'mexicali'
  | 'all'

interface RegionSpec {
  key: RegionKey
  labelEs: string
  labelEn: string
  emoji: string
  matcher: (city: string) => boolean
}

export const REGIONS: RegionSpec[] = [
  { key: 'rgv',         labelEs: 'McAllen / Reynosa',       labelEn: 'McAllen / Reynosa',       emoji: '🌵',
    matcher: (c) => ['McAllen', 'Hidalgo', 'Pharr'].some((s) => c.includes(s)) },
  { key: 'progreso',    labelEs: 'Progreso / N. Progreso',  labelEn: 'Progreso / N. Progreso',  emoji: '🌾',
    matcher: (c) => c.includes('Progreso') || c.includes('Donna') },
  { key: 'roma',        labelEs: 'Roma / Cd. Alemán',       labelEn: 'Roma / Cd. Alemán',       emoji: '🌿',
    matcher: (c) => c.includes('Roma') || c.includes('Rio Grande City') },
  { key: 'brownsville', labelEs: 'Matamoros / Brownsville', labelEn: 'Matamoros / Brownsville', emoji: '🏙️',
    matcher: (c) => c.includes('Brownsville') },
  { key: 'laredo',      labelEs: 'Laredo / N. Laredo',      labelEn: 'Laredo / N. Laredo',      emoji: '🛣️',
    matcher: (c) => c.includes('Laredo') },
  { key: 'eagle_pass',  labelEs: 'Eagle Pass / P. Negras',  labelEn: 'Eagle Pass / P. Negras',  emoji: '🦅',
    matcher: (c) => c.includes('Eagle Pass') },
  { key: 'del_rio',     labelEs: 'Del Rio / Cd. Acuña',     labelEn: 'Del Rio / Cd. Acuña',     emoji: '🏞️',
    matcher: (c) => c.includes('Del Rio') },
  { key: 'el_paso',     labelEs: 'El Paso / Juárez',        labelEn: 'El Paso / Juárez',        emoji: '⛰️',
    matcher: (c) => c.includes('El Paso') },
  { key: 'nogales',     labelEs: 'Nogales / Sonora',        labelEn: 'Nogales / Sonora',        emoji: '🌮',
    matcher: (c) => c.includes('Nogales') || c.includes('Lukeville') },
  { key: 'douglas',     labelEs: 'Douglas / Agua Prieta',   labelEn: 'Douglas / Agua Prieta',   emoji: '🏔️',
    matcher: (c) => c.includes('Douglas') || c.includes('Naco') },
  { key: 'san_luis',    labelEs: 'San Luis RC / Yuma',      labelEn: 'San Luis RC / Yuma',      emoji: '☀️',
    matcher: (c) => c.includes('San Luis') || c.includes('Yuma') },
  { key: 'tijuana',     labelEs: 'Tijuana / San Ysidro',    labelEn: 'Tijuana / San Ysidro',    emoji: '🌊',
    matcher: (c) => c.includes('San Ysidro') || c.includes('Otay Mesa') || c.includes('Tecate') },
  { key: 'mexicali',    labelEs: 'Mexicali / Calexico',     labelEn: 'Mexicali / Calexico',     emoji: '🏜️',
    matcher: (c) => c.includes('Calexico') || c.includes('Andrade') },
  { key: 'all',         labelEs: 'Toda la frontera',        labelEn: 'Whole border',            emoji: '🌎',
    matcher: () => true },
]

// Return all port IDs that belong in a given region, based on portMeta.
// Used server-side (in the planner endpoint) and client-side (in the
// planner page form).
export function portIdsForRegion(region: RegionKey): string[] {
  const spec = REGIONS.find((r) => r.key === region)
  if (!spec) return []
  const ids: string[] = []
  for (const [id, meta] of Object.entries(PORT_META)) {
    if (spec.matcher(meta.city)) ids.push(id)
  }
  return ids
}
