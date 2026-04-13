import { NextRequest, NextResponse } from 'next/server'
import { createServerClient } from '@supabase/ssr'
import { cookies } from 'next/headers'
import { getServiceClient } from '@/lib/supabase'

export const dynamic = 'force-dynamic'

// Share-event counter. Fires when a user taps WhatsApp / Copy / Share
// buttons anywhere in the app. Increments profiles.share_count by 1 for
// logged-in users. Anonymous shares are tracked as a no-op so the call
// is still safe.
//
// This is intentionally lightweight — no events table, no source column,
// no timestamps beyond updated_at. Just a counter. If we need channel/
// context attribution later (for the giveaway drawing) we add a proper
// share_events table then.
const VALID_CHANNELS = new Set(['whatsapp', 'facebook', 'copy', 'native'])

export async function POST(req: NextRequest) {
  const cookieStore = await cookies()
  const supabase = createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    { cookies: { getAll: () => cookieStore.getAll() } }
  )
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) {
    // Anonymous share — accept silently so clients don't have to branch
    return NextResponse.json({ ok: true, anonymous: true })
  }

  // Parse the body so we can store channel + context per-share.
  // Kept optional — the old callers that send no body still work.
  let channel: string | null = null
  let context: string | null = null
  try {
    const body = await req.json()
    if (body && typeof body === 'object') {
      if (typeof body.channel === 'string' && VALID_CHANNELS.has(body.channel)) {
        channel = body.channel
      }
      if (typeof body.context === 'string' && body.context.length <= 60) {
        context = body.context
      }
    }
  } catch { /* empty body is fine */ }

  const db = getServiceClient()

  // Insert a row into share_events so the admin viral-loop view can
  // show per-share timestamps + channel breakdowns. Best-effort; if
  // the table doesn't exist yet (migration not run), we still bump
  // the profile counter below so nothing regresses.
  await db
    .from('share_events')
    .insert({ user_id: user.id, channel, context })
    .then(() => {}, () => {})

  const { data: profile } = await db
    .from('profiles')
    .select('share_count')
    .eq('id', user.id)
    .single()
  const next = (profile?.share_count ?? 0) + 1
  await db
    .from('profiles')
    .update({ share_count: next })
    .eq('id', user.id)

  return NextResponse.json({ ok: true, share_count: next })
}
