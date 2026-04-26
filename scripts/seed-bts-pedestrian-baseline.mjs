#!/usr/bin/env node
// Seed bts_pedestrian_baseline from the live BTS Socrata API.
//
// Source: Bureau of Transportation Statistics — Border Crossing Entry
// Data dataset (https://data.bts.gov/d/keg4-3bc2). Public domain, no
// auth needed. SODA endpoint:
//
//   https://data.bts.gov/resource/keg4-3bc2.json
//
// Filters: border='US-Mexico Border' AND measure='Pedestrians'
// Returns: per (port_name, state, date) one count value.
//
// We fetch the most recent ~18 months, group by (port_name, state) and
// write the latest 12 months per port, apportioning the per-US-port
// total across the actual BWT bridges using lib/pedestrianApportionment.
// Bridges with weight 0 (commercial/cargo) get no row at all so the
// hero card doesn't claim baseline data for non-pedestrian bridges.
//
// Idempotent: upserts by (port_id, year, month). Re-run anytime.
//
// Usage:
//   node scripts/seed-bts-pedestrian-baseline.mjs
//   node scripts/seed-bts-pedestrian-baseline.mjs --months=24    (extend backfill)
//   node scripts/seed-bts-pedestrian-baseline.mjs --dry-run      (don't write)

import { createClient } from '@supabase/supabase-js'
import { config } from 'dotenv'
import { findBtsRule } from '../lib/pedestrianApportionment.mjs'

config({ path: '.env.local' })

const url = process.env.NEXT_PUBLIC_SUPABASE_URL
const key = process.env.SUPABASE_SERVICE_ROLE_KEY
if (!url || !key) {
  console.error('Missing NEXT_PUBLIC_SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY in .env.local')
  process.exit(1)
}

let monthsBack = 12
let dryRun = false
for (const arg of process.argv.slice(2)) {
  const m = arg.match(/^--months=(\d+)$/)
  if (m) monthsBack = parseInt(m[1], 10)
  if (arg === '--dry-run') dryRun = true
}

const SOCRATA_URL = 'https://data.bts.gov/resource/keg4-3bc2.json'

// Fetch the most recent N months of US-Mexico pedestrian counts.
// SODA $where with date is awkward (string field), so we pull a
// generous superset and filter client-side by month.
async function fetchBtsRows() {
  const params = new URLSearchParams({
    $where: "border='US-Mexico Border' AND measure='Pedestrians'",
    $select: 'port_name,state,port_code,date,measure,value,latitude,longitude',
    $limit: '20000',
    $order: 'date DESC',
  })
  const url = `${SOCRATA_URL}?${params}`
  console.log(`Fetching BTS: ${url}`)
  const res = await fetch(url, {
    headers: { 'User-Agent': 'Cruzar-BTS-Seed/1.0 (+https://cruzar.app)' },
  })
  if (!res.ok) {
    const txt = await res.text()
    throw new Error(`BTS fetch failed: HTTP ${res.status} — ${txt.slice(0, 300)}`)
  }
  const rows = await res.json()
  if (!Array.isArray(rows)) throw new Error('Expected array from Socrata')
  console.log(`Got ${rows.length} raw rows from BTS`)
  return rows
}

// BTS `date` is a string. The dataset uses two formats over its
// history: "Jan 2024" (3-letter month + space + 4-digit year) and ISO
// timestamps for newer rows. Normalize to {year, month}.
function parseBtsDate(s) {
  if (!s) return null
  // ISO first
  const iso = new Date(s)
  if (!isNaN(iso.getTime()) && s.includes('T')) {
    return { year: iso.getUTCFullYear(), month: iso.getUTCMonth() + 1 }
  }
  const months = { Jan: 1, Feb: 2, Mar: 3, Apr: 4, May: 5, Jun: 6, Jul: 7, Aug: 8, Sep: 9, Oct: 10, Nov: 11, Dec: 12 }
  const m = s.match(/^([A-Za-z]+)\s+(\d{4})$/)
  if (m && months[m[1]]) return { year: parseInt(m[2], 10), month: months[m[1]] }
  // Fallback: try Date parse anyway
  if (!isNaN(iso.getTime())) {
    return { year: iso.getUTCFullYear(), month: iso.getUTCMonth() + 1 }
  }
  return null
}

