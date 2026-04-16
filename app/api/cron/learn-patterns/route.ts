import { NextRequest, NextResponse } from 'next/server'
import { getServiceClient } from '@/lib/supabase'

export const dynamic = 'force-dynamic'

/*
 * GET /api/cron/learn-patterns?secret=CRON_SECRET
 *
 * Runs daily (or weekly). Analyzes each user's activity history to
 * learn their typical crossing window. Writes digest_window_hour and
 * digest_window_days to profiles.
 *
 * Signals used (in priority order):
 *   1. crossing_reports.created_at (strongest: they were AT the bridge)
 *   2. profiles.last_seen_at history (weaker: they opened the app)
 *
 * Algorithm: bucket all timestamps into hour-of-day (CT timezone).
 * The hour with the most activity = their typical window. Days are
 * derived from which days-of-week have 2+ data points.
 *
 * Minimum: 3 data points before we set a window. Below that, the
 * user hasn't given us enough signal to be confident.
 */

export async function GET(req: NextRequest) {
  const secret = req.nextUrl.searchParams.get('secret')
  const auth = req.headers.get('authorization')
  if (secret !== process.env.CRON_SECRET && auth !== `Bearer ${process.env.CRON_SECRET}`) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  const db = getServiceClient()

  /* Pull all reports with user_id + timestamp */
  const { data: reports } = await db
    .from('crossing_reports')
    .select('user_id, created_at')
    .not('user_id', 'is', null)

  if (!reports || reports.length === 0) {
    return NextResponse.json({ learned: 0, skipped: 0, reason: 'no_reports' })
  }

  /* Group by user */
  const byUser = new Map<string, { hour: number; dow: number }[]>()
  for (const r of reports) {
    if (!r.user_id || !r.created_at) continue
    const dt = new Date(r.created_at)
    /* Convert to CT (UTC-5 CDT, UTC-6 CST). Approximation: use -5 year-round.
       For production accuracy, use a timezone library. For MVP this is fine
       since the window is +/- 1 hour anyway. */
    const ctHour = (dt.getUTCHours() - 5 + 24) % 24
    const dow = dt.getUTCDay()
    if (!byUser.has(r.user_id)) byUser.set(r.user_id, [])
    byUser.get(r.user_id)!.push({ hour: ctHour, dow })
  }

  let learned = 0
  let skipped = 0

  for (const [userId, dataPoints] of byUser) {
    if (dataPoints.length < 3) {
      skipped++
      continue
    }

    /* Find the most common hour */
    const hourCounts = new Array(24).fill(0)
    const dowCounts = new Array(7).fill(0)
    for (const dp of dataPoints) {
      hourCounts[dp.hour]++
      dowCounts[dp.dow]++
    }

    const peakHour = hourCounts.indexOf(Math.max(...hourCounts))

    /* Days with 2+ data points */
    const activeDays = dowCounts
      .map((count, day) => (count >= 2 ? day : -1))
      .filter((d) => d >= 0)

    /* If no days meet the threshold, use all days with any activity */
    const days = activeDays.length > 0
      ? activeDays.join(',')
      : dowCounts.map((c, d) => (c > 0 ? d : -1)).filter((d) => d >= 0).join(',')

    await db
      .from('profiles')
      .update({
        digest_window_hour: peakHour,
        digest_window_days: days,
      })
      .eq('id', userId)

    learned++
  }

  return NextResponse.json({ learned, skipped, totalUsers: byUser.size })
}
