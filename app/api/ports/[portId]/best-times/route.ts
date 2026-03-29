import { NextRequest, NextResponse } from 'next/server'
import { getSupabase } from '@/lib/supabase'

export async function GET(
  req: NextRequest,
  { params }: { params: Promise<{ portId: string }> }
) {
  const { portId } = await params
  const dayOfWeek = new Date().getDay()

  // Get average wait by hour for this port on today's day of week
  const { data, error } = await getSupabase()
    .from('wait_time_readings')
    .select('hour_of_day, vehicle_wait')
    .eq('port_id', portId)
    .eq('day_of_week', dayOfWeek)
    .not('vehicle_wait', 'is', null)

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })

  if (!data || data.length === 0) {
    return NextResponse.json({ bestTimes: [] })
  }

  // Group by hour and average
  const hourMap: Record<number, number[]> = {}
  for (const row of data) {
    if (row.vehicle_wait !== null) {
      if (!hourMap[row.hour_of_day]) hourMap[row.hour_of_day] = []
      hourMap[row.hour_of_day].push(row.vehicle_wait)
    }
  }

  const averages = Object.entries(hourMap).map(([hour, waits]) => ({
    hour: parseInt(hour),
    avgWait: Math.round(waits.reduce((a, b) => a + b, 0) / waits.length),
    samples: waits.length,
  }))

  averages.sort((a, b) => a.avgWait - b.avgWait)

  return NextResponse.json({ bestTimes: averages.slice(0, 5) })
}
