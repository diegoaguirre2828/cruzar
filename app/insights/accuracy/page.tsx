// Public calibration scoreboard. Per-bridge accuracy, both backtest (the
// v0.5.4 manifest's held-out test split, frozen at training time) and live
// soak (predictions written every 15 min by /api/cron/calibration-tick,
// observed-and-scored 6 hours later from wait_time_readings).
//
// This page exists to answer the question "are you actually better than CBP?"
// with public receipts. Most AI startups don't publish accuracy because they
// don't track it. We track it. Calibration thesis 2026-04-30 — receipts, not
// promises.

import { getServiceClient } from '@/lib/supabase'
import manifest from '@/data/insights-manifest.json'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'
export const revalidate = 60

interface ManifestModel {
  port_id: string
  port_name: string
  horizon_min: number
  rmse_min: number
  model_kind: string
  lift_vs_persistence_pct: number | null
  lift_vs_cbp_climatology_pct: number | null
  lift_vs_self_climatology_pct: number | null
  n_train: number
  n_test: number
}

interface LiveStat {
  port_id: string
  port_name: string
  n_observations: number
  n_predictions: number
  mean_error_min: number | null
  mean_persistence_error_min: number | null
  lift_vs_persistence_pct: number | null
  first_recorded: string | null
  latest_recorded: string | null
  latest_observed: string | null
}

async function loadLiveStats(): Promise<{ stats: LiveStat[]; firstRecord: string | null; pendingTotal: number }> {
  const sb = getServiceClient()
  const thirtyDaysAgo = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000).toISOString()

  const { data: rows } = await sb
    .from('calibration_log')
    .select('predicted, observed, loss, context, created_at, observed_at')
    .eq('project', 'cruzar')
    .eq('sim_kind', 'wait_forecast_6h')
    .gte('created_at', thirtyDaysAgo)
    .order('created_at', { ascending: false })

  let firstRecord: string | null = null
  let pendingTotal = 0
  const byPort = new Map<string, {
    port_id: string
    port_name: string
    n_pred: number
    n_obs: number
    sum_loss: number
    sum_pers_loss: number
    n_pers: number
    first: string | null
    latest_pred: string | null
    latest_obs: string | null
  }>()

  for (const r of (rows ?? []) as Array<{
    predicted: { port_id?: string; port_name?: string } | null
    observed: { vehicle_wait?: number; persistence_loss?: number | null } | null
    loss: number | null
    context: { cbp_at_t_vehicle_wait?: number | null } | null
    created_at: string
    observed_at: string | null
  }>) {
    const portId = r.predicted?.port_id
    if (!portId) continue
    const portName = r.predicted?.port_name ?? portId

    const cur = byPort.get(portId) ?? {
      port_id: portId,
      port_name: portName,
      n_pred: 0,
      n_obs: 0,
      sum_loss: 0,
      sum_pers_loss: 0,
      n_pers: 0,
      first: r.created_at,
      latest_pred: r.created_at,
      latest_obs: null,
    }

    cur.n_pred++
    if (!cur.first || r.created_at < cur.first) cur.first = r.created_at
    if (!cur.latest_pred || r.created_at > cur.latest_pred) cur.latest_pred = r.created_at

    if (r.observed != null && r.loss != null) {
      cur.n_obs++
      cur.sum_loss += r.loss
      const persLoss = r.observed.persistence_loss
      if (persLoss != null) {
        cur.n_pers++
        cur.sum_pers_loss += persLoss
      }
      if (!cur.latest_obs || (r.observed_at && r.observed_at > cur.latest_obs)) {
        cur.latest_obs = r.observed_at
      }
    } else {
      pendingTotal++
    }

    byPort.set(portId, cur)

    if (!firstRecord || r.created_at < firstRecord) firstRecord = r.created_at
  }

  const stats: LiveStat[] = Array.from(byPort.values()).map((s) => {
    const meanErr = s.n_obs > 0 ? s.sum_loss / s.n_obs : null
    const meanPers = s.n_pers > 0 ? s.sum_pers_loss / s.n_pers : null
    const lift = (meanErr != null && meanPers != null && meanPers > 0)
      ? Math.round(((meanPers - meanErr) / meanPers) * 1000) / 10
      : null
    return {
      port_id: s.port_id,
      port_name: s.port_name,
      n_observations: s.n_obs,
      n_predictions: s.n_pred,
      mean_error_min: meanErr != null ? Math.round(meanErr * 10) / 10 : null,
      mean_persistence_error_min: meanPers != null ? Math.round(meanPers * 10) / 10 : null,
      lift_vs_persistence_pct: lift,
      first_recorded: s.first,
      latest_recorded: s.latest_pred,
      latest_observed: s.latest_obs,
    }
  }).sort((a, b) => b.n_observations - a.n_observations || b.n_predictions - a.n_predictions)

  return { stats, firstRecord, pendingTotal }
}

