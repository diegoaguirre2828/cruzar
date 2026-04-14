import { NextRequest, NextResponse } from 'next/server'
import { createServerClient } from '@supabase/ssr'
import { cookies } from 'next/headers'
import { getServiceClient } from '@/lib/supabase'
import { haversineKm, classifyDistance } from '@/lib/geo'
import { getPortMeta } from '@/lib/portMeta'
import { extractFeatures, computeDhash, dhashToSignedBigint, VISION_MODEL_VERSION } from '@/lib/photoVision'

export const dynamic = 'force-dynamic'

// Community-submitted bridge photos.
//
// GET  /api/port-photos?portId=X  → list live non-expired photos
// POST /api/port-photos           → submit a new photo
//
// Anti-mess rules enforced here:
//   - Auth required on POST
//   - GPS must resolve to 'near' (within ~1km) of the port at submit time
//   - Rate limit: max 3 photos per user per 15 minutes
//   - Photo size: 5MB max (raw base64 under ~6.7MB after encoding overhead)
//   - Caption: 140 chars max, stripped of URLs
//   - 2-hour expiry hardcoded on every row

const PHOTO_TTL_HOURS = 2
const MAX_CAPTION_LEN = 140
const MAX_PHOTO_BYTES = 5 * 1024 * 1024 // 5MB
const USER_RATE_LIMIT = 3
const USER_RATE_WINDOW_MIN = 15

async function getAuthedUser() {
  const cookieStore = await cookies()
  const supabase = createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    { cookies: { getAll: () => cookieStore.getAll() } },
  )
  const { data: { user } } = await supabase.auth.getUser()
  return user
}

// ────────────────────────────────────────────────────────────
// GET — list live photos for a port
// ────────────────────────────────────────────────────────────
export async function GET(req: NextRequest) {
  const portId = req.nextUrl.searchParams.get('portId')
  if (!portId) {
    return NextResponse.json({ error: 'portId required' }, { status: 400 })
  }

  const db = getServiceClient()
  const { data, error } = await db
    .from('port_photos')
    .select('id, user_id, port_id, storage_path, caption, created_at, expires_at, report_count')
    .eq('port_id', portId)
    .eq('moderation_status', 'live')
    .gt('expires_at', new Date().toISOString())
    .is('photo_deleted_at', null)
    .order('created_at', { ascending: false })
    .limit(5)

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 })
  }

  // Resolve reporter display names for attribution. Small N (≤5) so a
  // single roundtrip is cheap.
  const userIds = [...new Set((data || []).map((p) => p.user_id))]
  const { data: profiles } = userIds.length > 0
    ? await db.from('profiles').select('id, display_name').in('id', userIds)
    : { data: [] }
  const nameById: Record<string, string> = {}
  for (const p of (profiles || [])) {
    if (p.display_name) nameById[p.id] = p.display_name
  }

  // Resolve storage public URLs
  const photos = (data || []).map((p) => {
    const { data: urlData } = db.storage.from('port-photos').getPublicUrl(p.storage_path)
    return {
      id: p.id,
      port_id: p.port_id,
      url: urlData.publicUrl,
      caption: p.caption,
      created_at: p.created_at,
      expires_at: p.expires_at,
      report_count: p.report_count,
      display_name: nameById[p.user_id] || null,
    }
  })

  return NextResponse.json(
    { photos },
    { headers: { 'Cache-Control': 'public, s-maxage=30, stale-while-revalidate=90' } },
  )
}

// ────────────────────────────────────────────────────────────
// POST — submit a new photo
// ────────────────────────────────────────────────────────────
interface PostBody {
  portId?: string
  base64Image?: string
  caption?: string
  lat?: number
  lng?: number
}

