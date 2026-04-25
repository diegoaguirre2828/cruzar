import { NextRequest, NextResponse } from 'next/server'
import { createServerClient } from '@supabase/ssr'
import { cookies } from 'next/headers'
import { getServiceClient } from '@/lib/supabase'
import { put } from '@vercel/blob'
import Anthropic from '@anthropic-ai/sdk'
import { checkRateLimit, keyFromRequest } from '@/lib/ratelimit'

export const dynamic = 'force-dynamic'
// Vision-capable parsing of multi-page pedimentos can take 30-60s.
// Vercel default function timeout is 10s on Hobby. Bump to 60s.
export const maxDuration = 60

// POST /api/operator/validate
//
// Accepts a multipart upload of a single shipping document
// (pedimento, commercial invoice, USMCA cert, packing list, BOL),
// stores it in Vercel Blob, then runs Claude (vision) over the image
// pages with a doc-kind-specific extraction + validation prompt.
// Persists the result to operator_validations and returns the
// structured report so the dashboard can render it inline.
//
// Auth: requires a Cruzar Operator subscription (profile.tier = 'operator'
// OR 'business'). Free / pro / guest get 402.
//
// Pricing posture: subscriber's plan covers unlimited validations
// up to a per-hour rate-limit (60/hr) — same shape as /api/ads.

const ALLOWED_KINDS = new Set(['pedimento', 'commercial_invoice', 'usmca_cert', 'packing_list', 'bill_of_lading', 'other'])
const ALLOWED_MIME = new Set(['application/pdf', 'image/png', 'image/jpeg', 'image/webp'])
const MAX_BYTES = 10 * 1024 * 1024 // 10 MB — covers a multi-page scanned pedimento at reasonable DPI

const SYSTEM_PROMPT = `You are an expert Mexican customs broker (Agente Aduanal) auditing
a single shipping document for a US-Mexico cross-border shipment.

Your job: extract the structured fields, then flag any issue that
would (a) trigger a secondary inspection at the border, (b) cause
the broker to bounce the submission, or (c) materially mis-classify
duties.

Be strict but accurate — false-positive flags waste the operator's
time. Cite the field by name (in Spanish for pedimentos, English
for USMCA certs / BOLs).

Output a single JSON object with this exact shape, no prose around it:
{
  "extracted_fields": { ...key-value pairs you read from the doc... },
  "issues": [
    { "severity": "blocker"|"minor", "field": "...", "problem": "...", "fix": "..." }
  ],
  "severity": "clean"|"minor"|"blocker",
  "ai_summary": "2-3 sentence plain-English overview of what's right, what's wrong, what to do next"
}

If you cannot read the document at all, return:
{ "extracted_fields": {}, "issues": [{ "severity": "blocker", "field": "doc", "problem": "Document unreadable", "fix": "Re-scan at higher resolution and retry" }], "severity": "blocker", "ai_summary": "Document could not be parsed." }`

function promptForKind(kind: string): string {
  switch (kind) {
    case 'pedimento':
      return `This is a Mexican PEDIMENTO. Extract: pedimento number, clave de pedimento, fecha de pago, RFC importador/exportador, valor en aduana (USD + MXN), peso bruto/neto, fracciones arancelarias (HS codes — 8 digits min), número de operación. Flag: missing or zero value, invalid RFC format, HS code that doesn't exist, missing pago, fecha mismatch with shipment date, missing IMMEX program reference if applicable, valor en aduana under transaction value (DR-CAFTA / USMCA implication).`
    case 'commercial_invoice':
      return `This is a COMMERCIAL INVOICE for cross-border freight. Extract: invoice number, date, seller/buyer (name + tax ID), Incoterm, currency, line items (description, qty, unit price, total), grand total, country of origin, HS codes if present. Flag: missing tax IDs, mismatched currency between line items and total, missing country of origin (USMCA/NAFTA blocker), Incoterm not specified, total that doesn't sum line items, vague descriptions ("merchandise" / "goods" — Aduanas rejects these).`
    case 'usmca_cert':
      return `This is a USMCA Certificate of Origin. Extract: certifier (name + address + tax ID), exporter, producer, importer, blanket period (start + end), product description, HS classification (6 digits min), origin criterion (A/B/C/D), method (NC/RVC/etc), authorized signature. Flag: missing certifier signature/date, blanket period that doesn't cover shipment date, missing origin criterion, HS code under 6 digits, producer marked "available upon request" without supporting docs.`
    case 'packing_list':
      return `This is a PACKING LIST. Extract: shipper, consignee, total cartons/pallets, total gross/net weight, total cubic measure, PO number, line items (description, qty per carton, marks). Flag: weights that don't match commercial invoice if cross-referenced, missing cartonization, missing PO number, vague descriptions.`
    case 'bill_of_lading':
      return `This is a BILL OF LADING. Extract: shipper, consignee, notify party, vessel/voyage or carrier, port of loading, port of discharge, container number(s), seal number(s), HBL number, MBL number, freight terms, weight, measure. Flag: missing seal numbers (theft risk), missing notify party, freight terms mismatch with invoice Incoterm, container number format invalid (not 4 letters + 7 digits).`
    default:
      return `This is a shipping document of unknown type. Extract every clearly-labeled field you see. Flag anything that looks malformed, missing critical info, or inconsistent.`
  }
}

