// Pattern Brain — Pillar 1 wake-up notification cron.
//
// Runs hourly via cron-job.org. Refreshes the cached routines from the
// last 90 days of crossing_reports, then for any user whose routine
// matches "1 hour from now in CT" sends a push notif. Throttle: at most
// one Pattern Brain push per user per 6 hours.
//
// Auth: ?secret= or Authorization: Bearer (per Cruzar cron convention).

import { NextRequest, NextResponse } from 'next/server'
import { getServiceClient } from '@/lib/supabase'
import { getPortMeta } from '@/lib/portMeta'
import webpush from 'web-push'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'
export const maxDuration = 60

if (process.env.VAPID_PUBLIC_KEY && process.env.VAPID_PRIVATE_KEY) {
  webpush.setVapidDetails(
    'mailto:cruzabusiness@gmail.com',
    process.env.VAPID_PUBLIC_KEY,
    process.env.VAPID_PRIVATE_KEY,
  )
}

// America/Chicago offset — handles CST/CDT. Returns the current hour in CT.
function ctHourNow(): { dow: number; hour: number } {
  // Intl is correct on every timezone including DST transitions.
  const fmt = new Intl.DateTimeFormat('en-US', {
    timeZone: 'America/Chicago',
    weekday: 'short',
    hour: 'numeric',
    hour12: false,
  })
  const parts = fmt.formatToParts(new Date())
  const wd = parts.find((p) => p.type === 'weekday')?.value ?? 'Sun'
  const hr = Number(parts.find((p) => p.type === 'hour')?.value ?? 0)
  const map: Record<string, number> = { Sun: 0, Mon: 1, Tue: 2, Wed: 3, Thu: 4, Fri: 5, Sat: 6 }
  return { dow: map[wd] ?? 0, hour: hr % 24 }
}

interface Routine {
  user_id: string
  port_id: string
  dow: number
  hour: number
  sample_count: number
}

async function refreshRoutines(): Promise<{ users_scanned: number; routines_upserted: number }> {
  const db = getServiceClient()
  const since = new Date(Date.now() - 90 * 24 * 60 * 60 * 1000).toISOString()

  // Pull only opted-in users so we don't scan freeloaders.
  const { data: optedIn } = await db
    .from('profiles')
    .select('id')
    .eq('pattern_brain_opt_in', true)
  const userIds = (optedIn ?? []).map((r) => r.id as string)
  if (userIds.length === 0) return { users_scanned: 0, routines_upserted: 0 }

  const { data: reports } = await db
    .from('crossing_reports')
    .select('user_id, port_id, recorded_at, created_at')
    .in('user_id', userIds)
    .gte('created_at', since)
    .limit(50000)

  // Bucket by (user, port, dow, hour) using America/Chicago.
  const buckets = new Map<string, Routine>()
  for (const r of reports ?? []) {
    const ts = (r.recorded_at as string | null) ?? (r.created_at as string)
    if (!ts) continue
    const d = new Date(ts)
    if (Number.isNaN(d.getTime())) continue
    const fmt = new Intl.DateTimeFormat('en-US', {
      timeZone: 'America/Chicago',
      weekday: 'short',
      hour: 'numeric',
      hour12: false,
    })
    const parts = fmt.formatToParts(d)
    const wd = parts.find((p) => p.type === 'weekday')?.value ?? 'Sun'
    const hr = Number(parts.find((p) => p.type === 'hour')?.value ?? 0) % 24
    const map: Record<string, number> = { Sun: 0, Mon: 1, Tue: 2, Wed: 3, Thu: 4, Fri: 5, Sat: 6 }
    const dow = map[wd] ?? 0
    const key = `${r.user_id}|${r.port_id}|${dow}|${hr}`
    const cur = buckets.get(key)
    if (cur) {
      cur.sample_count += 1
    } else {
      buckets.set(key, {
        user_id: r.user_id as string,
        port_id: String(r.port_id),
        dow,
        hour: hr,
        sample_count: 1,
      })
    }
  }

  const qualifying = Array.from(buckets.values()).filter((r) => r.sample_count >= 3)
  if (qualifying.length === 0) return { users_scanned: userIds.length, routines_upserted: 0 }

  const upsertRows = qualifying.map((r) => ({
    user_id: r.user_id,
    port_id: r.port_id,
    dow: r.dow,
    hour: r.hour,
    sample_count: r.sample_count,
    last_seen_at: new Date().toISOString(),
  }))

  // Upsert in chunks of 500
  for (let i = 0; i < upsertRows.length; i += 500) {
    await db
      .from('pattern_brain_routines')
      .upsert(upsertRows.slice(i, i + 500), { onConflict: 'user_id,port_id,dow,hour' })
  }

  return { users_scanned: userIds.length, routines_upserted: upsertRows.length }
}

