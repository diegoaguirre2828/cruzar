import { NextRequest, NextResponse } from 'next/server'
import { getServiceClient } from '@/lib/supabase'
import webpush from 'web-push'

if (process.env.VAPID_PUBLIC_KEY && process.env.VAPID_PRIVATE_KEY) {
  webpush.setVapidDetails(
    'mailto:cruzabusiness@gmail.com',
    process.env.VAPID_PUBLIC_KEY,
    process.env.VAPID_PRIVATE_KEY
  )
}

// Staffing-drop push template (v56). Different copy + tag than the
// wait-drop alert so the user can tell at a glance which kind fired.
async function sendStaffingPush(
  userId: string,
  portName: string,
  portId: string,
  laneType: string,
  officersOpen: number,
  officersTypical: number,
) {
  if (!process.env.VAPID_PUBLIC_KEY || !process.env.VAPID_PRIVATE_KEY) return
  const db = getServiceClient()
  const { data: subs } = await db
    .from('push_subscriptions')
    .select('endpoint, p256dh, auth')
    .eq('user_id', userId)
  if (!subs?.length) return

  const laneLabel = laneType === 'commercial' ? 'camión'
    : laneType === 'pedestrian' ? 'peatonal'
    : laneType === 'sentri' ? 'SENTRI'
    : 'autos'
  const delta = officersTypical - officersOpen

  let anyDelivered = false
  for (const sub of subs) {
    if (!sub?.endpoint) continue
    try {
      await webpush.sendNotification(
        { endpoint: sub.endpoint, keys: { p256dh: sub.p256dh, auth: sub.auth } },
        JSON.stringify({
          title: `⚠️ ${portName} — ${delta} oficial${delta === 1 ? '' : 'es'} menos`,
          body: `${officersOpen} de ${officersTypical} normales en ${laneLabel}. La fila va a subir pronto · Wait spike likely in 15-30 min`,
          url: `/cruzar/${encodeURIComponent(portId)}`,
          tag: `staffing-alert-${portId}-${laneType}`,
          requireInteraction: true,
          actions: [
            { action: 'view', title: 'Ver · View' },
            { action: 'snooze', title: 'Snooze 1h' },
          ],
        }),
        { urgency: 'high', TTL: 1800 }
      )
      anyDelivered = true
    } catch (err: unknown) {
      if (err && typeof err === 'object' && 'statusCode' in err && (err as { statusCode: number }).statusCode === 410) {
        await db.from('push_subscriptions').delete().eq('endpoint', sub.endpoint)
      }
    }
  }

  if (anyDelivered) {
    await db.from('app_events').insert({
      event_name: 'alert_fired',
      props: { port_id: portId, alert_kind: 'staffing_drop', lane_type: laneType, officers_open: officersOpen, officers_typical: officersTypical, channel: 'push' },
      user_id: userId,
    }).then(() => {}, () => {})
  }
}

async function sendPush(userId: string, portName: string, portId: string, wait: number) {
  if (!process.env.VAPID_PUBLIC_KEY || !process.env.VAPID_PRIVATE_KEY) return
  const db = getServiceClient()
  // Fetch EVERY subscription for this user — a single user may have
  // iPhone + laptop + Android tablet registered. Previously `.single()`
  // capped delivery to one device, which meant a user's primary phone
  // could silently stop getting alerts if they ever hit "enable" on a
  // second device and the row got overwritten.
  const { data: subs } = await db
    .from('push_subscriptions')
    .select('endpoint, p256dh, auth')
    .eq('user_id', userId)

  if (!subs?.length) return

  let anyDelivered = false
  for (const sub of subs) {
    if (!sub?.endpoint) continue
    try {
      await webpush.sendNotification(
        { endpoint: sub.endpoint, keys: { p256dh: sub.p256dh, auth: sub.auth } },
        JSON.stringify({
          title: `🌉 ${portName} — ${wait} min`,
          body: `Bajó la espera · Wait dropped — toca para ver en vivo · tap to view live`,
          url: `/port/${encodeURIComponent(portId)}`,
          tag: `urgent-alert-${portId}`,
          requireInteraction: true,
          actions: [
            { action: 'view', title: 'Ver · View' },
            { action: 'snooze', title: 'Snooze 1h' },
          ],
        }),
        { urgency: 'high', TTL: 600 }
      )
      anyDelivered = true
    } catch (err: unknown) {
      // Subscription expired — remove just THIS endpoint, not every row
      // for the user. Other devices on the same account should keep
      // getting alerts.
      if (err && typeof err === 'object' && 'statusCode' in err && (err as { statusCode: number }).statusCode === 410) {
        await db.from('push_subscriptions').delete().eq('endpoint', sub.endpoint)
      }
      // Other errors fall through — loop continues so one bad endpoint
      // never blocks delivery to the user's other devices.
    }
  }

  if (anyDelivered) {
    // Log one event per alert-fire, not per device. Failure is silent —
    // a missing event row shouldn't break the cron run.
    await db.from('app_events').insert({
      event_name: 'alert_fired',
      props: { port_id: portId, wait, channel: 'push' },
      user_id: userId,
    }).then(() => {}, () => {})
  }
}

