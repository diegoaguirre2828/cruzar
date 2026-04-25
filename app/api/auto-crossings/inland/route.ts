import { NextRequest, NextResponse } from 'next/server'
import { createServerClient } from '@supabase/ssr'
import { cookies } from 'next/headers'
import { getServiceClient } from '@/lib/supabase'
import { INLAND_CHECKPOINTS } from '@/lib/inlandCheckpoints'
import { checkRateLimit, keyFromRequest } from '@/lib/ratelimit'

export const dynamic = 'force-dynamic'

// POST /api/auto-crossings/inland
//
// Anonymized inland-checkpoint dwell observation. Same opt-in posture
// as /api/auto-crossings: the user_id is read only to honor the
// auto_geofence_opt_in flag and is then dropped — the row carries
// no contributor identity.

const VALID_ZONES = new Set(INLAND_CHECKPOINTS.map((c) => c.zone))
const VALID_DIRECTIONS = new Set(['northbound', 'southbound'])
const ALLOWED_PLATFORMS = new Set(['ios_native', 'web_mobile', 'web_desktop'])

export async function POST(req: NextRequest) {
  const cookieStore = await cookies()
  const supabase = createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    { cookies: { getAll: () => cookieStore.getAll() } }
  )
  const { data: { user } } = await supabase.auth.getUser()

  const rl = await checkRateLimit(keyFromRequest(req, user?.id), 30, 5)
  if (!rl.ok) {
    return NextResponse.json(
      { error: 'Too many submissions. Slow down.' },
      { status: 429, headers: { 'Retry-After': String(rl.retryAfterSeconds) } },
    )
  }

  let body: { checkpoint_zone?: string; direction?: string; dt_minutes?: number; platform?: string }
  try {
    body = await req.json()
  } catch {
    return NextResponse.json({ error: 'Invalid JSON' }, { status: 400 })
  }

  const zone = (body.checkpoint_zone || '').trim()
  const direction = (body.direction || '').trim()
  const dt = typeof body.dt_minutes === 'number' && Number.isFinite(body.dt_minutes)
    ? Math.round(body.dt_minutes)
    : null
  const platformRaw = typeof body.platform === 'string' ? body.platform.trim().toLowerCase() : ''
  const platform = ALLOWED_PLATFORMS.has(platformRaw) ? platformRaw : null

  if (!VALID_ZONES.has(zone)) {
    return NextResponse.json({ error: 'Unknown checkpoint_zone' }, { status: 400 })
  }
  if (!VALID_DIRECTIONS.has(direction)) {
    return NextResponse.json({ error: 'direction must be northbound or southbound' }, { status: 400 })
  }
  if (dt == null || dt < 1 || dt > 720) {
    return NextResponse.json({ error: 'dt_minutes must be between 1 and 720' }, { status: 400 })
  }

  const db = getServiceClient()

  if (user) {
    const { data: profile } = await db
      .from('profiles')
      .select('auto_geofence_opt_in')
      .eq('id', user.id)
      .maybeSingle()
    if (!profile?.auto_geofence_opt_in) {
      return NextResponse.json(
        { error: 'Auto-crossing detection is off for this profile' },
        { status: 403 },
      )
    }
  }

  const { error } = await db.from('inland_checkpoint_readings').insert({
    checkpoint_zone: zone,
    direction,
    dt_minutes: dt,
    source: 'auto_geofence',
    platform,
  })

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 })
  }

  return NextResponse.json({ ok: true })
}
