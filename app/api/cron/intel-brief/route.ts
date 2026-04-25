import { NextRequest, NextResponse } from 'next/server'
import { getServiceClient } from '@/lib/supabase'
import Anthropic from '@anthropic-ai/sdk'

export const dynamic = 'force-dynamic'
export const maxDuration = 60

// /api/cron/intel-brief
//
// Pulls the last 24h of intel_events, asks Claude to synthesize a
// daily Cruzar Intelligence brief in markdown, persists it to
// intel_briefs, and emails it to every active intel_subscribers row.
//
// Schedule: daily via cron-job.org. Authed by ?secret=$CRON_SECRET.

function authed(req: NextRequest): boolean {
  const secret = process.env.CRON_SECRET
  if (!secret) return false
  const querySecret = new URL(req.url).searchParams.get('secret')
  if (querySecret && querySecret === secret) return true
  const auth = req.headers.get('authorization')
  return !!auth && auth === `Bearer ${secret}`
}

const SYSTEM_PROMPT = `You are the lead analyst for Cruzar Intelligence —
a daily border-friction brief for US-Mexico cross-border supply
chain operators (mid-market 3PLs, owner-operators, maquila
shippers, supply chain VPs).

You're given a JSON list of raw events ingested in the last 24
hours. Your job: distill them into a single brief operators can
read in under 90 seconds and act on TODAY.

Output format (markdown):

## Today's Headline
One sentence — the single most-impactful event.

## Watch List (top 3)
For each: bold the corridor / port + impact tag, then one sentence
on what happened, then a "→ Action:" line with the specific
operator move (e.g., "→ Action: divert Pharr-bound loads to
Anzalduas through 6pm CT").

## Lower-Priority Signals
Bullet list of 3-5 lesser items worth knowing but not acting on.

## Outlook (next 24h)
2-3 sentences on what to expect tomorrow given today's pattern.

Tone: terse, operator-grade. No hedging, no filler. If the data is
thin, say so plainly: "Quiet day at the border. Last meaningful
event was X." Do not invent events.`

export async function POST(req: NextRequest) {
  if (!authed(req)) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  return runBrief()
}

export async function GET(req: NextRequest) {
  if (!authed(req)) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  return runBrief()
}

