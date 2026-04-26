import { NextRequest, NextResponse } from 'next/server'
import { createServerClient } from '@supabase/ssr'
import { cookies } from 'next/headers'
import { getServiceClient } from '@/lib/supabase'

export const dynamic = 'force-dynamic'

// /api/reports/confirm
//
// Lightweight wait-time-accuracy verification endpoint. Two paths:
//
//   POST { portId, cbpWait, accurate: true|false, actualWait? }
//     Records a single user vote that the displayed CBP wait is or
//     isn't matching reality. Reuses the crossing_reports table with
//     report_type='wait_confirm' or 'wait_reject'. Guests allowed
//     (user_id null) — same posture as /api/reports POST.
//
//   GET ?portId=...
//     Returns rolling 30-min counts of confirms vs rejects so the
//     UI can render a trust badge under the wait number ("✓ 5
//     confirmados, ✗ 1 rechazo en 30 min").
//
// Why this exists (Bordify gap analysis 2026-04-26): Bordify's #1
// review complaint is "DEAD WRONG" wait times. Their just-shipped
// "community confirmation" feature is the band-aid. Cruzar can ship
// the same with a stronger data foundation (CBP + cameras + auto-
// crossing detection + 230k readings) — owns the accuracy moat.

const WINDOW_MINUTES = 30

export async function POST(req: NextRequest) {
  const body = await req.json().catch(() => ({}))
  const portId = String(body.portId || '').trim()
  const cbpWait = Number(body.cbpWait)
  const accurate = body.accurate === true
  const actualWaitRaw = body.actualWait
  const actualWait = typeof actualWaitRaw === 'number' ? actualWaitRaw : null

  if (!portId) return NextResponse.json({ error: 'portId required' }, { status: 400 })
  if (!Number.isFinite(cbpWait) || cbpWait < 0 || cbpWait > 480) {
    return NextResponse.json({ error: 'invalid cbpWait' }, { status: 400 })
  }
  if (!accurate && actualWait != null && (actualWait < 0 || actualWait > 480)) {
    return NextResponse.json({ error: 'invalid actualWait' }, { status: 400 })
  }

  // Identify the user (auth optional — guest votes still count, just
  // don't earn points). Same posture as /api/reports POST.
  const cookieStore = await cookies()
  const supabase = createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    { cookies: { getAll: () => cookieStore.getAll() } },
  )
  const { data: { user } } = await supabase.auth.getUser()
  const userId = user?.id ?? null

  const db = getServiceClient()

  // Per-user dedupe: if THIS user already confirmed/rejected the same
  // CBP wait for this port within the window, no-op. Stops mash-spam
  // and double-vote inflation.
  if (userId) {
    const since = new Date(Date.now() - WINDOW_MINUTES * 60_000).toISOString()
    const { data: existing } = await db
      .from('crossing_reports')
      .select('id')
      .eq('port_id', portId)
      .eq('user_id', userId)
      .in('report_type', ['wait_confirm', 'wait_reject'])
      .gte('created_at', since)
      .limit(1)
    if (existing && existing.length > 0) {
      return NextResponse.json({ ok: true, deduped: true })
    }
  }

  const reportType = accurate ? 'wait_confirm' : 'wait_reject'
  const description = accurate
    ? `Confirma CBP ${cbpWait} min`
    : actualWait != null
      ? `Reporta ${actualWait} min vs CBP ${cbpWait}`
      : `Rechaza CBP ${cbpWait} min`

  const { error } = await db.from('crossing_reports').insert({
    port_id: portId,
    user_id: userId,
    report_type: reportType,
    description,
    wait_minutes: actualWait ?? cbpWait,
    upvotes: 0,
    verified: false,
    source: 'wait_confirm',
    source_meta: {
      cbp_wait: cbpWait,
      actual_wait: actualWait,
      accurate,
    },
  })
  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 })
  }

  return NextResponse.json({ ok: true, recorded: reportType })
}

export async function GET(req: NextRequest) {
  const portId = req.nextUrl.searchParams.get('portId')
  if (!portId) return NextResponse.json({ error: 'portId required' }, { status: 400 })

  const db = getServiceClient()
  const since = new Date(Date.now() - WINDOW_MINUTES * 60_000).toISOString()

  const { data, error } = await db
    .from('crossing_reports')
    .select('report_type')
    .eq('port_id', portId)
    .in('report_type', ['wait_confirm', 'wait_reject'])
    .gte('created_at', since)

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })

  let confirms = 0
  let rejects = 0
  for (const r of data || []) {
    if (r.report_type === 'wait_confirm') confirms++
    else if (r.report_type === 'wait_reject') rejects++
  }

  return NextResponse.json({
    portId,
    windowMinutes: WINDOW_MINUTES,
    confirms,
    rejects,
    // trust = confirms / (confirms + rejects). null when no votes yet.
    trust: confirms + rejects === 0 ? null : Math.round((confirms / (confirms + rejects)) * 100),
  })
}
