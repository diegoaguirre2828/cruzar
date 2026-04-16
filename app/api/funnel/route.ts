import { NextRequest, NextResponse } from 'next/server'
import { getServiceClient } from '@/lib/supabase'

// Fire-and-forget funnel event tracking.
// No auth required — anyone can POST an event.
// Rate-limited by Vercel's edge (no app-level throttle needed).

export async function POST(req: NextRequest) {
  try {
    const body = await req.json()
    const { event, page, referrer, sessionId, meta } = body
    if (!event || typeof event !== 'string') {
      return NextResponse.json({ ok: false }, { status: 400 })
    }
    const db = getServiceClient()
    await db.from('funnel_events').insert({
      event,
      page: page || null,
      referrer: referrer || null,
      session_id: sessionId || null,
      meta: meta || {},
    })
    return NextResponse.json({ ok: true })
  } catch {
    return NextResponse.json({ ok: false }, { status: 500 })
  }
}