export async function POST(req: NextRequest) {
  const user = await getAuthedUser()
  if (!user) {
    return NextResponse.json({ error: 'Sign in to submit photos' }, { status: 401 })
  }

  let body: PostBody
  try {
    body = await req.json()
  } catch {
    return NextResponse.json({ error: 'Invalid JSON' }, { status: 400 })
  }

  const { portId, base64Image, caption, lat, lng } = body

  if (!portId || typeof portId !== 'string') {
    return NextResponse.json({ error: 'portId required' }, { status: 400 })
  }
  if (!base64Image || typeof base64Image !== 'string') {
    return NextResponse.json({ error: 'base64Image required' }, { status: 400 })
  }
  if (typeof lat !== 'number' || typeof lng !== 'number' || !Number.isFinite(lat) || !Number.isFinite(lng)) {
    return NextResponse.json({ error: 'GPS coordinates required (lat, lng)' }, { status: 400 })
  }

  // ── Geofence gate: the user must physically be at the bridge ──
  const meta = getPortMeta(portId)
  if (!meta?.lat || !meta?.lng) {
    return NextResponse.json({ error: 'Unknown portId' }, { status: 400 })
  }
  const distKm = haversineKm(lat, lng, meta.lat, meta.lng)
  const confidence = classifyDistance(distKm)
  if (confidence !== 'near') {
    return NextResponse.json(
      {
        error: 'Too far from the bridge to submit a photo',
        distance_km: Math.round(distKm * 10) / 10,
        location_confidence: confidence,
      },
      { status: 403 },
    )
  }

  // ── Image size sanity check ──
  // base64 adds ~33% overhead, so 5MB raw ≈ 6.7MB encoded.
  const dataUrlMatch = base64Image.match(/^data:(image\/[a-z+]+);base64,(.+)$/i)
  if (!dataUrlMatch) {
    return NextResponse.json({ error: 'Expected data URL (data:image/...;base64,...)' }, { status: 400 })
  }
  const mimeType = dataUrlMatch[1].toLowerCase()
  const base64Payload = dataUrlMatch[2]
  if (!['image/jpeg', 'image/jpg', 'image/png', 'image/webp'].includes(mimeType)) {
    return NextResponse.json({ error: 'Only JPEG, PNG, or WebP images allowed' }, { status: 400 })
  }
  // Approximate raw byte size from base64 length
  const approxBytes = Math.floor((base64Payload.length * 3) / 4)
  if (approxBytes > MAX_PHOTO_BYTES) {
    return NextResponse.json({ error: 'Photo too large (max 5MB)' }, { status: 413 })
  }

  const db = getServiceClient()

  // ── Per-user rate limit ──
  const windowStart = new Date(Date.now() - USER_RATE_WINDOW_MIN * 60 * 1000).toISOString()
  const { count: recentCount } = await db
    .from('port_photos')
    .select('id', { count: 'exact', head: true })
    .eq('user_id', user.id)
    .gte('created_at', windowStart)
  if ((recentCount ?? 0) >= USER_RATE_LIMIT) {
    return NextResponse.json(
      { error: `Rate limit: max ${USER_RATE_LIMIT} photos per ${USER_RATE_WINDOW_MIN} minutes` },
      { status: 429 },
    )
  }

  // ── Sanitize caption ──
  let cleanCaption: string | null = null
  if (caption && typeof caption === 'string') {
    // Strip URLs (photos are for images, not links) + trim + cap length
    const stripped = caption.replace(/\bhttps?:\/\/\S+/gi, '').trim().slice(0, MAX_CAPTION_LEN)
    cleanCaption = stripped || null
  }

  // ── Upload to storage ──
  const ext = mimeType === 'image/png' ? 'png' : mimeType === 'image/webp' ? 'webp' : 'jpg'
  const storagePath = `${portId}/${user.id}/${Date.now()}.${ext}`
  const photoBuffer = Buffer.from(base64Payload, 'base64')

  const { error: uploadError } = await db.storage
    .from('port-photos')
    .upload(storagePath, photoBuffer, {
      contentType: mimeType,
      upsert: false,
    })
  if (uploadError) {
    console.error('port-photos upload failed:', uploadError)
    return NextResponse.json({ error: `Upload failed: ${uploadError.message}` }, { status: 500 })
  }

  // ── Vision extraction at submit time (metadata moat) ──
  // Extract structured features BEFORE creating the DB row. The NSFW
  // flag doubles as the moderation gate — if Claude Vision detects
  // inappropriate content, we reject the submission and delete the
  // just-uploaded blob. Perceptual hash is computed in parallel for
  // clustering/dedupe in future analytics work.
  //
  // Cost: ~$0.001 per image. Diego handles the bill
  // (feedback_no_complexity_budgeting.md).
  const [visionResult, dhashResult] = await Promise.all([
    extractFeatures(base64Image),
    computeDhash(photoBuffer),
  ])

  // Moderation gate — NSFW OR low confidence that this is even a
  // border photo (meme/selfie/food/etc.) gets rejected.
  if (visionResult.features?.flag_nsfw === true) {
    await db.storage.from('port-photos').remove([storagePath]).catch(() => {})
    return NextResponse.json(
      { error: 'Photo rejected by moderation' },
      { status: 422 },
    )
  }
  if (visionResult.features && visionResult.features.confidence_score < 0.3) {
    await db.storage.from('port-photos').remove([storagePath]).catch(() => {})
    return NextResponse.json(
      { error: 'Photo does not appear to be a border crossing — try again' },
      { status: 422 },
    )
  }

  // ── Create DB row (metadata preserved indefinitely) ──
  const expiresAt = new Date(Date.now() + PHOTO_TTL_HOURS * 60 * 60 * 1000).toISOString()
  const perceptualHash = dhashResult != null ? dhashToSignedBigint(dhashResult).toString() : null

  const { data: inserted, error: insertError } = await db.from('port_photos').insert({
    user_id: user.id,
    port_id: portId,
    storage_path: storagePath,
    caption: cleanCaption,
    gps_lat: lat,
    gps_lng: lng,
    location_confidence: confidence,
    expires_at: expiresAt,
    moderation_status: 'live',
    // Metadata moat: these stay after the blob is deleted
    perceptual_hash: perceptualHash,
    vision_features: visionResult.features,
    vision_extracted_at: visionResult.features ? new Date().toISOString() : null,
    vision_model: visionResult.features ? VISION_MODEL_VERSION : null,
  }).select('id').single()

  if (insertError) {
    // Rollback: best-effort delete the uploaded file so we don't leak
    // orphan storage objects.
    await db.storage.from('port-photos').remove([storagePath]).catch(() => {})
    console.error('port-photos insert failed:', insertError)
    return NextResponse.json({ error: `Insert failed: ${insertError.message}` }, { status: 500 })
  }

  return NextResponse.json({
    ok: true,
    id: inserted?.id,
    expires_at: expiresAt,
    vision_captured: !!visionResult.features,
  })
}
