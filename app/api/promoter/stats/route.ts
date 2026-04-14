import { NextResponse } from 'next/server'
import { createServerClient } from '@supabase/ssr'
import { cookies } from 'next/headers'
import { getServiceClient } from '@/lib/supabase'

export const dynamic = 'force-dynamic'

// Promoter stats dashboard data.
//
// Returns, for the authenticated promoter:
//   - total unique visits attributed to their ref link (from app_events
//     where event_name = 'ref_visit' + ref prop matches their id)
//   - total signups attributed (from profiles where referred_by = them
//     OR from referral_events with event_type = 'signup')
//   - total attributed reports (from referral_events event_type = 'report')
//   - total shares logged (from promoter_share events in app_events)
//   - recent activity timeline (last 20 events)
//
// Only callable by users whose profile.is_promoter = true OR admin email.
// Non-promoters get 403.

const ADMIN_EMAIL = 'cruzabusiness@gmail.com'

async function getUser() {
  const cookieStore = await cookies()
  const supabase = createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    { cookies: { getAll: () => cookieStore.getAll() } }
  )
  const { data: { user } } = await supabase.auth.getUser()
  return user
}

export async function GET() {
  const user = await getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const db = getServiceClient()

  // Gate: must be promoter OR admin
  const { data: profile } = await db
    .from('profiles')
    .select('is_promoter, display_name')
    .eq('id', user.id)
    .single()

  const isAdmin = user.email === ADMIN_EMAIL
  if (!isAdmin && !profile?.is_promoter) {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
  }

  // Attributed signups — count of referral_events with this user as referrer
  const { count: signupsCount } = await db
    .from('referral_events')
    .select('id', { count: 'exact', head: true })
    .eq('referrer_id', user.id)
    .eq('event_type', 'signup')

  // Attributed reports
  const { count: reportsCount } = await db
    .from('referral_events')
    .select('id', { count: 'exact', head: true })
    .eq('referrer_id', user.id)
    .eq('event_type', 'report')

  // Shares logged — pulled from app_events where event_name = 'promoter_share'
  // and props.promoter_id matches this user. app_events stores props as JSONB.
  const { count: sharesCount } = await db
    .from('app_events')
    .select('id', { count: 'exact', head: true })
    .eq('event_name', 'promoter_share')
    .contains('props', { promoter_id: user.id })

  // Last 20 events for the activity timeline
  const { data: recentShares } = await db
    .from('app_events')
    .select('event_name, props, created_at')
    .eq('event_name', 'promoter_share')
    .contains('props', { promoter_id: user.id })
    .order('created_at', { ascending: false })
    .limit(20)

  // Time-bucketed signups (last 7 days)
  const sevenDaysAgo = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000).toISOString()
  const { data: weeklySignups } = await db
    .from('referral_events')
    .select('created_at')
    .eq('referrer_id', user.id)
    .eq('event_type', 'signup')
    .gte('created_at', sevenDaysAgo)

  return NextResponse.json({
    ok: true,
    // Privacy fix 2026-04-14: never fall back to email prefix.
    displayName: profile?.display_name || 'Promoter',
    stats: {
      signups: signupsCount || 0,
      reports: reportsCount || 0,
      shares: sharesCount || 0,
      weeklySignups: weeklySignups?.length || 0,
    },
    recentShares: recentShares || [],
  })
}
