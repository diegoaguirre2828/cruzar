// Apportionment table — splits BTS per-US-port pedestrian totals across
// the actual CBP BWT bridges that handle pedestrians.
//
// BTS publishes monthly pedestrian counts per US port-of-entry (one
// number per port like "Brownsville, TX"). Cruzar tracks individual
// bridges within each port. Most multi-bridge ports have ONE pedestrian-
// dominant bridge and others that are commercial/vehicle-only — without
// apportionment, dividing the BTS total evenly would massively over-
// count the cargo bridges and under-count the pedestrian ones.
//
// Weights sum to 1.0 per BTS port. Weight 0 is intentional: "this
// bridge handles effectively no pedestrians" (cargo-only).
//
// Source for weights: hand-curated from CBP bridge facility documentation
// + ground knowledge of which bridges have walk-up pedestrian inspection
// booths. Refine as ground-truth from camera-vision counts accumulates.
//
// Uses .mjs so both Node scripts and Next.js TypeScript can import it
// without a build step.

/**
 * @typedef {{ bwtPortId: string, weight: number, note?: string }} BwtBridgeShare
 * @typedef {{ portNameContains: string[], state: string, bridges: BwtBridgeShare[] }} BtsPortMatch
 */

/** @type {BtsPortMatch[]} */
export const BTS_TO_BWT_APPORTIONMENT = [
  // ─── Texas ──────────────────────────────────────────────────────────
  {
    portNameContains: ['Brownsville'],
    state: 'Texas',
    bridges: [
      { bwtPortId: '535501', weight: 0.35, note: 'B&M / Puente Viejo — historic pedestrian crossing' },
      { bwtPortId: '535502', weight: 0.10, note: 'Los Tomates / Veterans — has pedestrian lane' },
      { bwtPortId: '535503', weight: 0.05, note: 'Los Indios / Free Trade — minimal walk traffic' },
      { bwtPortId: '535504', weight: 0.50, note: 'Gateway / Puente Nuevo — main pedestrian volume' },
    ],
  },
  {
    portNameContains: ['Hidalgo'],
    state: 'Texas',
    bridges: [
      { bwtPortId: '230501', weight: 0.95, note: 'Hidalgo — the McAllen pedestrian crossing' },
      { bwtPortId: '230502', weight: 0.00, note: 'Pharr — commercial only' },
      { bwtPortId: '230503', weight: 0.05, note: 'Anzaldúas — minor pedestrian' },
    ],
  },
  {
    portNameContains: ['Progreso'],
    state: 'Texas',
    bridges: [
      { bwtPortId: '230901', weight: 0.95, note: 'Progreso — dental-tourism pedestrian volume' },
      { bwtPortId: '230902', weight: 0.05, note: 'Donna — minor pedestrian' },
    ],
  },
  {
    portNameContains: ['Roma'],
    state: 'Texas',
    bridges: [{ bwtPortId: '231001', weight: 1.00 }],
  },
  {
    portNameContains: ['Rio Grande City'],
    state: 'Texas',
    bridges: [{ bwtPortId: '230701', weight: 1.00 }],
  },
  {
    portNameContains: ['Laredo'],
    state: 'Texas',
    bridges: [
      { bwtPortId: '230401', weight: 0.85, note: 'Bridge I (Gateway to the Americas) — main pedestrian' },
      { bwtPortId: '230402', weight: 0.15, note: 'Bridge II (Juárez-Lincoln) — mixed' },
      { bwtPortId: '230403', weight: 0.00, note: 'Colombia Solidarity — commercial' },
      { bwtPortId: '230404', weight: 0.00, note: 'World Trade Bridge — commercial' },
      { bwtPortId: '230103', weight: 0.00, note: 'Generic Gateway entry — likely duplicate of 230401' },
    ],
  },
  {
    portNameContains: ['Eagle Pass'],
    state: 'Texas',
    bridges: [
      { bwtPortId: '230301', weight: 0.70, note: 'Bridge I (Puente Viejo) — main pedestrian' },
      { bwtPortId: '230302', weight: 0.30, note: 'Bridge II (Camino Real) — mixed' },
    ],
  },
  {
    portNameContains: ['Del Rio'],
    state: 'Texas',
    bridges: [{ bwtPortId: '230201', weight: 1.00 }],
  },
  {
    portNameContains: ['El Paso'],
    state: 'Texas',
    bridges: [
      { bwtPortId: '240201', weight: 0.40, note: 'Bridge of the Americas (BOTA)' },
      { bwtPortId: '240202', weight: 0.55, note: 'Paso del Norte (Stanton/Santa Fe) — main pedestrian' },
      { bwtPortId: '240204', weight: 0.05, note: 'Stanton DCL' },
      { bwtPortId: '202401', weight: 0.00, note: 'Duplicate Paso del Norte entry — exclude to avoid double-count' },
      { bwtPortId: '240207', weight: 0.00, note: 'BOTA secondary — same physical bridge' },
      { bwtPortId: '240215', weight: 0.00, note: 'BOTA Cargo — commercial' },
      { bwtPortId: '240221', weight: 0.00, note: 'Generic El Paso entry — duplicate' },
    ],
  },
  {
    // BTS reports Ysleta as its own port (separate from El Paso) so it
    // needs its own rule pointing at the BWT bridge for Ysleta/Zaragoza.
    portNameContains: ['Ysleta'],
    state: 'Texas',
    bridges: [
      { bwtPortId: '240203', weight: 1.00, note: 'Ysleta / Zaragoza — full BTS-Ysleta count' },
    ],
  },
  {
    portNameContains: ['Tornillo'],
    state: 'Texas',
    bridges: [{ bwtPortId: '240401', weight: 1.00 }],
  },
  {
    portNameContains: ['Presidio'],
    state: 'Texas',
    bridges: [{ bwtPortId: '240301', weight: 1.00 }],
  },
  // ─── New Mexico ─────────────────────────────────────────────────────
  {
    portNameContains: ['Santa Teresa'],
    state: 'New Mexico',
    bridges: [{ bwtPortId: '240801', weight: 1.00 }],
  },
  {
    portNameContains: ['Columbus'],
    state: 'New Mexico',
    bridges: [{ bwtPortId: '240601', weight: 1.00 }],
  },
  // ─── Arizona ────────────────────────────────────────────────────────
  {
    portNameContains: ['Nogales'],
    state: 'Arizona',
    bridges: [
      { bwtPortId: '260401', weight: 0.95, note: 'DeConcini — the Nogales pedestrian crossing' },
      { bwtPortId: '260402', weight: 0.00, note: 'Mariposa — commercial' },
      { bwtPortId: '260403', weight: 0.05, note: 'Morley Gate — small pedestrian' },
    ],
  },
  {
    portNameContains: ['Douglas'],
    state: 'Arizona',
    bridges: [{ bwtPortId: '260101', weight: 1.00 }],
  },
  {
    portNameContains: ['Naco'],
    state: 'Arizona',
    bridges: [
      { bwtPortId: '260301', weight: 1.00 },
      { bwtPortId: '260305', weight: 0.00, note: 'Likely duplicate of 260301' },
    ],
  },
  {
    portNameContains: ['Lukeville'],
    state: 'Arizona',
    bridges: [{ bwtPortId: '260201', weight: 1.00 }],
  },
  {
    portNameContains: ['San Luis'],
    state: 'Arizona',
    bridges: [
      { bwtPortId: '260801', weight: 1.00, note: 'San Luis I — pedestrian + passenger' },
      { bwtPortId: '260802', weight: 0.00, note: 'San Luis II — commercial' },
    ],
  },
  {
    portNameContains: ['Sasabe'],
    state: 'Arizona',
    bridges: [],
  },
  // ─── California ─────────────────────────────────────────────────────
  {
    portNameContains: ['San Ysidro'],
    state: 'California',
    bridges: [
      { bwtPortId: '250401', weight: 0.50, note: 'San Ysidro main — La Línea' },
      { bwtPortId: '250407', weight: 0.50, note: 'PedWest — dedicated pedestrian facility' },
      { bwtPortId: '250409', weight: 0.00, note: 'Cross Border Xpress — separate facility, own counts' },
    ],
  },
  {
    portNameContains: ['Otay Mesa'],
    state: 'California',
    bridges: [
      { bwtPortId: '250601', weight: 1.00, note: 'Otay Mesa Passenger — has pedestrian lane' },
      { bwtPortId: '250602', weight: 0.00, note: 'Commercial' },
      { bwtPortId: '250608', weight: 0.00, note: 'Otay Mesa East — new, minimal pedestrian' },
      { bwtPortId: '250609', weight: 0.00, note: 'Generic Otay entry' },
    ],
  },
  {
    // BTS treats Cross Border Xpress as its own port (it's a privately-
    // operated bridge directly into Tijuana airport, separate from
    // San Ysidro/Otay).
    portNameContains: ['Cross Border Xpress'],
    state: 'California',
    bridges: [
      { bwtPortId: '250409', weight: 1.00, note: 'Cross Border Xpress — Tijuana airport pedestrian bridge' },
    ],
  },
  {
    portNameContains: ['Tecate'],
    state: 'California',
    bridges: [{ bwtPortId: '250501', weight: 1.00 }],
  },
  {
    portNameContains: ['Calexico'],
    state: 'California',
    bridges: [
      { bwtPortId: '250301', weight: 0.05, note: 'Calexico East — mostly cargo' },
      { bwtPortId: '250302', weight: 0.95, note: 'Calexico West — main pedestrian (PedWest-style)' },
    ],
  },
  {
    portNameContains: ['Andrade', 'Algodones'],
    state: 'California',
    bridges: [{ bwtPortId: '250201', weight: 1.00, note: 'Los Algodones / Andrade — major dental-tourism pedestrian' }],
  },
]

export function findBtsRule(btsPortName, btsState) {
  const name = (btsPortName || '').toLowerCase()
  const state = (btsState || '').toLowerCase()
  for (const rule of BTS_TO_BWT_APPORTIONMENT) {
    if (rule.state.toLowerCase() !== state) continue
    if (rule.portNameContains.some((s) => name.includes(s.toLowerCase()))) return rule
  }
  return null
}
