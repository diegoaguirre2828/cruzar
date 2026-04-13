import { NextRequest, NextResponse } from 'next/server'
import { createServerClient } from '@supabase/ssr'
import { cookies } from 'next/headers'
import { getServiceClient } from '@/lib/supabase'

// Generic event ingest endpoint. Accepts POST { event_name, props,
// session_id } from the client and writes to app_events. Looks up
// the current auth user if available so events can be attributed.
// Rate-limited by IP + user to prevent runaway writes.
//
// Kept intentionally thin — no validation beyond event_name being
// a non-empty string and short. The whole point is to collect
// everything cheaply; we clean / aggregate at read time.

const MAX_EVENT_NAME_LEN = 60
const MAX_PROPS_BYTES = 2000

// Simple in-memory throttle. Not ideal for serverless but the
// downside (a few duplicate events surviving a cold start) is
// cheaper than adding a Redis dependency.
const rateLimit = new Map<string, { count: number; resetAt: number }>()
function allow(key: string, max = 120): boolean {
  const now = Date.now()
  const entry = rateLimit.get(key)
  if (!entry || now > entry.resetAt) {
    rateLimit.set(key, { count: 1, resetAt: now + 60 * 60 * 1000 })
    return true
  }
  if (entry.count >= max) return false
  entry.count++
  return true
}

export async function POST(req: NextRequest) {
  let body: { event_name?: string; props?: Record<string, unknown>; session_id?: string }
  try {
    body = await req.json()
  } catch {
    return NextResponse.json({ error: 'Invalid JSON' }, { status: 400 })
  }

  const eventName = typeof body.event_name === 'string' ? body.event_name.trim() : ''
  if (!eventName || eventName.length > MAX_EVENT_NAME_LEN) {
    return NextResponse.json({ error: 'Invalid event_name' }, { status: 400 })
  }

  // Props size cap — keep the write cheap.
  let props: Record<string, unknown> | null = null
  if (body.props && typeof body.props === 'object') {
    const serialized = JSON.stringify(body.props)
    if (serialized.length <= MAX_PROPS_BYTES) {
      props = body.props
    }
  }

  const sessionId = typeof body.session_id === 'string' ? body.session_id.slice(0, 64) : null

  const ip = req.headers.get('x-forwarded-for')?.split(',')[0] || 'unknown'

  // Resolve the signed-in user if any. Failure is fine — anon events
  // are a first-class use case here.
  const cookieStore = await cookies()
  const supabase = createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    { cookies: { getAll: () => cookieStore.getAll() } },
  )
  const { data: { user } } = await supabase.auth.getUser()

  const key = user ? `u:${user.id}` : `ip:${ip}`
  if (!allow(key)) {
    return NextResponse.json({ ok: false, rate_limited: true }, { status: 429 })
  }

  const db = getServiceClient()
  await db.from('app_events').insert({
    event_name: eventName,
    props,
    session_id: sessionId,
    user_id: user?.id || null,
  }).then(() => {}, () => {})

  return NextResponse.json({ ok: true })
}
