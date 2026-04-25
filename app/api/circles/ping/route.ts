import { NextRequest, NextResponse } from 'next/server'
import { createServerClient } from '@supabase/ssr'
import { cookies } from 'next/headers'
import { getServiceClient } from '@/lib/supabase'
import { getPortMeta } from '@/lib/portMeta'
import { checkRateLimit } from '@/lib/ratelimit'
import webpush from 'web-push'

export const dynamic = 'force-dynamic'

if (process.env.VAPID_PUBLIC_KEY && process.env.VAPID_PRIVATE_KEY) {
  webpush.setVapidDetails(
    'mailto:cruzabusiness@gmail.com',
    process.env.VAPID_PUBLIC_KEY,
    process.env.VAPID_PRIVATE_KEY
  )
}

// POST /api/circles/ping
// Body: { port_id: string, wait_minutes: number, note?: string }
//
// Sends a proactive "heads up" push notification to every member of
// every circle the authed user belongs to. Use case: user sees a
// port's wait is really low/high and wants to warn their family/crew
// BEFORE they cross, not after. Different from the auto-notification
// that fires on Just Crossed submissions.

export async function POST(req: NextRequest) {
  const cookieStore = await cookies()
  const supabase = createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    { cookies: { getAll: () => cookieStore.getAll() } }
  )
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  // SECURITY (2026-04-25 audit): cap pings per user. Without this an
  // authed user with 12-member circles could fan-out a phishing payload
  // through the `note` field as a high-urgency push. 6 pings/hour with
  // a burst of 2 is enough for legitimate "heads up" use and tight
  // enough that abusers hit the wall before any victim taps.
  const rl = await checkRateLimit(`circle-ping:${user.id}`, 6, 2)
  if (!rl.ok) {
    return NextResponse.json(
      { error: 'Too many pings. Wait a bit and try again.' },
      { status: 429, headers: { 'Retry-After': String(rl.retryAfterSeconds) } },
    )
  }

  let body: { port_id?: string; wait_minutes?: number; note?: string }
  try { body = await req.json() } catch { return NextResponse.json({ error: 'Invalid JSON' }, { status: 400 }) }

  const portId = (body.port_id || '').trim()
  const wait = typeof body.wait_minutes === 'number' && Number.isFinite(body.wait_minutes) ? body.wait_minutes : null
  // Strip URLs + bidi-control codepoints from note before it lands in
  // a push body. URLs would let an attacker exfiltrate or phish via
  // the notification surface; RTL overrides flip the rendered text
  // direction. 200-char cap keeps push body under platform limits.
  const noteRaw = typeof body.note === 'string' ? body.note.trim().slice(0, 200) : null
  const note = noteRaw
    ? noteRaw
        .replace(/https?:\/\/\S+/gi, '')
        .replace(/[‪-‮⁦-⁩]/g, '')
        .trim()
        .slice(0, 200) || null
    : null
  if (!portId) return NextResponse.json({ error: 'Missing port_id' }, { status: 400 })

  const db = getServiceClient()

  // Get crosser display name
  const { data: crosserProfile } = await db
    .from('profiles')
    .select('display_name')
    .eq('id', user.id)
    .maybeSingle()
  // Privacy fix 2026-04-14: never fall back to email prefix — that
  // leaked the user's email local part to every circle ping. Every
  // profile now has an auto-generated handle from the random_handles
  // SQL trigger, so display_name should always be populated.
  const displayName = crosserProfile?.display_name || 'Alguien'

  // Find circles the user is in
  const { data: myMemberships } = await db
    .from('circle_members')
    .select('circle_id')
    .eq('user_id', user.id)
  const circleIds = (myMemberships || []).map((m) => m.circle_id)
  if (circleIds.length === 0) {
    return NextResponse.json({ error: 'You are not in any circle' }, { status: 400 })
  }

  // Find other members
  const { data: otherMembers } = await db
    .from('circle_members')
    .select('user_id')
    .in('circle_id', circleIds)
    .neq('user_id', user.id)
  const otherUserIds = [...new Set((otherMembers || []).map((m) => m.user_id))]
  if (otherUserIds.length === 0) {
    return NextResponse.json({ ok: true, sent: 0, note: 'No other members in your circle(s)' })
  }

  // Fetch push subscriptions
  const { data: subs } = await db
    .from('push_subscriptions')
    .select('user_id, endpoint, p256dh, auth')
    .in('user_id', otherUserIds)
  if (!subs || subs.length === 0) {
    return NextResponse.json({ ok: true, sent: 0, note: 'No circle members have push enabled' })
  }

  const meta = getPortMeta(portId)
  const portLabel = meta?.localName
    ? `${meta.city} (${meta.localName})`
    : meta?.city || portId

  const waitFragment = wait == null ? '' : ` · ${wait === 0 ? '<1' : wait} min`
  const title = `${displayName} avisa`
  const body_text = note ? `${portLabel}${waitFragment} · "${note}"` : `${portLabel}${waitFragment}`

  let sent = 0
  await Promise.allSettled(
    subs.map(async (sub) => {
      try {
        await webpush.sendNotification(
          { endpoint: sub.endpoint, keys: { p256dh: sub.p256dh, auth: sub.auth } },
          JSON.stringify({
            title,
            body: body_text,
            url: `/port/${encodeURIComponent(portId)}`,
            tag: `circle-ping-${user.id}-${portId}`,
          })
        )
        sent++
      } catch (err: unknown) {
        if (err && typeof err === 'object' && 'statusCode' in err && (err as { statusCode: number }).statusCode === 410) {
          await db.from('push_subscriptions').delete().eq('user_id', sub.user_id)
        }
      }
    })
  )

  return NextResponse.json({ ok: true, sent })
}
