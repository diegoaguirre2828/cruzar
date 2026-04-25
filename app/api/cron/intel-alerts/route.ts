import { NextRequest, NextResponse } from 'next/server'
import { getServiceClient } from '@/lib/supabase'

export const dynamic = 'force-dynamic'
export const maxDuration = 60

// /api/cron/intel-alerts
//
// The real-time alert layer. Runs every 15 minutes via cron-job.org.
// Pulls every intel_event ingested but not yet alert-processed,
// scores it for alert-worthiness using deterministic rules
// (impact_tag + headline keyword density + freshness), then fans
// out to every subscriber whose intel_alert_preferences match the
// event's impact + corridor.
//
// Idempotent: rows are marked alert_processed_at after the run, so
// subsequent invocations skip them. Per-(subscriber, event) UNIQUE
// constraint on intel_alerts prevents double-sends even if a
// subscriber's prefs change mid-run.
//
// Quiet hours respected at the subscriber level. Free-tier
// subscribers don't get real-time alerts (only the daily brief);
// pro + enterprise tiers do.

function authed(req: NextRequest): boolean {
  const secret = process.env.CRON_SECRET
  if (!secret) return false
  const querySecret = new URL(req.url).searchParams.get('secret')
  if (querySecret && querySecret === secret) return true
  const auth = req.headers.get('authorization')
  return !!auth && auth === `Bearer ${secret}`
}

const HIGH_IMPACT_KEYWORDS = [
  // EN
  'blockade', 'cartel', 'closure', 'shutdown', 'kidnap', 'attack', 'violence',
  'inspection', 'tariff', 'duty', 'outage', 'down', 'breach',
  // ES
  'bloqueo', 'cártel', 'cierre', 'paro', 'huelga', 'ataque', 'enfrentamiento',
  'balacera', 'caída', 'arancel', 'suspensión', 'suspendido',
]

function scoreEvent(headline: string, body: string, impact: string | null): number {
  let score = 30
  if (impact === 'cartel' || impact === 'protest' || impact === 'vucem') score += 30
  if (impact === 'tariff' || impact === 'infra') score += 20
  if (impact === 'policy' || impact === 'weather') score += 10
  const hay = `${headline} ${body}`.toLowerCase()
  const hits = HIGH_IMPACT_KEYWORDS.filter((w) => hay.includes(w)).length
  score += Math.min(40, hits * 8)
  return Math.max(0, Math.min(100, score))
}

function inQuietHours(start: number | null, end: number | null): boolean {
  if (start == null || end == null) return false
  const hourUTC = new Date().getUTCHours()
  // The user's quiet window is in their local timezone but we don't
  // store TZ — we treat quiet_hour_* as UTC for now. Subscribers in
  // CT can subtract 5/6h when they set it. Enterprise tier will get
  // real TZ support when first customer asks.
  if (start === end) return false
  if (start < end) return hourUTC >= start && hourUTC < end
  return hourUTC >= start || hourUTC < end
}

export async function POST(req: NextRequest) {
  if (!authed(req)) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  return runAlerts()
}

export async function GET(req: NextRequest) {
  if (!authed(req)) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  return runAlerts()
}

