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

type ParsedPost = {
  port_id: string | null
  wait_minutes: number | null
  lane_type: 'vehicle' | 'pedestrian' | 'sentri' | 'commercial' | null
  description: string | null
  confidence: 'high' | 'medium' | 'low'
}

async function parseWithClaude(text: string, groupName: string): Promise<ParsedPost | null> {
  const apiKey = process.env.ANTHROPIC_API_KEY
  if (!apiKey) return null

  const prompt = `You extract US–Mexico border crossing wait time information from Spanish Facebook group posts.

Known crossings (port_id  name):
${PORT_CATALOG}

Post from group "${groupName}":
"""
${text}
"""

Return ONLY valid JSON matching this schema. Do not wrap in markdown.
{
  "port_id": string or null,            // one of the port_ids above, or null if the post doesn't mention a specific crossing
  "wait_minutes": number or null,       // estimated wait in minutes; "fluido"/"rapido" = 5, "mucha fila" = 60, "1 hora" = 60, "2 horas" = 120
  "lane_type": "vehicle" | "pedestrian" | "sentri" | "commercial" | null,
  "description": string,                // short 1-line Spanish summary (max 100 chars)
  "confidence": "high" | "medium" | "low"
}

Rules:
- If the post has NO wait time information (just chit-chat, selling something, unrelated), return all nulls with confidence "low".
- If ambiguous about which crossing, return port_id=null.
- "ahorita", "en este momento", "ya" all mean the post is describing CURRENT conditions.
- "rayos x", "inspección", "retén" = vehicle lane with secondary inspection.
- "sentri", "sentry", "express" = sentri lane.
- "a pie", "peatonal", "caminando" = pedestrian.
- "traila", "tráiler", "camión", "comercial" = commercial.`

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
        max_tokens: 400,
        messages: [{ role: 'user', content: prompt }],
      }),
    })
    if (!res.ok) {
      console.error('Anthropic API error:', res.status, await res.text())
      return null
    }
    const data = await res.json()
    const content = data?.content?.[0]?.text?.trim()
    if (!content) return null
    // Sometimes the model wraps the JSON in ```json blocks despite instructions
    const jsonStr = content.replace(/^```json\s*/, '').replace(/\s*```$/, '').trim()
    const parsed = JSON.parse(jsonStr) as ParsedPost
    return parsed
  } catch (err) {
    console.error('Claude parse error:', err)
    return null
  }
}

// Rough regex fallback — handles the most common post patterns when no API key.
// Keeps the endpoint useful during local dev and if the LLM call fails.
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

  const laneType: ParsedPost['lane_type'] =
    /sentri|sentry|express/.test(t) ? 'sentri'
    : /a pie|peatonal|caminando/.test(t) ? 'pedestrian'
    : /traila|tráiler|trailer|camión|comercial/.test(t) ? 'commercial'
    : /\b(auto|carro|coche|vehiculo|veh[ií]culo)\b/.test(t) || waitMin != null ? 'vehicle'
    : null

  if (!portId && waitMin == null) return null
  return {
    port_id: portId,
    wait_minutes: waitMin,
    lane_type: laneType,
    description: text.slice(0, 120),
    confidence: portId && waitMin != null ? 'medium' : 'low',
  }
}

function laneToReportType(lane: ParsedPost['lane_type'], waitMin: number | null): string {
  if (waitMin != null && waitMin >= 60) return 'delay'
  if (waitMin != null && waitMin <= 10) return 'clear'
  if (lane === 'commercial') return 'commercial'
  return 'delay'
}

export async function POST(req: NextRequest) {
  const secret = req.headers.get('x-ingest-secret') || req.nextUrl.searchParams.get('secret')
  if (!process.env.INGEST_SECRET || secret !== process.env.INGEST_SECRET) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  let body: { text?: string; group_name?: string; posted_at?: string }
  try {
    body = await req.json()
  } catch {
    return NextResponse.json({ error: 'Invalid JSON body' }, { status: 400 })
  }

  const text = (body.text || '').trim()
  const groupName = (body.group_name || 'unknown').trim()
  if (!text) return NextResponse.json({ error: 'Missing text' }, { status: 400 })
  if (text.length > 2000) {
    return NextResponse.json({ error: 'Text too long' }, { status: 400 })
  }

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

  // Parse — prefer Claude, fall back to regex
  let parsed = await parseWithClaude(text, groupName)
  if (!parsed) parsed = parseWithRegex(text)

  if (!parsed || !parsed.port_id || parsed.wait_minutes == null) {
    return NextResponse.json({
      skipped: 'no_wait_info',
      parsed,
    })
  }

  // Sanity: wait minutes must be plausible
  if (parsed.wait_minutes < 0 || parsed.wait_minutes > 360) {
    return NextResponse.json({ skipped: 'implausible_wait', parsed })
  }

  const postedAt = body.posted_at && !Number.isNaN(Date.parse(body.posted_at))
    ? new Date(body.posted_at).toISOString()
    : new Date().toISOString()

  const { data: inserted, error } = await db
    .from('crossing_reports')
    .insert({
      port_id: parsed.port_id,
      user_id: null,
      report_type: laneToReportType(parsed.lane_type, parsed.wait_minutes),
      description: parsed.description,
      wait_minutes: parsed.wait_minutes,
      upvotes: 0,
      verified: false,
      source: 'fb_group',
      source_meta: {
        group_name: groupName,
        original_text: text,
        posted_at: postedAt,
        confidence: parsed.confidence,
        lane_type: parsed.lane_type,
        parsed_by: process.env.ANTHROPIC_API_KEY ? 'claude-haiku' : 'regex',
      },
      created_at: postedAt,
    })
    .select('id')
    .single()

  if (error) {
    console.error('fb-post insert error:', error)
    return NextResponse.json({ error: error.message }, { status: 500 })
  }

  return NextResponse.json({
    ok: true,
    id: inserted?.id,
    parsed,
  })
}
