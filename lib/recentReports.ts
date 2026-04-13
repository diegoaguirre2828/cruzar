import { getServiceClient } from '@/lib/supabase'

// Server-side fetch for recent community reports. Exists so the homepage
// can pull this data on the server in parallel with the port list —
// previously three client components (LiveActivityTicker, UrgentAlerts,
// HomeReportsFeed) each fired their own fetch to /api/reports/recent on
// mount, which meant 3 round-trips on a spotty border cell connection
// before the page settled. Now the server does it once and hands the
// data down as props.
//
// The client components still refresh on interval for live-feel, but
// the first paint is instant and doesn't need the network at all.

export interface RecentReport {
  id: string
  port_id: string
  report_type: string
  description: string | null
  wait_minutes: number | null
  upvotes: number
  created_at: string
  username: string | null
}

export async function fetchRecentReports(limit = 50): Promise<RecentReport[]> {
  try {
    const db = getServiceClient()
    const since = new Date(Date.now() - 12 * 60 * 60 * 1000).toISOString()
    const { data, error } = await db
      .from('crossing_reports')
      .select('id, port_id, report_type, description, wait_minutes, upvotes, created_at, username')
      .gte('created_at', since)
      .order('created_at', { ascending: false })
      .limit(limit)
    if (error) return []
    return (data || []) as RecentReport[]
  } catch {
    return []
  }
}
