// Live calibration loop — writes 6h-ahead predictions to calibration_log and
// fills observed/loss for predictions whose 6h target has elapsed. Runs every
// 15 min via cron-job.org. Closes the "we don't know if we're better than CBP
// in production" gap that backtest-only metrics can't answer.
//
// Each tick does TWO actions:
//
// 1. FILL OBSERVED — find calibration_log rows where:
//      sim_kind = 'wait_forecast_6h'
//      observed IS NULL
//      created_at between (now - 24h) and (now - 6h + 15m grace)
//    For each, look up the wait_time_readings nearest to (created_at + 6h)
//    within ±15min and write observed/loss. Also computes persistence_loss
//    against the CBP-at-time-T snapshot stored in context — that's the
//    apples-to-apples comparison: what a dispatcher who just checked CBP
//    would have predicted.
//
// 2. WRITE PREDICTIONS — for each tracked port, call the v0.5.x forecast
//    endpoint and insert a row predicting the wait at (now + 6h). Snapshot
//    CBP-at-time-T into context for the persistence baseline.
//
// Auth: shared CRON_SECRET, accepts ?secret= or Authorization: Bearer.

import { NextRequest, NextResponse } from 'next/server'
import { getServiceClient } from '@/lib/supabase'
import { forecast, isForecastError } from '@/lib/forecastClient'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'
export const maxDuration = 60

// Tracked ports — superset of the v0.5.4 manifest commercial-relevant set.
// Limited to RGV + Laredo + Eagle Pass + Brownsville for the MVP loop;
// expand later when the soak proves stable.
const PORT_IDS = [
  '230401', '230402', '230403', // Laredo Gateway / WTB / Colombia
  '230301', '230302',           // Eagle Pass I / II
  '230501', '230502', '230503', // Hidalgo / Pharr-Reynosa / Anzalduas
  '230701', '230901', '230902', '231001', // RGC / Progreso / Donna / Roma
  '535501', '535502', '535503', '535504', // Brownsville x4
]

const HORIZON_MIN = 360
const TARGET_GRACE_MIN = 15

function authorized(req: NextRequest): boolean {
  const expected = process.env.CRON_SECRET
  if (!expected) return false
  const url = new URL(req.url)
  if (url.searchParams.get('secret') === expected) return true
  const auth = req.headers.get('authorization') ?? ''
  if (auth.toLowerCase().startsWith('bearer ') && auth.slice(7).trim() === expected) {
    return true
  }
  return false
}

interface PredictedJson {
  port_id: string
  port_name?: string
  prediction_min?: number | null
  horizon_min: number
  rmse_min?: number | null
  degraded?: boolean
  fallback_basis?: string | null
}

interface ContextJson {
  target_time_iso: string
  cbp_at_t_vehicle_wait?: number | null
  cbp_recorded_at?: string | null
}

