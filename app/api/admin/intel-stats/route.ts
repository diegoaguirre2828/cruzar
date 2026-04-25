import { NextResponse } from 'next/server'
import { createServerClient } from '@supabase/ssr'
import { cookies } from 'next/headers'
import { getServiceClient } from '@/lib/supabase'

export const dynamic = 'force-dynamic'

const ADMIN_EMAIL = 'cruzabusiness@gmail.com'

// /api/admin/intel-stats
//
// Visibility into Phase 3 (Cruzar Intelligence) growth: subscriber
// counts by tier, recent ingest volume per source, brief publishing
// cadence, and impact-tag distribution over the last 7 days.

async function requireAdmin() {
  const cookieStore = await cookies()
  const supabase = createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    { cookies: { getAll: () => cookieStore.getAll() } }
  )
  const { data: { user } } = await supabase.auth.getUser()
  if (!user || user.email !== ADMIN_EMAIL) return null
  return user
}

export async function GET() {
  const admin = await requireAdmin()
  if (!admin) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const db = getServiceClient()
  const now = Date.now()
  const iso24h = new Date(now - 24 * 60 * 60 * 1000).toISOString()
  const iso7d  = new Date(now - 7 * 24 * 60 * 60 * 1000).toISOString()

  const [
    subFree,
    subPro,
    subEnterprise,
    eventsTotal,
    events24h,
    events7d,
    briefsTotal,
    briefs7d,
  ] = await Promise.all([
    db.from('intel_subscribers').select('*', { count: 'exact', head: true }).eq('active', true).eq('tier', 'free'),
    db.from('intel_subscribers').select('*', { count: 'exact', head: true }).eq('active', true).eq('tier', 'pro'),
    db.from('intel_subscribers').select('*', { count: 'exact', head: true }).eq('active', true).eq('tier', 'enterprise'),
    db.from('intel_events').select('*', { count: 'exact', head: true }),
    db.from('intel_events').select('*', { count: 'exact', head: true }).gte('ingested_at', iso24h),
    db.from('intel_events').select('*', { count: 'exact', head: true }).gte('ingested_at', iso7d),
    db.from('intel_briefs').select('*', { count: 'exact', head: true }),
    db.from('intel_briefs').select('*', { count: 'exact', head: true }).gte('published_at', iso7d),
  ])

  // Per-source + per-impact breakdown over 7 days
  const { data: rows7d } = await db
    .from('intel_events')
    .select('source, impact_tag, language, corridor')
    .gte('ingested_at', iso7d)
    .limit(5000)

  const bySource: Record<string, number> = {}
  const byImpact: Record<string, number> = {}
  const byLanguage: Record<string, number> = {}
  for (const r of rows7d || []) {
    const s = String(r.source)
    bySource[s] = (bySource[s] || 0) + 1
    const i = String(r.impact_tag ?? 'other')
    byImpact[i] = (byImpact[i] || 0) + 1
    const l = String(r.language ?? 'unknown')
    byLanguage[l] = (byLanguage[l] || 0) + 1
  }

  // Recent brief titles for at-a-glance
  const { data: recentBriefs } = await db
    .from('intel_briefs')
    .select('id, title, published_at')
    .order('published_at', { ascending: false })
    .limit(7)

  const intelMRR = (subPro.count ?? 0) * 499 + (subEnterprise.count ?? 0) * 1999

  return NextResponse.json({
    subscribers: {
      free: subFree.count ?? 0,
      pro: subPro.count ?? 0,
      enterprise: subEnterprise.count ?? 0,
      mrr: intelMRR,
    },
    events: {
      total: eventsTotal.count ?? 0,
      last24h: events24h.count ?? 0,
      last7d: events7d.count ?? 0,
    },
    briefs: {
      total: briefsTotal.count ?? 0,
      last7d: briefs7d.count ?? 0,
      recent: recentBriefs || [],
    },
    breakdown7d: { bySource, byImpact, byLanguage },
    generatedAt: new Date().toISOString(),
  })
}