async function main() {
  const supa = createClient(url, key, { auth: { persistSession: false } })

  const rows = await fetchBtsRows()

  // Compute the date cutoff (oldest month we keep). Anything older gets
  // dropped to keep the table tight.
  const now = new Date()
  const cutoff = new Date(now.getFullYear(), now.getMonth() - monthsBack, 1)

  // Group rows: key = (port_name|state|year|month) → summed value.
  // BTS sometimes has multiple rows per port-month (different sub-
  // facilities under the same parent port), so we sum.
  const byPortMonth = new Map()
  let kept = 0
  let stale = 0
  let unparsable = 0
  for (const r of rows) {
    const date = parseBtsDate(r.date)
    if (!date) { unparsable++; continue }
    const ts = new Date(date.year, date.month - 1, 1)
    if (ts < cutoff) { stale++; continue }
    const value = parseInt(r.value, 10)
    if (!isFinite(value) || value <= 0) continue
    const k = `${r.port_name}|${r.state}|${date.year}|${date.month}`
    byPortMonth.set(k, (byPortMonth.get(k) ?? 0) + value)
    kept++
  }
  console.log(`Filter: kept=${kept} stale=${stale} unparsable=${unparsable}`)

  // Now apportion to BWT bridges.
  const upsertRows = []
  const portsTouched = new Set()
  const unmatched = new Set()
  for (const [k, total] of byPortMonth) {
    const [portName, state, yStr, mStr] = k.split('|')
    const year = parseInt(yStr, 10)
    const month = parseInt(mStr, 10)
    const rule = findBtsRule(portName, state)
    if (!rule) { unmatched.add(`${portName}, ${state}`); continue }
    for (const b of rule.bridges) {
      if (b.weight <= 0) continue
      const apportionedCount = Math.round(total * b.weight)
      if (apportionedCount <= 0) continue
      upsertRows.push({
        port_id: b.bwtPortId,
        year,
        month,
        pedestrians_count: apportionedCount,
        source: 'BTS Border Crossing Entry Data (Socrata)',
        notes: `${portName}, ${state} × ${b.weight.toFixed(2)} weight${b.note ? ` — ${b.note}` : ''}`,
      })
      portsTouched.add(b.bwtPortId)
    }
  }

  // Dedupe + sum: when two BTS port entries (e.g. 'El Paso' and 'Paso
  // del Norte' both reported as separate TX ports) both apportion to the
  // same BWT bridge in the same month, sum them rather than letting the
  // primary-key collision blow up the insert.
  const dedupe = new Map()
  for (const r of upsertRows) {
    const k = `${r.port_id}|${r.year}|${r.month}`
    const existing = dedupe.get(k)
    if (existing) {
      existing.pedestrians_count += r.pedestrians_count
      existing.notes = `${existing.notes}; ${r.notes}`
    } else {
      dedupe.set(k, { ...r })
    }
  }
  upsertRows.length = 0
  upsertRows.push(...dedupe.values())

  console.log(`Built ${upsertRows.length} apportioned rows for ${portsTouched.size} BWT ports (after dedupe)`)
  if (unmatched.size > 0) {
    console.log(`Unmatched BTS ports (no apportionment rule):`)
    for (const u of [...unmatched].sort()) console.log(`  - ${u}`)
  }

  // Sample the latest month per port so the user can sanity-check.
  const latestByPort = new Map()
  for (const r of upsertRows) {
    const cur = latestByPort.get(r.port_id)
    if (!cur || (r.year * 12 + r.month) > (cur.year * 12 + cur.month)) {
      latestByPort.set(r.port_id, r)
    }
  }
  console.log(`\nLatest month per BWT port (apportioned):`)
  const sorted = [...latestByPort.values()].sort((a, b) => b.pedestrians_count - a.pedestrians_count)
  for (const r of sorted) {
    const perDay = Math.round(r.pedestrians_count / 30)
    const perHour = Math.round(perDay / 24)
    console.log(`  ${r.port_id.padEnd(8)} ${String(r.year)}-${String(r.month).padStart(2, '0')}  ${r.pedestrians_count.toLocaleString().padStart(10)}/mo  ~${String(perHour).padStart(5)}/h`)
  }

  if (dryRun) {
    console.log('\n--dry-run: skipping write')
    return
  }

  // Wipe + re-insert rather than upsert because apportionment weights
  // may have shifted between runs and we want stale rows gone.
  console.log(`\nWiping bts_pedestrian_baseline...`)
  const { error: delErr } = await supa.from('bts_pedestrian_baseline').delete().not('port_id', 'is', null)
  if (delErr) {
    console.error('Wipe failed:', delErr.message)
    process.exit(1)
  }

  // Chunk to keep PostgREST happy.
  const chunkSize = 500
  for (let i = 0; i < upsertRows.length; i += chunkSize) {
    const chunk = upsertRows.slice(i, i + chunkSize)
    const { error } = await supa.from('bts_pedestrian_baseline').insert(chunk)
    if (error) {
      console.error(`Insert chunk ${i / chunkSize} failed:`, error.message)
      process.exit(1)
    }
  }
  console.log(`Inserted ${upsertRows.length} rows.`)
}

main().catch((e) => { console.error(e); process.exit(1) })
