import { NextRequest, NextResponse } from 'next/server'
import { getSupabase } from '@/lib/supabase'

export async function GET(
  _req: NextRequest,
  { params }: { params: Promise<{ portId: string }> }
) {
  const { portId } = await params

  const since = new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString()

  const { data, error } = await getSupabase()
    .from('wait_time_readings')
    .select('recorded_at, vehicle_wait, sentri_wait, pedestrian_wait, commercial_wait')
    .eq('port_id', portId)
    .gte('recorded_at', since)
    .order('recorded_at', { ascending: true })

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })

  return NextResponse.json({ history: data })
}
