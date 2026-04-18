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

async function sendEmail(email: string, portName: string, portId: string, wait: number, threshold: number) {
  if (!process.env.RESEND_API_KEY) return
  const res = await fetch('https://api.resend.com/emails', {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${process.env.RESEND_API_KEY}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      from: process.env.RESEND_FROM_EMAIL || 'Cruzar Alerts <onboarding@resend.dev>',
      to: [email],
      subject: `🌉 ${portName} wait dropped to ${wait} min`,
      html: `
        <div style="font-family:-apple-system,sans-serif;max-width:480px;margin:0 auto;padding:24px;">
          <h2 style="margin:0 0 16px;color:#111827;font-size:20px;">🌉 Cruzar Alert</h2>
          <div style="background:#f0fdf4;border:1px solid #bbf7d0;border-radius:12px;padding:16px;margin-bottom:20px;">
            <p style="margin:0;font-size:16px;font-weight:600;color:#166534;">${portName} is now ${wait} min</p>
            <p style="margin:4px 0 0;font-size:14px;color:#16a34a;">Below your ${threshold}-minute alert threshold</p>
          </div>
          <a href="https://cruzar.app/port/${encodeURIComponent(portId)}"
             style="display:inline-block;background:#111827;color:white;text-decoration:none;padding:12px 24px;border-radius:10px;font-size:14px;font-weight:600;">
            View Live Wait Times →
          </a>
          <p style="margin:24px 0 0;font-size:12px;color:#9ca3af;">
            You're receiving this because you set a wait time alert on Cruzar.
            <a href="https://cruzar.app/dashboard" style="color:#6b7280;">Manage alerts</a>
          </p>
        </div>
      `,
    }),
  })
  if (!res.ok) {
    throw new Error(`Resend ${res.status}: ${await res.text()}`)
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
          title: `🌉 ${portName} — ${wait} min wait`,
          body: `Wait dropped below your threshold. Tap to view live times.`,
          url: `/port/${encodeURIComponent(portId)}`,
          tag: `urgent-alert-${portId}`,
          requireInteraction: true,
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

async function sendSms(phone: string, portName: string, portId: string, wait: number) {
  if (!process.env.TWILIO_ACCOUNT_SID || !process.env.TWILIO_AUTH_TOKEN || !process.env.TWILIO_PHONE_NUMBER) return
  const url = `https://cruzar.app/port/${encodeURIComponent(portId)}`
  const body = `🌉 Cruzar Alert: ${portName} is now ${wait} min. ${url}`
  const auth = Buffer.from(`${process.env.TWILIO_ACCOUNT_SID}:${process.env.TWILIO_AUTH_TOKEN}`).toString('base64')
  await fetch(`https://api.twilio.com/2010-04-01/Accounts/${process.env.TWILIO_ACCOUNT_SID}/Messages.json`, {
    method: 'POST',
    headers: { Authorization: `Basic ${auth}`, 'Content-Type': 'application/x-www-form-urlencoded' },
    body: new URLSearchParams({ To: phone, From: process.env.TWILIO_PHONE_NUMBER, Body: body }).toString(),
  })
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

    // Batch fetch all users upfront — avoids N+1 query per alert
    const uniqueUserIds = [...new Set(alerts.map(a => a.user_id))]
    const userMap: Record<string, { email?: string }> = {}
    await Promise.all(
      uniqueUserIds.map(async (uid) => {
        const { data: { user } } = await supabase.auth.admin.getUserById(uid)
        if (user) userMap[uid] = { email: user.email }
      })
    )

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

      const user = userMap[alert.user_id]
      if (!user) continue

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
        user.email ? sendEmail(user.email, reading.port_name, alert.port_id, wait, alert.threshold_minutes) : null,
        sendPush(alert.user_id, reading.port_name, alert.port_id, wait),
        alert.phone ? sendSms(alert.phone, reading.port_name, alert.port_id, wait) : null,
      ])
      results.forEach((r, i) => {
        if (r.status === 'rejected') console.error(`Alert send failed [${['email','push','sms'][i]}] user=${alert.user_id}:`, r.reason)
      })

      sent++
    }

    return NextResponse.json({ sent, checked: alerts.length })
  } catch (err) {
    console.error('send-alerts cron error:', err)
    return NextResponse.json({ error: String(err) }, { status: 500 })
  }
}