// Per-account daily SMS budget. With the install-age gate removed
// from claim-pwa-pro, a malicious user can get Pro instantly + create
// up to 20 alerts (per the cap in /api/alerts). This budget caps the
// actual outbound Twilio cost regardless of alert count: max N SMS
// dispatches per user per 24h. Push remains uncapped (free).
const DAILY_SMS_CAP = 10

async function smsSentInLast24h(userId: string): Promise<number> {
  const db = getServiceClient()
  const since = new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString()
  const { count } = await db
    .from('app_events')
    .select('*', { count: 'exact', head: true })
    .eq('user_id', userId)
    .eq('event_name', 'alert_fired')
    .filter('props->>channel', 'eq', 'sms')
    .gte('created_at', since)
  return count ?? 0
}

async function sendSms(userId: string, phone: string, portName: string, portId: string, wait: number): Promise<'sent' | 'capped' | 'unconfigured'> {
  if (!process.env.TWILIO_ACCOUNT_SID || !process.env.TWILIO_AUTH_TOKEN || !process.env.TWILIO_PHONE_NUMBER) return 'unconfigured'
  const recent = await smsSentInLast24h(userId)
  if (recent >= DAILY_SMS_CAP) return 'capped'
  const url = `https://cruzar.app/port/${encodeURIComponent(portId)}`
  const body = `🌉 Cruzar Alert: ${portName} is now ${wait} min. ${url}`
  const auth = Buffer.from(`${process.env.TWILIO_ACCOUNT_SID}:${process.env.TWILIO_AUTH_TOKEN}`).toString('base64')
  const res = await fetch(`https://api.twilio.com/2010-04-01/Accounts/${process.env.TWILIO_ACCOUNT_SID}/Messages.json`, {
    method: 'POST',
    headers: { Authorization: `Basic ${auth}`, 'Content-Type': 'application/x-www-form-urlencoded' },
    body: new URLSearchParams({ To: phone, From: process.env.TWILIO_PHONE_NUMBER, Body: body }).toString(),
  })
  if (!res.ok) return 'sent'  // Twilio rejected, but we still consumed an attempt
  // Log the SMS event so the next run sees this in smsSentInLast24h.
  const db = getServiceClient()
  await db.from('app_events').insert({
    event_name: 'alert_fired',
    props: { port_id: portId, wait, channel: 'sms' },
    user_id: userId,
  }).then(() => {}, () => {})
  return 'sent'
}

