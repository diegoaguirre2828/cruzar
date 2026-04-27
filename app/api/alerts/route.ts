import { NextRequest, NextResponse } from 'next/server'
import { createServerClient } from '@supabase/ssr'
import { cookies } from 'next/headers'
import { getServiceClient } from '@/lib/supabase'

async function serverClient() {
  const cookieStore = await cookies()
  return createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    { cookies: { getAll: () => cookieStore.getAll() } }
  )
}

async function getUserTier(userId: string): Promise<string> {
  const db = getServiceClient()
  const { data } = await db.from('profiles').select('tier').eq('id', userId).single()
  return data?.tier || 'free'
}

export async function GET() {
  const supabase = await serverClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const { data } = await supabase
    .from('alert_preferences')
    .select('*')
    .eq('user_id', user.id)
    .order('created_at', { ascending: false })

  return NextResponse.json({ alerts: data || [] })
}

export async function POST(req: NextRequest) {
  const supabase = await serverClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const tier = await getUserTier(user.id)
  if (!['free', 'pro', 'business'].includes(tier)) {
    return NextResponse.json({ error: 'Account required' }, { status: 403 })
  }

  // Per-account alert caps. Defense-in-depth against Twilio/Resend
  // financial-DoS — replaces the install-age gate that was removed
  // from claim-pwa-pro on 2026-04-26. Generous limits for legit users
  // (most carry 1-3 alerts), tight enough that a malicious account
  // can't fan out hundreds of phones.
  //
  //   free:     1   (existing)
  //   pro:      20
  //   business: 100
  const ALERT_CAPS: Record<string, number> = { free: 1, pro: 20, business: 100 }
  const cap = ALERT_CAPS[tier] ?? 1
  const db = getServiceClient()
  const { count } = await db
    .from('alert_preferences')
    .select('*', { count: 'exact', head: true })
    .eq('user_id', user.id)
  if ((count ?? 0) >= cap) {
    return NextResponse.json(
      { error: tier === 'free' ? 'free_limit' : 'tier_limit', cap, current: count ?? 0 },
      { status: 403 },
    )
  }

  const { portId, laneType, thresholdMinutes, staffingDropEnabled } = await req.json()
  if (!portId) return NextResponse.json({ error: 'portId required' }, { status: 400 })
  if (!thresholdMinutes || thresholdMinutes < 5 || thresholdMinutes > 180) {
    return NextResponse.json({ error: 'thresholdMinutes must be between 5 and 180' }, { status: 400 })
  }
  const { error } = await supabase.from('alert_preferences').insert({
    user_id: user.id,
    port_id: portId,
    lane_type: laneType || 'vehicle',
    threshold_minutes: thresholdMinutes,
    staffing_drop_enabled: staffingDropEnabled === true,
  })

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json({ success: true })
}

export async function DELETE(req: NextRequest) {
  const supabase = await serverClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const id = req.nextUrl.searchParams.get('id')
  const { error } = await supabase
    .from('alert_preferences')
    .delete()
    .eq('id', id)
    .eq('user_id', user.id)

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json({ success: true })
}
