// /pulse — Border Tension Index public dashboard. The "what's the border
// like RIGHT NOW" glanceable surface backed by primary sources (CBP wait
// readings + NASA EONET natural events). Direct extension of the
// scenario-sim + EONET anomaly layer Diego shipped on 4/28.
//
// Inspired by GeoTrade's Geopolitical Tension Index but applied to US-MX
// border conditions. Regime-1 honesty: we surface only what we measure
// today (anomalies, closures, EONET events, commercial wait magnitude).
// Regime-2 inputs (DOS, DOF) are listed openly as "coming" so the page
// doesn't bluff.

import Link from 'next/link'
import { headers } from 'next/headers'

export const runtime = 'nodejs'
export const revalidate = 60

interface PulseSnapshot {
  port_id: string
  port_name: string
  current_wait: number | null
  baseline_avg: number | null
  baseline_n: number
  is_anomaly_high: boolean
  is_closed: boolean
  recorded_at: string | null
}

type FeedEvent =
  | { kind: 'anomaly'; port_id: string; port_name: string; current: number; baseline: number; ratio: number; recorded_at: string }
  | { kind: 'closure'; port_id: string; port_name: string; last_seen_at: string | null }
  | { kind: 'natural'; id: string; title: string; category: string; distance_km: number; source: string; source_url: string | null; last_observed_at: string }

interface PulseData {
  bti: number
  level: 'calm' | 'normal' | 'tense' | 'high' | 'severe'
  components: {
    anomaly: { score: number; cap: number; count: number }
    closure: { score: number; cap: number; count: number }
    natural_events: { score: number; cap: number; count: number }
    wait_magnitude: { score: number; cap: number; avg_commercial_min: number | null }
  }
  snapshots: PulseSnapshot[]
  events: FeedEvent[]
  regime: number
  regime_2_pending: string[]
  calculated_at: string
}

async function loadPulse(): Promise<PulseData | null> {
  // Build the absolute URL from request headers — Next 16 server components
  // can't relative-fetch their own /api routes (no automatic origin
  // resolution). Walking through the request host gives us the right
  // protocol + domain in prod (cruzar.app) and dev (localhost:3000).
  const h = await headers()
  const host = h.get('host') ?? 'cruzar.app'
  const proto = host.includes('localhost') ? 'http' : 'https'
  try {
    const res = await fetch(`${proto}://${host}/api/pulse`, { next: { revalidate: 60 } })
    if (!res.ok) return null
    return (await res.json()) as PulseData
  } catch {
    return null
  }
}

const LEVEL_CONFIG: Record<PulseData['level'], { es: string; en: string; ring: string; bg: string; text: string }> = {
  calm: { es: 'Despejado', en: 'Clear', ring: 'ring-emerald-500', bg: 'bg-emerald-500/10', text: 'text-emerald-400' },
  normal: { es: 'Normal', en: 'Normal', ring: 'ring-blue-500', bg: 'bg-blue-500/10', text: 'text-blue-400' },
  tense: { es: 'Tenso', en: 'Tense', ring: 'ring-amber-500', bg: 'bg-amber-500/10', text: 'text-amber-400' },
  high: { es: 'Alta tensión', en: 'High tension', ring: 'ring-orange-500', bg: 'bg-orange-500/10', text: 'text-orange-400' },
  severe: { es: 'Severo', en: 'Severe', ring: 'ring-rose-500', bg: 'bg-rose-500/10', text: 'text-rose-400' },
}

function fmtMinutesAgo(iso: string | null | undefined): string {
  if (!iso) return '—'
  const ms = Date.now() - new Date(iso).getTime()
  const m = Math.round(ms / 60000)
  if (m < 1) return 'just now'
  if (m < 60) return `${m} min ago`
  const h = Math.round(m / 60)
  if (h < 24) return `${h}h ago`
  return `${Math.round(h / 24)}d ago`
}

