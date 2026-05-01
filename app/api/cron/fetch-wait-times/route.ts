import { NextRequest, NextResponse } from 'next/server'
import { fetchRgvWaitTimes, portUtcOffsetHours } from '@/lib/cbp'
import { getServiceClient } from '@/lib/supabase'
import { fetchAllClusterWeather, weatherForPort } from '@/lib/clusterWeather'

// Bumped from default to 60s 2026-05-01 — function now awaits the
// inlined calibration tick (~30s with 16 forecast calls) so the worker
// must stay alive long enough for both the wait-times scrape AND the
// calibration write/fill to complete in a single invocation.
export const maxDuration = 60
export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

export async function GET(req: NextRequest) {
  const secret = req.nextUrl.searchParams.get('secret')
  const authHeader = req.headers.get('authorization')
  const isAuthed =
    secret === process.env.CRON_SECRET ||
    authHeader === `Bearer ${process.env.CRON_SECRET}`
  if (!isAuthed) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  try {
    // Fetch CBP wait times + weather for every cluster in parallel so
    // the weather calls don't block the wait-time insert. Weather is
    // best-effort — if Open-Meteo is down, the row still gets saved
    // with null weather fields and the cron succeeds.
    const [ports, weatherMap] = await Promise.all([
      fetchRgvWaitTimes(),
      fetchAllClusterWeather().catch(() => new Map()),
    ])
    const supabase = getServiceClient()
    const now = new Date()

    const rows = ports.map((p) => {
      // day_of_week / hour_of_day must be in the port's LOCAL time, not UTC.
      // A Sunday 11pm reading in RGV = Monday 4am UTC — stored as Monday
      // would contaminate the "best time to cross" historical queries.
      const offsetHours = portUtcOffsetHours(p.portName)
      const portLocal = new Date(now.getTime() + offsetHours * 60 * 60 * 1000)
      const weather = weatherForPort(p.portId, weatherMap)

      return {
        port_id: p.portId,
        port_name: p.portName,
        crossing_name: p.crossingName,
        vehicle_wait: p.vehicle,
        sentri_wait: p.sentri,
        pedestrian_wait: p.pedestrian,
        commercial_wait: p.commercial,
        recorded_at: now.toISOString(),
        day_of_week: portLocal.getUTCDay(),
        hour_of_day: portLocal.getUTCHours(),

        // Lane utilization — already in the CBP response, previously
        // discarded on the way to storage. Capturing now gives us
        // "how many lanes were open when wait was X" analysis for
        // each port, which nobody else has.
        lanes_vehicle_open: p.vehicleLanesOpen,
        lanes_sentri_open: p.sentriLanesOpen,
        lanes_pedestrian_open: p.pedestrianLanesOpen,
        lanes_commercial_open: p.commercialLanesOpen,

        // Weather at reading time — the goldmine. After 30 days
        // we can publish "rain adds 18 min at Hidalgo on average",
        // correlations CBP literally cannot know. Fields are nullable;
        // rows before this column existed stay untouched.
        weather_temp_c: weather?.tempC ?? null,
        weather_precip_mm: weather?.precipMm ?? null,
        weather_wind_kph: weather?.windKph ?? null,
        weather_visibility_km: weather?.visibilityKm ?? null,
        weather_condition: weather?.condition ?? null,
      }
    })

    const { error } = await supabase.from('wait_time_readings').insert(rows)
    if (error) throw error

    // Piggyback: run report quality manager + health check on the same
    // 15-min cron cycle. Fire-and-forget so they don't block the response.
    const base = 'https://www.cruzar.app'
    const s = secret || process.env.CRON_SECRET
    fetch(`${base}/api/cron/report-quality?secret=${s}`).catch(() => {})
    fetch(`${base}/api/cron/health-check?secret=${s}`).catch(() => {})
    // Calibration loop piggybacks on the same scheduler — no separate
    // cron-job.org registration needed. Inlined import (not HTTP fetch)
    // because hitting our own public domain hits Vercel Attack Challenge
    // Mode and gets 403'd. Awaited so Vercel doesn't kill the worker
    // mid-tick — adds ~30s to this function but stays under 60s timeout.
    try {
      const { runCalibrationTick } = await import('@/lib/calibrationTick')
      await runCalibrationTick()
    } catch (calErr) {
      console.warn('[fetch-wait-times] calibration tick failed:', calErr)
    }

    // FB-page social posting — replaces the Make.com scenario that
    // was firing only 3×/week instead of the intended 4×/day. We're
    // already running every 15 min, so detect the 4 posting windows
    // (5:30 / 11:30 / 15:30 / 19:30 America/Chicago = roughly 10:30 /
    // 16:30 / 20:30 / 00:30 UTC depending on DST) and fire the social
    // post once per window. The /api/social/next-post endpoint has
    // its own dedupe (180-min skip), so even if we fire the wrong
    // 15-min slot it won't double-post.
    const utcMinute = now.getUTCMinutes()
    const utcHour = now.getUTCHours()
    // Posting hours in UTC (approx CT, daylight-saving aware via env override)
    const postHoursUtc = (process.env.SOCIAL_POST_HOURS_UTC || '10,16,20,0')
      .split(',').map((h) => parseInt(h.trim(), 10)).filter((n) => Number.isFinite(n))
    if (postHoursUtc.includes(utcHour) && utcMinute < 15) {
      // Fire-and-forget — dedupe protects against duplicates
      fetch(`${base}/api/social/next-post`).catch(() => {})
    }

    return NextResponse.json({
      saved: rows.length,
      weatherClusters: weatherMap.size,
      at: now.toISOString(),
    })
  } catch (err) {
    console.error('Cron error:', err)
    return NextResponse.json({ error: String(err) }, { status: 500 })
  }
}
