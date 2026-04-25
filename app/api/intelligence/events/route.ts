import { NextRequest, NextResponse } from 'next/server'
import { createServerClient } from '@supabase/ssr'
import { cookies } from 'next/headers'
import { getServiceClient } from '@/lib/supabase'

export const dynamic = 'force-dynamic'

// GET /api/intelligence/events
//
// Query the ingested intel_events dataset. Free tier sees the most
// recent 50 (so the marketing page works). Pro / Enterprise tier
// can paginate + filter (?since= ?impact= ?corridor= ?language=).
// Optional ?format=csv returns a CSV download instead of JSON.

const VALID_IMPACTS = new Set(['cartel','protest','vucem','tariff','weather','infra','policy','other'])
const VALID_LANGUAGES = new Set(['es','en'])
const FREE_LIMIT = 50
const PAID_LIMIT = 5000

export async function GET(req: NextRequest) {
  const cookieStore = await cookies()
  const supabase = createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    { cookies: { getAll: () => cookieStore.getAll() } }
  )
  const { data: { user } } = await supabase.auth.getUser()

  // Determine paid status — pro / enterprise intel_subscribers OR
  // operator/business profile tier (Operator subscription includes
  // Intelligence Brief alerts as a perk per pricing copy).
  let paid = false
  if (user) {
    const db = getServiceClient()
    const [{ data: profile }, { data: sub }] = await Promise.all([
      db.from('profiles').select('tier').eq('id', user.id).maybeSingle(),
      db.from('intel_subscribers').select('tier, active').eq('user_id', user.id).maybeSingle(),
    ])
    if (profile?.tier === 'operator' || profile?.tier === 'business' || profile?.tier === 'pro') paid = true
    if (sub?.active && (sub.tier === 'pro' || sub.tier === 'enterprise')) paid = true
  }

  const url = new URL(req.url)
  const sinceRaw = url.searchParams.get('since')
  const since = sinceRaw && !Number.isNaN(Date.parse(sinceRaw)) ? new Date(sinceRaw).toISOString() : null
  const impactRaw = url.searchParams.get('impact')
  const corridorRaw = url.searchParams.get('corridor')
  const languageRaw = url.searchParams.get('language')
  const format = (url.searchParams.get('format') || 'json').toLowerCase()
  const limit = Math.min(paid ? PAID_LIMIT : FREE_LIMIT, parseInt(url.searchParams.get('limit') || '0', 10) || (paid ? 500 : FREE_LIMIT))

  const db = getServiceClient()
  let query = db
    .from('intel_events')
    .select('id, source, source_url, headline, body, language, impact_tag, corridor, occurred_at, ingested_at, alert_score')
    .order('ingested_at', { ascending: false })
    .limit(limit)
  if (since) query = query.gte('ingested_at', since)
  if (impactRaw && VALID_IMPACTS.has(impactRaw)) query = query.eq('impact_tag', impactRaw)
  if (corridorRaw) query = query.eq('corridor', corridorRaw)
  if (languageRaw && VALID_LANGUAGES.has(languageRaw)) query = query.eq('language', languageRaw)

  const { data: events, error } = await query
  if (error) return NextResponse.json({ error: error.message }, { status: 500 })

  if (format === 'csv') {
    if (!paid) {
      return NextResponse.json({ error: 'CSV export requires Cruzar Intelligence subscription.', upgrade: '/pricing#intelligence' }, { status: 402 })
    }
    const header = 'id,ingested_at,occurred_at,source,impact,corridor,language,headline,source_url,alert_score'
    const rows = (events || []).map((e) => [
      e.id,
      e.ingested_at,
      e.occurred_at || '',
      e.source,
      e.impact_tag || '',
      e.corridor || '',
      e.language || '',
      `"${String(e.headline || '').replace(/"/g, '""')}"`,
      e.source_url || '',
      e.alert_score ?? '',
    ].join(','))
    return new NextResponse([header, ...rows].join('\n'), {
      status: 200,
      headers: {
        'Content-Type': 'text/csv; charset=utf-8',
        'Content-Disposition': `attachment; filename="cruzar-intel-events-${new Date().toISOString().slice(0,10)}.csv"`,
      },
    })
  }

  return NextResponse.json({
    events: events || [],
    count: events?.length || 0,
    paid,
    limit,
  })
}
