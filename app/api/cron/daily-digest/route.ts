import { NextRequest, NextResponse } from 'next/server'
import { getServiceClient } from '@/lib/supabase'
import webpush from 'web-push'

export const dynamic = 'force-dynamic'

/*
 * GET /api/cron/daily-digest?secret=CRON_SECRET
 *
 * Runs every 15 minutes via cron-job.org. For each user with a learned
 * crossing window (digest_window_hour set by learn-patterns), checks
 * if NOW is within [window - 45min, window + 15min] CT and they
 * haven't been sent a digest today. If so, fires a personalized push
 * notification with current wait times at their saved bridges +
 * which bridge is fastest right now.
 *
 * This is THE moat feature. No other border app learns your routine
 * and talks to you before you ask. Diego 2026-04-15: "it needs to be
 * convenient for them / they should have a dependency on the app."
 */

if (process.env.VAPID_PUBLIC_KEY && process.env.VAPID_PRIVATE_KEY) {
  webpush.setVapidDetails(
    'mailto:cruzabusiness@gmail.com',
    process.env.VAPID_PUBLIC_KEY,
    process.env.VAPID_PRIVATE_KEY
  )
}

interface PortWait {
  portId: string
  portName: string
  vehicle: number | null
}

export async function GET(req: NextRequest) {
  const secret = req.nextUrl.searchParams.get('secret')
  const auth = req.headers.get('authorization')
  if (secret !== process.env.CRON_SECRET && auth !== `Bearer ${process.env.CRON_SECRET}`) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  const db = getServiceClient()

  /* Current hour in CT (UTC-5 CDT approximation) */
  const now = new Date()
  const ctHour = (now.getUTCHours() - 5 + 24) % 24
  const ctDow = ((now.getUTCDay() + (now.getUTCHours() < 5 ? -1 : 0)) + 7) % 7

  /* Find users whose window is within the next 45 min.
     If ctHour is 5 (5 AM CT), we want users with digest_window_hour = 5 or 6
     (their window starts in 0-60 min). The cron runs every 15 min so we
     have good coverage. */
  const targetHours = [ctHour, (ctHour + 1) % 24]

  const { data: candidates } = await db
    .from('profiles')
    .select('id, display_name, digest_window_hour, digest_window_days, digest_last_sent_at')
    .in('digest_window_hour', targetHours)
    .eq('digest_enabled', true)
    .not('digest_window_hour', 'is', null)

  if (!candidates || candidates.length === 0) {
    return NextResponse.json({ sent: 0, candidates: 0, hour: ctHour })
  }

  /* Filter: only users whose day-of-week matches + haven't been sent today */
  const todayStr = now.toISOString().split('T')[0]
  const eligible = candidates.filter((u) => {
    if (u.digest_last_sent_at) {
      const lastDate = new Date(u.digest_last_sent_at).toISOString().split('T')[0]
      if (lastDate === todayStr) return false
    }
    if (u.digest_window_days) {
      const days = u.digest_window_days.split(',').map(Number)
      if (!days.includes(ctDow)) return false
    }
    return true
  })

  if (eligible.length === 0) {
    return NextResponse.json({ sent: 0, candidates: candidates.length, filtered: 0, hour: ctHour })
  }

  /* Fetch current wait times once for all users */
  const apiBase = process.env.NEXT_PUBLIC_APP_URL || 'https://cruzar.app'
  let ports: PortWait[] = []
  try {
    const res = await fetch(`${apiBase}/api/ports`, { next: { revalidate: 0 } })
    const json = await res.json()
    ports = (json.ports || []).map((p: { portId: string; portName: string; vehicle: number | null }) => ({
      portId: p.portId,
      portName: p.portName,
      vehicle: p.vehicle,
    }))
  } catch {
    return NextResponse.json({ error: 'failed_to_fetch_ports' }, { status: 500 })
  }

  /* Fetch saved crossings for all eligible users */
  const userIds = eligible.map((u) => u.id)
  const { data: savedRows } = await db
    .from('saved_crossings')
    .select('user_id, port_id')
    .in('user_id', userIds)

  const savedByUser = new Map<string, string[]>()
  for (const row of savedRows || []) {
    if (!savedByUser.has(row.user_id)) savedByUser.set(row.user_id, [])
    savedByUser.get(row.user_id)!.push(row.port_id)
  }

  /* Fetch push subscriptions for all eligible users */
  const { data: pushSubs } = await db
    .from('push_subscriptions')
    .select('user_id, endpoint, p256dh, auth')
    .in('user_id', userIds)

  const subByUser = new Map<string, { endpoint: string; p256dh: string; auth: string }>()
  for (const sub of pushSubs || []) {
    if (sub.endpoint) subByUser.set(sub.user_id, { endpoint: sub.endpoint, p256dh: sub.p256dh, auth: sub.auth })
  }

  let sent = 0
  const errors: string[] = []

  for (const user of eligible) {
    const sub = subByUser.get(user.id)
    if (!sub) continue

    const savedPortIds = savedByUser.get(user.id) || []
    /* If user has saved bridges, show those. Otherwise show the top 3 by region. */
    const relevantPorts = savedPortIds.length > 0
      ? ports.filter((p) => savedPortIds.includes(p.portId) && p.vehicle != null)
      : ports.filter((p) => p.vehicle != null).slice(0, 3)

    if (relevantPorts.length === 0) continue

    const sorted = [...relevantPorts].sort((a, b) => (a.vehicle ?? 999) - (b.vehicle ?? 999))
    const fastest = sorted[0]
    const name = user.display_name?.split(' ')[0] || ''
    const greeting = name ? `Buenos dias ${name}.` : 'Buenos dias.'

    const lines = sorted.slice(0, 4).map((p) => {
      const emoji = (p.vehicle ?? 99) <= 20 ? '🟢' : (p.vehicle ?? 99) <= 45 ? '🟡' : '🔴'
      return `${emoji} ${p.portName}: ${p.vehicle} min`
    }).join('\n')

    const fastestTip = sorted.length > 1 && fastest.vehicle != null && sorted[1].vehicle != null
      ? ` ${fastest.portName} es tu mejor opcion (${fastest.vehicle} min).`
      : ''

    const body = `${greeting}${fastestTip}\n${lines}`

    try {
      await webpush.sendNotification(
        { endpoint: sub.endpoint, keys: { p256dh: sub.p256dh, auth: sub.auth } },
        JSON.stringify({
          title: `🌉 Tus puentes ahorita`,
          body,
          url: '/',
          tag: `daily-digest-${todayStr}`,
          requireInteraction: false,
        }),
        { urgency: 'normal', TTL: 3600 }
      )

      await db
        .from('profiles')
        .update({ digest_last_sent_at: now.toISOString() })
        .eq('id', user.id)

      /* Track for analytics */
      await db.from('app_events').insert({
        event_name: 'daily_digest_sent',
        props: { ports_shown: sorted.length, fastest_port: fastest.portId, fastest_wait: fastest.vehicle },
        user_id: user.id,
      }).then(() => {}, () => {})

      sent++
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : String(err)
      errors.push(`${user.id}: ${msg}`)
      if (err && typeof err === 'object' && 'statusCode' in err && (err as { statusCode: number }).statusCode === 410) {
        await db.from('push_subscriptions').delete().eq('user_id', user.id)
      }
    }
  }

  return NextResponse.json({
    sent,
    candidates: candidates.length,
    eligible: eligible.length,
    hour: ctHour,
    dow: ctDow,
    errors: errors.slice(0, 5),
  })
}
