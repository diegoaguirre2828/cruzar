import { NextRequest, NextResponse } from 'next/server'
import { getSupabase } from '@/lib/supabase'

// Returns average vehicle wait by hour-of-day across the last 14 days
// for a single port. Used by the HourlyWaitChart on the port detail
// page so users can see the typical pattern of a day at a glance.
export const revalidate = 600

export async function GET(
  _req: NextRequest,
  { params }: { params: Promise<{ portId: string }> }
) {
  const { portId } = await params

  const since = new Date(Date.now() - 14 * 24 * 60 * 60 * 1000).toISOString()

  const { data, error } = await getSupabase()
    .from('wait_time_readings')
    .select('hour_of_day, day_of_week, vehicle_wait')
    .eq('port_id', portId)
    .gte('recorded_at', since)
    .not('vehicle_wait', 'is', null)

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })

  const hourBuckets: { sum: number; count: number }[] = Array.from({ length: 24 }, () => ({ sum: 0, count: 0 }))
  const todayDow = new Date().getDay()
  const todayBuckets: { sum: number; count: number }[] = Array.from({ length: 24 }, () => ({ sum: 0, count: 0 }))

  for (const row of data || []) {
    if (row.vehicle_wait == null || row.hour_of_day == null) continue
    const h = row.hour_of_day as number
    const w = row.vehicle_wait as number
    hourBuckets[h].sum += w
    hourBuckets[h].count += 1
    if (row.day_of_week === todayDow) {
      todayBuckets[h].sum += w
      todayBuckets[h].count += 1
    }
  }

  const hours = hourBuckets.map((b, h) => ({
    hour: h,
    avgWait: b.count > 0 ? Math.round(b.sum / b.count) : null,
    todayAvg: todayBuckets[h].count > 0 ? Math.round(todayBuckets[h].sum / todayBuckets[h].count) : null,
    samples: b.count,
  }))

  const valid = hours.filter(h => h.avgWait != null) as { hour: number; avgWait: number }[]
  const peak = valid.length > 0 ? valid.reduce((a, b) => (b.avgWait > a.avgWait ? b : a)) : null
  const best = valid.length > 0 ? valid.reduce((a, b) => (b.avgWait < a.avgWait ? b : a)) : null

  const totalSamples = hourBuckets.reduce((s, b) => s + b.count, 0)
  return NextResponse.json(
    { hours, peak, best, totalSamples },
    { headers: { 'Cache-Control': 's-maxage=600, stale-while-revalidate=1800' } }
  )
}
