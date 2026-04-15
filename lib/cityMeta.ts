// City-level metadata for Cruzar's /city/[slug] SEO rollup pages.
//
// Each border city groups the CBP ports that belong to its metro area.
// Cities lead with the MX name because that's how border crossers
// actually search ("como esta la linea tijuana" not "san ysidro POE").
// Rollup pages match bordergarita.com's /tijuana-border-crossing URL
// pattern — the highest-ROI SEO steal from the competitor analysis
// (see memory/project_cruzar_competitor_bordergarita.md).

import type { MegaRegion } from './portMeta'

export type CityMeta = {
  slug: string
  mxName: string   // primary search term — the MX city ("Tijuana")
  usName: string   // paired US city ("San Diego / San Ysidro")
  displayName: { es: string; en: string }
  megaRegion: MegaRegion
  ports: string[]  // CBP portIds in this city, ordered by prominence
  blurb: { es: string; en: string }
  hashtags: string  // for OG + share copy
}

export const CITY_META: Record<string, CityMeta> = {
  tijuana: {
    slug: 'tijuana',
    mxName: 'Tijuana',
    usName: 'San Ysidro / Otay Mesa',
    displayName: {
      es: 'Tijuana ↔ San Ysidro / Otay',
      en: 'Tijuana ↔ San Ysidro / Otay',
    },
    megaRegion: 'baja',
    // Order: La Línea (busiest) → Otay Mesa → PedWest → CBX (airport)
    ports: ['250401', '250501', '250407', '250409'],
    blurb: {
      es: 'Los 4 cruces entre Tijuana y California en una sola vista: San Ysidro (La Línea), Otay Mesa, PedWest peatonal y Cross Border Xpress (aeropuerto). Tiempos en vivo, cámaras del lado mexicano y reportes de la raza que va cruzando ahorita.',
      en: 'All 4 crossings between Tijuana and California on one page: San Ysidro (La Línea), Otay Mesa, PedWest pedestrian, and Cross Border Xpress (airport). Live wait times, Mexican-side cameras, and reports from people crossing right now.',
    },
    hashtags: '#Tijuana #SanYsidro #Otay #LaLinea #CBX',
  },

  reynosa: {
    slug: 'reynosa',
    mxName: 'Reynosa',
    usName: 'McAllen / Hidalgo / Pharr',
    displayName: {
      es: 'Reynosa ↔ McAllen / Hidalgo / Pharr',
      en: 'Reynosa ↔ McAllen / Hidalgo / Pharr',
    },
    megaRegion: 'rgv',
    // Order: Hidalgo (most central) → Pharr (commercial) → Anzaldúas (newest)
    ports: ['230501', '230502', '230503'],
    blurb: {
      es: 'Los 3 puentes entre Reynosa y el Valle de Texas (RGV): Hidalgo, Pharr y Anzaldúas. Compara los tiempos en vivo antes de salir para cruzar por el más rápido, no por el más cercano.',
      en: 'The 3 bridges between Reynosa and the Rio Grande Valley: Hidalgo, Pharr, and Anzaldúas. Compare live wait times before you leave so you cross at the fastest, not just the closest.',
    },
    hashtags: '#Reynosa #McAllen #Hidalgo #Pharr #Anzalduas #RGV',
  },

  matamoros: {
    slug: 'matamoros',
    mxName: 'Matamoros',
    usName: 'Brownsville',
    displayName: {
      es: 'Matamoros ↔ Brownsville',
      en: 'Matamoros ↔ Brownsville',
    },
    megaRegion: 'rgv',
    // Order: Gateway (most central) → Los Tomates → B&M → Los Indios
    ports: ['535504', '535502', '535501', '535503'],
    blurb: {
      es: 'Los 4 puentes entre Matamoros y Brownsville: Puente Nuevo (Gateway), Puente Viejo (B&M), Los Tomates (Veterans) y Los Indios. Tiempos en vivo y comparativa lado a lado.',
      en: 'The 4 bridges between Matamoros and Brownsville: Puente Nuevo (Gateway), Puente Viejo (B&M), Los Tomates (Veterans), and Los Indios. Live wait times and side-by-side comparison.',
    },
    hashtags: '#Matamoros #Brownsville #Tamaulipas #ValleDeTexas',
  },

  'nuevo-laredo': {
    slug: 'nuevo-laredo',
    mxName: 'Nuevo Laredo',
    usName: 'Laredo',
    displayName: {
      es: 'Nuevo Laredo ↔ Laredo',
      en: 'Nuevo Laredo ↔ Laredo',
    },
    megaRegion: 'laredo',
    // Order: Juárez-Lincoln (busiest private) → Gateway → Colombia → World Trade (commercial)
    ports: ['230404', '230401', '230403', '230402'],
    blurb: {
      es: 'Los 4 puentes entre Nuevo Laredo y Laredo: Juárez-Lincoln (Puente II), Gateway to the Americas (Puente I), Colombia Solidaridad (Puente III) y World Trade Bridge (Puente IV comercial). Con cámaras en vivo de los dos lados gracias a City of Laredo.',
      en: 'The 4 bridges between Nuevo Laredo and Laredo: Juárez-Lincoln (Bridge II), Gateway to the Americas (Bridge I), Colombia Solidarity (Bridge III), and World Trade Bridge (Bridge IV commercial). With live cameras on both sides thanks to City of Laredo.',
    },
    hashtags: '#NuevoLaredo #Laredo #Tamaulipas #Coahuila',
  },

  juarez: {
    slug: 'juarez',
    mxName: 'Cd. Juárez',
    usName: 'El Paso',
    displayName: {
      es: 'Cd. Juárez ↔ El Paso',
      en: 'Cd. Juárez ↔ El Paso',
    },
    megaRegion: 'el-paso',
    // Order: BOTA (free, biggest) → Ysleta/Zaragoza → PDN → Stanton → Tornillo
    ports: ['240201', '240221', '240204', '240202', '240401'],
    blurb: {
      es: 'Los puentes entre Ciudad Juárez y El Paso: BOTA (Bridge of the Americas, gratis), Ysleta/Zaragoza, Paso del Norte, Stanton y Tornillo. Con cámaras en vivo del lado estadounidense via City of El Paso.',
      en: 'The bridges between Ciudad Juárez and El Paso: BOTA (Bridge of the Americas, toll-free), Ysleta/Zaragoza, Paso del Norte, Stanton, and Tornillo. With live US-side cameras via City of El Paso.',
    },
    hashtags: '#Juarez #ElPaso #Chihuahua #JRZELP',
  },

  mexicali: {
    slug: 'mexicali',
    mxName: 'Mexicali',
    usName: 'Calexico',
    displayName: {
      es: 'Mexicali ↔ Calexico',
      en: 'Mexicali ↔ Calexico',
    },
    megaRegion: 'baja',
    // Order: Calexico East (highway) → Calexico West (downtown)
    ports: ['250301', '250302'],
    blurb: {
      es: 'Los 2 cruces entre Mexicali y Calexico: Calexico Este (mejor si vas a San Diego o Yuma) y Calexico Oeste (mejor si vas al centro). Ahora con cámaras del lado mexicano.',
      en: 'The 2 crossings between Mexicali and Calexico: Calexico East (better if you\'re heading to San Diego or Yuma) and Calexico West (better if you\'re going downtown). Now with Mexican-side cameras.',
    },
    hashtags: '#Mexicali #Calexico #BajaCalifornia',
  },

  nogales: {
    slug: 'nogales',
    mxName: 'Nogales, Sonora',
    usName: 'Nogales, Arizona',
    displayName: {
      es: 'Nogales, Sonora ↔ Nogales, Arizona',
      en: 'Nogales, Sonora ↔ Nogales, Arizona',
    },
    megaRegion: 'sonora-az',
    // Order: DeConcini (busiest) → Mariposa (commercial) → Morley Gate (pedestrian)
    ports: ['260401', '260402', '260403'],
    blurb: {
      es: 'Los 3 cruces entre Nogales Sonora y Nogales Arizona: DeConcini (centro), Mariposa (comercial) y Morley Gate (peatonal). Ahora con cámaras en vivo del lado mexicano de DeConcini y Mariposa gracias a Heroica Nogales + El Imparcial.',
      en: 'The 3 crossings between Nogales Sonora and Nogales Arizona: DeConcini (downtown), Mariposa (commercial), and Morley Gate (pedestrian). Now with Mexican-side live cameras at DeConcini and Mariposa thanks to Heroica Nogales + El Imparcial.',
    },
    hashtags: '#Nogales #Sonora #Arizona #DeConcini #Mariposa',
  },
}

export const ALL_CITY_SLUGS = Object.keys(CITY_META)

export function getCityMeta(slug: string): CityMeta | null {
  return CITY_META[slug] ?? null
}

// Returns the city slug a given portId belongs to, if any. Used on
// port detail pages to add a "Also see other {city} crossings" link.
export function cityForPortId(portId: string): string | null {
  for (const [slug, meta] of Object.entries(CITY_META)) {
    if (meta.ports.includes(portId)) return slug
  }
  return null
}
