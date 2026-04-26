// Camera-based wait-time estimation via Claude Haiku vision.
//
// Diego's observation (2026-04-21): Brownsville B&M shows heavy cam
// traffic while CBP reports low wait, user sees the mismatch and
// loses trust. Fix: have the AI actually read the camera, not just
// display it.
//
// Pipeline:
//   1. Pick ONE primary snapshot-able feed per port from BRIDGE_CAMERAS
//   2. Resolve a snapshot URL (image-kind → src; iframe-kind ipcamlive
//      → /player/snapshot.php?alias=XYZ; hls/youtube → null, v1 skip)
//   3. Fetch the image bytes, base64 it, send to Claude Haiku
//      messages.create with a structured JSON-return prompt
//   4. Parse {cars_estimated, minutes_estimated, confidence} and
//      insert into camera_wait_readings
//
// The /api/ports blend reads the latest row per port and fuses it
// with CBP + HERE + community signals.

import Anthropic from '@anthropic-ai/sdk'
import { spawn } from 'node:child_process'
import ffmpegPath from 'ffmpeg-static'
import { BRIDGE_CAMERAS, type CameraFeed } from './bridgeCameras'

const MODEL = 'claude-haiku-4-5-20251001'

// Pull an HTTP(S) snapshot URL we can fetch as an image. Returns null
// for feed kinds where we get the frame a different way (hls grabs via
// ffmpeg, youtube still skipped).
export function snapshotUrlFor(feed: CameraFeed): string | null {
  if (feed.kind === 'image') return feed.src

  if (feed.kind === 'iframe') {
    // ipcamlive exposes a snapshot endpoint at the same alias. Pattern:
    //   player.php?alias=XYZ → snapshot.php?alias=XYZ
    const m = feed.src.match(/[?&]alias=([a-z0-9]+)/i)
    if (m && feed.src.includes('ipcamlive')) {
      return `https://www.ipcamlive.com/player/snapshot.php?alias=${m[1]}`
    }
    return null
  }

  // hls handled via extractHlsFrame, not via a snapshot URL.
  // youtube still has no easy frame-extraction path.
  return null
}

// Extract a single JPEG frame from an HLS stream using bundled ffmpeg.
// Workflow: fetch the m3u8 manifest, find the latest .ts segment URL,
// download that segment, pipe it through ffmpeg, capture stdout. The
// segment is typically 5s of video — we just grab the first frame.
//
// Returns the JPEG bytes, or null on failure (timeout, no segments,
// ffmpeg crash). Honest about non-fatal errors so the cron loop can
// keep going across other ports.
export async function extractHlsFrame(m3u8Url: string): Promise<Buffer | null> {
  // 1. Fetch the m3u8 manifest
  let manifest: string
  try {
    const res = await fetch(m3u8Url, { signal: AbortSignal.timeout(6000) })
    if (!res.ok) return null
    manifest = await res.text()
  } catch {
    return null
  }

  // 2. Find the latest .ts segment URL (relative to manifest)
  const lines = manifest.split(/\r?\n/).map((l) => l.trim())
  const segments = lines.filter((l) => l && !l.startsWith('#') && (l.endsWith('.ts') || l.includes('.ts?')))
  if (segments.length === 0) return null
  const lastSeg = segments[segments.length - 1]
  const segUrl = lastSeg.startsWith('http')
    ? lastSeg
    : new URL(lastSeg, m3u8Url).toString()

  // 3. Download the segment bytes
  let segBuf: Buffer
  try {
    const res = await fetch(segUrl, { signal: AbortSignal.timeout(8000) })
    if (!res.ok) return null
    segBuf = Buffer.from(await res.arrayBuffer())
    if (segBuf.length < 1000) return null
  } catch {
    return null
  }

  // 4. Pipe segment through ffmpeg, ask for one JPEG frame on stdout.
  // -f mpegts is the input format hint (HLS uses MPEG-TS containers),
  // -frames:v 1 stops after the first decoded frame, -f image2 +
  // -update 1 makes ffmpeg emit a single image to stdout instead of
  // expecting a numbered output filename.
  if (!ffmpegPath) return null
  const ffmpegBin: string = ffmpegPath
  return await new Promise<Buffer | null>((resolve) => {
    const chunks: Buffer[] = []
    const proc = spawn(ffmpegBin, [
      '-loglevel', 'error',
      '-f', 'mpegts',
      '-i', 'pipe:0',
      '-frames:v', '1',
      '-q:v', '5',
      '-f', 'image2',
      '-update', '1',
      'pipe:1',
    ])
    const timeout = setTimeout(() => {
      proc.kill('SIGKILL')
      resolve(null)
    }, 12000)
    proc.stdout.on('data', (c: Buffer) => chunks.push(c))
    proc.stderr.on('data', () => { /* swallow ffmpeg stderr — single failed extract isn't actionable */ })
    proc.on('error', () => {
      clearTimeout(timeout)
      resolve(null)
    })
    proc.on('close', (code) => {
      clearTimeout(timeout)
      if (code !== 0) {
        // Suppress noisy stderr — single failed extract isn't worth a log
        resolve(null)
        return
      }
      const out = Buffer.concat(chunks)
      // Sanity check: JPEG starts with 0xFF 0xD8
      if (out.length < 1000 || out[0] !== 0xff || out[1] !== 0xd8) {
        resolve(null)
        return
      }
      resolve(out)
    })
    proc.stdin.write(segBuf)
    proc.stdin.end()
  })
}