export default async function PulsePage() {
  const data = await loadPulse()

  if (!data) {
    return (
      <main className="min-h-screen bg-slate-950 text-slate-100 flex items-center justify-center px-4">
        <div className="text-center">
          <h1 className="text-2xl font-bold mb-2">Pulse offline</h1>
          <p className="text-slate-400">Couldn&rsquo;t load the Border Tension Index right now. Try again in a moment.</p>
        </div>
      </main>
    )
  }

  const cfg = LEVEL_CONFIG[data.level]
  const calculatedAgo = fmtMinutesAgo(data.calculated_at)

  return (
    <main className="min-h-screen bg-slate-950 text-slate-100">
      <div className="max-w-5xl mx-auto px-4 py-12">
        <header className="mb-8">
          <p className="text-xs uppercase tracking-[0.18em] text-slate-400 mb-2">Cruzar Insights — /pulse</p>
          <h1 className="text-3xl md:text-4xl font-bold mb-3">Border Tension Index</h1>
          <p className="text-slate-400 max-w-2xl leading-relaxed">
            One glanceable number, 0&ndash;100, for what the US-MX border feels like right now. Aggregates wait anomalies, closures, NASA-tracked natural events, and commercial wait magnitude. Updates every 60 seconds. Higher = more friction.
          </p>
        </header>

        {/* Hero — the BTI number + level */}
        <section className={`mb-10 rounded-3xl ring-1 ${cfg.ring} ${cfg.bg} p-8 md:p-10`}>
          <div className="flex flex-col md:flex-row items-center md:items-end gap-6">
            <div className="text-center md:text-left flex-1">
              <p className={`text-xs uppercase tracking-[0.2em] font-bold mb-2 ${cfg.text}`}>{cfg.en} · {cfg.es}</p>
              <div className="flex items-baseline gap-2 justify-center md:justify-start">
                <span className={`text-7xl md:text-9xl font-black tabular-nums leading-none ${cfg.text}`}>{data.bti}</span>
                <span className="text-xl text-slate-500">/ 100</span>
              </div>
              <p className="text-xs text-slate-500 mt-3">Calculated {calculatedAgo}</p>
            </div>

            {/* Component bars */}
            <div className="w-full md:w-[420px] space-y-2">
              <ComponentBar label="Wait anomalies" sub={`${data.components.anomaly.count} bridge${data.components.anomaly.count === 1 ? '' : 's'} > 1.5× baseline`} score={data.components.anomaly.score} cap={data.components.anomaly.cap} />
              <ComponentBar label="Closures" sub={`${data.components.closure.count} bridge${data.components.closure.count === 1 ? '' : 's'} not reporting`} score={data.components.closure.score} cap={data.components.closure.cap} />
              <ComponentBar label="Natural events" sub={`${data.components.natural_events.count} EONET event${data.components.natural_events.count === 1 ? '' : 's'} within 100km`} score={data.components.natural_events.score} cap={data.components.natural_events.cap} />
              <ComponentBar label="Commercial wait" sub={data.components.wait_magnitude.avg_commercial_min != null ? `Avg ${data.components.wait_magnitude.avg_commercial_min} min across major freight bridges` : 'No commercial readings yet'} score={data.components.wait_magnitude.score} cap={data.components.wait_magnitude.cap} />
            </div>
          </div>
        </section>

        {/* Event feed */}
        <section className="mb-10">
          <div className="flex items-baseline justify-between mb-3">
            <h2 className="text-xl font-bold">What&rsquo;s contributing right now</h2>
            <span className="text-xs text-slate-500">{data.events.length} signal{data.events.length === 1 ? '' : 's'}</span>
          </div>
          {data.events.length === 0 ? (
            <div className="rounded-2xl border border-slate-800 bg-slate-900/40 p-8 text-center text-sm text-slate-500">
              No active anomalies, closures, or nearby natural events. The corridor is reading clear.
            </div>
          ) : (
            <ul className="space-y-2">
              {data.events.map((e, i) => (
                <li key={i} className="rounded-2xl border border-slate-800 bg-slate-900/40 p-4 flex flex-col md:flex-row md:items-center gap-2 md:gap-4">
                  <EventIcon kind={e.kind} />
                  <div className="flex-1 min-w-0">
                    {e.kind === 'anomaly' && (
                      <>
                        <p className="font-semibold text-rose-400">Wait anomaly · {e.port_name}</p>
                        <p className="text-sm text-slate-400">
                          {e.current} min now vs {e.baseline} min typical at this hour. Ratio <span className="text-slate-200 font-semibold">{e.ratio}×</span> · seen {fmtMinutesAgo(e.recorded_at)}
                        </p>
                      </>
                    )}
                    {e.kind === 'closure' && (
                      <>
                        <p className="font-semibold text-rose-400">Bridge offline · {e.port_name}</p>
                        <p className="text-sm text-slate-400">No CBP readings in the last 60 minutes. Last seen {fmtMinutesAgo(e.last_seen_at)}.</p>
                      </>
                    )}
                    {e.kind === 'natural' && (
                      <>
                        <p className="font-semibold text-amber-400">{e.category} · {e.title}</p>
                        <p className="text-sm text-slate-400">
                          {e.distance_km} km from corridor · source {e.source_url ? <a href={e.source_url} target="_blank" rel="noopener noreferrer" className="underline hover:text-slate-200">{e.source}</a> : e.source} · last observed {fmtMinutesAgo(e.last_observed_at)}
                        </p>
                      </>
                    )}
                  </div>
                </li>
              ))}
            </ul>
          )}
        </section>

        {/* Per-port snapshot */}
        <section className="mb-10">
          <h2 className="text-xl font-bold mb-3">Per-port snapshot</h2>
          <div className="overflow-x-auto rounded-2xl border border-slate-800">
            <table className="w-full text-sm">
              <thead className="bg-slate-900/60 text-xs uppercase tracking-wider text-slate-500">
                <tr>
                  <th className="text-left px-4 py-3">Bridge</th>
                  <th className="text-right px-4 py-3">Now</th>
                  <th className="text-right px-4 py-3">Typical</th>
                  <th className="text-right px-4 py-3">Ratio</th>
                  <th className="text-right px-4 py-3">Seen</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-800">
                {data.snapshots.map((s) => {
                  const ratio = s.current_wait != null && s.baseline_avg != null && s.baseline_avg > 0
                    ? s.current_wait / s.baseline_avg
                    : null
                  return (
                    <tr key={s.port_id} className={s.is_closed ? 'opacity-60' : ''}>
                      <td className="px-4 py-3 font-medium">{s.port_name}<span className="text-xs text-slate-500 ml-2">{s.port_id}</span></td>
                      <td className="px-4 py-3 text-right tabular-nums">{s.current_wait != null ? `${s.current_wait} min` : <span className="text-rose-500 text-xs">offline</span>}</td>
                      <td className="px-4 py-3 text-right tabular-nums text-slate-400">{s.baseline_avg != null ? `${s.baseline_avg} min` : '—'}</td>
                      <td className={`px-4 py-3 text-right tabular-nums ${s.is_anomaly_high ? 'text-rose-400 font-semibold' : 'text-slate-500'}`}>
                        {ratio != null ? `${ratio.toFixed(1)}×` : '—'}
                      </td>
                      <td className="px-4 py-3 text-right text-slate-500 text-xs">{fmtMinutesAgo(s.recorded_at)}</td>
                    </tr>
                  )
                })}
              </tbody>
            </table>
          </div>
        </section>

        {/* Regime-2 disclosure */}
        <section className="rounded-2xl border border-slate-800 bg-slate-900/40 p-5">
          <p className="text-xs uppercase tracking-widest text-slate-500 mb-2">What we don&rsquo;t measure yet</p>
          <p className="text-sm text-slate-400 leading-relaxed mb-2">
            BTI is computed from inputs we already collect. The following signals are pending and will lift confidence when wired:
          </p>
          <ul className="text-sm text-slate-400 list-disc pl-5 space-y-1">
            {data.regime_2_pending.map((p, i) => (
              <li key={i}>{p}</li>
            ))}
          </ul>
          <p className="text-xs text-slate-500 mt-3 leading-relaxed">
            Substrate transparency over surface polish — see <Link href="/insights/accuracy" className="underline hover:text-slate-300">/insights/accuracy</Link> for the live calibration record on individual bridge predictions.
          </p>
        </section>
      </div>
    </main>
  )
}

function ComponentBar({ label, sub, score, cap }: { label: string; sub: string; score: number; cap: number }) {
  const pct = cap === 0 ? 0 : Math.min(100, (score / cap) * 100)
  return (
    <div>
      <div className="flex items-baseline justify-between gap-3 mb-1">
        <span className="text-sm font-semibold text-slate-200">{label}</span>
        <span className="text-xs tabular-nums text-slate-500">{score}/{cap}</span>
      </div>
      <div className="h-1.5 bg-slate-800 rounded-full overflow-hidden">
        <div className="h-full bg-slate-300" style={{ width: `${pct}%` }} />
      </div>
      <p className="text-[11px] text-slate-500 mt-1">{sub}</p>
    </div>
  )
}

function EventIcon({ kind }: { kind: 'anomaly' | 'closure' | 'natural' }) {
  if (kind === 'anomaly') return <span className="text-2xl flex-shrink-0">📈</span>
  if (kind === 'closure') return <span className="text-2xl flex-shrink-0">⛔</span>
  return <span className="text-2xl flex-shrink-0">🌪️</span>
}
