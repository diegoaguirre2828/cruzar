import { NextRequest, NextResponse } from 'next/server'
import { fetchRgvWaitTimes } from '@/lib/cbp'
import { getServiceClient } from '@/lib/supabase'

export async function GET(req: NextRequest) {
  // Protect cron endpoint
  const secret = req.headers.get('x-cron-secret') || req.nextUrl.searchParams.get('secret')
  if (secret !== process.env.CRON_SECRET) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  try {
    const ports = await fetchRgvWaitTimes()
    const supabase = getServiceClient()
    const now = new Date()

    const rows = ports.map((p) => ({
      port_id: p.portId,
      port_name: p.portName,
      crossing_name: p.crossingName,
      vehicle_wait: p.vehicle,
      sentri_wait: p.sentri,
      pedestrian_wait: p.pedestrian,
      commercial_wait: p.commercial,
      recorded_at: now.toISOString(),
      day_of_week: now.getDay(),
      hour_of_day: now.getHours(),
    }))

    const { error } = await supabase.from('wait_time_readings').insert(rows)
    if (error) throw error

    return NextResponse.json({ saved: rows.length, at: now.toISOString() })
  } catch (err) {
    console.error('Cron error:', err)
    return NextResponse.json({ error: String(err) }, { status: 500 })
  }
}
