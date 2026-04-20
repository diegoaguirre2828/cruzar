import { NextRequest, NextResponse } from 'next/server'
import { getServiceClient } from '@/lib/supabase'
import { getPortMeta } from '@/lib/portMeta'
import webpush from 'web-push'

// Daily bridge push — fires once per day at the morning commute hour.
// Target: every user with at least one saved crossing who has push
// subscribed, sent the current wait at their primary saved bridge as
// a zero-friction "check-in" that replaces the FB-group scroll habit.
//
// Schedule: cron-job.org → 11:00 UTC = 6am CT (before morning rush).
// URL: https://www.cruzar.app/api/cron/daily-bridge-push?secret=CRON_SECRET
//
// One push per user per day. If a user has multiple saved crossings,
// we send for the OLDEST saved one (their "main" bridge by proxy of
// being the first they cared enough to save). Users can unsubscribe
// from push via the dashboard or by denying the OS prompt.
//
// Why this matters: 2026-04-20 audit found one-and-done retention at
// 67% — users came once, got the number, left. This cron creates a
// passive daily touch-point that reuses the most valuable data (their
// own bridge's current state) to pull them back. Zero new Pro-only
// surface; genuine utility.

if (process.env.VAPID_PUBLIC_KEY && process.env.VAPID_PRIVATE_KEY) {
  webpush.setVapidDetails(
    'mailto:cruzabusiness@gmail.com',
    process.env.VAPID_PUBLIC_KEY,
    process.env.VAPID_PRIVATE_KEY,
  )
}

function waitPhrase(wait: number | null, lang: 'es' | 'en'): { emoji: string; text: string } {
  if (wait == null) return { emoji: '❓', text: lang === 'es' ? 'sin datos ahorita' : 'no data right now' }
  if (wait <= 20) return { emoji: '🟢', text: lang === 'es' ? `${wait} min — vete ya` : `${wait} min — go now` }
  if (wait <= 45) return { emoji: '🟡', text: lang === 'es' ? `${wait} min — moderado` : `${wait} min — moderate` }
  return { emoji: '🔴', text: lang === 'es' ? `${wait} min — lento, checa luego` : `${wait} min — slow, check later` }
}

export async function GET(req: NextRequest) {
  const secret = req.nextUrl.searchParams.get('secret')
  const authHeader = req.headers.get('authorization')
  const isAuthed =
    secret === process.env.CRON_SECRET ||
    authHeader === `Bearer ${process.env.CRON_SECRET}`
  if (!isAuthed) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  if (!process.env.VAPID_PUBLIC_KEY || !process.env.VAPID_PRIVATE_KEY) {
    return NextResponse.json({ error: 'VAPID keys not configured' }, { status: 500 })
  }

  const db = getServiceClient()

  try {
    // Pick each user's oldest saved crossing as their "main" bridge.
    // Users with multiple saved bridges still only get one push per day
    // — the digest feel matters more than multi-bridge coverage.
    const { data: saved } = await db
      .from('saved_crossings')
      .select('user_id, port_id, created_at')
      .order('created_at', { ascending: true })

    if (!saved?.length) {
      return NextResponse.json({ sent: 0, candidates: 0, note: 'no saved crossings' })
    }

    const primaryByUser = new Map<string, string>()
    for (const row of saved) {
      if (!primaryByUser.has(row.user_id)) primaryByUser.set(row.user_id, row.port_id)
    }

    // Fetch latest wait reading for the union of bridges (single query
    // instead of N+1 per user).
    const portIds = Array.from(new Set(primaryByUser.values()))
    const since = new Date(Date.now() - 45 * 60 * 1000).toISOString()
    const { data: recent } = await db
      .from('wait_time_readings')
      .select('port_id, port_name, vehicle_wait, recorded_at')
      .in('port_id', portIds)
      .gte('recorded_at', since)
      .order('recorded_at', { ascending: false })

    const latestByPort = new Map<string, { vehicle_wait: number | null; port_name: string }>()
    for (const r of recent ?? []) {
      if (!latestByPort.has(r.port_id)) {
        latestByPort.set(r.port_id, { vehicle_wait: r.vehicle_wait, port_name: r.port_name })
      }
    }

    // Fetch push subscriptions for the candidate users (multi-device
    // supported per v40 migration — each user may have 1-N rows).
    const userIds = Array.from(primaryByUser.keys())
    const { data: subs } = await db
      .from('push_subscriptions')
      .select('user_id, endpoint, p256dh, auth')
      .in('user_id', userIds)

    const subsByUser = new Map<string, typeof subs>()
    for (const sub of subs ?? []) {
      const list = subsByUser.get(sub.user_id) ?? []
      list.push(sub)
      subsByUser.set(sub.user_id, list)
    }

    let sent = 0
    let noDevices = 0
    let noData = 0

    for (const [userId, portId] of primaryByUser) {
      const userSubs = subsByUser.get(userId)
      if (!userSubs?.length) { noDevices++; continue }

      const latest = latestByPort.get(portId)
      if (!latest) { noData++; continue }

      const meta = getPortMeta(portId)
      const localName = meta.localName || meta.city || latest.port_name
      const phrase = waitPhrase(latest.vehicle_wait, 'es')

      const payload = JSON.stringify({
        title: `${phrase.emoji} ${localName} — ${phrase.text.split(' — ')[0]}`,
        body: `${phrase.text}. Toca pa ver en vivo.`,
        url: `/port/${encodeURIComponent(portId)}`,
        tag: `daily-bridge-${portId}`,
        requireInteraction: false,
      })

      for (const sub of userSubs) {
        if (!sub?.endpoint) continue
        try {
          await webpush.sendNotification(
            { endpoint: sub.endpoint, keys: { p256dh: sub.p256dh, auth: sub.auth } },
            payload,
            { urgency: 'low', TTL: 4 * 60 * 60 },
          )
          sent++
        } catch (err: unknown) {
          if (err && typeof err === 'object' && 'statusCode' in err && (err as { statusCode: number }).statusCode === 410) {
            await db.from('push_subscriptions').delete().eq('endpoint', sub.endpoint)
          }
          // Other errors: silently skip — don't block the batch.
        }
      }

      await db.from('app_events').insert({
        event_name: 'daily_bridge_push_sent',
        props: { port_id: portId, wait: latest.vehicle_wait },
        user_id: userId,
      }).then(() => {}, () => {})
    }

    return NextResponse.json({
      sent,
      candidates: primaryByUser.size,
      noDevices,
      noData,
    })
  } catch (err) {
    console.error('daily-bridge-push error:', err)
    return NextResponse.json({ error: String(err) }, { status: 500 })
  }
}
