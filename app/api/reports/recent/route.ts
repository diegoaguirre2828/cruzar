import { NextRequest, NextResponse } from 'next/server'
import { getServiceClient } from '@/lib/supabase'

export const dynamic = 'force-dynamic'

export async function GET(req: NextRequest) {
  const limit = Math.min(parseInt(req.nextUrl.searchParams.get('limit') || '50', 10), 100)
  const since = new Date(Date.now() - 12 * 60 * 60 * 1000).toISOString()
  const db = getServiceClient()

  const { data, error } = await db
    .from('crossing_reports')
    .select('id, port_id, report_type, description, wait_minutes, upvotes, created_at, username')
    .gte('created_at', since)
    .order('created_at', { ascending: false })
    .limit(limit)

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json({ reports: data || [] })
}
