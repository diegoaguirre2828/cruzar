'use client'

import { useState, useEffect } from 'react'
import { useAuth } from '@/lib/useAuth'
import { useRouter } from 'next/navigation'
import Link from 'next/link'
import { Loader2, RefreshCw } from 'lucide-react'

const ADMIN_EMAIL = 'cruzabusiness@gmail.com'

type AccuracyRow = {
  project: string
  sim_kind: string
  sim_version: string
  resolved_count: number | null
  pending_count: number | null
  mean_loss: number | null
  median_loss: number | null
}

type LogRow = {
  id: number
  project: string
  sim_kind: string
  sim_version: string
  predicted: Record<string, unknown>
  observed: Record<string, unknown> | null
  observed_at: string | null
  loss: number | null
  tags: string[]
  created_at: string
}

type ApiResponse = {
  project: string
  accuracy_30d: AccuracyRow[]
  recent: LogRow[]
  counts: { total: number; pending: number; resolved: number }
}

// Admin-only calibration dashboard. Reads calibration_log + the rolling
// 30-day accuracy view. Pending vs resolved counts let Diego see how much
// of the prediction stream has been ground-truthed.
//
// v0 = read-only. Future: add observed-value entry form so Diego can mark
// predictions resolved with the actual outcome → loss gets computed → moat
// compounds.

