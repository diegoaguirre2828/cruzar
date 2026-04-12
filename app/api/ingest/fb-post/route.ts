import { NextRequest, NextResponse } from 'next/server'
import { getServiceClient } from '@/lib/supabase'

export const dynamic = 'force-dynamic'

// Ingestion endpoint for Facebook community group posts.
//
// Expected payload (from Make.com → Facebook Pages/Groups module):
// {
//   "text":        "Hidalgo ahorita como 45 min, rayos x a todos",
//   "group_name":  "Filas de Puentes Matamoros/Brownsville",
//   "posted_at":   "2026-04-12T18:35:00Z"   // optional; defaults to now
// }
//
// Auth: the caller must pass the shared secret in the `X-Ingest-Secret` header.
// Set INGEST_SECRET in Vercel env vars and plug the same value into Make.com.
//
// Behavior:
//   1. Sends the post text to Claude Haiku with a tight JSON schema prompt
//      asking it to extract { port_id, wait_minutes, lane_type, description }.
//   2. If the LLM returns a usable result, inserts into crossing_reports with
//      source='fb_group' and source_meta containing the original text/group.
//   3. De-dupes: if the exact same text was ingested in the last 15 min, skips.

// CBP port IDs (confirmed by curling bwt.cbp.gov/api/bwtnew) — we give these
// to the LLM so it maps free-text crossing names to the correct ID.
const PORT_CATALOG = `
  230501  Hidalgo (Puente Hidalgo / McAllen-Reynosa)
  230502  Pharr (Puente Pharr-Reynosa)
  230503  Anzalduas (Puente Anzaldúas)
  230901  Progreso (Puente Progreso / Nuevo Progreso)
  230902  Donna (Puente Donna / Los Indios del Norte)
  230701  Rio Grande City (Puente Rio Grande City - Camargo)
  231001  Roma (Puente Roma - Ciudad Miguel Alemán)
  535501  Brownsville B&M (Puente B&M)
  535502  Brownsville Veterans International (Puente Los Tomates Nuevo)
  535503  Brownsville Los Indios (Puente Free Trade / Los Indios)
  535504  Brownsville Gateway (Puente Gateway / Matamoros-Brownsville viejo)
  230401  Laredo I / Gateway to the Americas
  230402  Laredo II / Juárez-Lincoln
  230403  Colombia Solidarity (Laredo - Nuevo Laredo / Colombia)
  230404  World Trade Bridge (Laredo IV)
  230301  Eagle Pass Bridge I
  230302  Eagle Pass Bridge II
`.trim()

type Observation = {
  port_id: string | null
  wait_minutes: number | null
  lane_type: 'vehicle' | 'pedestrian' | 'sentri' | 'commercial' | null
  description: string | null
  has_accident?: boolean
  has_inspection?: boolean
  confidence: 'high' | 'medium' | 'low'
}
type ParsedPost = {
  observations: Observation[]
}

