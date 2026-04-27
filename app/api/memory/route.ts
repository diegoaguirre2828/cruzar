import { NextResponse } from 'next/server'
import { createServerClient } from '@supabase/ssr'
import { cookies } from 'next/headers'
import { getServiceClient } from '@/lib/supabase'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

interface ReportRow {
  id: string
  port_id: string
  wait_minutes: number | null
  recorded_at: string | null
  created_at: string
  report_type: string | null
}

interface MemoryResponse {
  totals: {
    reports: number
    saved: number
    points: number
    days_active: number
    member_since: string | null
  }
  favorite_port: { port_id: string; count: number } | null
  longest_wait: { port_id: string; wait_minutes: number; recorded_at: string } | null
  fastest_wait: { port_id: string; wait_minutes: number; recorded_at: string } | null
  by_port: { port_id: string; count: number }[]
  by_month: { ym: string; count: number }[]
  recent: ReportRow[]
}

export async function GET() {
  const cookieStore = await cookies()
  const supabase = createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        getAll: () => cookieStore.getAll(),
        setAll: () => {},
      },
    },
  )
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'unauthorized' }, { status: 401 })

  const db = getServiceClient()

  const [profileRes, reportsRes, savedRes] = await Promise.all([
    db.from('profiles').select('points, created_at').eq('id', user.id).maybeSingle(),
    db
      .from('crossing_reports')
      .select('id, port_id, wait_minutes, recorded_at, created_at, report_type')
      .eq('user_id', user.id)
      .order('created_at', { ascending: false })
      .limit(2000),
    db.from('saved_crossings').select('port_id').eq('user_id', user.id),
  ])

  const reports = (reportsRes.data ?? []) as ReportRow[]
  const saved = savedRes.data ?? []
  const points = profileRes.data?.points ?? 0
  const memberSince = profileRes.data?.created_at ?? null

  const portCounts = new Map<string, number>()
  const monthCounts = new Map<string, number>()
  const dayKeys = new Set<string>()

  let longestWait: ReportRow | null = null
  let fastestWait: ReportRow | null = null

  for (const r of reports) {
    const pid = r.port_id
    portCounts.set(pid, (portCounts.get(pid) ?? 0) + 1)

    const ts = r.recorded_at ?? r.created_at
    const d = new Date(ts)
    if (!Number.isNaN(d.getTime())) {
      const ym = `${d.getUTCFullYear()}-${String(d.getUTCMonth() + 1).padStart(2, '0')}`
      monthCounts.set(ym, (monthCounts.get(ym) ?? 0) + 1)
      dayKeys.add(d.toISOString().slice(0, 10))
    }

    if (typeof r.wait_minutes === 'number' && r.wait_minutes >= 0) {
      if (!longestWait || (longestWait.wait_minutes ?? -1) < r.wait_minutes) longestWait = r
      if (!fastestWait || (fastestWait.wait_minutes ?? Infinity) > r.wait_minutes) fastestWait = r
    }
  }

  const byPort = Array.from(portCounts.entries())
    .map(([port_id, count]) => ({ port_id, count }))
    .sort((a, b) => b.count - a.count)

  const byMonth = Array.from(monthCounts.entries())
    .map(([ym, count]) => ({ ym, count }))
    .sort((a, b) => a.ym.localeCompare(b.ym))

  const favoritePort = byPort[0] ?? null

  const response: MemoryResponse = {
    totals: {
      reports: reports.length,
      saved: saved.length,
      points,
      days_active: dayKeys.size,
      member_since: memberSince,
    },
    favorite_port: favoritePort,
    longest_wait: longestWait
      ? {
          port_id: longestWait.port_id,
          wait_minutes: longestWait.wait_minutes ?? 0,
          recorded_at: longestWait.recorded_at ?? longestWait.created_at,
        }
      : null,
    fastest_wait: fastestWait
      ? {
          port_id: fastestWait.port_id,
          wait_minutes: fastestWait.wait_minutes ?? 0,
          recorded_at: fastestWait.recorded_at ?? fastestWait.created_at,
        }
      : null,
    by_port: byPort.slice(0, 12),
    by_month: byMonth,
    recent: reports.slice(0, 50),
  }

  return NextResponse.json(response)
}