// Returns the first analyzable feed for a port, or null. v55b: HLS
// feeds are now analyzable via extractHlsFrame, so they qualify too.
export function pickPrimaryFeed(portId: string): { feed: CameraFeed; snapshotUrl: string | null } | null {
  const feeds = BRIDGE_CAMERAS[portId] ?? []
  for (const f of feeds) {
    if (f.kind === 'image' || f.kind === 'iframe') {
      const url = snapshotUrlFor(f)
      if (url) return { feed: f, snapshotUrl: url }
    } else if (f.kind === 'hls') {
      // HLS feeds don't have a snapshot URL — caller routes via extractHlsFrame
      return { feed: f, snapshotUrl: null }
    }
    // youtube still skipped
  }
  return null
}

interface VisionResult {
  cars_estimated: number | null
  minutes_estimated: number | null
  confidence: 'high' | 'medium' | 'low'
  // Pedestrian queue, when one is visible. Same model call, no extra
  // image fetch. Most bridge cams point at vehicle approach lanes and
  // see the pedestrian line obliquely or not at all — when not visible,
  // these come back null and downstream falls through to community /
  // BTS baseline. v55.
  pedestrians_estimated: number | null
  pedestrian_minutes_estimated: number | null
  pedestrian_confidence: 'high' | 'medium' | 'low'
  pedestrian_lanes_visible: number | null
  raw: unknown
  error_code?: string
}

function emptyResult(error_code: string, raw: unknown = null): VisionResult {
  return {
    cars_estimated: null, minutes_estimated: null, confidence: 'low',
    pedestrians_estimated: null, pedestrian_minutes_estimated: null,
    pedestrian_confidence: 'low', pedestrian_lanes_visible: null,
    raw, error_code,
  }
}

// Fetch the snapshot and ask Claude Haiku to estimate the queue. Prompt
// is tight and returns strict JSON. We calibrate cars→minutes inside
// the model's response so it can adjust for visible lane count (harder
// to do in post-processing because lane visibility depends on camera
// angle, which only the model can see).
//
// v55b: feed can be either a snapshot URL (image/iframe-with-snapshot)
// OR pre-fetched bytes (HLS frame extraction). Caller picks the path.
export async function analyzeSnapshot(
  portId: string,
  snapshotUrl: string,
): Promise<VisionResult> {
  // Fetch image bytes. Cache-bust so we get a fresh frame every run.
  let imageMediaType: 'image/jpeg' | 'image/png' | 'image/webp' | 'image/gif' = 'image/jpeg'
  let buf: Buffer
  try {
    const bust = `${snapshotUrl}${snapshotUrl.includes('?') ? '&' : '?'}_t=${Date.now()}`
    const imgRes = await fetch(bust, {
      signal: AbortSignal.timeout(8000),
      headers: { 'User-Agent': 'Cruzar-CameraVision/1.0 (+https://cruzar.app)' },
    })
    if (!imgRes.ok) return emptyResult(`http_${imgRes.status}`)
    const ct = imgRes.headers.get('content-type') || ''
    if (ct.includes('png')) imageMediaType = 'image/png'
    else if (ct.includes('webp')) imageMediaType = 'image/webp'
    else if (ct.includes('gif')) imageMediaType = 'image/gif'
    buf = Buffer.from(await imgRes.arrayBuffer())
    // Guardrail: skip tiny responses (often a 1×1 pixel auth-wall or
    // redirect page rendered as image).
    if (buf.length < 2000) return emptyResult('image_too_small')
  } catch {
    return emptyResult('fetch_failed')
  }
  return await analyzeImageBytes(buf, imageMediaType)
}