function loadBacktest(): ManifestModel[] {
  const m = manifest as { models?: ManifestModel[] }
  return (m.models ?? []).filter((x) => x.horizon_min === 360).sort((a, b) => b.n_test - a.n_test)
}

function fmtPct(x: number | null | undefined, digits = 1): string {
  if (x == null) return '—'
  const sign = x > 0 ? '+' : ''
  return `${sign}${x.toFixed(digits)}%`
}

function fmtMin(x: number | null | undefined): string {
  if (x == null) return '—'
  return `${x.toFixed(1)} min`
}

export default async function AccuracyPage() {
  const [{ stats: liveStats, firstRecord, pendingTotal }, backtest] = await Promise.all([
    loadLiveStats(),
    Promise.resolve(loadBacktest()),
  ])

  const liveStarted = firstRecord ? new Date(firstRecord).toLocaleString('en-US', { timeZone: 'America/Chicago' }) : null
  const totalLiveObservations = liveStats.reduce((s, x) => s + x.n_observations, 0)

  return (
    <main className="min-h-screen bg-slate-950 text-slate-100">
      <div className="max-w-5xl mx-auto px-4 py-12">
        <header className="mb-10">
          <p className="text-xs uppercase tracking-[0.18em] text-slate-400 mb-2">Cruzar Insights — Accuracy</p>
          <h1 className="text-3xl md:text-4xl font-bold mb-3">Public accuracy receipts</h1>
          <p className="text-slate-400 max-w-2xl leading-relaxed">
            Every 6-hour wait-time prediction Cruzar makes is logged here, then compared against the actual wait that arrives 6 hours later. We publish this because most prediction products don&rsquo;t — and you should be able to see exactly how often we beat the alternative for the bridges you cross.
          </p>
        </header>

        <section className="mb-12">
          <div className="flex items-baseline justify-between mb-2">
            <h2 className="text-xl font-bold">Live soak — predictions vs reality</h2>
            <span className="text-xs text-slate-500">v0.5.x · 6h horizon · per-bridge</span>
          </div>
          {liveStarted ? (
            <p className="text-xs text-slate-500 mb-4">
              Live capture started <span className="text-slate-300">{liveStarted} CT</span>. {totalLiveObservations} predictions validated, {pendingTotal} pending. Predictions write every 15 min and are compared to the actual wait observed 6 hours later via CBP&apos;s data feed.
            </p>
          ) : (
            <p className="text-xs text-amber-400 mb-4">
              Live soak hasn&rsquo;t started yet — first cron tick will populate this section.
            </p>
          )}
          {liveStats.length === 0 ? (
            <div className="rounded-2xl border border-slate-800 bg-slate-900/40 p-8 text-center text-sm text-slate-500">
              No predictions have been observed yet. First validated row will appear ~6 hours after the live cron starts firing.
            </div>
          ) : (
            <div className="overflow-x-auto rounded-2xl border border-slate-800">
              <table className="w-full text-sm">
                <thead className="bg-slate-900/60 text-xs uppercase tracking-wider text-slate-500">
                  <tr>
                    <th className="text-left px-4 py-3">Bridge</th>
                    <th className="text-right px-4 py-3">n observed</th>
                    <th className="text-right px-4 py-3">Cruzar avg error</th>
                    <th className="text-right px-4 py-3">CBP-live avg error</th>
                    <th className="text-right px-4 py-3">Lift vs CBP-live</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-800">
                  {liveStats.map((s) => {
                    const lowConfidence = s.n_observations < 30
                    return (
                      <tr key={s.port_id} className={lowConfidence ? 'opacity-60' : ''}>
                        <td className="px-4 py-3 font-medium">{s.port_name}<span className="text-xs text-slate-500 ml-2">{s.port_id}</span></td>
                        <td className="px-4 py-3 text-right tabular-nums">{s.n_observations}{lowConfidence && s.n_observations > 0 ? <span className="text-xs text-amber-400 ml-1">(low n)</span> : null}</td>
                        <td className="px-4 py-3 text-right tabular-nums">{fmtMin(s.mean_error_min)}</td>
                        <td className="px-4 py-3 text-right tabular-nums">{fmtMin(s.mean_persistence_error_min)}</td>
                        <td className={`px-4 py-3 text-right tabular-nums ${s.lift_vs_persistence_pct != null && s.lift_vs_persistence_pct > 0 ? 'text-emerald-400' : s.lift_vs_persistence_pct != null && s.lift_vs_persistence_pct < 0 ? 'text-rose-400' : 'text-slate-500'}`}>
                          {fmtPct(s.lift_vs_persistence_pct)}
                        </td>
                      </tr>
                    )
                  })}
                </tbody>
              </table>
            </div>
          )}
          <p className="text-xs text-slate-500 mt-3 leading-relaxed">
            <strong className="text-slate-300">CBP-live</strong> = the wait CBP was reporting at the moment we made the prediction (i.e., what a dispatcher checking <span className="text-slate-300">bwt.cbp.gov</span> would have seen). That&rsquo;s the apples-to-apples comparison: we predict 6 hours forward, CBP shows now, the actual wait arrives 6 hours later, and whoever is closer wins.
            <br /><br />
            Rows with fewer than 30 observed predictions are shown faded — there&rsquo;s not enough data yet to draw conclusions. Full confidence requires 14+ days of soak.
          </p>
        </section>

        <section>
          <div className="flex items-baseline justify-between mb-2">
            <h2 className="text-xl font-bold">Backtest — held-out test split</h2>
            <span className="text-xs text-slate-500">v0.5.4 · 2026-04-29 training</span>
          </div>
          <p className="text-xs text-slate-500 mb-4 leading-relaxed">
            Pre-launch validation against historical data. Trained on most of the available wait-time history, evaluated on a frozen test split the model never saw. <strong className="text-slate-300">This is NOT operational accuracy</strong> — it&rsquo;s the bound we expect live performance to land near, given identical conditions. Live soak above is the actual proof.
          </p>
          <div className="overflow-x-auto rounded-2xl border border-slate-800">
            <table className="w-full text-sm">
              <thead className="bg-slate-900/60 text-xs uppercase tracking-wider text-slate-500">
                <tr>
                  <th className="text-left px-4 py-3">Bridge</th>
                  <th className="text-right px-4 py-3">RMSE</th>
                  <th className="text-right px-4 py-3">vs CBP climatology</th>
                  <th className="text-right px-4 py-3">vs persistence</th>
                  <th className="text-right px-4 py-3">n_test</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-800">
                {backtest.map((m) => {
                  const liftCbp = m.lift_vs_cbp_climatology_pct
                  const liftPers = m.lift_vs_persistence_pct
                  return (
                    <tr key={m.port_id}>
                      <td className="px-4 py-3 font-medium">{m.port_name}<span className="text-xs text-slate-500 ml-2">{m.port_id}</span></td>
                      <td className="px-4 py-3 text-right tabular-nums">{fmtMin(m.rmse_min)}</td>
                      <td className={`px-4 py-3 text-right tabular-nums ${liftCbp != null && liftCbp > 0 ? 'text-emerald-400' : liftCbp != null && liftCbp < 0 ? 'text-rose-400' : 'text-slate-500'}`}>{fmtPct(liftCbp)}</td>
                      <td className={`px-4 py-3 text-right tabular-nums ${liftPers != null && liftPers > 0 ? 'text-emerald-400' : liftPers != null && liftPers < 0 ? 'text-rose-400' : 'text-slate-500'}`}>{fmtPct(liftPers)}</td>
                      <td className="px-4 py-3 text-right tabular-nums text-slate-500">{m.n_test}</td>
                    </tr>
                  )
                })}
              </tbody>
            </table>
          </div>
          <p className="text-xs text-slate-500 mt-3">
            Negative numbers on bridges like Pharr-Reynosa or Brownsville Veterans aren&rsquo;t hidden. The model overfits or under-samples on those, and you should know before relying on the prediction. Improvements are tracked at <span className="text-slate-300">cruzar-insights-ml</span>.
          </p>
        </section>
      </div>
    </main>
  )
}
