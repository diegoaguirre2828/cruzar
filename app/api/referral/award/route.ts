import { NextRequest, NextResponse } from 'next/server'
import { createServerClient } from '@supabase/ssr'
import { cookies } from 'next/headers'
import { getServiceClient } from '@/lib/supabase'
import { POINTS } from '@/lib/points'

export async function POST(req: NextRequest) {
  const cookieStore = await cookies()
  const supabase = createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    { cookies: { getAll: () => cookieStore.getAll() } }
  )
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const { referrerId, eventType, portId } = await req.json()

  if (!referrerId || !eventType) {
    return NextResponse.json({ error: 'referrerId and eventType required' }, { status: 400 })
  }
  if (!['signup', 'report'].includes(eventType)) {
    return NextResponse.json({ error: 'Invalid eventType' }, { status: 400 })
  }
  // Can't refer yourself
  if (referrerId === user.id) {
    return NextResponse.json({ ok: false, reason: 'self-referral' })
  }

  const db = getServiceClient()

  // Check referrer profile exists
  const { data: referrerProfile } = await db
    .from('profiles')
    .select('id, points')
    .eq('id', referrerId)
    .single()

  if (!referrerProfile) {
    return NextResponse.json({ ok: false, reason: 'referrer not found' })
  }

  // Check for duplicate — unique constraint on (referrer_id, referred_user_id, event_type)
  const { data: existing } = await db
    .from('referral_events')
    .select('id')
    .eq('referrer_id', referrerId)
    .eq('referred_user_id', user.id)
    .eq('event_type', eventType)
    .maybeSingle()

  if (existing) {
    return NextResponse.json({ ok: false, reason: 'already awarded' })
  }

  const pts = eventType === 'signup' ? POINTS.referral_signup : POINTS.referral_report

  // Award points to referrer
  await db
    .from('profiles')
    .update({ points: (referrerProfile.points || 0) + pts })
    .eq('id', referrerId)

  // Record the event
  await db.from('referral_events').insert({
    referrer_id: referrerId,
    referred_user_id: user.id,
    event_type: eventType,
    port_id: portId || null,
    points_awarded: pts,
  })

  return NextResponse.json({ ok: true, pointsAwarded: pts })
}