// Analyze pre-fetched image bytes. Used by HLS path after ffmpeg has
// extracted a frame, and by analyzeSnapshot above after the URL fetch.
export async function analyzeImageBytes(
  buf: Buffer,
  imageMediaType: 'image/jpeg' | 'image/png' | 'image/webp' | 'image/gif' = 'image/jpeg',
): Promise<VisionResult> {
  const apiKey = process.env.ANTHROPIC_API_KEY
  if (!apiKey) return emptyResult('no_api_key')
  if (buf.length < 2000) return emptyResult('image_too_small')
  const imageB64 = buf.toString('base64')

  const client = new Anthropic({ apiKey })

  const prompt = `You are analyzing a live traffic camera pointed at a US-Mexico border bridge. Estimate BOTH the vehicle queue AND the pedestrian queue visible in the frame.

Return STRICT JSON, no prose, matching this schema exactly:
{
  "cars_estimated": <integer, total vehicles visible in the queue / on the approach lanes, or null if you can't see a queue clearly>,
  "minutes_estimated": <integer, estimated wait time in minutes for a vehicle joining the back of the queue NOW — use ~20 seconds per car per lane as a baseline, adjust up if cars look stopped for a long time, adjust down if lanes are moving>,
  "confidence": "high" | "medium" | "low",
  "visible_lanes": <integer, how many inbound vehicle lanes you can see>,
  "queue_is_moving": <boolean, best guess whether cars are flowing>,
  "pedestrians_estimated": <integer, total people visible standing in the pedestrian inspection line — count single-file walkers approaching the booth. Null if no pedestrian queue is in frame.>,
  "pedestrian_minutes_estimated": <integer, estimated wait at the back of the pedestrian line. Use ~12 seconds per person per booth as a baseline, adjust for visible motion. Null if no pedestrians visible.>,
  "pedestrian_confidence": "high" | "medium" | "low",
  "pedestrian_lanes_visible": <integer or null, how many pedestrian inspection booths/turnstiles are in frame>,
  "notes": <short string, what you see — e.g. "queue extends off-frame", "empty lanes", "no pedestrians visible — vehicle-only camera", "long pedestrian line wraps around plaza">
}

Guidance:
- If the camera is dark, blurry, or shows a "no signal" / error frame, return all nulls and both confidences: "low" with notes explaining.
- If cars are visible but you can't tell how many lanes they occupy, estimate conservatively (assume 2 lanes).
- Most border cameras point at the vehicle approach and don't capture the pedestrian queue. When pedestrians aren't visible, return pedestrians_estimated: null, pedestrian_minutes_estimated: null, pedestrian_confidence: "low" — DO NOT guess.
- When pedestrians ARE visible, count single-file walkers in line; ignore people loitering on sidewalks or in parking lots.
- If the pedestrian queue extends off-frame, estimate higher and drop pedestrian_confidence to "medium" or "low".
- Border bridge waits typically range 0-120 minutes; cap your estimates at 120.
- "high" confidence = you can clearly see the full queue and lane/booth count.
- "medium" = partial visibility or unclear lane count.
- "low" = can't estimate reliably.`

  let msg
  try {
    msg = await client.messages.create({
      model: MODEL,
      max_tokens: 300,
      messages: [
        {
          role: 'user',
          content: [
            { type: 'image', source: { type: 'base64', media_type: imageMediaType, data: imageB64 } },
            { type: 'text', text: prompt },
          ],
        },
      ],
    })
  } catch (err) {
    return emptyResult('anthropic_api_error', { error: String(err) })
  }

  const text = msg.content
    .filter((b) => b.type === 'text')
    .map((b) => ('text' in b ? b.text : ''))
    .join('\n')

  // Parse JSON (strip any accidental code fences or prefix)
  let parsed: Record<string, unknown> | null = null
  try {
    const jsonMatch = text.match(/\{[\s\S]*\}/)
    if (jsonMatch) parsed = JSON.parse(jsonMatch[0])
  } catch { /* fall through */ }

  if (!parsed) return emptyResult('parse_failed', { text })

  const cars = typeof parsed.cars_estimated === 'number' ? parsed.cars_estimated : null
  let mins = typeof parsed.minutes_estimated === 'number' ? parsed.minutes_estimated : null
  if (mins != null) {
    if (mins < 0) mins = 0
    if (mins > 120) mins = 120
  }
  const confRaw = parsed.confidence
  const confidence: 'high' | 'medium' | 'low' =
    confRaw === 'high' || confRaw === 'medium' || confRaw === 'low' ? confRaw : 'low'

  // Pedestrian fields — clamp + validate the same way
  const peds = typeof parsed.pedestrians_estimated === 'number' ? parsed.pedestrians_estimated : null
  let pedMins = typeof parsed.pedestrian_minutes_estimated === 'number' ? parsed.pedestrian_minutes_estimated : null
  if (pedMins != null) {
    if (pedMins < 0) pedMins = 0
    if (pedMins > 120) pedMins = 120
  }
  const pedConfRaw = parsed.pedestrian_confidence
  const pedConfidence: 'high' | 'medium' | 'low' =
    pedConfRaw === 'high' || pedConfRaw === 'medium' || pedConfRaw === 'low' ? pedConfRaw : 'low'
  const pedLanes = typeof parsed.pedestrian_lanes_visible === 'number' && parsed.pedestrian_lanes_visible >= 0
    ? parsed.pedestrian_lanes_visible : null

  return {
    cars_estimated: cars,
    minutes_estimated: mins,
    confidence,
    pedestrians_estimated: peds,
    pedestrian_minutes_estimated: pedMins,
    pedestrian_confidence: pedConfidence,
    pedestrian_lanes_visible: pedLanes,
    raw: parsed,
  }
}
