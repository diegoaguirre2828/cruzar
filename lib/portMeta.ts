export interface PortMeta {
  city: string
  region: string
  lat: number
  lng: number
}

export const PORT_META: Record<string, PortMeta> = {
  // ── RGV / McAllen ──────────────────────────────────────
  '230501': { city: 'McAllen',  region: 'RGV – McAllen / Hidalgo', lat: 26.1080, lng: -98.2708 },
  '230502': { city: 'Pharr',    region: 'RGV – McAllen / Hidalgo', lat: 26.1764, lng: -98.1836 },
  '230503': { city: 'McAllen',  region: 'RGV – McAllen / Hidalgo', lat: 26.0432, lng: -98.3647 },
  '230901': { city: 'Progreso', region: 'RGV – Progreso / Donna',  lat: 26.0905, lng: -97.9736 },
  '230902': { city: 'Donna',    region: 'RGV – Progreso / Donna',  lat: 26.1649, lng: -98.0492 },
  '230701': { city: 'Rio Grande City', region: 'RGV – Rio Grande City / Roma', lat: 26.3795, lng: -98.8219 },
  '231001': { city: 'Roma',     region: 'RGV – Rio Grande City / Roma', lat: 26.4079, lng: -99.0195 },
  '231002': { city: 'Roma',     region: 'RGV – Rio Grande City / Roma', lat: 26.4100, lng: -99.0200 },

  // ── Brownsville ────────────────────────────────────────
  '535501': { city: 'Brownsville', region: 'Brownsville', lat: 25.9007, lng: -97.4935 },
  '535502': { city: 'Brownsville', region: 'Brownsville', lat: 25.8726, lng: -97.4866 },
  '535503': { city: 'Brownsville', region: 'Brownsville', lat: 26.0416, lng: -97.7367 },
  '535504': { city: 'Brownsville', region: 'Brownsville', lat: 25.9044, lng: -97.5040 },

  // ── Laredo ─────────────────────────────────────────────
  '230401': { city: 'Laredo', region: 'Laredo', lat: 27.4994, lng: -99.5076 },
  '230402': { city: 'Laredo', region: 'Laredo', lat: 27.5628, lng: -99.5019 },
  '230403': { city: 'Laredo', region: 'Laredo', lat: 27.6506, lng: -99.5539 },
  '230404': { city: 'Laredo', region: 'Laredo', lat: 27.5533, lng: -99.4786 },
  '230103': { city: 'Laredo', region: 'Laredo', lat: 27.5000, lng: -99.5100 },

  // ── Eagle Pass ─────────────────────────────────────────
  '230301': { city: 'Eagle Pass', region: 'Eagle Pass', lat: 28.7091, lng: -100.4995 },
  '230302': { city: 'Eagle Pass', region: 'Eagle Pass', lat: 28.7150, lng: -100.5010 },

  // ── Del Rio ────────────────────────────────────────────
  '230201': { city: 'Del Rio', region: 'Del Rio', lat: 29.3627, lng: -100.8974 },

  // ── El Paso ────────────────────────────────────────────
  '240201': { city: 'El Paso', region: 'El Paso', lat: 31.7619, lng: -106.4850 },
  '240202': { city: 'El Paso', region: 'El Paso', lat: 31.7588, lng: -106.4869 },
  '240203': { city: 'El Paso', region: 'El Paso', lat: 31.6938, lng: -106.3353 },
  '240204': { city: 'El Paso', region: 'El Paso', lat: 31.7550, lng: -106.4780 },
  '240207': { city: 'El Paso', region: 'El Paso', lat: 31.7600, lng: -106.4830 },
  '240215': { city: 'El Paso', region: 'El Paso', lat: 31.7650, lng: -106.4900 },
  '240401': { city: 'Tornillo', region: 'El Paso', lat: 31.4336, lng: -106.0728 },
  '240301': { city: 'Presidio', region: 'El Paso', lat: 29.5602, lng: -104.3718 },
  '240801': { city: 'Santa Teresa', region: 'El Paso', lat: 31.8742, lng: -106.6717 },

  // ── Nogales ────────────────────────────────────────────
  '260401': { city: 'Nogales', region: 'Nogales, AZ', lat: 31.3364, lng: -110.9388 },
  '260402': { city: 'Nogales', region: 'Nogales, AZ', lat: 31.3525, lng: -110.9605 },
  '260403': { city: 'Nogales', region: 'Nogales, AZ', lat: 31.3380, lng: -110.9380 },

  // ── Douglas / Naco / Lukeville ─────────────────────────
  '260101': { city: 'Douglas',   region: 'Arizona',   lat: 31.3445, lng: -109.5457 },
  '260301': { city: 'Naco',      region: 'Arizona',   lat: 31.3333, lng: -109.9450 },
  '260305': { city: 'Naco',      region: 'Arizona',   lat: 31.3350, lng: -109.9460 },
  '260201': { city: 'Lukeville', region: 'Arizona',   lat: 31.8836, lng: -112.8112 },

  // ── San Luis ───────────────────────────────────────────
  '260801': { city: 'San Luis', region: 'San Luis, AZ', lat: 32.4846, lng: -114.7899 },
  '260802': { city: 'San Luis', region: 'San Luis, AZ', lat: 32.4900, lng: -114.7920 },

  // ── Calexico ───────────────────────────────────────────
  '250301': { city: 'Calexico', region: 'Calexico / Imperial Valley', lat: 32.6793, lng: -115.5088 },
  '250302': { city: 'Calexico', region: 'Calexico / Imperial Valley', lat: 32.6676, lng: -115.4788 },
  '250501': { city: 'Tecate',   region: 'Calexico / Imperial Valley', lat: 32.5777, lng: -116.6272 },

  // ── San Diego ──────────────────────────────────────────
  '250401': { city: 'San Ysidro', region: 'San Diego', lat: 32.5432, lng: -117.0281 },
  '250407': { city: 'San Ysidro', region: 'San Diego', lat: 32.5408, lng: -117.0271 },
  '250409': { city: 'San Ysidro', region: 'San Diego', lat: 32.5700, lng: -116.9700 },
  '250601': { city: 'Otay Mesa', region: 'San Diego',  lat: 32.5526, lng: -116.9734 },
  '250602': { city: 'Otay Mesa', region: 'San Diego',  lat: 32.5540, lng: -116.9750 },
  '250608': { city: 'Otay Mesa', region: 'San Diego',  lat: 32.5530, lng: -116.9740 },
  '250609': { city: 'Otay Mesa', region: 'San Diego',  lat: 32.5520, lng: -116.9730 },

  // ── Andrade / Columbus ─────────────────────────────────
  '250201': { city: 'Andrade',  region: 'Other', lat: 32.7202, lng: -114.7277 },
  '240601': { city: 'Columbus', region: 'Other', lat: 31.8280, lng: -107.6408 },
  '202401': { city: 'El Paso',  region: 'El Paso', lat: 31.7580, lng: -106.4870 },
  'l24501': { city: 'Fort Hancock', region: 'El Paso', lat: 31.1120, lng: -105.8490 },
}

export const ALL_REGIONS = [
  'All',
  'RGV – McAllen / Hidalgo',
  'RGV – Progreso / Donna',
  'RGV – Rio Grande City / Roma',
  'Brownsville',
  'Laredo',
  'Eagle Pass',
  'Del Rio',
  'El Paso',
  'Nogales, AZ',
  'Arizona',
  'San Luis, AZ',
  'Calexico / Imperial Valley',
  'San Diego',
  'Other',
]

export function getPortMeta(portId: string): PortMeta {
  return PORT_META[portId] ?? {
    city: 'Other',
    region: 'Other',
    lat: 26.2034,
    lng: -98.2300,
  }
}
