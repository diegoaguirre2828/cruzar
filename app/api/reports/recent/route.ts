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
    .select('id, port_id, report_type, description, wait_minutes, upvotes, created_at, username, source, source_meta, location_confidence')
    .gte('created_at', since)
    .order('created_at', { ascending: false })
    .limit(limit)

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json(
    { reports: data || [] },
    {
      headers: {
        // Edge cache — feed doesn't need to be millisecond-fresh
        'Cache-Control': 'public, s-maxage=20, stale-while-revalidate=60',
      },
    }
  )
}