export async function GET(req: NextRequest) {
  const authHeader = req.headers.get('authorization')
  const secret = req.nextUrl.searchParams.get('secret')
  const isAuthed =
    secret === process.env.CRON_SECRET ||
    authHeader === `Bearer ${process.env.CRON_SECRET}`

  if (!isAuthed) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  try {
    const supabase = getServiceClient()
    const oneHourAgo = new Date(Date.now() - 60 * 60 * 1000).toISOString()

    const { data: alerts } = await supabase
      .from('alert_preferences')
      .select('*')
      .eq('active', true)
      .or(`last_triggered_at.is.null,last_triggered_at.lt.${oneHourAgo}`)

    if (!alerts?.length) return NextResponse.json({ sent: 0, checked: 0 })

    const { data: readings } = await supabase
      .from('wait_time_readings')
      .select('port_id, port_name, vehicle_wait, commercial_wait, pedestrian_wait, sentri_wait, recorded_at')
      .gte('recorded_at', new Date(Date.now() - 30 * 60 * 1000).toISOString())
      .order('recorded_at', { ascending: false })

    const latest: Record<string, NonNullable<typeof readings>[0]> = {}
    for (const r of readings ?? []) {
      if (!latest[r.port_id]) latest[r.port_id] = r
    }

    let sent = 0

    for (const alert of alerts) {
      const reading = latest[alert.port_id]
      if (!reading) continue

      const wait =
        alert.lane_type === 'commercial' ? reading.commercial_wait
        : alert.lane_type === 'pedestrian' ? reading.pedestrian_wait
        : alert.lane_type === 'sentri' ? reading.sentri_wait
        : reading.vehicle_wait

      if (wait === null || wait >= alert.threshold_minutes) continue

      // Claim the alert atomically BEFORE sending — prevents double-fire
      // if two cron instances run at the same time
      const now = new Date().toISOString()
      const { data: claimed } = await supabase
        .from('alert_preferences')
        .update({ last_triggered_at: now })
        .eq('id', alert.id)
        .or(`last_triggered_at.is.null,last_triggered_at.lt.${oneHourAgo}`)
        .select('id')

      if (!claimed?.length) continue // another instance already claimed it

      const results = await Promise.allSettled([
        sendPush(alert.user_id, reading.port_name, alert.port_id, wait),
        alert.phone ? sendSms(alert.user_id, alert.phone, reading.port_name, alert.port_id, wait) : null,
      ])
      results.forEach((r, i) => {
        if (r.status === 'rejected') console.error(`Alert send failed [${['push','sms'][i]}] user=${alert.user_id}:`, r.reason)
      })

      sent++
    }

    // ─── v56: staffing-drop alerts ──────────────────────────────────
    // Fires when CBP officer count for the user's lane drops 2+ below
    // historical typical for this hour-of-week. Independent of the
    // wait-threshold check above. Reuses alerts already fetched but
    // filters to the staffing-enabled subset.
    let staffingSent = 0
    const staffingAlerts = (alerts ?? []).filter(
      (a) =>
        a.staffing_drop_enabled === true &&
        (!a.last_staffing_alert_at || new Date(a.last_staffing_alert_at).getTime() < Date.now() - 60 * 60 * 1000),
    )

    if (staffingAlerts.length > 0) {
      // Fetch the latest CBP poll per port (gives lanes_X_open right now)
      const portIds = [...new Set(staffingAlerts.map((a) => a.port_id))]
      const { data: cbpRows } = await supabase
        .from('wait_time_readings')
        .select('port_id, port_name, lanes_vehicle_open, lanes_sentri_open, lanes_commercial_open, lanes_pedestrian_open, recorded_at')
        .in('port_id', portIds)
        .gte('recorded_at', new Date(Date.now() - 30 * 60 * 1000).toISOString())
        .order('recorded_at', { ascending: false })
      const cbpLatest: Record<string, NonNullable<typeof cbpRows>[0]> = {}
      for (const r of cbpRows ?? []) {
        if (!cbpLatest[r.port_id]) cbpLatest[r.port_id] = r
      }

      // Compute typicals for (port, dow, hour) over last 30 days. The
      // /api/ports route does this on every request — here we batch it
      // once for the alerted ports.
      const nowCT = new Date(new Date().toLocaleString('en-US', { timeZone: 'America/Chicago' }))
      const dow = nowCT.getDay()
      const hour = nowCT.getHours()
      const thirtyDaysAgo = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000).toISOString()
      const { data: histRows } = await supabase
        .from('wait_time_readings')
        .select('port_id, lanes_vehicle_open, lanes_sentri_open, lanes_commercial_open, lanes_pedestrian_open')
        .in('port_id', portIds)
        .eq('day_of_week', dow)
        .eq('hour_of_day', hour)
        .gte('recorded_at', thirtyDaysAgo)

      const typicals: Record<string, Record<string, number>> = {}
      const accumulate = (portId: string, lane: string, val: number | null) => {
        if (val == null || val <= 0) return
        typicals[portId] = typicals[portId] ?? {}
        const key = `${lane}_sum`
        const ckey = `${lane}_count`
        typicals[portId][key] = (typicals[portId][key] ?? 0) + val
        typicals[portId][ckey] = (typicals[portId][ckey] ?? 0) + 1
      }
      for (const r of histRows ?? []) {
        accumulate(r.port_id, 'vehicle', r.lanes_vehicle_open)
        accumulate(r.port_id, 'sentri', r.lanes_sentri_open)
        accumulate(r.port_id, 'commercial', r.lanes_commercial_open)
        accumulate(r.port_id, 'pedestrian', r.lanes_pedestrian_open)
      }
      const getTypical = (portId: string, lane: string): number | null => {
        const t = typicals[portId]
        if (!t) return null
        const sum = t[`${lane}_sum`]
        const count = t[`${lane}_count`]
        if (!count || count < 3) return null
        return Math.round(sum / count)
      }

      for (const alert of staffingAlerts) {
        const reading = cbpLatest[alert.port_id]
        if (!reading) continue
        const lane = (alert.lane_type as string) || 'vehicle'
        const openCount = lane === 'commercial' ? reading.lanes_commercial_open
          : lane === 'pedestrian' ? reading.lanes_pedestrian_open
          : lane === 'sentri' ? reading.lanes_sentri_open
          : reading.lanes_vehicle_open
        const typical = getTypical(alert.port_id, lane)
        if (openCount == null || typical == null) continue
        if (typical - openCount < 2) continue // not a meaningful drop

        // Atomic claim of the staffing slot — same race-protection pattern
        // the wait-drop alert uses.
        const now = new Date().toISOString()
        const oneHourAgoIso = new Date(Date.now() - 60 * 60 * 1000).toISOString()
        const { data: claimed } = await supabase
          .from('alert_preferences')
          .update({ last_staffing_alert_at: now })
          .eq('id', alert.id)
          .or(`last_staffing_alert_at.is.null,last_staffing_alert_at.lt.${oneHourAgoIso}`)
          .select('id')
        if (!claimed?.length) continue

        await sendStaffingPush(alert.user_id, reading.port_name, alert.port_id, lane, openCount, typical).catch((e) =>
          console.error('staffing push failed', alert.user_id, e),
        )
        staffingSent++
      }
    }

    return NextResponse.json({ sent, checked: alerts.length, staffingSent, staffingChecked: staffingAlerts.length })
  } catch (err) {
    console.error('send-alerts cron error:', err)
    return NextResponse.json({ error: String(err) }, { status: 500 })
  }
}
