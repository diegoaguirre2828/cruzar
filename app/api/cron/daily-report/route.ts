import { NextRequest, NextResponse } from 'next/server'
import { getServiceClient } from '@/lib/supabase'

export const dynamic = 'force-dynamic'

/*
 * GET /api/cron/daily-report?secret=CRON_SECRET
 *
 * Computes a daily summary of all border wait times for the previous day
 * (or a specific date via ?date=YYYY-MM-DD). Stores the result in the
 * daily_reports table for the SEO landing pages at /data/[date].
 *
 * Schedule: once per day at 01:00 CT via cron-job.org (after midnight
 * so all readings for the previous day are in).
 *
 * The SEO pages can also compute the report on the fly from
 * wait_time_readings if the daily_reports row doesn't exist yet, so
 * this cron is an optimization, not a hard requirement.
 */

interface PortStats {
  port_id: string
  port_name: string
  crossing_name: string | null
  avg_wait: number | null
  min_wait: number | null
  max_wait: number | null
  peak_hour: number | null
  peak_wait: number | null
  best_hour: number | null
  best_wait: number | null
  readings_count: number
}

export async function GET(req: NextRequest) {
  const secret = req.nextUrl.searchParams.get('secret')
  const auth = req.headers.get('authorization')
  if (secret !== process.env.CRON_SECRET && auth !== `Bearer ${process.env.CRON_SECRET}`) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  // Default to yesterday (CT = UTC-5 approx)
  const dateParam = req.nextUrl.searchParams.get('date')
  let targetDate: string
  if (dateParam && /^\d{4}-\d{2}-\d{2}$/.test(dateParam)) {
    targetDate = dateParam
  } else {
    const now = new Date()
    // Approximate CT: UTC - 5 hours
    const ct = new Date(now.getTime() - 5 * 60 * 60 * 1000)
    ct.setDate(ct.getDate() - 1)
    targetDate = ct.toISOString().split('T')[0]
  }

  const startOfDay = `${targetDate}T00:00:00.000Z`
  const endOfDay = `${targetDate}T23:59:59.999Z`

  const db = getServiceClient()

  try {
    // Fetch all readings for the target date
    const { data: readings, error } = await db
      .from('wait_time_readings')
      .select('port_id, port_name, crossing_name, vehicle_wait, hour_of_day, recorded_at')
      .gte('recorded_at', startOfDay)
      .lte('recorded_at', endOfDay)
      .not('vehicle_wait', 'is', null)
      .order('recorded_at', { ascending: true })

    if (error) throw error

    if (!readings || readings.length === 0) {
      return NextResponse.json({
        date: targetDate,
        ports: 0,
        message: 'No readings found for this date',
      })
    }

    // Group by port_id
    const byPort = new Map<string, typeof readings>()
    for (const r of readings) {
      if (!byPort.has(r.port_id)) byPort.set(r.port_id, [])
      byPort.get(r.port_id)!.push(r)
    }

    // Compute stats per port
    const portStats: PortStats[] = []
    for (const [portId, portReadings] of byPort) {
      const waits = portReadings
        .map((r) => r.vehicle_wait as number)
        .filter((w) => w != null && w >= 0)

      if (waits.length === 0) continue

      const avg = Math.round(waits.reduce((s, w) => s + w, 0) / waits.length)
      const min = Math.min(...waits)
      const max = Math.max(...waits)

      // Group by hour to find peak and best
      const hourMap = new Map<number, number[]>()
      for (const r of portReadings) {
        const h = r.hour_of_day as number
        const w = r.vehicle_wait as number
        if (h == null || w == null) continue
        if (!hourMap.has(h)) hourMap.set(h, [])
        hourMap.get(h)!.push(w)
      }

      let peakHour: number | null = null
      let peakWait: number | null = null
      let bestHour: number | null = null
      let bestWait: number | null = null

      for (const [hour, hourWaits] of hourMap) {
        const hourAvg = hourWaits.reduce((s, w) => s + w, 0) / hourWaits.length
        if (peakWait === null || hourAvg > peakWait) {
          peakHour = hour
          peakWait = Math.round(hourAvg)
        }
        if (bestWait === null || hourAvg < bestWait) {
          bestHour = hour
          bestWait = Math.round(hourAvg)
        }
      }

      portStats.push({
        port_id: portId,
        port_name: portReadings[0].port_name,
        crossing_name: portReadings[0].crossing_name ?? null,
        avg_wait: avg,
        min_wait: min,
        max_wait: max,
        peak_hour: peakHour,
        peak_wait: peakWait,
        best_hour: bestHour,
        best_wait: bestWait,
        readings_count: waits.length,
      })
    }

    // Sort by avg_wait descending so busiest ports appear first
    portStats.sort((a, b) => (b.avg_wait ?? 0) - (a.avg_wait ?? 0))

    // Compute global summary
    const allAvgs = portStats.map((p) => p.avg_wait).filter((a): a is number => a != null)
    const globalAvg = allAvgs.length > 0
      ? Math.round(allAvgs.reduce((s, a) => s + a, 0) / allAvgs.length)
      : null

    const reportData = {
      date: targetDate,
      global_avg_wait: globalAvg,
      total_ports: portStats.length,
      total_readings: readings.length,
      ports: portStats,
    }

    // Upsert into daily_reports (creates if table exists, silently skips if not)
    await db
      .from('daily_reports')
      .upsert(
        {
          report_date: targetDate,
          report_data: reportData,
          created_at: new Date().toISOString(),
        },
        { onConflict: 'report_date' }
      )
      .then(() => {}, () => {
        // Table may not exist yet — that's fine, the SEO page will
        // compute on the fly from wait_time_readings directly.
      })

    // Piggyback the install-reminder loop onto this same daily fire so
    // we don't need to add another cron-job.org schedule. Fires the
    // /api/cron/install-reminder route in-process via fetch — keeps the
    // logic isolated in its own file but avoids extra scheduling.
    let reminderResult: unknown = null
    try {
      const base = process.env.NEXT_PUBLIC_APP_URL || 'https://www.cruzar.app'
      const r = await fetch(
        `${base}/api/cron/install-reminder?secret=${encodeURIComponent(process.env.CRON_SECRET || '')}`,
        { cache: 'no-store' }
      )
      reminderResult = await r.json().catch(() => ({ ok: r.ok }))
    } catch (e) {
      reminderResult = { error: String(e) }
    }

    return NextResponse.json({
      date: targetDate,
      ports: portStats.length,
      readings: readings.length,
      globalAvg: globalAvg,
      install_reminder: reminderResult,
    })
  } catch (err) {
    console.error('Daily report cron error:', err)
    return NextResponse.json({ error: String(err) }, { status: 500 })
  }
}
