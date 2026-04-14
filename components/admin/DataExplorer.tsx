'use client'

import { useEffect, useState } from 'react'
import { RefreshCw, Download } from 'lucide-react'
import { getPortMeta } from '@/lib/portMeta'

// Admin data explorer — renders every slice of the sensor-network
// dataset in cards, so Diego can SEE the moat. Diego's 2026-04-14
// directive: "with all the data collection we are doing, can we add
// something for me to see it in the admin panel?"
//
// Consumes /api/admin/data-explorer which aggregates:
//   - user distribution (tier, home region)
//   - port affinity by tier (saved / alerts / reports)
//   - sensor-network capture stats + field fill rates
//   - CBP null rate per port
//   - daily activity charts
//   - app_events rollup
//
// No charts library — keeps dependencies light and renders as simple
// sparkline bars. Every table has CSV export for pitching investors later.

interface PortTierRow {
  portId: string
  counts: Record<string, number>
  total: number
}

interface DataExplorerResponse {
  generatedAt: string
  users: {
    total: number
    byTier: Record<string, number>
    byHomeRegion: Record<string, number>
  }
  portAffinity: {
    savedByTier: PortTierRow[]
    alertsByTier: PortTierRow[]
    reportsByTier: PortTierRow[]
  }
  capture: {
    reportsTotal: number
    reports30Days: number
    reports7Days: number
    reportsToday: number
    reportsByLaneType: Record<string, number>
    xRayObservations: Record<string, number>
    reportsByIncidentFlag: Record<string, number>
    reportsBySource: Record<string, number>
    reportsByLocationConfidence: Record<string, number>
    sensorFieldsFilled: {
      sampleSize: number
      idleTimeMinutesPct: number
      flowRateEstimatePct: number
      firstStopToBoothMinutesPct: number
      laneTypePct: number
      xRayPct: number
      incidentFlagPct: number
    }
    topPortsLast7Days: Array<{ portId: string; count: number }>
  }
  cbp: {
    readingsTotal: number
    readings7Days: number
    nullRatePerPort: Array<{ portId: string; total: number; nulls: number; nullPct: number }>
  }
  activity: {
    dailySignups30: Array<{ day: string; count: number }>
    dailyReports30: Array<{ day: string; count: number }>
    dailyInstalls30: Array<{ day: string; count: number }>
    topReporters: Array<{ id: string; display_name: string | null; tier: string; points: number; reports_count: number }>
    pwaInstallsTotal: number
  }
  events: {
    byName7d: Array<{ name: string; count: number }>
    recent: Array<{ event_name: string; created_at: string; user_id: string | null; port_id: string | null; context: unknown }>
  }
}

const TIER_ORDER = ['guest', 'free', 'pro', 'business', 'admin']

function portLabel(portId: string): string {
  const meta = getPortMeta(portId)
  return meta.localName ? `${meta.city} · ${meta.localName}` : meta.city || portId
}

