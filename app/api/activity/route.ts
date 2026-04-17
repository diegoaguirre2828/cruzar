import { NextResponse } from 'next/server'
import { getServiceClient } from '@/lib/supabase'

export const dynamic = 'force-dynamic'

export async function GET() {
  const since30 = new Date(Date.now() - 30 * 60 * 1000).toISOString()
  const db = getServiceClient()

  const { data, error } = await db
    .from('crossing_reports')
    .select('port_id, report_type, wait_minutes, created_at')
    .is('hidden_at', null)  // v35 moderation: skip reports an admin flagged
    .gte('created_at', since30)
    .order('created_at', { ascending: false })

  if (error) return NextResponse.json({ pulse: [] })

  // Group by port_id
  const portMap: Record<string, {
    count: number
    waitMinutes: number[]
    types: string[]
    latest: string
  }> = {}

  for (const r of (data || [])) {
    if (!portMap[r.port_id]) {
      portMap[r.port_id] = { count: 0, waitMinutes: [], types: [], latest: r.created_at }
    }
    portMap[r.port_id].count++
    if (r.wait_minutes) portMap[r.port_id].waitMinutes.push(r.wait_minutes)
    portMap[r.port_id].types.push(r.report_type || 'other')
  }

  const pulse = Object.entries(portMap)
    .map(([portId, stats]) => {
      const avgWait = stats.waitMinutes.length
        ? Math.round(stats.waitMinutes.reduce((a, b) => a + b, 0) / stats.waitMinutes.length)
        : null
      const clearCount = stats.types.filter(t => t === 'clear' || t === 'fast').length
      const slowCount = stats.types.filter(t => t === 'delay' || t === 'slow').length
      const mood = clearCount > slowCount ? 'fast' : slowCount > clearCount ? 'slow' : 'mixed'
      const minsAgo = Math.round((Date.now() - new Date(stats.latest).getTime()) / 60000)
      return { portId, count: stats.count, avgWait, mood, minsAgo }
    })
    .sort((a, b) => b.count - a.count)

  return NextResponse.json({ pulse })
}
