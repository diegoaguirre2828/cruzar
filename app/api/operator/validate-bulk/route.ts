import { NextRequest, NextResponse } from 'next/server'
import { createServerClient } from '@supabase/ssr'
import { cookies } from 'next/headers'
import { getServiceClient } from '@/lib/supabase'
import { put } from '@vercel/blob'
import Anthropic from '@anthropic-ai/sdk'
import { checkRateLimit, keyFromRequest } from '@/lib/ratelimit'
import { randomUUID } from 'node:crypto'
import sharp from 'sharp'

export const dynamic = 'force-dynamic'
export const maxDuration = 60

// POST /api/operator/validate-bulk
//
// Accepts up to 10 files in one multipart request, runs them through
// Claude in parallel (with a small concurrency cap so we don't burst
// the Anthropic API), persists each as a separate operator_validations
// row sharing a batch_id, and returns the array of results.

const ALLOWED_KINDS = new Set(['pedimento', 'commercial_invoice', 'usmca_cert', 'packing_list', 'bill_of_lading', 'other'])
const ALLOWED_MIME = new Set(['application/pdf', 'image/png', 'image/jpeg', 'image/webp'])
const MAX_BYTES = 10 * 1024 * 1024
const MAX_FILES = 10
const CONCURRENCY = 3

const SYSTEM_PROMPT = `You are an expert Mexican customs broker auditing a single shipping document. Output ONE JSON object: { "extracted_fields": {...}, "issues": [{"severity":"blocker|minor","field":"...","problem":"...","fix":"..."}], "severity":"clean|minor|blocker", "ai_summary":"..." }`

interface FileEntry { file: File; kind: string; index: number }

async function validateOne(client: Anthropic, db: ReturnType<typeof getServiceClient>, userId: string, batchId: string, entry: FileEntry) {
  const { file, kind, index } = entry
  const filename = file.name || `${kind}-${Date.now()}-${index}.bin`
  const safe = filename.replace(/[^A-Za-z0-9._-]/g, '_')
  const blob = await put(`operator/${userId}/${batchId}/${index}-${safe}`, file, { access: 'public', addRandomSuffix: false, contentType: file.type })

  const t0 = Date.now()
  const bytes = Buffer.from(await file.arrayBuffer())
  const mime = file.type
  // Resize images to 1568px max-edge (skip PDFs — Anthropic handles
  // them natively). Cuts vision token cost ~80% on phone-camera
  // photos with no OCR accuracy loss.
  let processedB64: string
  let processedMime = mime
  if (mime === 'application/pdf') {
    processedB64 = bytes.toString('base64')
  } else {
    const resized = await sharp(bytes)
      .rotate()
      .resize({ width: 1568, height: 1568, fit: 'inside', withoutEnlargement: true })
      .jpeg({ quality: 85, progressive: true })
      .toBuffer()
    processedB64 = resized.toString('base64')
    processedMime = 'image/jpeg'
  }
  const docBlock = processedMime === 'application/pdf'
    ? { type: 'document' as const, source: { type: 'base64' as const, media_type: 'application/pdf' as const, data: processedB64 } }
    : { type: 'image' as const, source: { type: 'base64' as const, media_type: processedMime as 'image/png' | 'image/jpeg' | 'image/webp', data: processedB64 } }

  let parsed: { extracted_fields: Record<string, unknown>; issues: Array<{ severity: string; field: string; problem: string; fix: string }>; severity: 'clean' | 'minor' | 'blocker'; ai_summary: string }
  try {
    const completion = await client.messages.create({
      model: 'claude-sonnet-4-6',
      max_tokens: 2048,
      // Cache the broker prompt — saves ~90% on input cost when each
      // bulk batch validates 10 docs back-to-back with the same prompt.
      system: [{ type: 'text', text: SYSTEM_PROMPT, cache_control: { type: 'ephemeral' } }],
      messages: [{ role: 'user', content: [docBlock, { type: 'text', text: `Document kind hint: ${kind}. Extract every clearly-labeled field. Flag any blocker or minor. Output JSON only.` }] }],
    })
    const txt = completion.content.filter((c): c is Anthropic.TextBlock => c.type === 'text').map((c) => c.text).join('\n').trim()
    parsed = JSON.parse(txt.replace(/^```(?:json)?\s*/i, '').replace(/\s*```$/i, '').trim())
  } catch (err: unknown) {
    return { index, error: err instanceof Error ? err.message : String(err), filename }
  }

  const sev = (['blocker', 'minor', 'clean'].includes(parsed.severity) ? parsed.severity : 'clean') as 'clean' | 'minor' | 'blocker'
  const ms = Date.now() - t0

  const { data: row } = await db.from('operator_validations').insert({
    user_id: userId,
    doc_kind: kind,
    source_url: blob.url,
    source_filename: filename,
    extracted_fields: parsed.extracted_fields ?? {},
    issues: parsed.issues ?? [],
    severity: sev,
    ai_summary: parsed.ai_summary ?? '',
    ai_model: 'claude-sonnet-4-6',
    ms_to_complete: ms,
    batch_id: batchId,
  }).select('id').single()

  return {
    index,
    id: row?.id,
    filename,
    doc_kind: kind,
    extracted_fields: parsed.extracted_fields,
    issues: parsed.issues,
    severity: sev,
    ai_summary: parsed.ai_summary,
    ms_to_complete: ms,
  }
}

