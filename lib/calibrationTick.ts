// Live calibration loop logic — exported so it can run inline from
// /api/cron/calibration-tick (direct invocation by cron-job.org or
// manual trigger) AND from /api/cron/fetch-wait-times (piggyback on
// the already-registered scheduler).
//
// We had to extract this because the original piggyback used a
// fire-and-forget fetch() to https://www.cruzar.app/api/cron/calibration-tick,
// which gets blocked by Vercel Attack Challenge Mode on the public
// domain — even when called from another Vercel function inside the
// same project. Inlining the logic avoids the public-domain round trip
// entirely.

import { getServiceClient } from '@/lib/supabase'
import { forecast, isForecastError } from '@/lib/forecastClient'

export const TRACKED_PORT_IDS = [
  '230401', '230402', '230403',
  '230301', '230302',
  '230501', '230502', '230503',
  '230701', '230901', '230902', '231001',
  '535501', '535502', '535503', '535504',
]

export const HORIZON_MIN = 360
const TARGET_GRACE_MIN = 15
const FILL_BATCH_LIMIT = 80

interface PredictedJson {
  port_id: string
  port_name?: string
  prediction_min?: number | null
  horizon_min: number
}

interface ContextJson {
  cbp_at_t_vehicle_wait?: number | null
}

export interface CalibrationTickResult {
  ok: true
  at: string
  fill: { count: number; skipped: number; examined: number }
  write: { count: number; skipped: number; ports: number }
}

export async function runCalibrationTick(): Promise<CalibrationTickResult> {
  const sb = getServiceClient()
  const now = new Date()
  const nowIso = now.toISOString()

  // ───── ACTION 1: fill observed for predictions whose 6h target has elapsed ─────
  const lookbackUpper = new Date(now.getTime() - HORIZON_MIN * 60 * 1000 + TARGET_GRACE_MIN * 60 * 1000).toISOString()
  const lookbackLower = new Date(now.getTime() - 24 * 60 * 60 * 1000).toISOString()

  const { data: pendingRows } = await sb
    .from('calibration_log')
    .select('id, predicted, context, created_at')
    .eq('project', 'cruzar')
    .eq('sim_kind', 'wait_forecast_6h')
    .is('observed', null)
    .gte('created_at', lookbackLower)
    .lte('created_at', lookbackUpper)
    .order('created_at', { ascending: true })
    .limit(FILL_BATCH_LIMIT)

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
    if (!observedReading || observedReading.vehicle_wait == null) { fillSkipped++; continue }

    const observedWait = observedReading.vehicle_wait as number
    const predMin = predicted?.prediction_min ?? null
    const persistence = context?.cbp_at_t_vehicle_wait ?? null

    const loss = predMin != null ? Math.abs(predMin - observedWait) : null
    const persistenceLoss = persistence != null ? Math.abs(persistence - observedWait) : null

    const { error: updateErr } = await sb
      .from('calibration_log')
      .update({
        observed: { vehicle_wait: observedWait, recorded_at: observedReading.recorded_at, persistence_loss: persistenceLoss },
        observed_at: nowIso,
        loss,
      })
      .eq('id', row.id)

    if (!updateErr) filledCount++
    else fillSkipped++
  }

  // ───── ACTION 2: write fresh 6h-ahead predictions ─────
  const targetIso = new Date(now.getTime() + HORIZON_MIN * 60 * 1000).toISOString()
  let writtenCount = 0
  let writeSkipped = 0

  for (const portId of TRACKED_PORT_IDS) {
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

    const { error: insertErr } = await sb.from('calibration_log').insert({
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
      // tags is TEXT[] per v63 migration — array of strings only.
      tags: [
        `port:${portId}`,
        `model:${f.model || 'unknown'}`,
        'horizon:6h',
        'sim:wait_forecast_6h',
      ],
    })

    if (!insertErr) writtenCount++
    else { console.warn(`[calibration-tick] insert failed for ${portId}: ${insertErr.message}`); writeSkipped++ }
  }

  return {
    ok: true,
    at: nowIso,
    fill: { count: filledCount, skipped: fillSkipped, examined: pendingRows?.length ?? 0 },
    write: { count: writtenCount, skipped: writeSkipped, ports: TRACKED_PORT_IDS.length },
  }
}
