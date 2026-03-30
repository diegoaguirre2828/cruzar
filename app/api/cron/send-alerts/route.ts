import { NextRequest, NextResponse } from 'next/server'
import { getServiceClient } from '@/lib/supabase'

async function sendEmail(email: string, portName: string, portId: string, wait: number, threshold: number) {
  if (!process.env.RESEND_API_KEY) return

  await fetch('https://api.resend.com/emails', {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${process.env.RESEND_API_KEY}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      from: process.env.RESEND_FROM_EMAIL || 'Cruza Alerts <onboarding@resend.dev>',
      to: [email],
      subject: `🌉 ${portName} wait dropped to ${wait} min`,
      html: `
        <div style="font-family:-apple-system,sans-serif;max-width:480px;margin:0 auto;padding:24px;">
          <h2 style="margin:0 0 16px;color:#111827;font-size:20px;">🌉 Cruza Alert</h2>
          <div style="background:#f0fdf4;border:1px solid #bbf7d0;border-radius:12px;padding:16px;margin-bottom:20px;">
            <p style="margin:0;font-size:16px;font-weight:600;color:#166534;">${portName} is now ${wait} min</p>
            <p style="margin:4px 0 0;font-size:14px;color:#16a34a;">Below your ${threshold}-minute alert threshold</p>
          </div>
          <a href="https://cruzaapp.vercel.app/port/${encodeURIComponent(portId)}"
             style="display:inline-block;background:#111827;color:white;text-decoration:none;padding:12px 24px;border-radius:10px;font-size:14px;font-weight:600;">
            View Live Wait Times →
          </a>
          <p style="margin:24px 0 0;font-size:12px;color:#9ca3af;">
            You're receiving this because you set a wait time alert on Cruza.
            <a href="https://cruzaapp.vercel.app/dashboard" style="color:#6b7280;">Manage alerts</a>
          </p>
        </div>
      `,
    }),
  })
}

export async function GET(req: NextRequest) {
  const authHeader = req.headers.get('authorization')
  const secret = req.nextUrl.searchParams.get('secret')
  const isAuthed =
    secret === process.env.CRON_SECRET ||
    authHeader === `Bearer ${process.env.CRON_SECRET}`

  if (!isAuthed) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  try {
    const supabase = getServiceClient()
    const oneHourAgo = new Date(Date.now() - 60 * 60 * 1000).toISOString()

    // Get alerts not triggered in the last hour
    const { data: alerts } = await supabase
      .from('alert_preferences')
      .select('*')
      .eq('active', true)
      .or(`last_triggered_at.is.null,last_triggered_at.lt.${oneHourAgo}`)

    if (!alerts?.length) return NextResponse.json({ sent: 0, checked: 0 })

    // Get most recent readings (last 30 min)
    const { data: readings } = await supabase
      .from('wait_time_readings')
      .select('port_id, port_name, vehicle_wait, commercial_wait, pedestrian_wait, sentri_wait, recorded_at')
      .gte('recorded_at', new Date(Date.now() - 30 * 60 * 1000).toISOString())
      .order('recorded_at', { ascending: false })

    // Latest reading per port
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

      // Get user email via admin API
      const { data: { user } } = await supabase.auth.admin.getUserById(alert.user_id)
      if (!user?.email) continue

      await sendEmail(user.email, reading.port_name, alert.port_id, wait, alert.threshold_minutes)

      await supabase
        .from('alert_preferences')
        .update({ last_triggered_at: new Date().toISOString() })
        .eq('id', alert.id)

      sent++
    }

    return NextResponse.json({ sent, checked: alerts.length })
  } catch (err) {
    console.error('send-alerts cron error:', err)
    return NextResponse.json({ error: String(err) }, { status: 500 })
  }
}