export async function POST(req: NextRequest) {
  const cookieStore = await cookies()
  const supabase = createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    { cookies: { getAll: () => cookieStore.getAll() } }
  )
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Sign in to use the Operator validator.' }, { status: 401 })

  const rl = await checkRateLimit(keyFromRequest(req, user.id), 60, 5)
  if (!rl.ok) {
    return NextResponse.json(
      { error: 'Too many validations in the last hour. Try again soon.' },
      { status: 429, headers: { 'Retry-After': String(rl.retryAfterSeconds) } },
    )
  }

  const db = getServiceClient()
  const { data: profile } = await db
    .from('profiles')
    .select('tier')
    .eq('id', user.id)
    .maybeSingle()
  const tier = String(profile?.tier ?? 'free')
  if (tier !== 'operator' && tier !== 'business') {
    return NextResponse.json(
      { error: 'Cruzar Operator subscription required.', upgrade: '/pricing#operator' },
      { status: 402 },
    )
  }

  const formData = await req.formData()
  const file = formData.get('file')
  const kind = String(formData.get('kind') || 'other').toLowerCase()
  if (!ALLOWED_KINDS.has(kind)) {
    return NextResponse.json({ error: 'Unknown doc kind.' }, { status: 400 })
  }
  if (!(file instanceof Blob) || file.size === 0) {
    return NextResponse.json({ error: 'Missing file.' }, { status: 400 })
  }
  if (file.size > MAX_BYTES) {
    return NextResponse.json({ error: 'File too large (10 MB max).' }, { status: 413 })
  }
  const mime = file.type || 'application/octet-stream'
  if (!ALLOWED_MIME.has(mime)) {
    return NextResponse.json({ error: 'Only PDF, PNG, JPEG, or WebP accepted.' }, { status: 415 })
  }

  // Persist the doc to Blob first so we have a stable reference even
  // if Claude bails — keeps the audit trail intact.
  const filename = (file as File).name || `${kind}-${Date.now()}.bin`
  const safeFilename = filename.replace(/[^A-Za-z0-9._-]/g, '_')
  const blobKey = `operator/${user.id}/${Date.now()}-${safeFilename}`
  const blob = await put(blobKey, file, { access: 'public', addRandomSuffix: false, contentType: mime })

  const t0 = Date.now()
  const apiKey = process.env.ANTHROPIC_API_KEY
  if (!apiKey) {
    return NextResponse.json({ error: 'AI not configured (ANTHROPIC_API_KEY missing).' }, { status: 500 })
  }
  const client = new Anthropic({ apiKey })

  const fileBytes = Buffer.from(await file.arrayBuffer())
  const fileBase64 = fileBytes.toString('base64')
  const docContentBlock = mime === 'application/pdf'
    ? { type: 'document' as const, source: { type: 'base64' as const, media_type: 'application/pdf' as const, data: fileBase64 } }
    : { type: 'image' as const, source: { type: 'base64' as const, media_type: mime as 'image/png' | 'image/jpeg' | 'image/webp', data: fileBase64 } }

  const aiModel = 'claude-sonnet-4-6'
  let parsed: { extracted_fields: Record<string, unknown>; issues: Array<{ severity: string; field: string; problem: string; fix: string }>; severity: 'clean' | 'minor' | 'blocker'; ai_summary: string }

  try {
    const completion = await client.messages.create({
      model: aiModel,
      max_tokens: 2048,
      system: SYSTEM_PROMPT,
      messages: [{
        role: 'user',
        content: [
          docContentBlock,
          { type: 'text', text: promptForKind(kind) },
        ],
      }],
    })
    const text = completion.content
      .filter((c): c is Anthropic.TextBlock => c.type === 'text')
      .map((c) => c.text)
      .join('\n')
      .trim()
    // Tolerate ```json fences if Claude adds them despite the instruction
    const stripped = text.replace(/^```(?:json)?\s*/i, '').replace(/\s*```$/i, '').trim()
    parsed = JSON.parse(stripped)
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : String(err)
    return NextResponse.json({ error: `AI validation failed: ${msg}` }, { status: 502 })
  }

  const sev: 'clean' | 'minor' | 'blocker' = parsed.severity === 'blocker' || parsed.severity === 'minor' ? parsed.severity : 'clean'
  const ms = Date.now() - t0

  const { data: row, error } = await db.from('operator_validations').insert({
    user_id: user.id,
    doc_kind: kind,
    source_url: blob.url,
    source_filename: filename,
    extracted_fields: parsed.extracted_fields ?? {},
    issues: parsed.issues ?? [],
    severity: sev,
    ai_summary: parsed.ai_summary ?? '',
    ai_model: aiModel,
    ms_to_complete: ms,
  }).select('id').single()

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 })
  }

  return NextResponse.json({
    ok: true,
    id: row?.id,
    doc_kind: kind,
    source_url: blob.url,
    extracted_fields: parsed.extracted_fields,
    issues: parsed.issues,
    severity: sev,
    ai_summary: parsed.ai_summary,
    ms_to_complete: ms,
  })
}
