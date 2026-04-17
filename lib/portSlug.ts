// Human-readable port slugs for FB-comment-friendly URLs.
//
// Diego's ask 2026-04-17: replace /port/535502 with /cruzar/los-tomates
// so he can paste a URL in a Facebook group and people can read what
// bridge it points to without decoding a CBP numeric ID.
//
// Strategy:
//   - Generate a slug for every port from portMeta's localName (fallback
//     to city), normalizing accents + punctuation + spaces.
//   - `/cruzar/[slug]` becomes a SEO-friendly alias that renders the
//     same content as `/port/[portId]`. Both work; slug is canonical
//     for sitemap + share URLs so Google indexes one URL per port.
//   - Collisions (two ports slugifying to the same string, e.g., two
//     Roma entries) resolve deterministically: first port in PORT_META
//     order wins the pretty slug, the rest get the portId appended.

import { PORT_META } from './portMeta'

function slugify(input: string): string {
  return input
    .normalize('NFD')                  // separate accents
    .replace(/[\u0300-\u036f]/g, '')   // strip combining marks
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')       // non-alphanumeric → dash
    .replace(/^-+|-+$/g, '')           // trim dashes
}

// Explicit slug overrides per portId. Used when the auto-derived slug
// from localName is cryptic (e.g., "Commercial" for 260402 Mariposa
// Commercial), collides with another port, or would surprise Spanish-
// or English-speaking users searching for the crossing by name.
// Slugs below are picked for FB-pasteability + recognition, not
// uniqueness — the map below enforces uniqueness.
const SLUG_OVERRIDES: Record<string, string> = {
  // California / Baja
  '250401': 'san-ysidro',
  '250407': 'san-ysidro-pedwest',
  '250409': 'cbx',
  '250601': 'otay-mesa',
  '250602': 'otay-mesa-commercial',
  '250609': 'otay-mesa-east',
  '250301': 'calexico-east',
  '250302': 'calexico-west',
  '250501': 'tecate',
  // Sonora / Arizona
  '260401': 'deconcini',
  '260402': 'mariposa',
  '260403': 'morley-gate',
  '260101': 'agua-prieta',
  '260201': 'lukeville',
  '260301': 'naco',
  '260801': 'san-luis-1',
  '260802': 'san-luis-2',
  // El Paso
  '202401': 'paso-del-norte-poe',
  '240201': 'bota',
  '240202': 'pdn',
  '240203': 'ysleta',
  '240204': 'stanton',
  '240207': 'bota-2',
  '240215': 'bota-cargo',
  '240221': 'el-paso',
  '240401': 'tornillo',
  '240301': 'presidio',
  '240601': 'columbus-palomas',
  '240801': 'santa-teresa',
  // Coahuila-TX
  '230301': 'eagle-pass-1',
  '230302': 'eagle-pass-2',
  '230201': 'del-rio',
  // Laredo
  '230401': 'laredo-1',
  '230402': 'juarez-lincoln',
  '230403': 'colombia',
  '230404': 'world-trade',
  '230103': 'laredo-gateway',
  // RGV — Reynosa / McAllen
  '230501': 'hidalgo',
  '230502': 'pharr',
  '230503': 'anzalduas',
  // RGV — Progreso
  '230901': 'progreso',
  '230902': 'donna',
  // RGV — Roma
  '230701': 'rio-grande-city',
  '231001': 'roma',
  '231002': 'roma-2',
  // RGV — Brownsville / Matamoros
  '535501': 'puente-viejo',
  '535502': 'los-tomates',
  '535503': 'los-indios',
  '535504': 'gateway-nuevo',
}

function rawSlugFor(portId: string): string {
  if (SLUG_OVERRIDES[portId]) return SLUG_OVERRIDES[portId]
  const meta = PORT_META[portId]
  if (!meta) return portId
  // Fallback: slugify the full localName (with accents/punct normalized).
  // We do NOT extract parenthesized content — that produced cryptic
  // slugs like "commercial" or "secondary" when the paren was a
  // lane-type qualifier rather than a name.
  const source = (meta.localName || meta.city).replace(/[()/]/g, ' ')
  return slugify(source) || portId
}

// Build the maps once at module load. Two indexes:
//   PORT_SLUGS  :  portId → slug          (for outbound URL generation)
//   SLUG_TO_ID  :  slug   → portId        (for inbound route resolution)
// Both support collision-safe suffixing.
const PORT_SLUGS: Record<string, string> = {}
const SLUG_TO_ID: Record<string, string> = {}

for (const portId of Object.keys(PORT_META)) {
  const base = rawSlugFor(portId)
  let slug = base
  // Collision → append portId to make it unique
  if (SLUG_TO_ID[slug]) slug = `${base}-${portId}`
  PORT_SLUGS[portId] = slug
  SLUG_TO_ID[slug] = portId
}

export function slugForPort(portId: string): string {
  return PORT_SLUGS[portId] || portId
}

export function portIdFromSlug(slug: string): string | null {
  const normalized = slugify(slug)
  return SLUG_TO_ID[normalized] || null
}

export function allSlugs(): { portId: string; slug: string }[] {
  return Object.entries(PORT_SLUGS).map(([portId, slug]) => ({ portId, slug }))
}
