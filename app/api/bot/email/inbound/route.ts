import { NextRequest, NextResponse } from 'next/server'
import { getServiceClient } from '@/lib/supabase'
import Anthropic from '@anthropic-ai/sdk'
import { put } from '@vercel/blob'

export const dynamic = 'force-dynamic'
export const maxDuration = 60

// /api/bot/email/inbound
//
// Inbound email webhook for validate@cruzar.app. Configure Cloudflare
// Email Routing (free) to forward to this URL with the email payload.
// Cloudflare delivers a multipart with the raw email + attachments.
// We extract the first PDF/image attachment, run validation, and
// reply via Resend.
//
// Sender → user lookup: by `From:` header, find an
// operator_bot_bindings row where channel='email' and external_id
// matches the sender address. If no binding, allow 3 free trials
// like the Telegram bot.
//
// Auth: shared secret in `Authorization: Bearer <EMAIL_INBOUND_SECRET>`
// header (set when configuring the Cloudflare worker).

const ALLOWED_MIME = new Set(['application/pdf', 'image/png', 'image/jpeg', 'image/webp'])

const SYSTEM_PROMPT = `You are an expert Mexican customs broker. Output ONE JSON object: { "extracted_fields": {...}, "issues": [...], "severity": "clean|minor|blocker", "ai_summary": "..." }`

function authed(req: NextRequest): boolean {
  const expected = process.env.EMAIL_INBOUND_SECRET
  if (!expected) return true // dev mode
  const auth = req.headers.get('authorization')
  return !!auth && auth === `Bearer ${expected}`
}

async function sendReplyEmail(to: string, subject: string, html: string, text: string) {
  const apiKey = process.env.RESEND_API_KEY
  const from = process.env.RESEND_FROM_EMAIL || 'Cruzar Operator <validate@cruzar.app>'
  if (!apiKey) return
  await fetch('https://api.resend.com/emails', {
    method: 'POST',
    headers: { 'Authorization': `Bearer ${apiKey}`, 'Content-Type': 'application/json' },
    body: JSON.stringify({ from, to, subject, html, text }),
  })
}

interface InboundPayload {
  from?: string
  subject?: string
  text?: string
  attachments?: Array<{ filename?: string; mimeType?: string; contentBase64?: string }>
}

