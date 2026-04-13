// Port metadata for every CBP crossing Cruzar covers.
//
// Two region fields:
//   - `region` (display) — the human-readable paired "MX city ↔ US city / bridge"
//     label used in the filter dropdown. Must match one of ALL_REGIONS.
//   - `megaRegion` (filter key) — a normalized key used for localization
//     (businesses, ads, default copy tone). One of MEGA_REGIONS.
//
// Display labels lead with the MX city because that's how border crossers
// actually search. Mega regions are intentionally coarse — just enough to
// partition businesses and ads so a Baja user never sees an RGV promo.

export interface PortMeta {
  city: string
  region: string
  megaRegion: MegaRegion
  lat: number
  lng: number
  localName?: string
}

export type MegaRegion =
  | 'rgv'          // Reynosa, Matamoros, Progreso, Miguel Alemán
  | 'laredo'       // Nuevo Laredo ↔ Laredo
  | 'coahuila-tx'  // Piedras Negras, Cd. Acuña (Eagle Pass + Del Rio)
  | 'el-paso'      // Juárez, Santa Teresa, Tornillo, Presidio, Columbus
  | 'sonora-az'    // Nogales, Agua Prieta, San Luis, Naco, Sasabe, Lukeville
  | 'baja'         // Tijuana, Mexicali, Tecate, Los Algodones
  | 'other'

// ─── Display labels (dropdown) ─────────────────────────────────────────────
// These are paired MX↔US names. Users in FB groups talk about "Reynosa" or
// "Tijuana" — the MX side comes first. The US side says which exact bridge.
const RGV_REYNOSA      = 'Reynosa ↔ McAllen / Hidalgo / Pharr'
const RGV_PROGRESO     = 'Nuevo Progreso ↔ Progreso / Donna'
const RGV_ROMA         = 'Cd. Miguel Alemán ↔ Rio Grande City / Roma'
const RGV_BROWNSVILLE  = 'Matamoros ↔ Brownsville'
const R_LAREDO         = 'Nuevo Laredo ↔ Laredo'
const R_EAGLE_PASS     = 'Piedras Negras ↔ Eagle Pass'
const R_DEL_RIO        = 'Cd. Acuña ↔ Del Rio'
const R_EL_PASO        = 'Cd. Juárez ↔ El Paso'
const R_NOGALES        = 'Nogales, Sonora ↔ Nogales, Arizona'
const R_DOUGLAS        = 'Agua Prieta ↔ Douglas / Naco / Lukeville'
const R_SAN_LUIS_AZ    = 'San Luis RC ↔ San Luis, Arizona'
const R_MEXICALI       = 'Mexicali / Tecate ↔ Calexico'
const R_TIJUANA        = 'Tijuana ↔ San Ysidro / Otay'
const R_OTROS          = 'Otros'

