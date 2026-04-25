// Known inland border-area checkpoints where commercial + passenger
// vehicles routinely dwell during secondary inspection. These are
// downstream of the official port of entry — CBP's bwt.cbp.gov data
// covers the bridge wait, not these stops, so even shippers with
// "perfect" POE wait-time intel end up blind here.
//
// Phase 1 of the Cruzar auto-detection flywheel records anonymized
// dwell times at any of these zones to seed the inland_checkpoint_readings
// table. Adding a checkpoint here automatically extends the geofence.

export interface InlandCheckpoint {
  zone: string             // stable id used as the checkpoint_zone column value
  name: string             // display label (English)
  nameEs: string           // display label (Spanish)
  lat: number
  lng: number
  direction: 'northbound' | 'southbound'
}

// Coordinates verified against public records (Falfurrias = US-281 +
// FM-755 area; Sarita = US-77 just south of the Kenedy/Willacy line;
// Hebbronville = US-359 east of town; Garita 21KM = official
// Aduanas-México federal customs station 21 km inland of the Reynosa /
// Matamoros bridge clusters).
export const INLAND_CHECKPOINTS: InlandCheckpoint[] = [
  {
    zone: 'falfurrias_us281',
    name: 'Falfurrias Checkpoint (US-281)',
    nameEs: 'Garita Falfurrias (US-281)',
    lat: 27.2333,
    lng: -98.1297,
    direction: 'northbound',
  },
  {
    zone: 'sarita_us77',
    name: 'Sarita Checkpoint (US-77)',
    nameEs: 'Garita Sarita (US-77)',
    lat: 26.8417,
    lng: -97.7944,
    direction: 'northbound',
  },
  {
    zone: 'hebbronville_us359',
    name: 'Hebbronville Checkpoint (US-359)',
    nameEs: 'Garita Hebbronville (US-359)',
    lat: 27.3072,
    lng: -98.6831,
    direction: 'northbound',
  },
  {
    zone: 'garita21km_reynosa',
    name: 'Garita 21KM Reynosa (MX)',
    nameEs: 'Garita 21KM Reynosa',
    lat: 25.9908,
    lng: -98.2789,
    direction: 'southbound',
  },
  {
    zone: 'garita21km_matamoros',
    name: 'Garita 21KM Matamoros (MX)',
    nameEs: 'Garita 21KM Matamoros',
    lat: 25.7600,
    lng: -97.5500,
    direction: 'southbound',
  },
]
