import { NextRequest, NextResponse } from 'next/server'
import { getSupabase } from '@/lib/supabase'

// Returns day-of-week averages + rush windows + morning vs evening
// for a single port over the last 30 days. Powers the Pro insights page.
export const revalidate = 1800

const DOW_NAMES_EN = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday']
const DOW_NAMES_ES = ['Domingo', 'Lunes', 'Martes', 'Miércoles', 'Jueves', 'Viernes', 'Sábado']

export async function GET(
  _req: NextRequest,
  { params }: { params: Promise<{ portId: string }> }
) {
  const { portId } = await params
  const since = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000).toISOString()

  const { data, error } = await getSupabase()
    .from('wait_time_readings')
    .select('hour_of_day, day_of_week, vehicle_wait')
    .eq('port_id', portId)
    .gte('recorded_at', since)
    .not('vehicle_wait', 'is', null)

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })

  // Day-of-week buckets
  const dowBuckets: Array<{ sum: number; count: number; hours: Array<{ sum: number; count: number }> }> =
    Array.from({ length: 7 }, () => ({
      sum: 0,
      count: 0,
      hours: Array.from({ length: 24 }, () => ({ sum: 0, count: 0 })),
    }))

  for (const row of data || []) {
    if (row.vehicle_wait == null || row.day_of_week == null || row.hour_of_day == null) continue
    const dow = row.day_of_week as number
    const h = row.hour_of_day as number
    const w = row.vehicle_wait as number
    dowBuckets[dow].sum += w
    dowBuckets[dow].count += 1
    dowBuckets[dow].hours[h].sum += w
    dowBuckets[dow].hours[h].count += 1
  }

  // Day-of-week summary
  const days = dowBuckets.map((b, i) => ({
    dow: i,
    nameEn: DOW_NAMES_EN[i],
    nameEs: DOW_NAMES_ES[i],
    avgWait: b.count > 0 ? Math.round(b.sum / b.count) : null,
    samples: b.count,
  }))

  const validDays = days.filter(d => d.avgWait != null) as Array<typeof days[number] & { avgWait: number }>
  const bestDay = validDays.length > 0 ? validDays.reduce((a, b) => a.avgWait < b.avgWait ? a : b) : null
  const worstDay = validDays.length > 0 ? validDays.reduce((a, b) => a.avgWait > b.avgWait ? a : b) : null

  // Rush windows: contiguous hours where avg > 40 min
  const overallHours: Array<{ hour: number; avgWait: number | null }> = Array.from({ length: 24 }, (_, h) => {
    let sum = 0, count = 0
    for (const dow of dowBuckets) {
      if (dow.hours[h].count > 0) {
        sum += dow.hours[h].sum
        count += dow.hours[h].count
      }
    }
    return { hour: h, avgWait: count > 0 ? Math.round(sum / count) : null }
  })

  const rushWindows: Array<{ startHour: number; endHour: number; avgWait: number }> = []
  let rushStart: number | null = null
  let rushSum = 0, rushCount = 0
  for (let h = 0; h <= 24; h++) {
    const bucket = h < 24 ? overallHours[h] : null
    const isRush = bucket != null && bucket.avgWait != null && bucket.avgWait > 40
    if (isRush && bucket!.avgWait != null) {
      if (rushStart === null) rushStart = h
      rushSum += bucket!.avgWait!
      rushCount++
    } else if (rushStart !== null) {
      rushWindows.push({
        startHour: rushStart,
        endHour: h - 1,
        avgWait: Math.round(rushSum / rushCount),
      })
      rushStart = null
      rushSum = 0
      rushCount = 0
    }
  }

  // Morning (5-11) vs afternoon (12-18) vs evening (19-23)
  const timeBlocks = [
    { key: 'morning', labelEn: 'Morning (5am-11am)', labelEs: 'Mañana (5am-11am)', startH: 5, endH: 11 },
    { key: 'afternoon', labelEn: 'Afternoon (12pm-6pm)', labelEs: 'Tarde (12pm-6pm)', startH: 12, endH: 18 },
    { key: 'evening', labelEn: 'Evening (7pm-11pm)', labelEs: 'Noche (7pm-11pm)', startH: 19, endH: 23 },
  ].map(block => {
    let sum = 0, count = 0
    for (let h = block.startH; h <= block.endH; h++) {
      if (overallHours[h].avgWait != null) {
        sum += overallHours[h].avgWait!
        count++
      }
    }
    return { ...block, avgWait: count > 0 ? Math.round(sum / count) : null }
  })

  // Weekday vs weekend
  const weekdayAvg = (() => {
    const wd = [1, 2, 3, 4, 5].map(i => days[i]).filter(d => d.avgWait != null)
    if (wd.length === 0) return null
    return Math.round(wd.reduce((s, d) => s + d.avgWait!, 0) / wd.length)
  })()
  const weekendAvg = (() => {
    const we = [0, 6].map(i => days[i]).filter(d => d.avgWait != null)
    if (we.length === 0) return null
    return Math.round(we.reduce((s, d) => s + d.avgWait!, 0) / we.length)
  })()

  return NextResponse.json({
    days,
    bestDay,
    worstDay,
    rushWindows,
    timeBlocks,
    weekdayAvg,
    weekendAvg,
    totalSamples: (data || []).length,
  }, {
    headers: { 'Cache-Control': 's-maxage=1800, stale-while-revalidate=3600' },
  })
}