function downloadCsv(filename: string, rows: Array<Record<string, unknown>>) {
  if (rows.length === 0) return
  const headers = Object.keys(rows[0])
  const escape = (v: unknown) => {
    if (v == null) return ''
    const s = typeof v === 'object' ? JSON.stringify(v) : String(v)
    if (/[,"\n]/.test(s)) return `"${s.replace(/"/g, '""')}"`
    return s
  }
  const csv = [headers.join(','), ...rows.map((r) => headers.map((h) => escape(r[h])).join(','))].join('\n')
  const blob = new Blob([csv], { type: 'text/csv;charset=utf-8' })
  const url = URL.createObjectURL(blob)
  const a = document.createElement('a')
  a.href = url
  a.download = filename
  a.click()
  URL.revokeObjectURL(url)
}

export function DataExplorer() {
  const [data, setData] = useState<DataExplorerResponse | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  const load = () => {
    setLoading(true)
    setError(null)
    fetch('/api/admin/data-explorer')
      .then((r) => r.json())
      .then((d) => {
        if (d.error) throw new Error(d.error)
        setData(d)
      })
      .catch((e) => setError(e instanceof Error ? e.message : String(e)))
      .finally(() => setLoading(false))
  }

  useEffect(() => { load() }, [])

  if (loading && !data) {
    return <p className="text-sm text-gray-500">Loading moat…</p>
  }
  if (error) {
    return (
      <div className="bg-red-50 border border-red-200 rounded-xl p-4 text-sm text-red-700">
        <p className="font-bold mb-1">Failed to load data explorer</p>
        <p>{error}</p>
        <button onClick={load} className="mt-2 px-3 py-1 bg-red-600 text-white rounded-lg text-xs">Retry</button>
      </div>
    )
  }
  if (!data) return null

  const generatedAgo = Math.round((Date.now() - new Date(data.generatedAt).getTime()) / 1000)

  return (
    <div className="space-y-4">
      {/* Header / refresh */}
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-lg font-black text-gray-900">📊 The Moat</h2>
          <p className="text-xs text-gray-500">
            Generated {generatedAgo}s ago · {data.users.total} users · {data.capture.reportsTotal.toLocaleString()} reports · {data.cbp.readingsTotal.toLocaleString()} CBP readings
          </p>
        </div>
        <button
          onClick={load}
          disabled={loading}
          className="flex items-center gap-1 text-xs font-bold text-gray-700 bg-white border border-gray-300 rounded-lg px-3 py-2 hover:border-gray-500 disabled:opacity-50"
        >
          <RefreshCw className={`w-3 h-3 ${loading ? 'animate-spin' : ''}`} />
          Refresh
        </button>
      </div>

      {/* ─── Section 1: Users ─── */}
      <Card title="👥 Users" exportData={[data.users]} exportName="users.csv">
        <div className="grid grid-cols-2 sm:grid-cols-5 gap-2 mb-3">
          <Stat label="Total" value={data.users.total} big />
          {TIER_ORDER.map((t) => (
            <Stat key={t} label={t} value={data.users.byTier[t] || 0} />
          ))}
        </div>
        <div>
          <p className="text-[10px] font-black uppercase tracking-widest text-gray-500 mb-1">By Home Region</p>
          <div className="flex flex-wrap gap-1.5">
            {Object.entries(data.users.byHomeRegion)
              .sort((a, b) => b[1] - a[1])
              .map(([region, count]) => (
                <span key={region} className="text-[11px] font-bold bg-gray-100 text-gray-800 rounded-full px-2.5 py-1">
                  {region}: <span className="text-blue-700">{count}</span>
                </span>
              ))}
          </div>
        </div>
      </Card>

      {/* ─── Section 2: Port Affinity ─── */}
      <Card
        title="🌉 Most Popular Ports by Tier"
        subtitle="Where each tier actually engages with the product"
        exportData={[
          ...data.portAffinity.savedByTier.map((p) => ({ metric: 'saved', portId: p.portId, ...p.counts, total: p.total })),
          ...data.portAffinity.reportsByTier.map((p) => ({ metric: 'reports_30d', portId: p.portId, ...p.counts, total: p.total })),
          ...data.portAffinity.alertsByTier.map((p) => ({ metric: 'alerts', portId: p.portId, ...p.counts, total: p.total })),
        ]}
        exportName="port-affinity.csv"
      >
        <div className="grid gap-3 md:grid-cols-3">
          <PortTierTable title="By saved crossings" rows={data.portAffinity.savedByTier} />
          <PortTierTable title="Reports (30d)" rows={data.portAffinity.reportsByTier} />
          <PortTierTable title="Active alerts" rows={data.portAffinity.alertsByTier} />
        </div>
      </Card>

      {/* ─── Section 3: Capture (sensor-network moat) ─── */}
      <Card title="🧬 Sensor-Network Capture" subtitle="The real moat — what nobody else can replicate">
        <div className="grid grid-cols-4 gap-2 mb-4">
          <Stat label="All time" value={data.capture.reportsTotal} big />
          <Stat label="Last 30d" value={data.capture.reports30Days} />
          <Stat label="Last 7d" value={data.capture.reports7Days} />
          <Stat label="Today" value={data.capture.reportsToday} />
        </div>

        <div className="grid md:grid-cols-2 gap-4">
          <BucketTable title="Lane type" data={data.capture.reportsByLaneType} />
          <BucketTable title="X-ray active" data={data.capture.xRayObservations} />
          <BucketTable title="Incident flag" data={data.capture.reportsByIncidentFlag} />
          <BucketTable title="Source" data={data.capture.reportsBySource} />
          <BucketTable title="Location confidence" data={data.capture.reportsByLocationConfidence} />
          <div>
            <p className="text-[10px] font-black uppercase tracking-widest text-gray-500 mb-2">Sensor field fill rate</p>
            <p className="text-[10px] text-gray-400 mb-1">n = {data.capture.sensorFieldsFilled.sampleSize}</p>
            <div className="space-y-1.5">
              <FillBar label="lane_type"        pct={data.capture.sensorFieldsFilled.laneTypePct} />
              <FillBar label="x_ray_active"     pct={data.capture.sensorFieldsFilled.xRayPct} />
              <FillBar label="incident_flag"    pct={data.capture.sensorFieldsFilled.incidentFlagPct} />
              <FillBar label="idle_time"        pct={data.capture.sensorFieldsFilled.idleTimeMinutesPct} />
              <FillBar label="flow_rate"        pct={data.capture.sensorFieldsFilled.flowRateEstimatePct} />
              <FillBar label="first_stop_booth" pct={data.capture.sensorFieldsFilled.firstStopToBoothMinutesPct} />
            </div>
          </div>
        </div>

        <div className="mt-4">
          <p className="text-[10px] font-black uppercase tracking-widest text-gray-500 mb-2">Top ports last 7 days</p>
          <div className="grid grid-cols-2 md:grid-cols-3 gap-1.5">
            {data.capture.topPortsLast7Days.map(({ portId, count }) => (
              <div key={portId} className="flex items-center justify-between bg-gray-50 rounded-lg px-2.5 py-1.5">
                <span className="text-[11px] font-medium text-gray-800 truncate">{portLabel(portId)}</span>
                <span className="text-xs font-black text-blue-700 tabular-nums ml-2 flex-shrink-0">{count}</span>
              </div>
            ))}
          </div>
        </div>
      </Card>

      {/* ─── Section 4: CBP capture ─── */}
      <Card title="📡 CBP Capture Health" subtitle="Where CBP's public feed is unreliable">
        <div className="grid grid-cols-2 gap-2 mb-3">
          <Stat label="All-time rows" value={data.cbp.readingsTotal} big />
          <Stat label="Rows last 7d" value={data.cbp.readings7Days} />
        </div>
        <p className="text-[10px] font-black uppercase tracking-widest text-gray-500 mb-1">Ports with highest CBP null rate (last 7d)</p>
        <div className="space-y-1">
          {data.cbp.nullRatePerPort.slice(0, 12).map(({ portId, total, nullPct }) => (
            <div key={portId} className="flex items-center gap-2">
              <span className="text-[11px] text-gray-700 flex-1 truncate">{portLabel(portId)}</span>
              <span className="text-[10px] text-gray-400 tabular-nums">{total}</span>
              <div className="w-20 h-1.5 bg-gray-100 rounded-full overflow-hidden">
                <div
                  className={`h-full ${nullPct >= 50 ? 'bg-red-500' : nullPct >= 25 ? 'bg-amber-500' : 'bg-green-500'}`}
                  style={{ width: `${Math.min(100, nullPct)}%` }}
                />
              </div>
              <span className="text-[11px] font-bold text-gray-800 tabular-nums w-9 text-right">{nullPct}%</span>
            </div>
          ))}
        </div>
      </Card>

      {/* ─── Section 5: Activity ─── */}
      <Card title="📈 Activity (last 30 days)">
        <div className="grid grid-cols-3 gap-2 mb-3">
          <Stat label="Signups 30d" value={data.activity.dailySignups30.reduce((s, d) => s + d.count, 0)} />
          <Stat label="Reports 30d" value={data.activity.dailyReports30.reduce((s, d) => s + d.count, 0)} />
          <Stat label="PWA installs" value={data.activity.pwaInstallsTotal} />
        </div>

        <div className="space-y-3">
          <Sparkline title="Signups per day" series={data.activity.dailySignups30} />
          <Sparkline title="Reports per day" series={data.activity.dailyReports30} />
          <Sparkline title="PWA installs per day" series={data.activity.dailyInstalls30} />
        </div>

        <div className="mt-4">
          <p className="text-[10px] font-black uppercase tracking-widest text-gray-500 mb-2">Top reporters</p>
          <div className="space-y-1">
            {data.activity.topReporters.map((r) => (
              <div key={r.id} className="flex items-center justify-between bg-gray-50 rounded-lg px-3 py-1.5">
                <span className="text-[11px] font-medium text-gray-800 truncate">
                  {r.display_name || r.id.slice(0, 6)}
                  <span className="ml-2 text-[9px] font-bold uppercase text-gray-400">{r.tier}</span>
                </span>
                <span className="text-[11px] font-black text-gray-900 tabular-nums flex-shrink-0">
                  {r.reports_count} reports · {r.points}pt
                </span>
              </div>
            ))}
          </div>
        </div>
      </Card>

      {/* ─── Section 6: Events ─── */}
      <Card
        title="🔔 App Events (last 7 days)"
        exportData={data.events.byName7d}
        exportName="events.csv"
      >
        <div className="grid grid-cols-2 md:grid-cols-3 gap-1.5">
          {data.events.byName7d.slice(0, 30).map(({ name, count }) => (
            <div key={name} className="flex items-center justify-between bg-gray-50 rounded-lg px-2.5 py-1.5">
              <span className="text-[11px] font-mono text-gray-700 truncate">{name}</span>
              <span className="text-xs font-black text-indigo-700 tabular-nums ml-2 flex-shrink-0">{count}</span>
            </div>
          ))}
        </div>
      </Card>
    </div>
  )
}

// ──────────────────────────────────────────────────────────
// Sub-components
// ──────────────────────────────────────────────────────────

function Card({
  title,
  subtitle,
  children,
  exportData,
  exportName,
}: {
  title: string
  subtitle?: string
  children: React.ReactNode
  exportData?: Array<Record<string, unknown>>
  exportName?: string
}) {
  return (
    <div className="bg-white border border-gray-200 rounded-2xl p-4 shadow-sm">
      <div className="flex items-start justify-between mb-3 gap-2">
        <div className="min-w-0">
          <h3 className="text-sm font-black text-gray-900">{title}</h3>
          {subtitle && <p className="text-[11px] text-gray-500 mt-0.5">{subtitle}</p>}
        </div>
        {exportData && exportName && exportData.length > 0 && (
          <button
            onClick={() => downloadCsv(exportName, exportData)}
            className="flex-shrink-0 flex items-center gap-1 text-[10px] font-bold text-gray-500 hover:text-gray-900 border border-gray-200 rounded-lg px-2 py-1"
          >
            <Download className="w-3 h-3" /> CSV
          </button>
        )}
      </div>
      {children}
    </div>
  )
}

function Stat({ label, value, big }: { label: string; value: number; big?: boolean }) {
  return (
    <div className={`bg-gray-50 rounded-xl px-3 py-2 ${big ? 'ring-2 ring-blue-200' : ''}`}>
      <p className="text-[9px] font-black uppercase tracking-widest text-gray-500">{label}</p>
      <p className={`font-black tabular-nums text-gray-900 mt-0.5 ${big ? 'text-2xl' : 'text-lg'}`}>
        {value.toLocaleString()}
      </p>
    </div>
  )
}

function PortTierTable({ title, rows }: { title: string; rows: PortTierRow[] }) {
  return (
    <div>
      <p className="text-[10px] font-black uppercase tracking-widest text-gray-500 mb-2">{title}</p>
      <div className="space-y-1">
        {rows.slice(0, 10).map((r) => (
          <div key={r.portId} className="bg-gray-50 rounded-lg px-2.5 py-1.5">
            <div className="flex items-center justify-between">
              <span className="text-[11px] font-medium text-gray-800 truncate">{portLabel(r.portId)}</span>
              <span className="text-xs font-black text-gray-900 tabular-nums ml-2">{r.total}</span>
            </div>
            <div className="flex gap-1 mt-0.5 flex-wrap">
              {TIER_ORDER.map((t) => {
                const v = r.counts[t] || 0
                if (v === 0) return null
                return (
                  <span key={t} className="text-[9px] font-bold bg-white border border-gray-200 rounded-full px-1.5 py-0.5 text-gray-700">
                    {t}:{v}
                  </span>
                )
              })}
            </div>
          </div>
        ))}
      </div>
    </div>
  )
}

function BucketTable({ title, data }: { title: string; data: Record<string, number> }) {
  const entries = Object.entries(data).sort((a, b) => b[1] - a[1])
  const max = Math.max(...entries.map(([, v]) => v), 1)
  return (
    <div>
      <p className="text-[10px] font-black uppercase tracking-widest text-gray-500 mb-1.5">{title}</p>
      <div className="space-y-1">
        {entries.map(([k, v]) => (
          <div key={k} className="flex items-center gap-2">
            <span className="text-[11px] font-medium text-gray-700 w-32 truncate">{k}</span>
            <div className="flex-1 h-1.5 bg-gray-100 rounded-full overflow-hidden">
              <div className="h-full bg-indigo-500" style={{ width: `${(v / max) * 100}%` }} />
            </div>
            <span className="text-[11px] font-bold text-gray-900 tabular-nums w-12 text-right">{v}</span>
          </div>
        ))}
      </div>
    </div>
  )
}

function FillBar({ label, pct }: { label: string; pct: number }) {
  return (
    <div className="flex items-center gap-2">
      <span className="text-[10px] font-mono text-gray-700 w-28 truncate">{label}</span>
      <div className="flex-1 h-1.5 bg-gray-100 rounded-full overflow-hidden">
        <div
          className={`h-full ${pct >= 60 ? 'bg-green-500' : pct >= 25 ? 'bg-amber-500' : 'bg-red-500'}`}
          style={{ width: `${Math.min(100, pct)}%` }}
        />
      </div>
      <span className="text-[10px] font-black text-gray-900 tabular-nums w-9 text-right">{pct}%</span>
    </div>
  )
}

function Sparkline({ title, series }: { title: string; series: Array<{ day: string; count: number }> }) {
  const max = Math.max(...series.map((s) => s.count), 1)
  const total = series.reduce((s, d) => s + d.count, 0)
  return (
    <div>
      <div className="flex items-center justify-between mb-1">
        <p className="text-[10px] font-black uppercase tracking-widest text-gray-500">{title}</p>
        <p className="text-[10px] text-gray-400">total {total}</p>
      </div>
      <div className="flex items-end gap-[2px] h-10">
        {series.map((d) => {
          const h = Math.max(2, (d.count / max) * 100)
          return (
            <div
              key={d.day}
              title={`${d.day}: ${d.count}`}
              className="flex-1 bg-indigo-500 rounded-sm"
              style={{ height: `${h}%` }}
            />
          )
        })}
      </div>
    </div>
  )
}
