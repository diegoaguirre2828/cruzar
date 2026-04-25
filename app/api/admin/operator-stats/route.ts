import { NextResponse } from 'next/server'
import { createServerClient } from '@supabase/ssr'
import { cookies } from 'next/headers'
import { getServiceClient } from '@/lib/supabase'

export const dynamic = 'force-dynamic'

const ADMIN_EMAIL = 'cruzabusiness@gmail.com'

// /api/admin/operator-stats
//
// Visibility into Phase 2 (Operator + Express Cert) growth + usage.
// Mirror of /api/admin/auto-crossings-stats shape.

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
    operatorTier,
    businessTier,
    validationsTotal,
    validations24h,
    validations7d,
    expressDraft,
    expressPaid,
    expressGenerated,
  ] = await Promise.all([
    db.from('profiles').select('*', { count: 'exact', head: true }).eq('tier', 'operator'),
    db.from('profiles').select('*', { count: 'exact', head: true }).eq('tier', 'business'),
    db.from('operator_validations').select('*', { count: 'exact', head: true }),
    db.from('operator_validations').select('*', { count: 'exact', head: true }).gte('created_at', iso24h),
    db.from('operator_validations').select('*', { count: 'exact', head: true }).gte('created_at', iso7d),
    db.from('express_cert_applications').select('*', { count: 'exact', head: true }).eq('status', 'draft'),
    db.from('express_cert_applications').select('*', { count: 'exact', head: true }).eq('status', 'paid'),
    db.from('express_cert_applications').select('*', { count: 'exact', head: true }).eq('status', 'generated'),
  ])

  const { data: rows7d } = await db
    .from('operator_validations')
    .select('doc_kind, severity, ms_to_complete')
    .gte('created_at', iso7d)
    .limit(2000)

  const byKind: Record<string, number> = {}
  const bySeverity: Record<string, number> = {}
  let sumMs = 0
  let cntMs = 0
  for (const r of rows7d || []) {
    const k = String(r.doc_kind)
    byKind[k] = (byKind[k] || 0) + 1
    const s = String(r.severity ?? 'unknown')
    bySeverity[s] = (bySeverity[s] || 0) + 1
    if (typeof r.ms_to_complete === 'number') {
      sumMs += r.ms_to_complete
      cntMs++
    }
  }

  const operatorMRR = (operatorTier.count ?? 0) * 99
  const businessMRR = (businessTier.count ?? 0) * 19.99
  const expressLifetime = ((expressPaid.count ?? 0) + (expressGenerated.count ?? 0)) * 499

  return NextResponse.json({
    subscriptions: {
      operatorActive: operatorTier.count ?? 0,
      businessActive: businessTier.count ?? 0,
      operatorMRR,
      businessMRR,
    },
    validations: {
      total: validationsTotal.count ?? 0,
      last24h: validations24h.count ?? 0,
      last7d: validations7d.count ?? 0,
      avgMsPerRun: cntMs > 0 ? Math.round(sumMs / cntMs) : null,
    },
    breakdown7d: { byKind, bySeverity },
    expressCert: {
      draft: expressDraft.count ?? 0,
      paid: expressPaid.count ?? 0,
      generated: expressGenerated.count ?? 0,
      lifetimeRevenue: expressLifetime,
    },
    generatedAt: new Date().toISOString(),
  })
}
