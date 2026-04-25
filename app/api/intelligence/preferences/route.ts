import { NextRequest, NextResponse } from 'next/server'
import { createServerClient } from '@supabase/ssr'
import { cookies } from 'next/headers'
import { getServiceClient } from '@/lib/supabase'

export const dynamic = 'force-dynamic'

// GET / POST /api/intelligence/preferences
//
// Subscriber-level alert preferences. GET returns the current row
// (creating defaults if missing). POST upserts the user's settings.

const VALID_IMPACTS = new Set(['cartel','protest','vucem','tariff','weather','infra','policy','other'])

async function getSubscriberId(userId: string) {
  const db = getServiceClient()
  const { data } = await db
    .from('intel_subscribers')
    .select('id, tier, active')
    .eq('user_id', userId)
    .maybeSingle()
  return data
}

export async function GET() {
  const cookieStore = await cookies()
  const supabase = createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    { cookies: { getAll: () => cookieStore.getAll() } }
  )
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Sign in.' }, { status: 401 })

  const sub = await getSubscriberId(user.id)
  if (!sub) return NextResponse.json({ subscribed: false })

  const db = getServiceClient()
  const { data: prefs } = await db
    .from('intel_alert_preferences')
    .select('impacts, corridors, min_score, quiet_hour_start, quiet_hour_end, updated_at')
    .eq('subscriber_id', sub.id)
    .maybeSingle()

  return NextResponse.json({
    subscribed: true,
    tier: sub.tier,
    active: sub.active,
    preferences: prefs || {
      impacts: ['cartel','protest','vucem','tariff','infra','policy'],
      corridors: [],
      min_score: 60,
      quiet_hour_start: null,
      quiet_hour_end: null,
    },
  })
}

export async function POST(req: NextRequest) {
  const cookieStore = await cookies()
  const supabase = createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    { cookies: { getAll: () => cookieStore.getAll() } }
  )
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Sign in.' }, { status: 401 })

  const sub = await getSubscriberId(user.id)
  if (!sub) return NextResponse.json({ error: 'No active Cruzar Intelligence subscription on this account.' }, { status: 403 })

  let body: { impacts?: string[]; corridors?: string[]; min_score?: number; quiet_hour_start?: number | null; quiet_hour_end?: number | null }
  try { body = await req.json() } catch { return NextResponse.json({ error: 'Invalid JSON' }, { status: 400 }) }

  const impacts = Array.isArray(body.impacts)
    ? body.impacts.filter((i): i is string => typeof i === 'string' && VALID_IMPACTS.has(i))
    : ['cartel','protest','vucem','tariff','infra','policy']
  const corridors = Array.isArray(body.corridors)
    ? body.corridors.filter((c): c is string => typeof c === 'string' && c.length < 64)
    : []
  const minScore = typeof body.min_score === 'number' && body.min_score >= 0 && body.min_score <= 100
    ? Math.round(body.min_score)
    : 60
  const qStart = typeof body.quiet_hour_start === 'number' && body.quiet_hour_start >= 0 && body.quiet_hour_start <= 23
    ? Math.round(body.quiet_hour_start)
    : null
  const qEnd = typeof body.quiet_hour_end === 'number' && body.quiet_hour_end >= 0 && body.quiet_hour_end <= 23
    ? Math.round(body.quiet_hour_end)
    : null

  const db = getServiceClient()
  const { error } = await db.from('intel_alert_preferences').upsert({
    subscriber_id: sub.id,
    impacts,
    corridors,
    min_score: minScore,
    quiet_hour_start: qStart,
    quiet_hour_end: qEnd,
    updated_at: new Date().toISOString(),
  }, { onConflict: 'subscriber_id' })

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json({ ok: true })
}
