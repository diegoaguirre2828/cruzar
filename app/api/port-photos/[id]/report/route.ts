import { NextRequest, NextResponse } from 'next/server'
import { createServerClient } from '@supabase/ssr'
import { cookies } from 'next/headers'
import { getServiceClient } from '@/lib/supabase'

export const dynamic = 'force-dynamic'

// POST /api/port-photos/[id]/report
//
// Increments the photo's report_count. At 3+ reports the photo's
// moderation_status flips to 'removed' and it stops rendering. Auth
// required so we can later prevent duplicate reports from the same
// user — for v1 we don't track who reported, just the count.

const AUTO_HIDE_THRESHOLD = 3

export async function POST(
  _req: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  const { id } = await params
  if (!id) return NextResponse.json({ error: 'id required' }, { status: 400 })

  const cookieStore = await cookies()
  const supabase = createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    { cookies: { getAll: () => cookieStore.getAll() } },
  )
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Sign in to report' }, { status: 401 })

  const db = getServiceClient()

  const { data: row, error: fetchError } = await db
    .from('port_photos')
    .select('id, report_count, moderation_status')
    .eq('id', id)
    .maybeSingle()
  if (fetchError) return NextResponse.json({ error: fetchError.message }, { status: 500 })
  if (!row) return NextResponse.json({ error: 'Not found' }, { status: 404 })
  if (row.moderation_status !== 'live') {
    return NextResponse.json({ ok: true, note: 'Photo already removed' })
  }

  const newCount = (row.report_count ?? 0) + 1
  const shouldHide = newCount >= AUTO_HIDE_THRESHOLD

  const { error: updateError } = await db
    .from('port_photos')
    .update({
      report_count: newCount,
      moderation_status: shouldHide ? 'removed' : 'live',
      removed_at: shouldHide ? new Date().toISOString() : null,
    })
    .eq('id', id)
  if (updateError) return NextResponse.json({ error: updateError.message }, { status: 500 })

  return NextResponse.json({
    ok: true,
    report_count: newCount,
    hidden: shouldHide,
  })
}
