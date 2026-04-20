import { NextRequest, NextResponse } from 'next/server'
import { createServerClient } from '@supabase/ssr'
import { cookies } from 'next/headers'
import { getServiceClient } from '@/lib/supabase'

// Snooze a user's active alert on a port by pushing last_triggered_at into
// the future — the send-alerts cron checks `last_triggered_at < 1h ago`
// before firing, so a future timestamp disables that alert until the
// snooze window elapses. Called from the service worker's
// notificationclick "snooze" action button.

export async function POST(req: NextRequest) {
  const cookieStore = await cookies()
  const supabase = createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    { cookies: { getAll: () => cookieStore.getAll() } }
  )
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const body = await req.json().catch(() => ({}))
  const portId: string | undefined = body?.port_id
  const minutes = Number.isFinite(body?.minutes) ? Math.max(15, Math.min(1440, Number(body.minutes))) : 60
  if (!portId) return NextResponse.json({ error: 'port_id required' }, { status: 400 })

  const db = getServiceClient()
  const future = new Date(Date.now() + minutes * 60 * 1000).toISOString()
  const { error } = await db
    .from('alert_preferences')
    .update({ last_triggered_at: future })
    .eq('user_id', user.id)
    .eq('port_id', portId)
    .eq('active', true)

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 })
  }

  return NextResponse.json({ ok: true, snoozed_until: future, minutes })
}
