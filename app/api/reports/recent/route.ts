import { NextRequest, NextResponse } from 'next/server'
import { getServiceClient } from '@/lib/supabase'

// `force-dynamic` removed to allow the Cache-Control header below to take
// effect on Vercel's edge — feed doesn't need millisecond-fresh.

export async function GET(req: NextRequest) {
  const limit = Math.min(parseInt(req.nextUrl.searchParams.get('limit') || '50', 10), 100)
  const since = new Date(Date.now() - 12 * 60 * 60 * 1000).toISOString()
  const db = getServiceClient()

  const { data, error } = await db
    .from('crossing_reports')
    .select('id, user_id, port_id, report_type, description, wait_minutes, upvotes, created_at, username, source, source_meta, location_confidence')
    .is('hidden_at', null)  // v35 moderation: skip reports an admin flagged
    .gte('created_at', since)
    .order('created_at', { ascending: false })
    .limit(limit)

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })

  // Join reporter tier for the Pro badge flex on the feed
  const userIds = [...new Set((data || []).map(r => r.user_id).filter((id): id is string => !!id))]
  let tierMap: Record<string, string> = {}
  if (userIds.length > 0) {
    const { data: profiles } = await db
      .from('profiles')
      .select('id, tier')
      .in('id', userIds)
    tierMap = Object.fromEntries((profiles || []).map(p => [p.id, p.tier]))
  }

  const reports = (data || []).map(({ user_id, ...rest }) => ({
    ...rest,
    reporter_tier: user_id ? (tierMap[user_id] || 'free') : null,
  }))

  return NextResponse.json(
    { reports },
    {
      headers: {
        // Edge cache — feed doesn't need to be millisecond-fresh. Bumped
        // from 20s → 60s to drop DB hit rate on this query to ~1/min
        // regardless of traffic.
        'Cache-Control': 'public, s-maxage=60, stale-while-revalidate=180',
      },
    }
  )
}