export async function POST(req: NextRequest) {
  if (!authed(req)) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  let body: InboundPayload
  try { body = await req.json() } catch { return NextResponse.json({ error: 'Invalid JSON' }, { status: 400 }) }

  const fromEmail = String(body.from || '').toLowerCase().match(/[a-z0-9._%+-]+@[a-z0-9.-]+\.[a-z]{2,}/)?.[0]
  if (!fromEmail) return NextResponse.json({ error: 'No from address' }, { status: 400 })

  const attachment = (body.attachments || []).find((a) => a.mimeType && ALLOWED_MIME.has(a.mimeType) && a.contentBase64)
  if (!attachment) {
    await sendReplyEmail(
      fromEmail,
      `Cruzar Operator — no document found`,
      `<p>We didn't find a PDF or image attachment in your email. Forward the email with the pedimento attached and we'll validate it within 60 seconds.</p>`,
      `We didn't find a PDF or image attachment in your email. Forward the email with the pedimento attached and we'll validate it within 60 seconds.`,
    )
    return NextResponse.json({ ok: true, action: 'no_attachment_reply' })
  }

  const db = getServiceClient()

  const { data: binding } = await db
    .from('operator_bot_bindings')
    .select('user_id')
    .eq('channel', 'email')
    .eq('external_id', fromEmail)
    .maybeSingle()
  const userId = binding?.user_id || null

  // Free-tier paywall (3 anon validations)
  if (!userId) {
    const { count } = await db
      .from('operator_validations')
      .select('*', { count: 'exact', head: true })
      .eq('ai_model', `email-anon-${fromEmail}`)
    if ((count ?? 0) >= 3) {
      const bindUrl = `https://www.cruzar.app/bot/bind?channel=email&external_id=${encodeURIComponent(fromEmail)}`
      await sendReplyEmail(
        fromEmail,
        `Cruzar Operator — free trial used up`,
        `<p>You've used your 3 free validations.</p><p>To continue:<br/>1. Bind your email to your Cruzar account: <a href="${bindUrl}">${bindUrl}</a><br/>2. Subscribe to Cruzar Operator: <a href="https://www.cruzar.app/pricing#operator">$99/mo, 7 days free</a></p>`,
        `You've used your 3 free validations. Subscribe at https://www.cruzar.app/pricing#operator for unlimited validations.`,
      )
      return NextResponse.json({ ok: true, action: 'paywall' })
    }
  } else {
    const { data: profile } = await db.from('profiles').select('tier').eq('id', userId).maybeSingle()
    const tier = String(profile?.tier ?? 'free')
    if (tier !== 'operator' && tier !== 'business') {
      await sendReplyEmail(
        fromEmail,
        `Cruzar Operator subscription required`,
        `<p>Your account is bound but doesn't have an active Cruzar Operator subscription.</p><p>Subscribe at <a href="https://www.cruzar.app/pricing#operator">cruzar.app/pricing</a> — $99/mo, 7 days free.</p>`,
        `Your account is bound but doesn't have Cruzar Operator. Subscribe: https://www.cruzar.app/pricing#operator`,
      )
      return NextResponse.json({ ok: true, action: 'no_subscription' })
    }
  }

  const filename = attachment.filename || `email-inbound-${Date.now()}.bin`
  const safe = filename.replace(/[^A-Za-z0-9._-]/g, '_')
  const buf = Buffer.from(attachment.contentBase64!, 'base64')
  const blob = await put(`operator/email/${fromEmail}/${Date.now()}-${safe}`, buf, { access: 'public', addRandomSuffix: false, contentType: attachment.mimeType })

  const apiKey = process.env.ANTHROPIC_API_KEY
  if (!apiKey) {
    await sendReplyEmail(fromEmail, 'Cruzar Operator — system error', `<p>AI service not configured. Please contact hello@cruzar.app.</p>`, `AI service not configured.`)
    return NextResponse.json({ error: 'AI not configured' }, { status: 500 })
  }
  const client = new Anthropic({ apiKey })

  const docBlock = attachment.mimeType === 'application/pdf'
    ? { type: 'document' as const, source: { type: 'base64' as const, media_type: 'application/pdf' as const, data: attachment.contentBase64! } }
    : { type: 'image' as const, source: { type: 'base64' as const, media_type: attachment.mimeType as 'image/png' | 'image/jpeg' | 'image/webp', data: attachment.contentBase64! } }

  const t0 = Date.now()
  let parsed: { extracted_fields: Record<string, unknown>; issues: Array<{ severity: string; field: string; problem: string; fix: string }>; severity: 'clean' | 'minor' | 'blocker'; ai_summary: string }
  try {
    const completion = await client.messages.create({
      model: 'claude-sonnet-4-6',
      max_tokens: 2048,
      system: SYSTEM_PROMPT,
      messages: [{ role: 'user', content: [docBlock, { type: 'text', text: `Subject: ${body.subject || ''}\nExtract every clearly-labeled field. Flag blockers and minor issues. Output JSON.` }] }],
    })
    const txt = completion.content.filter((c): c is Anthropic.TextBlock => c.type === 'text').map((c) => c.text).join('\n').trim()
    parsed = JSON.parse(txt.replace(/^```(?:json)?\s*/i, '').replace(/\s*```$/i, '').trim())
  } catch (err: unknown) {
    const e = err instanceof Error ? err.message : String(err)
    await sendReplyEmail(fromEmail, 'Cruzar Operator — validation error', `<p>Validation failed: ${e}</p><p>Try re-sending or contact hello@cruzar.app.</p>`, `Validation failed: ${e}`)
    return NextResponse.json({ error: e }, { status: 502 })
  }

  const sev = (['blocker', 'minor', 'clean'].includes(parsed.severity) ? parsed.severity : 'clean') as 'clean' | 'minor' | 'blocker'
  const ms = Date.now() - t0

  await db.from('operator_validations').insert({
    user_id: userId || '00000000-0000-0000-0000-000000000000',
    doc_kind: 'other',
    source_url: blob.url,
    source_filename: filename,
    extracted_fields: parsed.extracted_fields ?? {},
    issues: parsed.issues ?? [],
    severity: sev,
    ai_summary: parsed.ai_summary ?? '',
    ai_model: userId ? 'claude-sonnet-4-6' : `email-anon-${fromEmail}`,
    ms_to_complete: ms,
  })

  const sevEmoji = sev === 'clean' ? '✅' : sev === 'minor' ? '⚠️' : '🛑'
  const sevLabel = sev === 'clean' ? 'Ready to cross' : sev === 'minor' ? 'Minor flags' : 'BLOCKER — fix before submitting'

  const issuesHtml = (parsed.issues || []).map((i) =>
    `<li><strong>${i.field}</strong>: ${i.problem}<br/><span style="color:#2563eb;">→ ${i.fix}</span></li>`
  ).join('')
  const issuesText = (parsed.issues || []).map((i) => `• ${i.field}: ${i.problem}\n  → ${i.fix}`).join('\n\n')

  const html = `
    <h2>${sevEmoji} ${sevLabel}</h2>
    <p><strong>${filename}</strong> · ${Math.round(ms/1000)}s</p>
    <p>${parsed.ai_summary || ''}</p>
    ${issuesHtml ? `<h3>Issues:</h3><ul>${issuesHtml}</ul>` : ''}
    <p>Full history at <a href="https://www.cruzar.app/operator">cruzar.app/operator</a></p>
  `
  const text = `${sevEmoji} ${sevLabel}\n${filename} · ${Math.round(ms/1000)}s\n\n${parsed.ai_summary || ''}\n\n${issuesText}\n\nHistory: https://www.cruzar.app/operator`

  await sendReplyEmail(fromEmail, `Cruzar validation: ${sevLabel}`, html, text)

  return NextResponse.json({ ok: true, action: 'validated', severity: sev })
}