async function parseWithClaude(
  text: string,
  groupName: string,
  image?: { base64: string; mediaType: string } | null,
): Promise<ParsedPost | null> {
  const apiKey = process.env.ANTHROPIC_API_KEY
  if (!apiKey) return null

  const prompt = `You extract US–Mexico border crossing wait time information from Spanish Facebook group posts.

Known crossings (port_id  name):
${PORT_CATALOG}

Post from group "${groupName}":
"""
${text}
"""
${image ? '\nAn image is attached. It is a photo of the border crossing from a user\'s point of view (often from inside their car in the queue, or showing the line ahead/behind).' : ''}

Return ONLY valid JSON matching this schema. No markdown, no prose.
{
  "observations": [
    {
      "port_id": string,                                 // one of the port_ids above
      "wait_minutes": number,                            // estimated wait in minutes for THIS lane
      "lane_type": "vehicle" | "pedestrian" | "sentri" | "commercial",
      "description": string,                             // short Spanish summary (max 100 chars) for THIS lane
      "has_accident": boolean,
      "has_inspection": boolean,
      "confidence": "high" | "medium" | "low"
    }
  ]
}

Rules:
- A single post may describe MULTIPLE lanes or crossings. Emit one observation per lane+crossing.
  "B&M 20 min, nada de fila en sentri" → [{vehicle, 20}, {sentri, 0}]
  "Hidalgo lleno pero pharr fluido"   → [{hidalgo vehicle, 60}, {pharr vehicle, 5}]
- Q&A PATTERN: the text may be a question followed by one or more replies. If the ORIGINAL
  POST is a question ("alguien sabe la fila en Hidalgo?"), use the REPLIES as the source of
  truth. Replies come after the post text and often begin with a short answer like "30 min",
  "fluido", "1 hora". Example input:
    "Alguien sabe la fila en Hidalgo?
     Reply: ahorita 45 min, rayos x a todos
     Reply: yo crucé fluido hace rato"
  → Emit [{port: Hidalgo, vehicle, 45}] — the most recent substantive answer wins.
  Don't average contradictory replies; trust the one with the most specific number.
- Spanish slang: "fluido"/"fluidito"/"sin fila"/"rapido"/"nada de fila" ≈ 5 min.
  "mucha fila"/"lleno" (no number) ≈ 60 min. "1 hora"=60, "hora y media"=90, "2 horas"=120.
- "rayos x", "inspección", "retén" → set has_inspection=true. "choque", "accidente" → has_accident=true.
- "sentri"/"sentry"/"express lane" = sentri. "a pie"/"peatonal"/"caminando" = pedestrian.
- "traila"/"tráiler"/"camión"/"comercial"/"carga" = commercial.
${image ? `- IMAGE ANALYSIS: Look at the attached photo. If it shows a visible queue of cars at a border bridge:
  - Count the cars visible (approximate is fine — "~25 cars" rather than exact).
  - Estimate wait minutes using ~3 min per car per open lane (so 25 cars in 2 open lanes ≈ 40 min).
  - Combine image evidence with the text. If text says "Los Tomates ahorita" and image shows a full queue, emit Los Tomates with the image-derived wait.
  - If image does NOT clearly show a border crossing line (selfie, landscape, wrong location), ignore it and only use the text.
  - When the image is the primary signal, set confidence to "medium".` : ''}
- If the post is a question ("alguien sabe...?") or unrelated chit-chat AND the image doesn't help, return {"observations":[]}.
- If the crossing is ambiguous and can't be mapped to a port_id, skip that observation.`

  // Multi-modal message content when an image is attached
  const userContent: Array<Record<string, unknown>> = []
  if (image) {
    userContent.push({
      type: 'image',
      source: { type: 'base64', media_type: image.mediaType, data: image.base64 },
    })
  }
  userContent.push({ type: 'text', text: prompt })

  try {
    const res = await fetch('https://api.anthropic.com/v1/messages', {
      method: 'POST',
      headers: {
        'x-api-key': apiKey,
        'anthropic-version': '2023-06-01',
        'content-type': 'application/json',
      },
      body: JSON.stringify({
        model: 'claude-haiku-4-5-20251001',
        max_tokens: 800,
        messages: [{ role: 'user', content: userContent }],
      }),
    })
    if (!res.ok) {
      console.error('Anthropic API error:', res.status, await res.text())
      return null
    }
    const data = await res.json()
    const content = data?.content?.[0]?.text?.trim()
    if (!content) return null
    const jsonStr = content.replace(/^```json\s*/, '').replace(/\s*```$/, '').trim()
    const parsed = JSON.parse(jsonStr) as ParsedPost
    if (!parsed || !Array.isArray(parsed.observations)) return { observations: [] }
    return parsed
  } catch (err) {
    console.error('Claude parse error:', err)
    return null
  }
}

// Rough regex fallback — handles the most common post patterns when no API key.
// Returns a single observation (not multi-lane); the LLM path handles the
// fancy cases.
function parseWithRegex(text: string): ParsedPost | null {
  const t = text.toLowerCase()
  const nameToPort: [RegExp, string][] = [
    [/\bhidalgo\b|\breynosa[- ]hidalgo\b/, '230501'],
    [/\bpharr\b/, '230502'],
    [/\banzald[uú]as\b/, '230503'],
    [/\bprogreso\b/, '230901'],
    [/\bdonna\b|\blos indios del norte\b/, '230902'],
    [/\broma\b/, '231001'],
    [/\brio grande city\b|\bcamargo\b/, '230701'],
    [/\bb&m\b|\bpuente b ?y ?m\b/, '535501'],
    [/\bveterans\b|\blos tomates\b/, '535502'],
    [/\bfree trade\b|\blos indios\b/, '535503'],
    [/\bgateway\b|\bmatamoros[- ]brownsville\b/, '535504'],
    [/\blaredo( i\b|[- ]1\b|\s*uno\b)/, '230401'],
    [/\blaredo( ii\b|[- ]2\b|\s*dos\b)/, '230402'],
    [/\bworld trade\b/, '230404'],
    [/\bcolombia\b/, '230403'],
  ]
  let portId: string | null = null
  for (const [re, id] of nameToPort) {
    if (re.test(t)) { portId = id; break }
  }

  let waitMin: number | null = null
  const hourMatch = t.match(/(\d+(?:\.\d+)?)\s*(?:h|hora|horas)/)
  const minMatch  = t.match(/(\d+)\s*(?:min|minutos|m\b)/)
  if (hourMatch) waitMin = Math.round(parseFloat(hourMatch[1]) * 60)
  else if (minMatch) waitMin = parseInt(minMatch[1], 10)
  else if (/fluido|fluidito|rapid|sin fila|no hay fila/.test(t)) waitMin = 5

  const laneType: Observation['lane_type'] =
    /sentri|sentry|express/.test(t) ? 'sentri'
    : /a pie|peatonal|caminando/.test(t) ? 'pedestrian'
    : /traila|tráiler|trailer|camión|comercial/.test(t) ? 'commercial'
    : /\b(auto|carro|coche|vehiculo|veh[ií]culo)\b/.test(t) || waitMin != null ? 'vehicle'
    : null

  if (!portId || waitMin == null) return { observations: [] }
  return {
    observations: [{
      port_id: portId,
      wait_minutes: waitMin,
      lane_type: laneType,
      description: text.slice(0, 120),
      has_inspection: /rayos x|inspecci[oó]n|ret[eé]n/.test(t),
      has_accident:  /choque|accidente/.test(t),
      confidence: 'medium',
    }],
  }
}

