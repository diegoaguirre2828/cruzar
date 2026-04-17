import { NextRequest, NextResponse } from 'next/server'
import { getServiceClient } from '@/lib/supabase'
import { keyFromRequest, checkRateLimit } from '@/lib/ratelimit'

// Fire-and-forget funnel event tracking.
// No auth required — anyone can POST an event.
//
// Previously the comment claimed "rate-limited by Vercel's edge" but
// Vercel does not throttle POSTs to your own routes by default. The
// endpoint was genuinely unguarded — an adversarial client could
// flood funnel_events and bloat the table forever. App-level rate
// limit added: 300 events/hour per IP (generous for organic use),
// 60/min burst (covers rapid-fire page-transition + click-tracking
// + autosave events during normal interaction).
//
// String-length caps on event / page / referrer / session_id because
// an attacker could still stuff huge payloads in allowed fields. DB
// will also enforce at insert, but defense-in-depth beats depending
// on it.

export async function POST(req: NextRequest) {
  try {
    const rl = checkRateLimit(keyFromRequest(req), 300, 60)
    if (!rl.ok) {
      return NextResponse.json(
        { ok: false, error: 'rate_limited' },
        { status: 429, headers: { 'Retry-After': String(rl.retryAfterSeconds) } },
      )
    }

    const body = await req.json()
    const { event, page, referrer, sessionId, meta } = body
    if (!event || typeof event !== 'string') {
      return NextResponse.json({ ok: false }, { status: 400 })
    }

    const safeEvent = event.slice(0, 100)
    const safePage = typeof page === 'string' ? page.slice(0, 500) : null
    const safeReferrer = typeof referrer === 'string' ? referrer.slice(0, 500) : null
    const safeSessionId = typeof sessionId === 'string' ? sessionId.slice(0, 100) : null

    const db = getServiceClient()
    await db.from('funnel_events').insert({
      event: safeEvent,
      page: safePage,
      referrer: safeReferrer,
      session_id: safeSessionId,
      meta: meta || {},
    })
    return NextResponse.json({ ok: true })
  } catch {
    return NextResponse.json({ ok: false }, { status: 500 })
  }
}
