import { NextRequest, NextResponse } from 'next/server'
import { getServiceClient } from '@/lib/supabase'
import { extractFeatures, VISION_MODEL_VERSION } from '@/lib/photoVision'

export const dynamic = 'force-dynamic'

// Cleanup cron — hard-deletes expired port photos from BOTH storage
// and the port_photos table. Runs every 30 minutes via cron-job.org.
//
// Why hard delete:
//   - 2-hour freshness contract (project_cruzar_camera_v2_20260414.md)
//     is the strongest anti-mess rule we have. If anything slips
//     through moderation, it's gone within 2 hours.
//   - Supabase free-tier storage is 1GB. At ~200KB per photo that's
//     5000 photos max. Without cleanup the bucket fills up fast.
//
// Protection: requires ?secret=CRON_SECRET query param, matching
// the pattern used by every other cron route in the app.

export async function GET(req: NextRequest) {
  const secret = req.nextUrl.searchParams.get('secret')
  if (secret !== process.env.CRON_SECRET) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  const db = getServiceClient()
  const now = new Date().toISOString()

  // Find expired rows where the storage blob hasn't been deleted yet.
  // We don't want to re-process rows whose photo_deleted_at is already
  // stamped (that would mean we already processed them).
  //
  // Batched to 100 per run so a backlog + safety-net Vision extractions
  // can't exceed Vercel's serverless time budget in one shot.
  const { data: expired, error: fetchError } = await db
    .from('port_photos')
    .select('id, storage_path, vision_extracted_at, port_id')
    .lt('expires_at', now)
    .is('photo_deleted_at', null)
    .limit(100)

  if (fetchError) {
    console.error('cleanup-port-photos fetch failed:', fetchError)
    return NextResponse.json({ error: fetchError.message }, { status: 500 })
  }

  const rows = expired || []
  if (rows.length === 0) {
    return NextResponse.json({ ok: true, removed: 0 })
  }

  // ── Safety-net Vision extraction ──
  // If the submit-time extraction failed (network hiccup, Anthropic
  // transient 500, etc.), vision_extracted_at will be null. Run the
  // extraction NOW, before the blob disappears — this is our last
  // chance to capture the feature data. Metadata moat rule: no row
  // leaves this table without its vision_features bag populated if
  // the blob was ever actually fetchable.
  let safetyNetExtracted = 0
  let safetyNetFailed = 0
  for (const row of rows) {
    if (row.vision_extracted_at) continue
    try {
      const { data: urlData } = db.storage.from('port-photos').getPublicUrl(row.storage_path)
      const result = await extractFeatures(urlData.publicUrl)
      if (result.features) {
        await db
          .from('port_photos')
          .update({
            vision_features: result.features,
            vision_extracted_at: new Date().toISOString(),
            vision_model: VISION_MODEL_VERSION,
          })
          .eq('id', row.id)
        safetyNetExtracted++
      } else {
        safetyNetFailed++
        console.warn(`Safety-net extraction failed for ${row.id}: ${result.error}`)
      }
    } catch (err) {
      safetyNetFailed++
      console.warn(`Safety-net extraction threw for ${row.id}:`, err)
    }
  }

  // ── Delete storage blobs ──
  const paths = rows.map((r) => r.storage_path)
  const { error: storageError } = await db.storage.from('port-photos').remove(paths)
  if (storageError) {
    console.error('cleanup-port-photos storage remove failed:', storageError)
    // Continue anyway — the row update below is still valuable.
  }

  // ── Stamp photo_deleted_at + null out storage_path ──
  // The metadata row STAYS (retention rule). Only the blob reference
  // dies. Vision features + perceptual hash + GPS + everything else
  // survives indefinitely.
  const ids = rows.map((r) => r.id)
  const { error: updateError } = await db
    .from('port_photos')
    .update({
      photo_deleted_at: now,
      storage_path: '',
    })
    .in('id', ids)

  if (updateError) {
    console.error('cleanup-port-photos update failed:', updateError)
    return NextResponse.json({ error: updateError.message }, { status: 500 })
  }

  return NextResponse.json({
    ok: true,
    processed: rows.length,
    safety_net_extracted: safetyNetExtracted,
    safety_net_failed: safetyNetFailed,
    at: now,
  })
}
