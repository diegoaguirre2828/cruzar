import { NextRequest, NextResponse } from 'next/server'
import { getServiceClient } from '@/lib/supabase'

export async function GET(req: NextRequest) {
  const secret = req.nextUrl.searchParams.get('secret')
  const authHeader = req.headers.get('authorization')
  const isAuthed = secret === process.env.CRON_SECRET || authHeader === `Bearer ${process.env.CRON_SECRET}`
  if (!isAuthed) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  if (!process.env.RESEND_API_KEY) return NextResponse.json({ error: 'No email configured' }, { status: 500 })

  // Monday-only guard. Cron-job.org schedule should already fire only
  // on Mondays, but a mis-set schedule blasted all Pro users on a
  // Saturday (2026-04-18), burning ~30 emails of the Resend 100/day
  // free-tier quota. This defensive day-of-week check ensures even a
  // mis-scheduled trigger can't fire the digest on the wrong day.
  // Use Central Time (UTC-5 / -6) since Cruzar's audience is CT.
  // Force=1 query param bypasses the guard for manual admin runs.
  const force = req.nextUrl.searchParams.get('force') === '1'
  const ctNow = new Date(new Date().toLocaleString('en-US', { timeZone: 'America/Chicago' }))
  const isMonday = ctNow.getDay() === 1
  if (!force && !isMonday) {
    return NextResponse.json({
      skipped: true,
      reason: 'weekly-digest only runs on Monday CT. Pass ?force=1 to override.',
      dayOfWeek: ctNow.getDay(),
    })
  }

  const db = getServiceClient()

  // Get all business + pro users
  const { data: profiles } = await db
    .from('profiles')
    .select('id, tier')
    .in('tier', ['pro', 'business'])

  if (!profiles?.length) return NextResponse.json({ sent: 0 })

  const sevenDaysAgo = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000).toISOString()
  let sent = 0

  for (const profile of profiles) {
    // Get their saved crossings
    const { data: saved } = await db
      .from('saved_crossings')
      .select('port_id')
      .eq('user_id', profile.id)

    if (!saved?.length) continue

    const portIds = saved.map(s => s.port_id)

    // Get readings for the last 7 days
    const { data: readings } = await db
      .from('wait_time_readings')
      .select('port_id, port_name, vehicle_wait, recorded_at, hour_of_day, day_of_week')
      .in('port_id', portIds)
      .gte('recorded_at', sevenDaysAgo)
      .not('vehicle_wait', 'is', null)

    if (!readings?.length) continue

    // Compute stats per port
    const stats: Record<string, { portName: string; avg: number; min: number; max: number; count: number; bestHour: number }> = {}
    const hourTotals: Record<string, Record<number, { sum: number; count: number }>> = {}

    for (const r of readings) {
      if (!stats[r.port_id]) {
        stats[r.port_id] = { portName: r.port_name, avg: 0, min: Infinity, max: 0, count: 0, bestHour: 0 }
        hourTotals[r.port_id] = {}
      }
      const s = stats[r.port_id]
      s.count++
      s.min = Math.min(s.min, r.vehicle_wait)
      s.max = Math.max(s.max, r.vehicle_wait)
      s.avg += r.vehicle_wait

      const h = r.hour_of_day
      if (!hourTotals[r.port_id][h]) hourTotals[r.port_id][h] = { sum: 0, count: 0 }
      hourTotals[r.port_id][h].sum += r.vehicle_wait
      hourTotals[r.port_id][h].count++
    }

    const portRows: string[] = []
    for (const [portId, s] of Object.entries(stats)) {
      s.avg = Math.round(s.avg / s.count)

      // Find best hour
      let bestHour = 0, bestAvg = Infinity
      for (const [h, data] of Object.entries(hourTotals[portId])) {
        const avg = data.sum / data.count
        if (avg < bestAvg) { bestAvg = avg; bestHour = parseInt(h) }
      }
      s.bestHour = bestHour

      const fmtHour = (h: number) => h === 0 ? '12am' : h < 12 ? `${h}am` : h === 12 ? '12pm' : `${h - 12}pm`

      portRows.push(`
        <tr>
          <td style="padding:10px 12px;font-weight:600;color:#111827;">${s.portName}</td>
          <td style="padding:10px 12px;text-align:center;color:#374151;">${s.avg} min</td>
          <td style="padding:10px 12px;text-align:center;color:#16a34a;">${s.min} min</td>
          <td style="padding:10px 12px;text-align:center;color:#dc2626;">${s.max} min</td>
          <td style="padding:10px 12px;text-align:center;color:#2563eb;">${fmtHour(s.bestHour)}</td>
        </tr>
      `)
    }

    if (!portRows.length) continue

    const { data: { user }, error: userErr } = await db.auth.admin.getUserById(profile.id)
    if (userErr) { console.error('weekly-digest: failed to fetch user', profile.id, userErr); continue }
    if (!user?.email) continue

    const html = `
      <div style="font-family:-apple-system,sans-serif;max-width:600px;margin:0 auto;padding:24px;color:#111827;">
        <h1 style="font-size:22px;font-weight:700;margin:0 0 4px;">🌉 Your Weekly Border Report</h1>
        <p style="color:#6b7280;margin:0 0 24px;font-size:14px;">Week of ${new Date().toLocaleDateString('en-US', { month: 'long', day: 'numeric', year: 'numeric' })}</p>

        <table style="width:100%;border-collapse:collapse;border-radius:12px;overflow:hidden;border:1px solid #e5e7eb;">
          <thead>
            <tr style="background:#f9fafb;">
              <th style="padding:10px 12px;text-align:left;font-size:12px;color:#6b7280;text-transform:uppercase;">Crossing</th>
              <th style="padding:10px 12px;text-align:center;font-size:12px;color:#6b7280;text-transform:uppercase;">Avg</th>
              <th style="padding:10px 12px;text-align:center;font-size:12px;color:#6b7280;text-transform:uppercase;">Best</th>
              <th style="padding:10px 12px;text-align:center;font-size:12px;color:#6b7280;text-transform:uppercase;">Worst</th>
              <th style="padding:10px 12px;text-align:center;font-size:12px;color:#6b7280;text-transform:uppercase;">Best Hour</th>
            </tr>
          </thead>
          <tbody>${portRows.join('')}</tbody>
        </table>

        <div style="margin-top:24px;text-align:center;">
          <a href="https://cruzar.app/dashboard"
             style="display:inline-block;background:#111827;color:white;text-decoration:none;padding:12px 28px;border-radius:10px;font-size:14px;font-weight:600;">
            View Live Wait Times →
          </a>
        </div>

        <p style="margin-top:24px;font-size:12px;color:#9ca3af;text-align:center;">
          Cruzar · <a href="https://cruzar.app/dashboard" style="color:#9ca3af;">Manage preferences</a>
        </p>
      </div>
    `

    const emailRes = await fetch('https://api.resend.com/emails', {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${process.env.RESEND_API_KEY}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        from: process.env.RESEND_FROM_EMAIL || 'Cruzar <onboarding@resend.dev>',
        to: [user.email],
        subject: `🌉 Your weekly border crossing report`,
        html,
      }),
    })
    if (!emailRes.ok) {
      console.error('weekly-digest: email failed for', user.email, await emailRes.text())
      continue
    }

    sent++
  }

  return NextResponse.json({ sent, total: profiles.length })
}
