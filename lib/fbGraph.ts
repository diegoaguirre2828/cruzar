// Facebook Graph API client for the Cruzar FB Page publisher.
//
// Why this exists: until 2026-04-25 the page was published to via
// Make.com, which (a) tagged every post "Published by Make" (algo
// discount), and (b) sent text-only posts (no media boost). This
// client lets /api/cron/fb-publish post natively as the Page using a
// long-lived Page Access Token, attaching a live image (from
// /api/social-image) so FB sees a photo post.
//
// Token: a long-lived Page Access Token generated via Meta Developer
// Portal → Tools → Graph API Explorer → "Page" dropdown → Long-Lived
// User Token → exchange for a Page token. Lives ~60 days; refresh
// process is on the admin /admin/fb panel.

const GRAPH_VERSION = 'v21.0'

export interface PostPhotoArgs {
  pageId: string
  accessToken: string
  imageUrl: string
  caption: string
  // FB will publish immediately if true; if false the photo is uploaded
  // unpublished and an explicit /feed post can attach the photo. We
  // always publish in one shot for the cron use case.
  published?: boolean
}

export interface PostPhotoResult {
  ok: boolean
  // Composite "{pageId}_{postId}" — the canonical FB post id used in
  // the public URL https://facebook.com/{fb_post_id}.
  postId?: string
  // Just the photo asset id, kept for completeness in case we ever
  // need /photos/{id}/insights (different endpoint than post insights).
  photoId?: string
  error?: string
  rawStatus?: number
  // Captured for debugging when error is set; omitted on success to
  // keep the row narrow.
  rawBody?: string
}

export async function postPhoto(args: PostPhotoArgs): Promise<PostPhotoResult> {
  const { pageId, accessToken, imageUrl, caption, published = true } = args

  // POST /{page-id}/photos with form-encoded body. Graph rejects JSON
  // here for /photos — the `url` parameter MUST be a form field even
  // though it's a string, otherwise FB returns "(#100) param url must
  // be a valid URL".
  const body = new URLSearchParams()
  body.set('url', imageUrl)
  body.set('caption', caption)
  body.set('published', published ? 'true' : 'false')
  body.set('access_token', accessToken)

  const endpoint = `https://graph.facebook.com/${GRAPH_VERSION}/${pageId}/photos`

  const res = await fetch(endpoint, { method: 'POST', body })
  const text = await res.text()

  let parsed: { id?: string; post_id?: string; error?: { message?: string } } = {}
  try { parsed = JSON.parse(text) } catch { /* keep as text */ }

  if (!res.ok || parsed.error) {
    return {
      ok: false,
      error: parsed.error?.message || `HTTP ${res.status}`,
      rawStatus: res.status,
      rawBody: text.slice(0, 500),
    }
  }

  // Graph's /photos response is `{ id, post_id }` when published=true.
  // post_id is what we want for the public URL; id is the photo asset.
  return {
    ok: true,
    postId: parsed.post_id,
    photoId: parsed.id,
  }
}

export interface PageInsightsArgs {
  pageId: string
  accessToken: string
  postId: string
}

export interface PageInsightsResult {
  ok: boolean
  impressions?: number
  reach?: number
  reactions?: number
  error?: string
}

// Optional: pull insights for an already-posted FB post id. Used by
// the admin panel for "did this post earn reach?" — not by the cron.
export async function getPostInsights(args: PageInsightsArgs): Promise<PageInsightsResult> {
  const { accessToken, postId } = args
  const metrics = 'post_impressions,post_impressions_unique,post_reactions_by_type_total'
  const url = `https://graph.facebook.com/${GRAPH_VERSION}/${postId}/insights?metric=${metrics}&access_token=${encodeURIComponent(accessToken)}`
  const res = await fetch(url)
  const text = await res.text()
  let parsed: { data?: Array<{ name: string; values: Array<{ value: unknown }> }>; error?: { message?: string } } = {}
  try { parsed = JSON.parse(text) } catch { /* keep as text */ }

  if (!res.ok || parsed.error) {
    return { ok: false, error: parsed.error?.message || `HTTP ${res.status}` }
  }

  const out: PageInsightsResult = { ok: true }
  for (const row of parsed.data || []) {
    const v = row.values?.[0]?.value
    if (row.name === 'post_impressions' && typeof v === 'number') out.impressions = v
    if (row.name === 'post_impressions_unique' && typeof v === 'number') out.reach = v
    if (row.name === 'post_reactions_by_type_total' && v && typeof v === 'object') {
      out.reactions = Object.values(v as Record<string, number>).reduce((a, b) => a + (b || 0), 0)
    }
  }
  return out
}

// Helper: derive the public FB URL for a post given its composite id.
export function fbPostUrl(postId: string): string {
  return `https://www.facebook.com/${postId}`
}
