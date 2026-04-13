import { NextResponse } from 'next/server'
import { createServerClient } from '@supabase/ssr'
import { cookies } from 'next/headers'
import { getServiceClient } from '@/lib/supabase'

// Admin growth events endpoint. Reads the app_events table and
// returns counts bucketed by event_name for the last 7 days and
// 30 days. This is the read side of the tracking infra — new
// events flowing in via /api/events/track get surfaced here so
// Diego can watch growth curves take shape as user count grows.

const ADMIN_EMAILS = (process.env.ADMIN_EMAILS || '')
  .split(',')
  .map((e) => e.trim().toLowerCase())
  .filter(Boolean)

async function requireAdmin() {
  const cookieStore = await cookies()
  const supabase = createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    { cookies: { getAll: () => cookieStore.getAll() } },
  )
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return null
  if (ADMIN_EMAILS.length > 0 && !ADMIN_EMAILS.includes((user.email || '').toLowerCase())) {
    return null
  }
  return user
}

export async function GET() {
  const admin = await requireAdmin()
  if (!admin) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const db = getServiceClient()
  const now = Date.now()
  const since7 = new Date(now - 7 * 24 * 60 * 60 * 1000).toISOString()
  const since30 = new Date(now - 30 * 24 * 60 * 60 * 1000).toISOString()

  const { data, error } = await db
    .from('app_events')
    .select('event_name, created_at')
    .gte('created_at', since30)
    .limit(10000)

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  const rows = data || []

  const counts7: Record<string, number> = {}
  const counts30: Record<string, number> = {}
  for (const r of rows) {
    counts30[r.event_name] = (counts30[r.event_name] || 0) + 1
    if (r.created_at >= since7) {
      counts7[r.event_name] = (counts7[r.event_name] || 0) + 1
    }
  }

  const allNames = new Set([...Object.keys(counts7), ...Object.keys(counts30)])
  const events = Array.from(allNames)
    .map((name) => ({
      name,
      last7: counts7[name] || 0,
      last30: counts30[name] || 0,
    }))
    .sort((a, b) => b.last30 - a.last30)

  return NextResponse.json(
    { events, totalRows: rows.length },
    { headers: { 'Cache-Control': 'private, no-store' } },
  )
}
