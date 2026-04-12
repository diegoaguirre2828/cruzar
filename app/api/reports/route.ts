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

// Rate limit: 10 reports/hour for guests, 30 for authenticated users
const reportRateLimit = new Map<string, { count: number; resetAt: number }>()

function checkReportRateLimit(key: string, max: number): boolean {
  const now = Date.now()
  const entry = reportRateLimit.get(key)
  if (!entry || now > entry.resetAt) {
    reportRateLimit.set(key, { count: 1, resetAt: now + 60 * 60 * 1000 })
    return true
  }
  if (entry.count >= max) return false
  entry.count++
  return true
}

export async function POST(req: NextRequest) {
  const body = await req.json()
  const { portId, reportType, condition, description, severity, waitMinutes, note, waitingMode, ref } = body

  // Support both reportType and condition field names
  const type = reportType || condition || 'other'
  if (!portId) return NextResponse.json({ error: 'portId required' }, { status: 400 })

  const validTypes = [
    'delay', 'accident', 'inspection', 'clear', 'other',
    'fast', 'normal', 'slow',
    'weather_fog', 'weather_rain', 'weather_wind', 'weather_dust',
    'officer_k9', 'officer_secondary',
    'road_construction', 'road_hazard',
    'reckless_driver',
  ]
  const mappedType = type === 'fast' ? 'clear' : type === 'slow' ? 'delay' : type === 'normal' ? 'other' : type
  if (!validTypes.includes(type) && !validTypes.includes(mappedType)) return NextResponse.json({ error: 'Invalid report type' }, { status: 400 })

  const user = await getUser()

  // Rate limit by user ID (authenticated) or IP (guest)
  const ip = req.headers.get('x-forwarded-for')?.split(',')[0] || 'unknown'
  const rateLimitKey = user ? `user:${user.id}` : `ip:${ip}`
  const rateLimitMax = user ? 30 : 10
  if (!checkReportRateLimit(rateLimitKey, rateLimitMax)) {
    return NextResponse.json({ error: 'Too many reports. Try again later.' }, { status: 429 })
  }

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

  // Award referral points if a valid ref was provided and user is logged in
  if (user && ref && typeof ref === 'string' && ref.length > 10 && ref !== user.id) {
    try {
      const { data: existing } = await db
        .from('referral_events')
        .select('id')
        .eq('referrer_id', ref)
        .eq('referred_user_id', user.id)
        .eq('event_type', 'report')
        .maybeSingle()

      if (!existing) {
        const { data: referrerProfile } = await db
          .from('profiles')
          .select('points')
          .eq('id', ref)
          .maybeSingle()

        if (referrerProfile) {
          await db.from('profiles').update({
            points: (referrerProfile.points || 0) + POINTS.referral_report,
          }).eq('id', ref)

          await db.from('referral_events').insert({
            referrer_id: ref,
            referred_user_id: user.id,
            event_type: 'report',
            port_id: portId,
            points_awarded: POINTS.referral_report,
          })
        }
      }
    } catch { /* non-critical — don't fail the report */ }
  }

  return NextResponse.json({ success: true, id: inserted?.id, pointsEarned, newBadges })
}
