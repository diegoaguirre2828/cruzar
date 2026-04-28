import { NextRequest, NextResponse } from 'next/server'
import { createServerClient } from '@supabase/ssr'
import { cookies } from 'next/headers'
import { getServiceClient } from '@/lib/supabase'

// Returns the IDs of reports for a given port that the current user has
// already upvoted. ReportsFeed hydrates its `upvoted` Set from this so
// the thumbs-up button reflects prior-session state — without it, every
// session starts with `upvoted: empty Set`, which means clicking on a
// previously-upvoted report toggles it OFF and decrements the count
// (looks like "thumbs-up doesn't work / goes wrong way").
export async function GET(req: NextRequest) {
  const portId = req.nextUrl.searchParams.get('portId')
  if (!portId) return NextResponse.json({ upvoted: [] })

  const cookieStore = await cookies()
  const supabase = createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    { cookies: { getAll: () => cookieStore.getAll() } }
  )
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ upvoted: [] })

  const since = new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString()
  const db = getServiceClient()

  const { data: reports } = await db
    .from('crossing_reports')
    .select('id')
    .eq('port_id', portId)
    .gte('created_at', since)
  const reportIds = (reports || []).map(r => r.id)
  if (reportIds.length === 0) return NextResponse.json({ upvoted: [] })

  const { data } = await db
    .from('report_upvotes')
    .select('report_id')
    .eq('user_id', user.id)
    .in('report_id', reportIds)

  return NextResponse.json({
    upvoted: (data || []).map(r => r.report_id),
  })
}
