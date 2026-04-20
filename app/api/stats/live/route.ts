import { NextResponse } from 'next/server'
import { getServiceClient } from '@/lib/supabase'

// Live presence counter — distinct active users in the last 5 minutes.
// Powers the "X personas viendo Cruzar ahorita" social-proof strip on
// the home hero. Social proof at the moment of hesitation (should I
// trust this app?) converts higher than any amount of copy.
//
// Data source: app_events table. Any event with a user_id in the last
// 5 min counts as an "active user" for this window. Anonymous / guest
// visits don't count since there's no reliable way to dedupe them
// across events without touching cookies.
//
// Edge-cached 20s so we don't hammer the DB with the refresh cadence
// the home hero polls at. Small staleness is invisible — a count of
// "23" vs "24" makes no difference to a human reading social proof.

export async function GET() {
  try {
    const db = getServiceClient()
    const since = new Date(Date.now() - 5 * 60 * 1000).toISOString()

    const { data, error } = await db
      .from('app_events')
      .select('user_id')
      .not('user_id', 'is', null)
      .gte('created_at', since)
      .limit(1000)

    if (error) throw error

    const uniqueUsers = new Set((data ?? []).map((r) => r.user_id as string).filter(Boolean))
    const count = uniqueUsers.size

    return NextResponse.json(
      { count, windowMinutes: 5 },
      {
        headers: {
          'Cache-Control': 'public, s-maxage=20, stale-while-revalidate=60',
        },
      },
    )
  } catch (err) {
    console.error('stats/live error:', err)
    return NextResponse.json({ count: 0, error: 'unavailable' }, { status: 200 })
  }
}
