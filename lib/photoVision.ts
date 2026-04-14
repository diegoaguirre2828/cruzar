// Claude Vision extraction for community-submitted bridge photos.
//
// This is the moat machinery. Photo blobs expire in 2 hours, but
// the OBSERVATION they represent (who + where + when + what they
// saw) is the sensor-network asset we retain indefinitely. Before
// the blob is deleted, we run it through Claude Vision to extract
// structured features into a JSONB column so the value survives
// the photo.
//
// Called from two places:
//   1. /api/port-photos POST — at submit time, for instant moderation
//      (NSFW gets rejected before going live) AND immediate feature
//      capture
//   2. /api/cron/cleanup-port-photos — as a safety net, extracts
//      features for any row missing vision_extracted_at before the
//      blob is hard-deleted
//
// Cost: ~$0.001 per image on claude-haiku-4-5-20251001. At 100
// photos/day that's ~$3/month. Diego handles the bill.

const VISION_MODEL = 'claude-haiku-4-5-20251001'

// What we ask Claude to extract. Keep the schema stable across
// model upgrades so downstream queries don't break when we bump
// to a newer model version.
export interface VisionFeatures {
  x_ray_visible: boolean
  lanes_visible: number | null
  lane_congestion_estimate: number | null // 1-5
  weather: 'clear' | 'cloudy' | 'rain' | 'fog' | 'night' | 'unknown'
  time_of_day_visual: 'dawn' | 'day' | 'dusk' | 'night' | 'unknown'
  incidents_visible: Array<'accident' | 'k9' | 'secondary' | 'booth_closed' | 'construction' | 'officer_on_foot'>
  vehicles_in_line_estimate: number | null
  border_patrol_presence: boolean
  cbp_officer_count_visible: number | null
  booths_open_count: number | null
  booths_closed_count: number | null
  construction_visible: boolean
  flag_nsfw: boolean
  flag_faces_visible: boolean
  flag_plates_visible: boolean
  confidence_score: number // 0.0 to 1.0
}

export interface ExtractionResult {
  features: VisionFeatures | null
  model: string
  error?: string
}

const SYSTEM_PROMPT = `You are extracting structured features from a photo taken at a US-Mexico border crossing. The photographer was physically at the bridge. Your job is to return ONLY valid JSON — no markdown, no commentary, no extra text.

Return this exact shape (every field required, use null/unknown/false when uncertain):
{
  "x_ray_visible": boolean,
  "lanes_visible": number | null,
  "lane_congestion_estimate": number | null,
  "weather": "clear" | "cloudy" | "rain" | "fog" | "night" | "unknown",
  "time_of_day_visual": "dawn" | "day" | "dusk" | "night" | "unknown",
  "incidents_visible": ["accident" | "k9" | "secondary" | "booth_closed" | "construction" | "officer_on_foot"],
  "vehicles_in_line_estimate": number | null,
  "border_patrol_presence": boolean,
  "cbp_officer_count_visible": number | null,
  "booths_open_count": number | null,
  "booths_closed_count": number | null,
  "construction_visible": boolean,
  "flag_nsfw": boolean,
  "flag_faces_visible": boolean,
  "flag_plates_visible": boolean,
  "confidence_score": number
}

Field rules:
- x_ray_visible: true if you can see a truck X-ray scanner portal or the characteristic blue X-ray booth
- lanes_visible: count of distinct crossing lanes you can see (any type). null if you can't tell.
- lane_congestion_estimate: 1 (empty) to 5 (fully backed up). null if no lanes visible.
- weather: based on visible sky/conditions
- time_of_day_visual: based on light quality alone
- incidents_visible: array of observations. Empty array if none. Include "officer_on_foot" if officers are walking the queue (not in booths).
- vehicles_in_line_estimate: rough count of visible vehicles in the crossing line
- border_patrol_presence: true if USBP or CBP officers visible (uniform matters)
- cbp_officer_count_visible: count of visible officers in uniform
- booths_open_count / booths_closed_count: count of visible inspection booths, distinguish by presence of officer
- construction_visible: cones, barriers, construction equipment, road work signage
- flag_nsfw: true if the image contains nudity, explicit sexual content, or graphic violence. This is a moderation gate.
- flag_faces_visible: true if any human face is clearly recognizable
- flag_plates_visible: true if any vehicle license plate is clearly readable
- confidence_score: your overall confidence the extraction is accurate (0.0 to 1.0)

If the image is NOT a photo of a border crossing (random selfie, food, meme, etc.), set flag_nsfw to false BUT set confidence_score to 0.0 and return all booleans as false, all numbers as null, all enums as "unknown". The caller will treat confidence_score < 0.3 as a reason to reject.`

async function fetchImageAsBase64(url: string): Promise<{ base64: string; mediaType: string }> {
  const res = await fetch(url)
  if (!res.ok) throw new Error(`Image fetch failed: ${res.status}`)
  const contentType = res.headers.get('content-type') || 'image/jpeg'
  const buffer = await res.arrayBuffer()
  const base64 = Buffer.from(buffer).toString('base64')
  const mediaType = contentType.split(';')[0].trim()
  return { base64, mediaType }
}

