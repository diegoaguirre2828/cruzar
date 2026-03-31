import { NextRequest, NextResponse } from 'next/server'
import { createServerClient } from '@supabase/ssr'
import { cookies } from 'next/headers'
import { getServiceClient } from '@/lib/supabase'
import { POINTS, getBadgesForProfile } from '@/lib/points'

async function getUser() {
  const cookieStore = await cookies()
  const supabase = createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    { cookies: { getAll: () => cookieStore.getAll() } }
  )
  const { data: { user } } = await supabase.auth.getUser()
  return user
}

async function awardPoints(userId: string, pts: number, reportsCount: number) {
  const db = getServiceClient()
  const newCount = reportsCount + 1
  const { data: profile } = await db
    .from('profiles')
    .select('points')
    .eq('id', userId)
    .single()

  const newPoints = (profile?.points || 0) + pts
  const badges = getBadgesForProfile(newCount, 0)

  await db.from('profiles').update({
    points: newPoints,
    reports_count: newCount,
    badges,
  }).eq('id', userId)

  return { newPoints, badges }
}

export async function GET(req: NextRequest) {
  const portId = req.nextUrl.searchParams.get('portId')
  if (!portId) return NextResponse.json({ error: 'portId required' }, { status: 400 })

  const since = new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString()
  const db = getServiceClient()

  const { data, error } = await db
    .from('crossing_reports')
    .select('id, report_type, description, severity, upvotes, created_at, wait_minutes, username')
    .eq('port_id', portId)
    .gte('created_at', since)
    .order('created_at', { ascending: false })
    .limit(30)

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json({ reports: data })
}

export async function POST(req: NextRequest) {
  const body = await req.json()
  const { portId, reportType, condition, description, severity, waitMinutes, note, waitingMode } = body

  // Support both reportType and condition field names
  const type = reportType || condition || 'other'
  if (!portId) return NextResponse.json({ error: 'portId required' }, { status: 400 })

  const validTypes = ['delay', 'accident', 'inspection', 'clear', 'other', 'fast', 'normal', 'slow']
  const mappedType = type === 'fast' ? 'clear' : type === 'slow' ? 'delay' : type === 'normal' ? 'other' : type
  if (!validTypes.includes(type)) return NextResponse.json({ error: 'Invalid report type' }, { status: 400 })

  const user = await getUser()
  const db = getServiceClient()

  // Check if this is the first report at this port today (bonus points)
  const todayStart = new Date()
  todayStart.setHours(0, 0, 0, 0)
  const { count: todayCount } = await db
    .from('crossing_reports')
    .select('id', { count: 'exact', head: true })
    .eq('port_id', portId)
    .gte('created_at', todayStart.toISOString())

  const isFirstToday = (todayCount || 0) === 0

  // Get username for display
  let username: string | null = null
  let reportsCount = 0
  if (user) {
    const { data: profile } = await db
      .from('profiles')
      .select('display_name, reports_count')
      .eq('id', user.id)
      .single()
    username = profile?.display_name || user.email?.split('@')[0] || null
    reportsCount = profile?.reports_count || 0
  }

  const { data: inserted, error } = await db.from('crossing_reports').insert({
    port_id: portId,
    report_type: mappedType,
    description: (description || note)?.slice(0, 500) || null,
    severity: severity || 'medium',
    user_id: user?.id || null,
    wait_minutes: waitMinutes || null,
    username,
  }).select('id').single()

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })

  // Award points if logged in
  let pointsEarned = 0
  let newBadges: string[] = []
  if (user) {
    let pts = POINTS.report_submitted
    if (waitMinutes) pts += POINTS.report_with_wait_time - POINTS.report_submitted
    if (isFirstToday) pts += POINTS.first_report_of_day
    if (waitingMode) pts += POINTS.waiting_mode_bonus

    // Check if this is a founder (first 100 reporters ever)
    const { count: totalReporters } = await db
      .from('profiles')
      .select('id', { count: 'exact', head: true })
      .gt('reports_count', 0)
    const isFounder = (totalReporters || 0) <= 100

    const result = await awardPoints(user.id, pts, reportsCount)

    // Grant founder badge if eligible
    if (isFounder && !result.badges.includes('founder')) {
      result.badges = ['founder', ...result.badges]
      await db.from('profiles').update({ badges: result.badges }).eq('id', user.id)
    }
    pointsEarned = pts
    newBadges = result.badges
  }

  return NextResponse.json({ success: true, id: inserted?.id, pointsEarned, newBadges })
}
