#!/usr/bin/env node
// One-shot backfill: grant 90-day Pro to users stuck by the PWASetup
// dedupe bug fixed in commit 366433c on 2026-04-26.
//
// Bug: PWASetup.tsx wrote a localStorage dedupe flag for all
// { ok:true } responses from /api/user/claim-pwa-pro, including the
// { granted:false, pending:true } response that fires on the FIRST
// claim attempt during the 24h anti-spam window. Once the flag was
// set, the second call (post-24h) never fired — neither the silent
// auto-claim nor the ClaimProInPwa manual fallback (also gated on the
// same flag). Result: a population of users who installed the PWA but
// never received the promised 3-month Pro grant.
//
// Eligibility (server-side, no client interaction needed):
//   - profiles.pwa_installed_at < NOW() - 24h
//   - profiles.tier = 'free'  (don't downgrade business / paid pro)
//   - profiles.pro_via_pwa_until IS NULL OR < NOW()
//
// Action: set tier='pro' + pro_via_pwa_until = NOW() + 90 days.
// Idempotent: re-running won't double-grant (filter excludes already
// granted users via pro_via_pwa_until check).
//
// Run from cruzar root:  node scripts/backfill-pwa-pro.mjs
// Add --dry to preview without writing.

import { config } from 'dotenv'
import { createClient } from '@supabase/supabase-js'

config({ path: '.env.local' })

const url = process.env.NEXT_PUBLIC_SUPABASE_URL
const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY
if (!url || !serviceKey) {
  console.error('Missing NEXT_PUBLIC_SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY in .env.local')
  process.exit(1)
}

const dry = process.argv.includes('--dry')
const db = createClient(url, serviceKey, { auth: { persistSession: false } })

const cutoffISO = new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString()
const grantUntilISO = new Date(Date.now() + 90 * 24 * 60 * 60 * 1000).toISOString()
const nowISO = new Date().toISOString()

// Find eligible profiles. Two-pass filter on pro_via_pwa_until since
// PostgREST doesn't let us OR (is.null) with (lt.now) in one filter
// cleanly without RPC; pull both populations and dedupe.
const { data: nullGrants, error: nullErr } = await db
  .from('profiles')
  .select('id, display_name, tier, pwa_installed_at, pro_via_pwa_until')
  .lt('pwa_installed_at', cutoffISO)
  .eq('tier', 'free')
  .is('pro_via_pwa_until', null)

const { data: expiredGrants, error: expErr } = await db
  .from('profiles')
  .select('id, display_name, tier, pwa_installed_at, pro_via_pwa_until')
  .lt('pwa_installed_at', cutoffISO)
  .eq('tier', 'free')
  .lt('pro_via_pwa_until', nowISO)

if (nullErr || expErr) {
  console.error('query failed:', nullErr || expErr)
  process.exit(1)
}

const seen = new Set()
const eligible = [...(nullGrants || []), ...(expiredGrants || [])].filter((p) => {
  if (seen.has(p.id)) return false
  seen.add(p.id)
  return true
})

console.log(`\nfound ${eligible.length} eligible profiles for backfill`)
console.log(`(pwa_installed_at < ${cutoffISO}, tier=free, no active pro_via_pwa_until)\n`)

if (eligible.length > 0) {
  const preview = eligible.slice(0, 10).map((p) => ({
    id: p.id.slice(0, 8) + '…',
    name: p.display_name,
    installed: p.pwa_installed_at,
    expired_grant: p.pro_via_pwa_until,
  }))
  console.table(preview)
  if (eligible.length > 10) console.log(`... and ${eligible.length - 10} more`)
}

if (dry) {
  console.log('\n--dry: nothing written. re-run without --dry to apply.')
  process.exit(0)
}

if (eligible.length === 0) {
  console.log('nothing to do.')
  process.exit(0)
}

let granted = 0
let failed = 0
for (const p of eligible) {
  const { error } = await db
    .from('profiles')
    .update({ tier: 'pro', pro_via_pwa_until: grantUntilISO })
    .eq('id', p.id)
  if (error) {
    failed += 1
    console.error(`failed for ${p.email}:`, error.message)
  } else {
    granted += 1
  }
}

console.log(`\ngranted Pro to ${granted} users. failures: ${failed}`)
console.log(`pro_via_pwa_until = ${grantUntilISO}`)