// Accept either a data: URL, an absolute https: URL (e.g. supabase
// storage public URL), or a raw base64 string with known mime type.
export async function extractFeatures(
  imageSource: string,
  explicitMimeType?: string,
): Promise<ExtractionResult> {
  const apiKey = process.env.ANTHROPIC_API_KEY
  if (!apiKey) {
    return { features: null, model: VISION_MODEL, error: 'ANTHROPIC_API_KEY not set' }
  }

  let base64: string
  let mediaType: string

  try {
    if (imageSource.startsWith('data:')) {
      const match = imageSource.match(/^data:(image\/[a-z+]+);base64,(.+)$/i)
      if (!match) throw new Error('Invalid data URL')
      mediaType = match[1]
      base64 = match[2]
    } else if (imageSource.startsWith('http')) {
      const fetched = await fetchImageAsBase64(imageSource)
      base64 = fetched.base64
      mediaType = fetched.mediaType
    } else {
      // Raw base64 — require explicit mime type
      if (!explicitMimeType) throw new Error('Raw base64 requires explicitMimeType')
      base64 = imageSource
      mediaType = explicitMimeType
    }
  } catch (err) {
    return {
      features: null,
      model: VISION_MODEL,
      error: `Image load failed: ${err instanceof Error ? err.message : String(err)}`,
    }
  }

  try {
    const res = await fetch('https://api.anthropic.com/v1/messages', {
      method: 'POST',
      headers: {
        'x-api-key': apiKey,
        'anthropic-version': '2023-06-01',
        'content-type': 'application/json',
      },
      body: JSON.stringify({
        model: VISION_MODEL,
        max_tokens: 800,
        system: SYSTEM_PROMPT,
        messages: [
          {
            role: 'user',
            content: [
              {
                type: 'image',
                source: {
                  type: 'base64',
                  media_type: mediaType,
                  data: base64,
                },
              },
              {
                type: 'text',
                text: 'Extract the structured features from this border crossing photo. Return only the JSON object described in your instructions.',
              },
            ],
          },
        ],
      }),
    })

    if (!res.ok) {
      const errText = await res.text().catch(() => '')
      return {
        features: null,
        model: VISION_MODEL,
        error: `Anthropic ${res.status}: ${errText.slice(0, 200)}`,
      }
    }

    const data = await res.json()
    const raw = data?.content?.[0]?.text?.trim() || ''
    const jsonStr = raw
      .replace(/^```json\s*/i, '')
      .replace(/^```\s*/i, '')
      .replace(/\s*```\s*$/i, '')
      .trim()

    let parsed: VisionFeatures
    try {
      parsed = JSON.parse(jsonStr)
    } catch (parseErr) {
      return {
        features: null,
        model: VISION_MODEL,
        error: `JSON parse failed: ${parseErr instanceof Error ? parseErr.message : String(parseErr)}. Raw: ${raw.slice(0, 200)}`,
      }
    }

    // Minimal validation — ensure the top-level shape is correct.
    // Don't be pedantic; accept whatever the model returns and let
    // downstream consumers handle unexpected values.
    if (typeof parsed !== 'object' || parsed === null) {
      return { features: null, model: VISION_MODEL, error: 'Malformed response — not an object' }
    }

    return { features: parsed, model: VISION_MODEL }
  } catch (err) {
    return {
      features: null,
      model: VISION_MODEL,
      error: err instanceof Error ? err.message : String(err),
    }
  }
}

// ─────────────────────────────────────────────────────────────
// Perceptual hash (dhash) — 64-bit signature for clustering
// ─────────────────────────────────────────────────────────────
//
// Computed at submit time so we can later find near-duplicates,
// build "canonical view per port" features, and detect users
// re-submitting the same photo. Uses the sharp image library which
// is already installed for the FB asset generator.
//
// dhash algorithm: resize to 9x8 grayscale, compare each pixel to
// its right neighbor, output 64 bits. Invariant to small crops and
// minor adjustments; stable across compression levels.

// Use BigInt() constructor + hex strings instead of BigInt literals
// since the project tsconfig targets ES2017.

const BIGINT_ZERO = BigInt(0)
const BIGINT_ONE = BigInt(1)
const BIGINT_63 = BIGINT_ONE << BigInt(63)
const BIGINT_64 = BIGINT_ONE << BigInt(64)

export async function computeDhash(imageBuffer: Buffer): Promise<bigint | null> {
  try {
    // Dynamic import to keep sharp out of the client bundle
    const sharpMod = await import('sharp')
    const sharp = sharpMod.default
    const { data } = await sharp(imageBuffer)
      .grayscale()
      .resize(9, 8, { fit: 'fill' })
      .raw()
      .toBuffer({ resolveWithObject: true })

    let hash = BIGINT_ZERO
    let bitIndex = BIGINT_ZERO
    for (let row = 0; row < 8; row++) {
      for (let col = 0; col < 8; col++) {
        const leftPx = data[row * 9 + col]
        const rightPx = data[row * 9 + col + 1]
        if (leftPx < rightPx) {
          hash = hash | (BIGINT_ONE << bitIndex)
        }
        bitIndex = bitIndex + BIGINT_ONE
      }
    }
    return hash
  } catch (err) {
    console.error('computeDhash failed:', err)
    return null
  }
}

// Convert bigint dhash to a DB-safe signed 64-bit integer. Postgres
// BIGINT range is -2^63 to 2^63-1; our dhash is an unsigned 64-bit
// so values above 2^63 need to wrap to negative to fit. Reversible.
export function dhashToSignedBigint(hash: bigint): bigint {
  return hash >= BIGINT_63 ? hash - BIGINT_64 : hash
}

export const VISION_MODEL_VERSION = VISION_MODEL