async function runAlerts() {
  const db = getServiceClient()

  // 1) Pull pending events (not yet processed, max 200 per run for safety)
  const { data: pending } = await db
    .from('intel_events')
    .select('id, headline, body, impact_tag, corridor, source, source_url, language, alert_score')
    .is('alert_processed_at', null)
    .order('ingested_at', { ascending: true })
    .limit(200)

  if (!pending || pending.length === 0) {
    return NextResponse.json({ ok: true, processed: 0, alerted: 0, at: new Date().toISOString() })
  }

  // 2) Pull paid subscribers + their prefs
  const { data: subs } = await db
    .from('intel_subscribers')
    .select('id, email, tier, unsubscribe_token')
    .eq('active', true)
    .in('tier', ['pro', 'enterprise'])

  const subsList = subs || []
  if (subsList.length === 0) {
    // Mark events processed so they don't re-queue forever; nothing to send.
    const ids = pending.map((p) => p.id)
    await db.from('intel_events').update({ alert_processed_at: new Date().toISOString() }).in('id', ids)
    return NextResponse.json({ ok: true, processed: pending.length, alerted: 0, reason: 'no paid subscribers', at: new Date().toISOString() })
  }
  const subIds = subsList.map((s) => s.id)
  const { data: prefs } = await db
    .from('intel_alert_preferences')
    .select('subscriber_id, impacts, corridors, min_score, quiet_hour_start, quiet_hour_end')
    .in('subscriber_id', subIds)
  const prefMap = new Map<string, { impacts: string[]; corridors: string[]; minScore: number; qStart: number | null; qEnd: number | null }>()
  for (const p of prefs || []) {
    prefMap.set(p.subscriber_id, {
      impacts: p.impacts || [],
      corridors: p.corridors || [],
      minScore: p.min_score ?? 60,
      qStart: p.quiet_hour_start,
      qEnd: p.quiet_hour_end,
    })
  }

  // 3) Score each event + fan out
  const resendKey = process.env.RESEND_API_KEY
  const fromEmail = process.env.RESEND_FROM_EMAIL || 'Cruzar Intelligence <intel@cruzar.app>'
  let alertsSent = 0
  let alertsErrored = 0
  const processedIds: string[] = []
  const scoreUpdates: Array<{ id: string; alert_score: number }> = []

  for (const ev of pending) {
    const score = scoreEvent(String(ev.headline || ''), String(ev.body || ''), ev.impact_tag as string | null)
    scoreUpdates.push({ id: ev.id, alert_score: score })
    processedIds.push(ev.id)

    for (const sub of subsList) {
      const pref = prefMap.get(sub.id) || { impacts: ['cartel', 'protest', 'vucem', 'tariff', 'infra', 'policy'], corridors: [], minScore: 60, qStart: null, qEnd: null }
      if (score < pref.minScore) continue
      if (ev.impact_tag && !pref.impacts.includes(String(ev.impact_tag))) continue
      if (pref.corridors.length > 0 && ev.corridor && !pref.corridors.includes(String(ev.corridor))) continue
      if (inQuietHours(pref.qStart, pref.qEnd)) continue

      // Insert the alert row first — if the UNIQUE constraint trips,
      // we silently skip the email (already sent).
      const { error: insErr } = await db.from('intel_alerts').insert({
        subscriber_id: sub.id,
        event_id: ev.id,
        channel: 'email',
      })
      if (insErr) continue // duplicate or transient — skip

      if (!resendKey) { alertsErrored++; continue }

      const unsubUrl = `https://www.cruzar.app/api/intelligence/unsubscribe?token=${sub.unsubscribe_token}`
      const html = renderAlertHtml(ev, score, unsubUrl)
      try {
        const res = await fetch('https://api.resend.com/emails', {
          method: 'POST',
          headers: { 'Authorization': `Bearer ${resendKey}`, 'Content-Type': 'application/json' },
          body: JSON.stringify({
            from: fromEmail,
            to: sub.email,
            subject: `[ALERT · ${ev.impact_tag || 'border'}] ${String(ev.headline).slice(0, 90)}`,
            html,
          }),
        })
        if (res.ok) alertsSent++
        else alertsErrored++
      } catch { alertsErrored++ }
    }
  }

  // 4) Persist score + processed_at on every event we touched
  const now = new Date().toISOString()
  for (const u of scoreUpdates) {
    await db.from('intel_events')
      .update({ alert_score: u.alert_score, alert_processed_at: now })
      .eq('id', u.id)
  }

  return NextResponse.json({
    ok: true,
    processed: processedIds.length,
    alerted: alertsSent,
    errored: alertsErrored,
    paidSubscribers: subsList.length,
    at: now,
  })
}

function renderAlertHtml(ev: { headline?: string; body?: string; impact_tag?: string | null; corridor?: string | null; source?: string; source_url?: string | null }, score: number, unsubUrl: string) {
  const headline = String(ev.headline || '').replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;')
  const body = String(ev.body || '').slice(0, 600).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;')
  const tag = ev.impact_tag ? `<span style="font-size:11px;font-weight:700;text-transform:uppercase;background:#0f172a;color:#fff;padding:2px 8px;border-radius:4px;">${ev.impact_tag}</span>` : ''
  const corridor = ev.corridor ? `<span style="font-size:11px;color:#64748b;margin-left:8px;">${ev.corridor}</span>` : ''
  const link = ev.source_url ? `<a href="${ev.source_url}" style="color:#2563eb;font-size:12px;">Source: ${ev.source} →</a>` : `<span style="color:#94a3b8;font-size:12px;">${ev.source}</span>`
  return `<!doctype html><html><body style="background:#f8fafc;padding:24px;font:14px system-ui,Helvetica,sans-serif;color:#0f172a;">
    <div style="max-width:560px;margin:0 auto;background:#fff;border:1px solid #e2e8f0;border-radius:12px;padding:24px;">
      <p style="margin:0 0 12px;">${tag}${corridor}<span style="float:right;font-size:11px;color:#94a3b8;">score ${score}</span></p>
      <h1 style="margin:0 0 12px;font:700 18px system-ui,Helvetica,sans-serif;line-height:1.4;">${headline}</h1>
      <p style="margin:0 0 16px;line-height:1.5;color:#334155;">${body}</p>
      ${link}
      <hr style="margin:24px 0 12px;border:0;border-top:1px solid #e2e8f0;"/>
      <p style="font-size:11px;color:#94a3b8;">Cruzar Intelligence real-time alert · <a href="https://www.cruzar.app/intelligence/dashboard" style="color:#94a3b8;">Dashboard</a> · <a href="${unsubUrl}" style="color:#94a3b8;">Unsubscribe</a></p>
    </div>
  </body></html>`
}