// Map a single observation to the existing report_type values used by the UI.
// Report types in use: 'delay' (shown as "Long Delay"), 'clear', 'accident',
// 'inspection', 'commercial', 'other'. Keep ≤20 min as 'clear' so the UI
// doesn't scream "Long Delay" on a fast crossing.
function classifyObservation(o: Observation): string {
  if (o.has_accident) return 'accident'
  if (o.has_inspection) return 'inspection'
  if (o.lane_type === 'commercial') return 'commercial'
  if (o.wait_minutes != null && o.wait_minutes <= 20) return 'clear'
  return 'delay'
}

export async function POST(req: NextRequest) {
  const secret = req.headers.get('x-ingest-secret') || req.nextUrl.searchParams.get('secret')
  if (!process.env.INGEST_SECRET || secret !== process.env.INGEST_SECRET) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  let body: {
    text?: string
    group_name?: string
    posted_at?: string
    image_base64?: string
    image_media_type?: string
  }
  try {
    body = await req.json()
  } catch {
    return NextResponse.json({ error: 'Invalid JSON body' }, { status: 400 })
  }

  const text = (body.text || '').trim()
  const groupName = (body.group_name || 'unknown').trim()
  const hasImage = !!body.image_base64
  if (!text && !hasImage) {
    return NextResponse.json({ error: 'Missing text or image' }, { status: 400 })
  }
  if (text.length > 2000) {
    return NextResponse.json({ error: 'Text too long' }, { status: 400 })
  }
  // Reject huge images — Anthropic caps at ~5MB base64 and this keeps payloads sane
  if (body.image_base64 && body.image_base64.length > 5_000_000) {
    return NextResponse.json({ error: 'Image too large (max ~3.5MB raw)' }, { status: 400 })
  }
  const image = hasImage
    ? {
        base64: body.image_base64 as string,
        mediaType: (body.image_media_type || 'image/jpeg') as string,
      }
    : null

  const db = getServiceClient()

  // De-dupe: if this exact text was ingested in the last 15 min, skip
  const fifteenMinAgo = new Date(Date.now() - 15 * 60 * 1000).toISOString()
  const { data: existing } = await db
    .from('crossing_reports')
    .select('id')
    .eq('source', 'fb_group')
    .gte('created_at', fifteenMinAgo)
    .filter('source_meta->>original_text', 'eq', text)
    .limit(1)
  if (existing && existing.length > 0) {
    return NextResponse.json({ skipped: 'duplicate', id: existing[0].id })
  }

  // Parse — prefer Claude (with optional image), fall back to regex (text-only)
  let parsed = await parseWithClaude(text, groupName, image)
  if (!parsed) parsed = parseWithRegex(text)

  const observations = (parsed?.observations ?? []).filter((o): o is Observation =>
    !!o &&
    !!o.port_id &&
    o.wait_minutes != null &&
    o.wait_minutes >= 0 &&
    o.wait_minutes <= 360,
  )

  if (observations.length === 0) {
    return NextResponse.json({ skipped: 'no_wait_info', parsed })
  }

  const postedAt = body.posted_at && !Number.isNaN(Date.parse(body.posted_at))
    ? new Date(body.posted_at).toISOString()
    : new Date().toISOString()

  const rows = observations.map((o) => ({
    port_id: o.port_id as string,
    user_id: null,
    report_type: classifyObservation(o),
    description: o.description ?? text.slice(0, 120),
    wait_minutes: o.wait_minutes as number,
    upvotes: 0,
    verified: false,
    source: 'fb_group',
    source_meta: {
      group_name: groupName,
      original_text: text,
      posted_at: postedAt,
      confidence: o.confidence,
      lane_type: o.lane_type,
      has_accident: !!o.has_accident,
      has_inspection: !!o.has_inspection,
      parsed_by: process.env.ANTHROPIC_API_KEY ? 'claude-haiku' : 'regex',
    },
    created_at: postedAt,
  }))

  const { data: inserted, error } = await db
    .from('crossing_reports')
    .insert(rows)
    .select('id')

  if (error) {
    console.error('fb-post insert error:', error)
    return NextResponse.json({ error: error.message }, { status: 500 })
  }

  return NextResponse.json({
    ok: true,
    inserted: inserted?.length ?? 0,
    ids: inserted?.map((r) => r.id) ?? [],
    observations,
  })
}
