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

// Reduce a localName like "Bridge II (Juárez-Lincoln)" to the parenthesized
// half (usually the local Spanish name users actually search). Falls back
// to the head segment if no parens are present.
function localizedRoot(name: string): string {
  const paren = name.match(/\(([^)]+)\)/)
  if (paren && paren[1]) return paren[1]
  const slash = name.split('/')[0]
  return slash.trim()
}

function rawSlugFor(portId: string): string {
  const meta = PORT_META[portId]
  if (!meta) return portId
  const source = meta.localName || meta.city
  return slugify(localizedRoot(source)) || portId
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