export default function CalibrationPage() {
  const { user, loading } = useAuth()
  const router = useRouter()

  const [data, setData] = useState<ApiResponse | null>(null)
  const [loadingData, setLoadingData] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [simKindFilter, setSimKindFilter] = useState<string>('')

  useEffect(() => {
    if (!loading && (!user || user.email !== ADMIN_EMAIL)) router.push('/')
  }, [user, loading, router])

  async function load() {
    if (!user || user.email !== ADMIN_EMAIL) return
    setLoadingData(true)
    setError(null)
    try {
      const params = new URLSearchParams({ project: 'cruzar', limit: '50' })
      if (simKindFilter) params.set('sim_kind', simKindFilter)
      const res = await fetch(`/api/admin/calibration?${params.toString()}`)
      const json = await res.json()
      if (!res.ok) {
        setError(json.error || `HTTP ${res.status}`)
        return
      }
      setData(json as ApiResponse)
    } catch (e) {
      setError(e instanceof Error ? e.message : 'request failed')
    } finally {
      setLoadingData(false)
    }
  }

  useEffect(() => {
    if (user?.email === ADMIN_EMAIL) load()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [user, simKindFilter])

  if (loading || !user || user.email !== ADMIN_EMAIL) {
    return (
      <main className="min-h-screen bg-[#0a1020] text-slate-100 flex items-center justify-center">
        <Loader2 className="animate-spin" size={20} />
      </main>
    )
  }

  const simKinds = Array.from(new Set((data?.recent ?? []).map((r) => r.sim_kind)))

  return (
    <main className="min-h-screen bg-[#0a1020] text-slate-100">
      <div className="mx-auto max-w-5xl px-4 py-6 sm:px-6">
        <div className="mb-5 flex items-baseline justify-between">
          <div>
            <h1 className="font-serif text-2xl font-medium text-white">
              Calibration{' '}
              <span className="text-white/40 text-sm font-normal">predicted vs observed</span>
            </h1>
            <p className="mt-1 text-xs text-white/55">
              Cross-portfolio prediction log · resolved counts grow as observations land · 30-day rolling accuracy
            </p>
          </div>
          <div className="flex items-center gap-3">
            <Link href="/admin" className="text-xs text-white/45 hover:text-amber-300">
              ← Admin
            </Link>
            <button
              onClick={load}
              disabled={loadingData}
              className="text-xs text-white/55 hover:text-white border border-white/10 hover:border-white/30 rounded-lg px-2.5 py-1 flex items-center gap-1.5"
            >
              {loadingData ? <Loader2 size={12} className="animate-spin" /> : <RefreshCw size={12} />}
              refresh
            </button>
          </div>
        </div>

        {error && (
          <div className="mb-4 rounded-xl border border-rose-400/30 bg-rose-950/30 px-3 py-2 text-xs text-rose-200">
            ✗ {error}
          </div>
        )}

        {data && (
          <>
            {/* Counts strip */}
            <div className="grid grid-cols-3 gap-3 mb-5">
              <Counter label="Total predictions" value={data.counts.total} />
              <Counter label="Pending observation" value={data.counts.pending} accent="amber" />
              <Counter label="Resolved (loss known)" value={data.counts.resolved} accent="emerald" />
            </div>

            {/* Accuracy 30-day rolling view */}
            <div className="mb-6 rounded-2xl border border-white/[0.08] bg-white/[0.02]">
              <div className="border-b border-white/[0.06] px-5 py-3 text-[10px] uppercase tracking-[0.2em] text-white/55">
                Accuracy · last 30 days
              </div>
              {data.accuracy_30d.length === 0 ? (
                <div className="px-5 py-6 text-sm text-white/45">
                  No accuracy rows yet — observations need to land for loss to be computable.
                </div>
              ) : (
                <table className="w-full text-sm">
                  <thead className="text-[10px] uppercase tracking-[0.18em] text-white/40">
                    <tr>
                      <th className="px-5 py-2 text-left">Sim kind</th>
                      <th className="px-5 py-2 text-left">Version</th>
                      <th className="px-5 py-2 text-right">Resolved</th>
                      <th className="px-5 py-2 text-right">Pending</th>
                      <th className="px-5 py-2 text-right">Mean loss</th>
                      <th className="px-5 py-2 text-right">Median loss</th>
                    </tr>
                  </thead>
                  <tbody>
                    {data.accuracy_30d.map((r, i) => (
                      <tr key={i} className="border-t border-white/[0.04]">
                        <td className="px-5 py-2.5 font-mono">{r.sim_kind}</td>
                        <td className="px-5 py-2.5 font-mono text-white/55">{r.sim_version}</td>
                        <td className="px-5 py-2.5 text-right tabular-nums text-emerald-400">
                          {r.resolved_count ?? 0}
                        </td>
                        <td className="px-5 py-2.5 text-right tabular-nums text-amber-300">
                          {r.pending_count ?? 0}
                        </td>
                        <td className="px-5 py-2.5 text-right tabular-nums">
                          {r.mean_loss != null ? r.mean_loss.toFixed(2) : '—'}
                        </td>
                        <td className="px-5 py-2.5 text-right tabular-nums">
                          {r.median_loss != null ? r.median_loss.toFixed(2) : '—'}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              )}
            </div>

            {/* Sim kind filter */}
            {simKinds.length > 1 && (
              <div className="mb-3 flex items-center gap-2 text-xs">
                <span className="text-white/45">Filter:</span>
                <button
                  onClick={() => setSimKindFilter('')}
                  className={`rounded-lg px-2.5 py-1 font-mono ${
                    simKindFilter === '' ? 'bg-amber-400 text-[#0a1020]' : 'bg-white/[0.04] text-white/55'
                  }`}
                >
                  all
                </button>
                {simKinds.map((k) => (
                  <button
                    key={k}
                    onClick={() => setSimKindFilter(k)}
                    className={`rounded-lg px-2.5 py-1 font-mono ${
                      simKindFilter === k ? 'bg-amber-400 text-[#0a1020]' : 'bg-white/[0.04] text-white/55'
                    }`}
                  >
                    {k}
                  </button>
                ))}
              </div>
            )}

            {/* Recent predictions */}
            <div className="rounded-2xl border border-white/[0.08] bg-white/[0.02]">
              <div className="border-b border-white/[0.06] px-5 py-3 text-[10px] uppercase tracking-[0.2em] text-white/55">
                Recent predictions ({data.recent.length})
              </div>
              {data.recent.length === 0 ? (
                <div className="px-5 py-6 text-sm text-white/45">
                  No predictions yet. Run /admin/scenario-sim to generate the first one.
                </div>
              ) : (
                <ul className="divide-y divide-white/[0.04]">
                  {data.recent.map((r) => (
                    <RowItem key={r.id} row={r} />
                  ))}
                </ul>
              )}
            </div>
          </>
        )}
      </div>
    </main>
  )
}

function Counter({
  label,
  value,
  accent,
}: {
  label: string
  value: number
  accent?: 'amber' | 'emerald'
}) {
  const color =
    accent === 'amber' ? 'text-amber-300' : accent === 'emerald' ? 'text-emerald-400' : 'text-white'
  return (
    <div className="rounded-2xl border border-white/[0.08] bg-white/[0.02] px-5 py-4">
      <div className="text-[10px] uppercase tracking-[0.2em] text-white/45 mb-1.5">{label}</div>
      <div className={`text-3xl font-semibold tabular-nums ${color}`}>{value.toLocaleString()}</div>
    </div>
  )
}

function RowItem({ row }: { row: LogRow }) {
  const [expanded, setExpanded] = useState(false)
  const created = new Date(row.created_at)
  const resolved = row.observed != null
  return (
    <li
      className="px-5 py-3.5 hover:bg-white/[0.02] cursor-pointer"
      onClick={() => setExpanded((e) => !e)}
    >
      <div className="flex items-baseline justify-between gap-3">
        <div className="flex items-baseline gap-3 min-w-0">
          <span
            className={`inline-block w-1.5 h-1.5 rounded-full flex-shrink-0 mt-1 ${
              resolved ? 'bg-emerald-400' : 'bg-amber-300'
            }`}
          />
          <span className="font-mono text-xs text-white/40 tabular-nums">
            {created.toISOString().slice(0, 16).replace('T', ' ')}
          </span>
          <span className="font-mono text-xs text-white/55">{row.sim_kind}</span>
          <span className="font-mono text-[10px] text-white/35">{row.sim_version}</span>
        </div>
        <div className="text-xs text-white/40 flex-shrink-0">
          {resolved ? `loss=${row.loss?.toFixed(2) ?? '?'}` : 'pending'}
        </div>
      </div>
      <div className="mt-1 ml-[18px] flex flex-wrap gap-1.5">
        {row.tags.slice(0, 6).map((t) => (
          <span
            key={t}
            className="font-mono text-[10px] text-white/45 bg-white/[0.04] rounded px-1.5 py-0.5"
          >
            {t}
          </span>
        ))}
      </div>
      {expanded && (
        <div className="mt-3 ml-[18px] grid grid-cols-1 sm:grid-cols-2 gap-3">
          <div>
            <div className="text-[10px] uppercase tracking-[0.18em] text-white/40 mb-1">
              Predicted
            </div>
            <pre className="font-mono text-[10px] text-white/70 bg-[#040814] border border-white/[0.06] rounded-lg p-2 overflow-x-auto">
              {JSON.stringify(row.predicted, null, 2)}
            </pre>
          </div>
          <div>
            <div className="text-[10px] uppercase tracking-[0.18em] text-white/40 mb-1">
              Observed
            </div>
            <pre className="font-mono text-[10px] text-white/70 bg-[#040814] border border-white/[0.06] rounded-lg p-2 overflow-x-auto">
              {row.observed ? JSON.stringify(row.observed, null, 2) : '—'}
            </pre>
          </div>
        </div>
      )}
    </li>
  )
}