async function pool<T, R>(items: T[], n: number, worker: (item: T) => Promise<R>): Promise<R[]> {
  const results: R[] = new Array(items.length)
  let cursor = 0
  async function next(): Promise<void> {
    while (cursor < items.length) {
      const i = cursor++
      results[i] = await worker(items[i])
    }
  }
  await Promise.all(Array.from({ length: Math.min(n, items.length) }, () => next()))
  return results
}

export async function POST(req: NextRequest) {
  const cookieStore = await cookies()
  const supabase = createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    { cookies: { getAll: () => cookieStore.getAll() } }
  )
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Sign in.' }, { status: 401 })

  const rl = await checkRateLimit(keyFromRequest(req, user.id), 30, 3)
  if (!rl.ok) return NextResponse.json({ error: 'Too many bulk requests.' }, { status: 429 })

  const db = getServiceClient()
  const { data: profile } = await db.from('profiles').select('tier').eq('id', user.id).maybeSingle()
  const tier = String(profile?.tier ?? 'free')
  if (tier !== 'operator' && tier !== 'business') {
    return NextResponse.json({ error: 'Cruzar Operator subscription required.' }, { status: 402 })
  }

  const formData = await req.formData()
  const files: FileEntry[] = []
  let idx = 0
  for (const [key, value] of formData.entries()) {
    if (key === 'files' && value instanceof Blob && value.size > 0) {
      const f = value as File
      if (!ALLOWED_MIME.has(f.type)) continue
      if (f.size > MAX_BYTES) continue
      const kindKey = `kind_${idx}`
      const kindRaw = String(formData.get(kindKey) || formData.get('kind') || 'other').toLowerCase()
      const kind = ALLOWED_KINDS.has(kindRaw) ? kindRaw : 'other'
      files.push({ file: f, kind, index: idx })
      idx++
      if (files.length >= MAX_FILES) break
    }
  }

  if (files.length === 0) return NextResponse.json({ error: 'No valid files.' }, { status: 400 })

  const apiKey = process.env.ANTHROPIC_API_KEY
  if (!apiKey) return NextResponse.json({ error: 'AI not configured.' }, { status: 500 })
  const client = new Anthropic({ apiKey })
  const batchId = randomUUID()

  const results = await pool(files, CONCURRENCY, (f) => validateOne(client, db, user.id, batchId, f))

  return NextResponse.json({ ok: true, batch_id: batchId, results })
}
