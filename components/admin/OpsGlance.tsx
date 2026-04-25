'use client'

import { useEffect, useState } from 'react'
import { RefreshCw } from 'lucide-react'

// Admin ops-at-a-glance tile — the "super detailed, all info possible,
// organized and readable" tile Diego asked for. Renders a single
// compact grid of live-ish counters across every system he cares
// about, so a login sweep tells him what's healthy / broken in one
// glance.
//
// Data source: /api/admin/ops-glance (one aggregated endpoint that
// issues ~20 parallel count() queries). Client-side refresh every
// 5 min by default (was 60s — see PERF audit 2026-04-25), manual
// button too.

interface OpsData {
  users: { total: number; pro: number; business: number; new24h: number; new7d: number }
  reports: { count24h: number; count7d: number; hidden24h: number }
  waitReadings: {
    lastReadingAt: string | null
    count15m: number
    count24h: number
    portsFresh72h: number
    pctPortsFresh: number
  }
  socialPosts: {
    page24h: number
    group24h: number
    lastPagePostAt: string | null
    lastGroupPostAt: string | null
  }
  circles: { total: number; memberships: number; invitesOpen: number; invitesAccepted: number }
  alerts: { activePrefs: number; firedToday: number }
  moderation: { usersCurrentlyBanned: number }
  infra: { pwaInstalls: number; generatedAt: string }
}

function timeAgo(iso: string | null): string {
  if (!iso) return 'never'
  const mins = Math.round((Date.now() - new Date(iso).getTime()) / 60000)
  if (mins < 1) return 'just now'
  if (mins < 60) return `${mins}m ago`
  if (mins < 60 * 48) return `${Math.round(mins / 60)}h ago`
  return `${Math.round(mins / 60 / 24)}d ago`
}

function statusDot(ok: boolean): string {
  return ok ? 'bg-emerald-500' : 'bg-red-500'
}

