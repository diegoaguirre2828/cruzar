import { NextResponse } from 'next/server'
import { createServerClient } from '@supabase/ssr'
import { cookies } from 'next/headers'
import { getServiceClient } from '@/lib/supabase'

// Admin viral-loop detail endpoint. Returns a per-user breakdown of
// who's sharing the app, through what channels, when, and — via the
// referral_events table — who they actually brought back in.
//
// Diego is the only consumer. Gated to admin emails via env var.
// The service role client is used to read across RLS boundaries
// because share_events and referral_events have user-scoped policies.

const ADMIN_EMAILS = (process.env.ADMIN_EMAILS || '')
  .split(',')
  .map((e) => e.trim().toLowerCase())
  .filter(Boolean)

async function requireAdmin() {
  const cookieStore = await cookies()
  const supabase = createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    { cookies: { getAll: () => cookieStore.getAll() } },
  )
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return null
  if (ADMIN_EMAILS.length > 0 && !ADMIN_EMAILS.includes((user.email || '').toLowerCase())) {
    return null
  }
  return user
}

export async function GET() {
  const admin = await requireAdmin()
  if (!admin) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const db = getServiceClient()

  // 1. Top sharers by share_count. Limit to 100 so the admin UI
  //    doesn't choke on huge lists once the viral loop heats up.
  const { data: sharers } = await db
    .from('profiles')
    .select('id, display_name, tier, share_count, reports_count, created_at')
    .gt('share_count', 0)
    .order('share_count', { ascending: false })
    .limit(100)

  const sharerIds = (sharers || []).map((s) => s.id)

  // 2. Per-user share event history (last 10 events per user). One
  //    query pulling the last 500 events across the top 100 sharers,
  //    then grouped client-side. Avoids N+1 queries.
  const { data: events } = await db
    .from('share_events')
    .select('user_id, channel, context, created_at')
    .in('user_id', sharerIds.length > 0 ? sharerIds : ['__none__'])
    .order('created_at', { ascending: false })
    .limit(500)

  const eventsByUser = new Map<string, typeof events>()
  for (const e of events || []) {
    if (!e.user_id) continue
    if (!eventsByUser.has(e.user_id)) eventsByUser.set(e.user_id, [])
    const list = eventsByUser.get(e.user_id)!
    if (list.length < 10) list.push(e)
  }

  // 3. Referrals attributed to each sharer — who they brought back.
  //    referral_events has (referrer_id, referred_user_id, event_type,
  //    created_at). We want the list of referred users with minimal
  //    details for the admin table.
  const { data: refEvents } = await db
    .from('referral_events')
    .select('referrer_id, referred_user_id, event_type, created_at')
    .in('referrer_id', sharerIds.length > 0 ? sharerIds : ['__none__'])
    .order('created_at', { ascending: false })
    .limit(500)

  const referralsByUser = new Map<string, typeof refEvents>()
  for (const r of refEvents || []) {
    if (!r.referrer_id) continue
    if (!referralsByUser.has(r.referrer_id)) referralsByUser.set(r.referrer_id, [])
    referralsByUser.get(r.referrer_id)!.push(r)
  }

  // Collect referred user IDs to fetch their emails
  const referredIds = new Set<string>()
  for (const r of refEvents || []) if (r.referred_user_id) referredIds.add(r.referred_user_id)

  // 4. Pull auth.users for email lookups (sharers + referred users)
  const { data: authUsers } = await db.auth.admin.listUsers({ page: 1, perPage: 1000 })
  const emailById: Record<string, string> = {}
  for (const u of authUsers?.users || []) {
    if (u.id) emailById[u.id] = u.email || ''
  }

  // 5. Assemble the response
  const rows = (sharers || []).map((s) => {
    const userEvents = eventsByUser.get(s.id) || []
    const userReferrals = referralsByUser.get(s.id) || []

    // Channel tally for this user — quick read of "what buttons they
    // tap most" without the admin having to eyeball the event list.
    const channelCounts: Record<string, number> = {}
    for (const e of userEvents) {
      const ch = e.channel || 'unknown'
      channelCounts[ch] = (channelCounts[ch] || 0) + 1
    }

    // Dedupe referred users — one sharer can earn multiple referral
    // events per referred user (signup + first report). The admin
    // wants to see "how many PEOPLE did they bring," not event count.
    const uniqueReferredIds = new Set(userReferrals.map((r) => r.referred_user_id).filter(Boolean))
    const referredDetails = Array.from(uniqueReferredIds).map((id) => {
      const firstEvent = userReferrals.find((r) => r.referred_user_id === id)
      return {
        id: id as string,
        email: emailById[id as string] || '',
        event_type: firstEvent?.event_type || null,
        created_at: firstEvent?.created_at || null,
      }
    })

    return {
      user_id: s.id,
      email: emailById[s.id] || '',
      display_name: s.display_name || null,
      tier: s.tier || 'free',
      share_count: s.share_count || 0,
      reports_count: s.reports_count || 0,
      created_at: s.created_at,
      last_share_at: userEvents[0]?.created_at || null,
      channel_counts: channelCounts,
      recent_shares: userEvents.slice(0, 5).map((e) => ({
        channel: e.channel,
        context: e.context,
        created_at: e.created_at,
      })),
      referrals: referredDetails,
      referral_count: uniqueReferredIds.size,
    }
  })

  return NextResponse.json(
    { sharers: rows, generated_at: new Date().toISOString() },
    { headers: { 'Cache-Control': 'private, no-store' } },
  )
}