async function sendWakeUps(): Promise<{ candidates: number; delivered: number; errors: number }> {
  const db = getServiceClient()
  const ct = ctHourNow()
  // Wake-up fires at routine_hour - 1. So at CT hour H, we look for routines with hour H+1.
  const targetHour = (ct.hour + 1) % 24
  const targetDow = targetHour === 0 ? (ct.dow + 1) % 7 : ct.dow

  // Throttle: skip users who got a Pattern Brain push in the last 6 hours.
  const sinceCutoff = new Date(Date.now() - 6 * 60 * 60 * 1000).toISOString()

  const { data: candidates } = await db
    .from('pattern_brain_routines')
    .select('user_id, port_id, dow, hour, sample_count')
    .eq('dow', targetDow)
    .eq('hour', targetHour)
    .limit(2000)

  if (!candidates || candidates.length === 0) {
    return { candidates: 0, delivered: 0, errors: 0 }
  }

  // Filter out users whose pattern_brain_last_sent_at is recent.
  const userIds = [...new Set(candidates.map((c) => c.user_id as string))]
  const { data: profiles } = await db
    .from('profiles')
    .select('id, pattern_brain_last_sent_at, pattern_brain_opt_in, display_name')
    .in('id', userIds)
    .eq('pattern_brain_opt_in', true)
  const eligible = new Set(
    (profiles ?? [])
      .filter((p) => !p.pattern_brain_last_sent_at || p.pattern_brain_last_sent_at < sinceCutoff)
      .map((p) => p.id as string),
  )

  const fireables = candidates.filter((c) => eligible.has(c.user_id as string))
  let delivered = 0
  let errors = 0

  for (const c of fireables) {
    const { data: subs } = await db
      .from('push_subscriptions')
      .select('endpoint, p256dh, auth')
      .eq('user_id', c.user_id)
    if (!subs?.length) continue

    const meta = getPortMeta(String(c.port_id))
    const portName = meta.localName || meta.city
    const title = `🌅 Cruzar — ${portName} en 1 hora`
    const body = `Cruzas a esta hora normalmente. Espera ahorita: revisa antes de salir.`
    const url = `/cruzar/${encodeURIComponent(String(c.port_id))}`

    let anyDelivered = false
    for (const sub of subs) {
      if (!sub?.endpoint) continue
      try {
        await webpush.sendNotification(
          { endpoint: sub.endpoint, keys: { p256dh: sub.p256dh as string, auth: sub.auth as string } },
          JSON.stringify({
            title,
            body,
            url,
            tag: `pattern-brain-${c.port_id}-${c.dow}-${c.hour}`,
            requireInteraction: false,
          }),
          { urgency: 'normal', TTL: 1800 },
        )
        anyDelivered = true
      } catch (err: unknown) {
        if (err && typeof err === 'object' && 'statusCode' in err && (err as { statusCode: number }).statusCode === 410) {
          await db.from('push_subscriptions').delete().eq('endpoint', sub.endpoint)
        }
      }
    }

    await db.from('pattern_brain_sends').insert({
      user_id: c.user_id,
      port_id: c.port_id,
      dow: c.dow,
      hour: c.hour,
      delivered: anyDelivered,
    })

    if (anyDelivered) {
      await db.from('profiles').update({ pattern_brain_last_sent_at: new Date().toISOString() }).eq('id', c.user_id)
      delivered++
    } else {
      errors++
    }
  }

  return { candidates: fireables.length, delivered, errors }
}

async function authorized(req: NextRequest): Promise<boolean> {
  const secret = process.env.CRON_SECRET
  if (!secret) return false
  const url = new URL(req.url)
  if (url.searchParams.get('secret') === secret) return true
  const auth = req.headers.get('authorization') || ''
  return auth.replace(/^Bearer\s+/i, '').trim() === secret
}

export async function GET(req: NextRequest) {
  if (!(await authorized(req))) {
    return NextResponse.json({ error: 'unauthorized' }, { status: 401 })
  }
  try {
    const refresh = await refreshRoutines()
    const send = await sendWakeUps()
    return NextResponse.json({
      ok: true,
      ct_now: ctHourNow(),
      refresh,
      send,
      ran_at: new Date().toISOString(),
    })
  } catch (e) {
    return NextResponse.json({ ok: false, error: (e as Error).message }, { status: 500 })
  }
}

export async function POST(req: NextRequest) { return GET(req) }