export function OpsGlance() {
  const [data, setData] = useState<OpsData | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [refreshedAt, setRefreshedAt] = useState<Date | null>(null)

  async function load() {
    setLoading(true)
    try {
      const res = await fetch('/api/admin/ops-glance', { cache: 'no-store' })
      if (!res.ok) {
        setError(`HTTP ${res.status}`)
        setData(null)
        return
      }
      const j = await res.json()
      setData(j)
      setError(null)
      setRefreshedAt(new Date())
    } catch (e) {
      setError(e instanceof Error ? e.message : 'fetch failed')
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    load()
    // PERF (2026-04-25 audit): /api/admin/ops-glance fires ~24 COUNT
    // queries per call. Polling every 60s burns DB capacity for admin
    // numbers that almost never change minute-over-minute. 5 min is
    // plenty fresh for the dashboard.
    const id = setInterval(load, 5 * 60 * 1000)
    return () => clearInterval(id)
  }, [])

  if (error) {
    return (
      <div className="mb-5 bg-red-900/20 border border-red-800 text-red-200 rounded-xl px-4 py-3 text-sm">
        Ops glance failed: {error}
      </div>
    )
  }
  if (!data) {
    return <div className="mb-5 h-32 bg-gray-100 dark:bg-gray-800 rounded-xl animate-pulse" />
  }

  const readingHealthy = data.waitReadings.count15m > 0
  const pageHealthy = data.socialPosts.lastPagePostAt != null
    && Date.now() - new Date(data.socialPosts.lastPagePostAt).getTime() < 24 * 60 * 60 * 1000
  const groupHealthy = data.socialPosts.lastGroupPostAt != null
    && Date.now() - new Date(data.socialPosts.lastGroupPostAt).getTime() < 24 * 60 * 60 * 1000

  return (
    <div className="mb-5 bg-gray-900 text-white rounded-2xl p-4 border border-gray-800">
      <div className="flex items-center justify-between mb-3">
        <div>
          <p className="text-xs font-black uppercase tracking-widest text-gray-400">Ops at a glance</p>
          <p className="text-[10px] text-gray-500">
            {refreshedAt ? `Refreshed ${timeAgo(refreshedAt.toISOString())}` : '…'}
            {' · auto-refresh 5m'}
          </p>
        </div>
        <button
          onClick={load}
          disabled={loading}
          className="text-xs bg-white/10 hover:bg-white/20 px-2.5 py-1 rounded-lg flex items-center gap-1 transition-colors disabled:opacity-50"
          aria-label="Refresh"
        >
          <RefreshCw className={`w-3 h-3 ${loading ? 'animate-spin' : ''}`} />
          Refresh
        </button>
      </div>

      <div className="grid grid-cols-2 md:grid-cols-4 gap-2.5">
        {/* Users */}
        <Card title="Users" detail={`+${data.users.new24h} 24h · +${data.users.new7d} 7d`}>
          <Metric label="Total" value={data.users.total} />
          <Metric label="Pro" value={data.users.pro} />
          <Metric label="Biz" value={data.users.business} />
        </Card>

        {/* Reports */}
        <Card title="Reports" detail={`${data.reports.hidden24h} hidden 24h`}>
          <Metric label="24h" value={data.reports.count24h} />
          <Metric label="7d" value={data.reports.count7d} />
        </Card>

        {/* Wait readings (CBP cron health) */}
        <Card
          title="Wait readings"
          detail={`last ${timeAgo(data.waitReadings.lastReadingAt)}`}
          dot={statusDot(readingHealthy)}
        >
          <Metric label="15m" value={data.waitReadings.count15m} emphasize={!readingHealthy} />
          <Metric label="24h" value={data.waitReadings.count24h} />
          <Metric label="% fresh" value={`${data.waitReadings.pctPortsFresh}%`} />
        </Card>

        {/* Social posts (Make.com + fb-poster) */}
        <Card title="Social 24h" detail={`pg ${timeAgo(data.socialPosts.lastPagePostAt)} · grp ${timeAgo(data.socialPosts.lastGroupPostAt)}`}>
          <Metric label="Page" value={data.socialPosts.page24h} dot={statusDot(pageHealthy)} />
          <Metric label="Group" value={data.socialPosts.group24h} dot={statusDot(groupHealthy)} />
        </Card>

        {/* Circles */}
        <Card title="Circles" detail={`${data.circles.invitesOpen} invites open`}>
          <Metric label="Circles" value={data.circles.total} />
          <Metric label="Members" value={data.circles.memberships} />
          <Metric label="Accepted" value={data.circles.invitesAccepted} />
        </Card>

        {/* Alerts */}
        <Card title="Alerts" detail={`${data.alerts.firedToday} fired today`}>
          <Metric label="Active" value={data.alerts.activePrefs} />
          <Metric label="Fired" value={data.alerts.firedToday} />
        </Card>

        {/* Moderation */}
        <Card title="Moderation" detail={data.moderation.usersCurrentlyBanned > 0 ? `⚠️ ${data.moderation.usersCurrentlyBanned} banned` : 'clean'}>
          <Metric label="Banned" value={data.moderation.usersCurrentlyBanned} emphasize={data.moderation.usersCurrentlyBanned > 0} />
          <Metric label="Hidden24h" value={data.reports.hidden24h} />
        </Card>

        {/* Infra */}
        <Card title="Infra" detail={`${data.infra.pwaInstalls} PWA`}>
          <Metric label="PWA" value={data.infra.pwaInstalls} />
        </Card>
      </div>
    </div>
  )
}

function Card({
  title,
  detail,
  dot,
  children,
}: {
  title: string
  detail?: string
  dot?: string
  children: React.ReactNode
}) {
  return (
    <div className="bg-gray-800 rounded-xl p-3 border border-gray-700">
      <div className="flex items-center gap-1.5 mb-2">
        {dot && <span className={`w-2 h-2 rounded-full ${dot}`} />}
        <p className="text-[10px] font-black uppercase tracking-wider text-gray-400">{title}</p>
      </div>
      <div className="flex flex-wrap gap-x-3 gap-y-1">
        {children}
      </div>
      {detail && <p className="text-[9px] text-gray-500 mt-1.5 leading-tight">{detail}</p>}
    </div>
  )
}

function Metric({
  label,
  value,
  emphasize,
  dot,
}: {
  label: string
  value: number | string
  emphasize?: boolean
  dot?: string
}) {
  return (
    <div>
      <div className="flex items-center gap-1">
        {dot && <span className={`w-1.5 h-1.5 rounded-full ${dot}`} />}
        <p className={`text-xs tabular-nums font-black ${emphasize ? 'text-red-400' : 'text-white'}`}>{value}</p>
      </div>
      <p className="text-[9px] text-gray-500 uppercase tracking-wider">{label}</p>
    </div>
  )
}
