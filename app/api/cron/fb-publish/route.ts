import { NextRequest, NextResponse } from 'next/server'
import { createHash } from 'node:crypto'
import { getServiceClient } from '@/lib/supabase'
import { postPhoto, fbPostUrl } from '@/lib/fbGraph'

export const dynamic = 'force-dynamic'
export const maxDuration = 30

// Native Graph API publisher for the Cruzar FB Page.
//
// Replaces the Make.com loop that Diego ran from build → 2026-04-25.
// That loop posted the next-post caption as plain text via Make's FB
// module, which surfaced as "Published by Make" (algo discount) and
// had no image attachment (no media boost). Result: 0 reactions, 0
// shares, 78% follower-only reach across the last 28 days.
//
// This route:
//  1. Calls /api/social/next-post — same dedupe + caption logic as Make
//     was using (MIN_GAP_MINUTES=180, caption_hash collision skip).
//  2. POSTs the caption + a fresh /api/social-image PNG to Graph API
//     /{page-id}/photos. FB sees a photo post → media-boost eligible,
//     publisher is the Page itself → no third-party tag.
//  3. Updates the social_posts row that next-post just inserted with
//     fb_post_id + fb_posted_at so the admin panel can link to the
//     live FB post and surface error rate.
//
// Schedule on cron-job.org: 5:30am, 11:30am, 3:30pm, 7:00pm CT.

const MIN_GAP_MINUTES = 180

function captionHash(caption: string): string {
  // Same hashing rule as /api/social/next-post — strip the timestamp
  // and weekday lines so a caption published at 11:31 vs 11:33 in the
  // same scheduled slot collapses to the same hash. We use this to
  // find the row next-post just inserted and update it in-place.
  const stripped = caption
    .split('\n')
    .filter((line) => !/TIEMPOS EN LOS PUENTES/i.test(line))
    .filter((line) => !/^(Lunes|Martes|Miercoles|Miércoles|Jueves|Viernes|Sabado|Sábado|Domingo)/i.test(line))
    .join('\n')
  return createHash('sha256').update(stripped).digest('hex').slice(0, 16)
}

export async function GET(req: NextRequest) {
  const secret = req.nextUrl.searchParams.get('secret')
  const authHeader = req.headers.get('authorization')
  const isAuthed =
    secret === process.env.CRON_SECRET ||
    authHeader === `Bearer ${process.env.CRON_SECRET}`
  if (!isAuthed) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  const force = req.nextUrl.searchParams.get('force') === '1'
  const apiBase = process.env.NEXT_PUBLIC_APP_URL || 'https://cruzar.app'
  const cronSecret = process.env.CRON_SECRET!

  // Step 1: get the caption (and have next-post insert the social_posts row).
  // force=1 propagates so manual admin "Fire Now" can bypass the dedupe.
  const nextPostUrl = `${apiBase}/api/social/next-post?secret=${encodeURIComponent(cronSecret)}${force ? '&force=1' : ''}`
  let nextPost: { caption?: string; imageUrl?: string; landingUrl?: string; skip?: boolean; reason?: string } = {}
  try {
    const res = await fetch(nextPostUrl, { cache: 'no-store' })
    nextPost = await res.json()
  } catch (err) {
    return NextResponse.json({ ok: false, stage: 'next-post-fetch', error: String(err) }, { status: 502 })
  }

  if (nextPost.skip) {
    return NextResponse.json({ ok: true, skipped: true, reason: nextPost.reason || 'recent_post_exists' })
  }
  if (!nextPost.caption) {
    return NextResponse.json({ ok: false, stage: 'caption-empty' }, { status: 502 })
  }

  // Step 2: validate FB env. If missing, log to the row and return —
  // captions still generate so admin can see what *would* have posted.
  const pageId = process.env.FACEBOOK_PAGE_ID
  const pageToken = process.env.FACEBOOK_PAGE_ACCESS_TOKEN
  if (!pageId || !pageToken) {
    const db = getServiceClient()
    const hash = captionHash(nextPost.caption)
    await db.from('social_posts')
      .update({ fb_post_error: 'FB_ENV_MISSING', image_kind: 'social-image' })
      .eq('caption_hash', hash)
      .is('fb_post_id', null)
    return NextResponse.json({
      ok: false,
      stage: 'env',
      error: 'FACEBOOK_PAGE_ID or FACEBOOK_PAGE_ACCESS_TOKEN missing in production env',
      captionPreview: nextPost.caption.slice(0, 120),
    }, { status: 412 })
  }

  // Step 3: build a unique image URL per post so Graph API always pulls
  // a fresh PNG (cache-busted by ts). We use a 1080×1350 portrait card
  // rendered by /api/social-image — that's what FB uploads as the
  // photo asset for this post.
  const ts = Date.now()
  const imageUrl = `${apiBase}/api/social-image?ts=${ts}`

  // Step 4: post to Graph API.
  const fb = await postPhoto({
    pageId,
    accessToken: pageToken,
    imageUrl,
    caption: nextPost.caption,
  })

  // Step 5: write back to the social_posts row that next-post inserted.
  const db = getServiceClient()
  const hash = captionHash(nextPost.caption)
  if (fb.ok) {
    await db.from('social_posts')
      .update({
        fb_post_id: fb.postId || null,
        fb_posted_at: new Date().toISOString(),
        fb_post_error: null,
        image_kind: 'social-image',
        image_url: imageUrl,
      })
      .eq('caption_hash', hash)
      .is('fb_post_id', null)
    return NextResponse.json({
      ok: true,
      posted: true,
      fbPostId: fb.postId,
      fbPostUrl: fb.postId ? fbPostUrl(fb.postId) : null,
    })
  }

  // Failure path — record the error so the admin panel surfaces it.
  await db.from('social_posts')
    .update({
      fb_post_error: fb.error || `HTTP ${fb.rawStatus}`,
      image_kind: 'social-image',
      image_url: imageUrl,
    })
    .eq('caption_hash', hash)
    .is('fb_post_id', null)
  return NextResponse.json({
    ok: false,
    stage: 'graph-api',
    error: fb.error,
    rawStatus: fb.rawStatus,
    rawBody: fb.rawBody,
  }, { status: 502 })
}
