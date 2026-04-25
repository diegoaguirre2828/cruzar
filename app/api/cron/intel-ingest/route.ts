import { NextRequest, NextResponse } from 'next/server'
import { getServiceClient } from '@/lib/supabase'
import { INTEL_SOURCES } from '@/lib/intelSources'
import { createHash } from 'node:crypto'

export const dynamic = 'force-dynamic'
export const maxDuration = 60

// /api/cron/intel-ingest
//
// Pulls every configured RSS / Atom source, parses out the most
// recent items, dedupes against intel_events.dedupe_hash, and
// inserts new rows tagged with impact + corridor based on the
// source-level rules + keyword overrides.
//
// Schedule via cron-job.org every hour (the existing
// /api/admin/create-cron-jobs endpoint can register this URL —
// authed by ?secret=$CRON_SECRET).
//
// Idempotent: calling repeatedly never duplicates events because
// the unique dedupe_hash on intel_events kicks duplicates.

function authed(req: NextRequest): boolean {
  const secret = process.env.CRON_SECRET
  if (!secret) return false
  const querySecret = new URL(req.url).searchParams.get('secret')
  if (querySecret && querySecret === secret) return true
  const auth = req.headers.get('authorization')
  return !!auth && auth === `Bearer ${secret}`
}

interface ParsedItem {
  title: string
  link: string
  description?: string
  pubDate?: string
}

// Tiny RSS parser that handles both RSS 2.0 and Atom. We keep it
// dependency-free for cold-start speed; if a source ships malformed
// XML the parse just returns nothing for that source rather than
// killing the whole run.
function parseFeed(xml: string): ParsedItem[] {
  const items: ParsedItem[] = []
  // RSS 2.0 <item>...</item>
  const itemRe = /<item\b[^>]*>([\s\S]*?)<\/item>/gi
  let m: RegExpExecArray | null
  while ((m = itemRe.exec(xml))) {
    const block = m[1]
    items.push({
      title: extractTag(block, 'title'),
      link: extractTag(block, 'link') || extractTag(block, 'guid'),
      description: extractTag(block, 'description'),
      pubDate: extractTag(block, 'pubDate'),
    })
  }
  if (items.length > 0) return items.filter((i) => i.title)
  // Atom <entry>...</entry>
  const entryRe = /<entry\b[^>]*>([\s\S]*?)<\/entry>/gi
  while ((m = entryRe.exec(xml))) {
    const block = m[1]
    const link = (block.match(/<link[^>]*href="([^"]+)"/i) || [])[1] || ''
    items.push({
      title: extractTag(block, 'title'),
      link,
      description: extractTag(block, 'summary') || extractTag(block, 'content'),
      pubDate: extractTag(block, 'updated') || extractTag(block, 'published'),
    })
  }
  return items.filter((i) => i.title)
}

function extractTag(xml: string, tag: string): string {
  const re = new RegExp(`<${tag}\\b[^>]*>(?:<!\\[CDATA\\[)?([\\s\\S]*?)(?:\\]\\]>)?</${tag}>`, 'i')
  const m = xml.match(re)
  if (!m) return ''
  return m[1].replace(/<[^>]+>/g, '').replace(/\s+/g, ' ').trim()
}

function classify(headline: string, body: string, src: typeof INTEL_SOURCES[number]): { impact: string; matched: boolean } {
  const hay = `${headline} ${body}`.toLowerCase()
  for (const rule of src.impactKeywords || []) {
    for (const w of rule.words) {
      if (hay.includes(w.toLowerCase())) return { impact: rule.tag, matched: true }
    }
  }
  return { impact: src.defaultImpact, matched: false }
}

export async function POST(req: NextRequest) {
  if (!authed(req)) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  return runIngest()
}

export async function GET(req: NextRequest) {
  if (!authed(req)) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  return runIngest()
}

async function runIngest() {
  const db = getServiceClient()
  let totalNew = 0
  const perSource: Record<string, { fetched: number; new: number; error?: string }> = {}

  for (const src of INTEL_SOURCES) {
    perSource[src.id] = { fetched: 0, new: 0 }
    try {
      const res = await fetch(src.url, {
        headers: { 'User-Agent': 'CruzarIntelBot/1.0 (+https://cruzar.app)' },
        // Some publishers respond slowly; cap so the whole run stays under maxDuration.
        signal: AbortSignal.timeout(8000),
      })
      if (!res.ok) {
        perSource[src.id].error = `HTTP ${res.status}`
        continue
      }
      const xml = await res.text()
      const items = parseFeed(xml).slice(0, 30)
      perSource[src.id].fetched = items.length

      for (const item of items) {
        const link = item.link?.trim() || ''
        if (!item.title || !link) continue
        const dedupeHash = createHash('sha256').update(`${src.id}|${link}`).digest('hex').slice(0, 32)
        const occurredAt = item.pubDate ? new Date(item.pubDate) : new Date()
        const { impact } = classify(item.title, item.description || '', src)
        const { error } = await db.from('intel_events').insert({
          source: src.id,
          source_url: link,
          headline: item.title.slice(0, 500),
          body: (item.description || '').slice(0, 2000),
          language: src.language,
          impact_tag: impact,
          corridor: src.defaultCorridor || null,
          occurred_at: isFinite(occurredAt.getTime()) ? occurredAt.toISOString() : new Date().toISOString(),
          dedupe_hash: dedupeHash,
        })
        if (!error) perSource[src.id].new++
        // Unique-violation 23505 = already ingested, ignore silently.
      }
      totalNew += perSource[src.id].new
    } catch (err: unknown) {
      perSource[src.id].error = err instanceof Error ? err.message : String(err)
    }
  }

  return NextResponse.json({ ok: true, totalNew, perSource, at: new Date().toISOString() })
}
