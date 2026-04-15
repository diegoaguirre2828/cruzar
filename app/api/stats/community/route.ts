import { NextResponse } from 'next/server'
import { getServiceClient } from '@/lib/supabase'

export const dynamic = 'force-dynamic'
export const revalidate = 60

// Public read-only endpoint that powers the home-page social proof strip
// AND the first-1000 progress bar. Returns real numbers, cached at the
// Vercel edge for 60 seconds so hitting refresh doesn't pound the DB.
//
// Shape:
//   totalUsers      — count of rows in profiles
//   reportsLast7d   — count of crossing_reports in last 7 days
//   reportsLast24h  — count of crossing_reports in last 24 hours
//   topReporters    — up to 5 public display names + points, ordered by reports_count
//   promoRemaining  — max(0, 1000 - totalUsers) — drives the "X cupos restantes" strip

interface StatsResponse {
  totalUsers: number
  reportsLast7d: number
  reportsLast24h: number
  topReporters: { display_name: string; points: number; reports_count: number }[]
  promoRemaining: number
  generatedAt: string
}

export async function GET(): Promise<Response> {
  const db = getServiceClient()

  const since7d = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000).toISOString()
  const since24h = new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString()

  const [{ count: totalUsers }, { count: reports7 }, { count: reports24 }, topRes] = await Promise.all([
    db.from('profiles').select('id', { count: 'exact', head: true }),
    db.from('crossing_reports').select('id', { count: 'exact', head: true }).gte('created_at', since7d),
    db.from('crossing_reports').select('id', { count: 'exact', head: true }).gte('created_at', since24h),
    db.from('profiles').select('display_name, points, reports_count').order('reports_count', { ascending: false }).limit(5),
  ])

  const topReporters = (topRes.data || [])
    .filter((r) => r.display_name && r.reports_count && r.reports_count > 0)
    .map((r) => ({
      display_name: r.display_name as string,
      points: (r.points as number) || 0,
      reports_count: (r.reports_count as number) || 0,
    }))

  const body: StatsResponse = {
    totalUsers: totalUsers || 0,
    reportsLast7d: reports7 || 0,
    reportsLast24h: reports24 || 0,
    topReporters,
    promoRemaining: Math.max(0, 1000 - (totalUsers || 0)),
    generatedAt: new Date().toISOString(),
  }

  return NextResponse.json(body, {
    headers: { 'Cache-Control': 'public, s-maxage=60, stale-while-revalidate=120' },
  })
}