async function runBrief() {
  const db = getServiceClient()
  const since = new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString()

  const { data: events } = await db
    .from('intel_events')
    .select('source, headline, body, language, impact_tag, corridor, occurred_at, source_url')
    .gte('ingested_at', since)
    .order('ingested_at', { ascending: false })
    .limit(120)

  const apiKey = process.env.ANTHROPIC_API_KEY
  if (!apiKey) return NextResponse.json({ error: 'AI not configured.' }, { status: 500 })
  const client = new Anthropic({ apiKey })

  const eventsForPrompt = (events || []).map((e) => ({
    src: e.source,
    impact: e.impact_tag,
    corridor: e.corridor,
    when: e.occurred_at,
    headline: e.headline,
    body: (e.body || '').slice(0, 400),
    lang: e.language,
    url: e.source_url,
  }))

  const completion = await client.messages.create({
    model: 'claude-sonnet-4-6',
    max_tokens: 2200,
    system: SYSTEM_PROMPT,
    messages: [{
      role: 'user',
      content: `Generate today's Cruzar Intelligence brief from these ${eventsForPrompt.length} events.\n\n${JSON.stringify(eventsForPrompt, null, 2)}`,
    }],
  })

  const md = completion.content
    .filter((c): c is Anthropic.TextBlock => c.type === 'text')
    .map((c) => c.text)
    .join('\n')
    .trim()

  // Pull title + summary from the first H2 / first paragraph of the
  // generated brief so the index card can show a teaser without
  // re-rendering the full markdown.
  const titleMatch = md.match(/^##\s+(.+)$/m)
  const title = titleMatch ? titleMatch[1].slice(0, 200) : `Border Brief ${new Date().toISOString().slice(0, 10)}`
  const summaryMatch = md.match(/^##\s+Today's Headline\s*\n+([^\n]+)/i)
  const summary = (summaryMatch ? summaryMatch[1] : md.slice(0, 240)).trim().slice(0, 240)

  const { data: brief, error } = await db.from('intel_briefs').insert({
    cadence: 'daily',
    title,
    summary,
    body_md: md,
    events_used: eventsForPrompt.slice(0, 30),
    ai_model: 'claude-sonnet-4-6',
  }).select('id').single()

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })

  // Send to active subscribers via Resend REST API. Matches the
  // pattern in /api/admin/blast-first-1000 — keeps us off the SDK
  // and avoids one more npm dep.
  let emailsSent = 0
  let emailsErrored = 0
  const resendKey = process.env.RESEND_API_KEY
  const fromEmail = process.env.RESEND_FROM_EMAIL || 'Cruzar Intelligence <intel@cruzar.app>'
  if (resendKey) {
    const { data: subs } = await db
      .from('intel_subscribers')
      .select('email, unsubscribe_token, tier')
      .eq('active', true)
    for (const s of subs || []) {
      try {
        const unsubUrl = `https://www.cruzar.app/api/intelligence/unsubscribe?token=${s.unsubscribe_token}`
        const res = await fetch('https://api.resend.com/emails', {
          method: 'POST',
          headers: {
            'Authorization': `Bearer ${resendKey}`,
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({
            from: fromEmail,
            to: s.email,
            subject: `${title} · Cruzar Intelligence`,
            html: renderEmailHtml(title, md, unsubUrl),
          }),
        })
        if (res.ok) emailsSent++
        else emailsErrored++
      } catch {
        emailsErrored++
      }
    }
  }

  return NextResponse.json({
    ok: true,
    briefId: brief.id,
    title,
    eventsUsed: eventsForPrompt.length,
    emailsSent,
    emailsErrored,
    at: new Date().toISOString(),
  })
}

function renderEmailHtml(title: string, md: string, unsubUrl: string): string {
  // Minimal markdown → HTML for the email. Keeps it dependency-free
  // and lets the body render in any client (Gmail / Outlook).
  const escaped = md.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;')
  const html = escaped
    .replace(/^## (.+)$/gm, '<h2 style="margin:20px 0 8px;font:600 17px system-ui,Helvetica,sans-serif;color:#0f172a;">$1</h2>')
    .replace(/^- (.+)$/gm, '<li>$1</li>')
    .replace(/(<li>[\s\S]*?<\/li>)/g, '<ul>$1</ul>')
    .replace(/\*\*(.+?)\*\*/g, '<strong>$1</strong>')
    .replace(/^([^<\n].+)$/gm, '<p style="margin:0 0 10px;line-height:1.5;">$1</p>')
  return `<!doctype html><html><body style="background:#f8fafc;padding:24px;font:14px system-ui,Helvetica,sans-serif;color:#0f172a;">
    <div style="max-width:600px;margin:0 auto;background:#fff;border:1px solid #e2e8f0;border-radius:12px;padding:24px;">
      <p style="margin:0 0 4px;font-size:11px;text-transform:uppercase;letter-spacing:.05em;color:#64748b;">Cruzar Intelligence · ${new Date().toISOString().slice(0,10)}</p>
      <h1 style="margin:0 0 16px;font:700 22px system-ui,Helvetica,sans-serif;">${title}</h1>
      ${html}
      <hr style="margin:28px 0 14px;border:0;border-top:1px solid #e2e8f0;"/>
      <p style="font-size:11px;color:#94a3b8;">You're receiving this because you subscribed to Cruzar Intelligence at cruzar.app/intelligence. <a href="${unsubUrl}" style="color:#94a3b8;">Unsubscribe</a>.</p>
    </div>
  </body></html>`
}
