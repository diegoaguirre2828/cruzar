import { NextRequest, NextResponse } from 'next/server'
import { createServerClient } from '@supabase/ssr'
import { cookies } from 'next/headers'
import { getServiceClient } from '@/lib/supabase'

export const dynamic = 'force-dynamic'

// Log a share event for an authenticated promoter. Writes to app_events
// with event_name = 'promoter_share' so it can be counted by the stats
// endpoint without introducing a new table. Rate-limited loosely — a
// spammy promoter copy-clicking to inflate numbers should trip a soft
// cap instead of breaking anything.

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

export async function POST(req: NextRequest) {
  const user = await getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const body = await req.json().catch(() => ({}))
  const { templateId, category, channel, targetGroup } = body

  const db = getServiceClient()

  // Must be promoter
  const { data: profile } = await db
    .from('profiles')
    .select('is_promoter')
    .eq('id', user.id)
    .single()
  if (!profile?.is_promoter) {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
  }

  // Write the share event. Props keep the promoter_id indexable via
  // contains() queries so the stats endpoint can filter cheaply.
  const { error } = await db.from('app_events').insert({
    event_name: 'promoter_share',
    props: {
      promoter_id: user.id,
      template_id: templateId || null,
      category: category || null,
      channel: channel || 'copy',
      target_group: targetGroup || null,
    },
    user_id: user.id,
  })

  if (error) {
    console.error('promoter/log-share insert failed', error)
    return NextResponse.json({ error: error.message }, { status: 500 })
  }

  return NextResponse.json({ ok: true })
}