export const PORT_META: Record<string, PortMeta> = {
  // ── Reynosa ↔ McAllen / Hidalgo / Pharr ──────────────────
  '230501': { city: 'McAllen',  region: RGV_REYNOSA, megaRegion: 'rgv', lat: 26.1080, lng: -98.2708, localName: 'Hidalgo' },
  '230502': { city: 'Pharr',    region: RGV_REYNOSA, megaRegion: 'rgv', lat: 26.1764, lng: -98.1836, localName: 'Pharr' },
  '230503': { city: 'McAllen',  region: RGV_REYNOSA, megaRegion: 'rgv', lat: 26.0432, lng: -98.3647, localName: 'Anzaldúas' },

  // ── Nuevo Progreso ↔ Progreso / Donna ────────────────────
  '230901': { city: 'Progreso', region: RGV_PROGRESO, megaRegion: 'rgv', lat: 26.0905, lng: -97.9736, localName: 'Progreso' },
  '230902': { city: 'Donna',    region: RGV_PROGRESO, megaRegion: 'rgv', lat: 26.1649, lng: -98.0492, localName: 'Donna' },

  // ── Cd. Miguel Alemán ↔ Rio Grande City / Roma ───────────
  '230701': { city: 'Rio Grande City', region: RGV_ROMA, megaRegion: 'rgv', lat: 26.3795, lng: -98.8219 },
  '231001': { city: 'Roma',     region: RGV_ROMA, megaRegion: 'rgv', lat: 26.4079, lng: -99.0195 },
  '231002': { city: 'Roma',     region: RGV_ROMA, megaRegion: 'rgv', lat: 26.4100, lng: -99.0200 },

  // ── Matamoros ↔ Brownsville ──────────────────────────────
  // Local names confirmed 2026-04-13 with Diego (RGV native), corrected
  // after two earlier bad assumptions:
  //   B&M = "Puente Viejo" (the older centro crossing)
  //   Gateway = "Puente Nuevo" (the newer centro crossing)
  //   Veterans International = "Los Tomates" (east, Bagdad road)
  //   Free Trade = "Los Indios" (west, commercial focus)
  '535501': { city: 'Brownsville', region: RGV_BROWNSVILLE, megaRegion: 'rgv', lat: 25.9007, lng: -97.4935, localName: 'Puente Viejo / B&M' },
  '535502': { city: 'Brownsville', region: RGV_BROWNSVILLE, megaRegion: 'rgv', lat: 25.8726, lng: -97.4866, localName: 'Los Tomates' },
  '535503': { city: 'Brownsville', region: RGV_BROWNSVILLE, megaRegion: 'rgv', lat: 26.0416, lng: -97.7367, localName: 'Los Indios / Free Trade' },
  '535504': { city: 'Brownsville', region: RGV_BROWNSVILLE, megaRegion: 'rgv', lat: 25.9044, lng: -97.5040, localName: 'Puente Nuevo / Gateway' },

  // ── Nuevo Laredo ↔ Laredo ────────────────────────────────
  '230401': { city: 'Laredo', region: R_LAREDO, megaRegion: 'laredo', lat: 27.4994, lng: -99.5076, localName: 'Bridge I (Gateway to the Americas)' },
  '230402': { city: 'Laredo', region: R_LAREDO, megaRegion: 'laredo', lat: 27.5628, lng: -99.5019, localName: 'Bridge II (Juárez-Lincoln)' },
  '230403': { city: 'Laredo', region: R_LAREDO, megaRegion: 'laredo', lat: 27.6506, lng: -99.5539, localName: 'Colombia Solidarity' },
  '230404': { city: 'Laredo', region: R_LAREDO, megaRegion: 'laredo', lat: 27.5533, lng: -99.4786, localName: 'World Trade Bridge' },
  '230103': { city: 'Laredo', region: R_LAREDO, megaRegion: 'laredo', lat: 27.5000, lng: -99.5100, localName: 'Gateway' },

  // ── Piedras Negras ↔ Eagle Pass ──────────────────────────
  // Consistent 'Bridge I / Bridge II' format matches CBP crossing_name.
  '230301': { city: 'Eagle Pass', region: R_EAGLE_PASS, megaRegion: 'coahuila-tx', lat: 28.7091, lng: -100.4995, localName: 'Bridge I (Puente Viejo)' },
  '230302': { city: 'Eagle Pass', region: R_EAGLE_PASS, megaRegion: 'coahuila-tx', lat: 28.7150, lng: -100.5010, localName: 'Bridge II (Camino Real)' },

  // ── Cd. Acuña ↔ Del Rio ──────────────────────────────────
  '230201': { city: 'Del Rio', region: R_DEL_RIO, megaRegion: 'coahuila-tx', lat: 29.3627, lng: -100.8974 },

  // ── Cd. Juárez ↔ El Paso ─────────────────────────────────
  // Verified against CBP crossing_name field 2026-04-12. Note that CBP has
  // TWO port numbers for Paso del Norte (202401 and 240202) — keeping both
  // since they appear in different CBP responses.
  '202401': { city: 'El Paso',     region: R_EL_PASO, megaRegion: 'el-paso', lat: 31.7588, lng: -106.4869, localName: 'Paso del Norte' },
  '240201': { city: 'El Paso',     region: R_EL_PASO, megaRegion: 'el-paso', lat: 31.7619, lng: -106.4850, localName: 'Bridge of the Americas (BOTA)' },
  '240202': { city: 'El Paso',     region: R_EL_PASO, megaRegion: 'el-paso', lat: 31.7588, lng: -106.4869, localName: 'Paso del Norte (PDN)' },
  '240203': { city: 'El Paso',     region: R_EL_PASO, megaRegion: 'el-paso', lat: 31.6938, lng: -106.3353, localName: 'Ysleta / Zaragoza' },
  '240204': { city: 'El Paso',     region: R_EL_PASO, megaRegion: 'el-paso', lat: 31.7550, lng: -106.4780, localName: 'Stanton DCL' },
  '240207': { city: 'El Paso',     region: R_EL_PASO, megaRegion: 'el-paso', lat: 31.7600, lng: -106.4830, localName: 'BOTA (secondary)' },
  '240215': { city: 'El Paso',     region: R_EL_PASO, megaRegion: 'el-paso', lat: 31.7650, lng: -106.4900, localName: 'BOTA Cargo Facility' },
  '240221': { city: 'El Paso',     region: R_EL_PASO, megaRegion: 'el-paso', lat: 31.7619, lng: -106.4850, localName: 'El Paso' },
  '240401': { city: 'Tornillo',    region: R_EL_PASO, megaRegion: 'el-paso', lat: 31.4336, lng: -106.0728, localName: 'Tornillo (Marcelino Serna)' },
  '240301': { city: 'Presidio',    region: R_EL_PASO, megaRegion: 'el-paso', lat: 29.5602, lng: -104.3718, localName: 'Presidio ↔ Ojinaga' },
  '240801': { city: 'Santa Teresa',region: R_EL_PASO, megaRegion: 'el-paso', lat: 31.8742, lng: -106.6717, localName: 'Santa Teresa' },
  '240601': { city: 'Columbus',    region: R_EL_PASO, megaRegion: 'el-paso', lat: 31.8280, lng: -107.6408, localName: 'Columbus ↔ Puerto Palomas' },
  'l24501': { city: 'Fort Hancock',region: R_EL_PASO, megaRegion: 'el-paso', lat: 31.1120, lng: -105.8490, localName: 'Fort Hancock' },

  // ── Nogales, Sonora ↔ Nogales, Arizona ───────────────────
  '260401': { city: 'Nogales', region: R_NOGALES, megaRegion: 'sonora-az', lat: 31.3364, lng: -110.9388, localName: 'Deconcini' },
  '260402': { city: 'Nogales', region: R_NOGALES, megaRegion: 'sonora-az', lat: 31.3525, lng: -110.9605, localName: 'Mariposa (Commercial)' },
  '260403': { city: 'Nogales', region: R_NOGALES, megaRegion: 'sonora-az', lat: 31.3380, lng: -110.9380, localName: 'Morley Gate' },

  // ── Agua Prieta ↔ Douglas / Naco / Lukeville ─────────────
  '260101': { city: 'Douglas',   region: R_DOUGLAS, megaRegion: 'sonora-az', lat: 31.3445, lng: -109.5457, localName: 'Agua Prieta ↔ Douglas' },
  '260301': { city: 'Naco',      region: R_DOUGLAS, megaRegion: 'sonora-az', lat: 31.3333, lng: -109.9450, localName: 'Naco, Sonora ↔ Naco, AZ' },
  '260305': { city: 'Naco',      region: R_DOUGLAS, megaRegion: 'sonora-az', lat: 31.3350, lng: -109.9460 },
  '260201': { city: 'Lukeville', region: R_DOUGLAS, megaRegion: 'sonora-az', lat: 31.8836, lng: -112.8112, localName: 'Sonoyta ↔ Lukeville' },

  // ── San Luis RC ↔ San Luis, Arizona ──────────────────────
  '260801': { city: 'San Luis', region: R_SAN_LUIS_AZ, megaRegion: 'sonora-az', lat: 32.4846, lng: -114.7899, localName: 'San Luis I' },
  '260802': { city: 'San Luis', region: R_SAN_LUIS_AZ, megaRegion: 'sonora-az', lat: 32.4900, lng: -114.7920, localName: 'San Luis II (Commercial)' },

  // ── Mexicali / Tecate ↔ Calexico ─────────────────────────
  // Corrected 2026-04-12: CBP returns 250301 as "East" and 250302 as "West".
  // Previous portMeta had them swapped.
  '250301': { city: 'Calexico', region: R_MEXICALI, megaRegion: 'baja', lat: 32.6793, lng: -115.5088, localName: 'Calexico East' },
  '250302': { city: 'Calexico', region: R_MEXICALI, megaRegion: 'baja', lat: 32.6676, lng: -115.4788, localName: 'Calexico West' },
  '250501': { city: 'Tecate',   region: R_MEXICALI, megaRegion: 'baja', lat: 32.5777, lng: -116.6272, localName: 'Tecate' },

  // ── Tijuana ↔ San Ysidro / Otay ──────────────────────────
  // Verified 2026-04-12 against CBP crossing_name field. Consistent format:
  //   '<common local name>' or '<entity> (<type>)' for multi-entry ports.
  '250401': { city: 'San Ysidro', region: R_TIJUANA, megaRegion: 'baja', lat: 32.5432, lng: -117.0281, localName: 'San Ysidro (La Línea)' },
  '250407': { city: 'San Ysidro', region: R_TIJUANA, megaRegion: 'baja', lat: 32.5408, lng: -117.0271, localName: 'San Ysidro PedWest' },
  '250409': { city: 'San Ysidro', region: R_TIJUANA, megaRegion: 'baja', lat: 32.5700, lng: -116.9700, localName: 'Cross Border Xpress (Tijuana Airport)' },
  '250601': { city: 'Otay Mesa',  region: R_TIJUANA, megaRegion: 'baja', lat: 32.5526, lng: -116.9734, localName: 'Otay Mesa (Passenger)' },
  '250602': { city: 'Otay Mesa',  region: R_TIJUANA, megaRegion: 'baja', lat: 32.5540, lng: -116.9750, localName: 'Otay Mesa (Commercial)' },
  '250608': { city: 'Otay Mesa',  region: R_TIJUANA, megaRegion: 'baja', lat: 32.5530, lng: -116.9740, localName: 'Otay Mesa East' },
  '250609': { city: 'Otay Mesa',  region: R_TIJUANA, megaRegion: 'baja', lat: 32.5520, lng: -116.9730, localName: 'Otay Mesa' },

  // ── Otros (Andrade) ──────────────────────────────────────
  '250201': { city: 'Andrade',  region: R_OTROS, megaRegion: 'baja', lat: 32.7202, lng: -114.7277, localName: 'Los Algodones ↔ Andrade' },
}

// Ordered for the dropdown. Use 'All' / 'Todos los cruces' as the first option
// in the UI. We don't include it here so each entry is a real filterable region.
export const ALL_REGIONS = [
  'All',
  RGV_REYNOSA,
  RGV_PROGRESO,
  RGV_ROMA,
  RGV_BROWNSVILLE,
  R_LAREDO,
  R_EAGLE_PASS,
  R_DEL_RIO,
  R_EL_PASO,
  R_NOGALES,
  R_DOUGLAS,
  R_SAN_LUIS_AZ,
  R_MEXICALI,
  R_TIJUANA,
  R_OTROS,
]

export function getPortMeta(portId: string): PortMeta {
  return PORT_META[portId] ?? {
    city: 'Other',
    region: R_OTROS,
    megaRegion: 'other',
    lat: 26.2034,
    lng: -98.2300,
  }
}

// Resolve a port's mega region for business / ad localization.
// Falls back to 'other' for ports not in the meta map.
export function portMegaRegion(portId: string): MegaRegion {
  return PORT_META[portId]?.megaRegion ?? 'other'
}