export async function GET(req: NextRequest) {
  if (!authorized(req)) {
    return NextResponse.json({ error: 'unauthorized' }, { status: 401 })
  }

  const sb = getServiceClient()
  const now = new Date()
  const nowIso = now.toISOString()

  // ───────────────────────────────────────────────────────────────────────
  // ACTION 1 — fill observed for predictions whose 6h target has elapsed.
  // ───────────────────────────────────────────────────────────────────────
  const lookbackUpper = new Date(now.getTime() - HORIZON_MIN * 60 * 1000 + TARGET_GRACE_MIN * 60 * 1000).toISOString()
  const lookbackLower = new Date(now.getTime() - 24 * 60 * 60 * 1000).toISOString()

  const { data: pendingRows, error: pendingErr } = await sb
    .from('calibration_log')
    .select('id, predicted, context, created_at')
    .eq('project', 'cruzar')
    .eq('sim_kind', 'wait_forecast_6h')
    .is('observed', null)
    .gte('created_at', lookbackLower)
    .lte('created_at', lookbackUpper)

  let filledCount = 0
  let fillSkipped = 0

  for (const row of pendingRows ?? []) {
    const predicted = row.predicted as PredictedJson | null
    const context = row.context as ContextJson | null
    const portId = predicted?.port_id
    if (!portId) { fillSkipped++; continue }

    const targetMs = new Date(row.created_at).getTime() + HORIZON_MIN * 60 * 1000
    const lower = new Date(targetMs - TARGET_GRACE_MIN * 60 * 1000).toISOString()
    const upper = new Date(targetMs + TARGET_GRACE_MIN * 60 * 1000).toISOString()

    const { data: readings } = await sb
      .from('wait_time_readings')
      .select('vehicle_wait, recorded_at')
      .eq('port_id', portId)
      .gte('recorded_at', lower)
      .lte('recorded_at', upper)
      .order('recorded_at', { ascending: true })
      .limit(1)

    const observedReading = readings?.[0]
    if (!observedReading || observedReading.vehicle_wait == null) {
      fillSkipped++
      continue
    }

    const observedWait = observedReading.vehicle_wait as number
    const predMin = predicted?.prediction_min ?? null
    const persistence = context?.cbp_at_t_vehicle_wait ?? null

    const loss = predMin != null ? Math.abs(predMin - observedWait) : null
    const persistenceLoss = persistence != null ? Math.abs(persistence - observedWait) : null

    const { error: updateErr } = await sb
      .from('calibration_log')
      .update({
        observed: {
          vehicle_wait: observedWait,
          recorded_at: observedReading.recorded_at,
          persistence_loss: persistenceLoss,
        },
        observed_at: nowIso,
        loss: loss,
      })
      .eq('id', row.id)

    if (!updateErr) filledCount++
    else fillSkipped++
  }

  // ───────────────────────────────────────────────────────────────────────
  // ACTION 2 — write fresh 6h-ahead predictions for each tracked port.
  // ───────────────────────────────────────────────────────────────────────
  const targetIso = new Date(now.getTime() + HORIZON_MIN * 60 * 1000).toISOString()
  let writtenCount = 0
  let writeSkipped = 0

  for (const portId of PORT_IDS) {
    // Snapshot CBP-at-time-T (persistence baseline) — most recent reading
    // for the port, ideally within the last 30min so the cron-job.org
    // scheduler delays don't poison the comparison.
    const { data: latest } = await sb
      .from('wait_time_readings')
      .select('vehicle_wait, recorded_at')
      .eq('port_id', portId)
      .order('recorded_at', { ascending: false })
      .limit(1)

    const cbpAtT = latest?.[0]?.vehicle_wait ?? null
    const cbpRecordedAt = latest?.[0]?.recorded_at ?? null

    const f = await forecast(portId, HORIZON_MIN)
    if (isForecastError(f)) {
      console.warn(`[calibration-tick] forecast failed for ${portId}: ${f.error}`)
      writeSkipped++
      continue
    }

    const insertRow = {
      project: 'cruzar',
      sim_kind: 'wait_forecast_6h',
      sim_version: f.model || 'unknown',
      predicted: {
        port_id: portId,
        port_name: f.port_name,
        prediction_min: f.prediction_min,
        horizon_min: HORIZON_MIN,
        rmse_min: f.rmse_min,
        degraded: f.degraded ?? false,
        fallback_basis: f.fallback_basis ?? null,
      },
      observed: null,
      context: {
        target_time_iso: targetIso,
        cbp_at_t_vehicle_wait: cbpAtT,
        cbp_recorded_at: cbpRecordedAt,
      },
      tags: { port_id: portId, model_version: f.model, sim: 'wait_forecast_6h' },
    }

    const { error: insertErr } = await sb.from('calibration_log').insert(insertRow)
    if (!insertErr) writtenCount++
    else { console.warn(`[calibration-tick] insert failed for ${portId}: ${insertErr.message}`); writeSkipped++ }
  }

  return NextResponse.json({
    ok: true,
    at: nowIso,
    fill: { count: filledCount, skipped: fillSkipped, examined: pendingRows?.length ?? 0 },
    write: { count: writtenCount, skipped: writeSkipped, ports: PORT_IDS.length },
  })
}
