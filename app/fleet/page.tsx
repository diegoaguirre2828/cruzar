'use client'

import { useState, useEffect, useCallback } from 'react'
import { useRouter } from 'next/navigation'
import Link from 'next/link'
import { useAuth } from '@/lib/useAuth'
import { getWaitLevel, waitLevelDot, waitLevelColor } from '@/lib/cbp'
import { getPortMeta, ALL_REGIONS } from '@/lib/portMeta'
import { ArrowLeft, RefreshCw, TrendingUp, TrendingDown, Minus, Download, Users, AlertTriangle, CheckCircle } from 'lucide-react'
import type { PortWaitTime } from '@/types'

export default function FleetPage() {
  const { user, loading: authLoading } = useAuth()
  const router = useRouter()
  const [ports, setPorts] = useState<PortWaitTime[]>([])
  const [loading, setLoading] = useState(true)
  const [selectedRegions, setSelectedRegions] = useState<string[]>([])
  const [sortBy, setSortBy] = useState<'commercial' | 'wait' | 'name'>('commercial')
  const [cbpUpdatedAt, setCbpUpdatedAt] = useState<string | null>(null)
  const [tier, setTier] = useState<string>('free')
  const [exportLoading, setExportLoading] = useState(false)
  const [activeTab, setActiveTab] = useState<'overview' | 'alerts' | 'export'>('overview')

  const loadPorts = useCallback(async () => {
    const res = await fetch('/api/ports')
    if (res.ok) {
      const d = await res.json()
      setPorts(d.ports || [])
      setCbpUpdatedAt(d.cbpUpdatedAt ?? null)
    }
    setLoading(false)
  }, [])

  useEffect(() => {
    if (!authLoading && !user) router.push('/login')
    if (user) {
      loadPorts()
      fetch('/api/profile').then(r => r.json()).then(d => setTier(d.profile?.tier || 'free'))
    }
  }, [user, authLoading, router, loadPorts])

  useEffect(() => {
    if (!authLoading && user && tier && tier !== 'business') {
      router.push('/pricing')
    }
  }, [tier, user, authLoading, router])

  function toggleRegion(region: string) {
    setSelectedRegions(prev =>
      prev.includes(region) ? prev.filter(r => r !== region) : [...prev, region]
    )
  }

  const filtered = ports
    .filter(p => selectedRegions.length === 0 || selectedRegions.includes(getPortMeta(p.portId).region))
    .sort((a, b) => {
      if (sortBy === 'commercial') return (a.commercial ?? 999) - (b.commercial ?? 999)
      if (sortBy === 'wait') return (a.vehicle ?? 999) - (b.vehicle ?? 999)
      return a.portName.localeCompare(b.portName)
    })

  const withCommercial = filtered.filter(p => p.commercial !== null)
  const avgCommercial = withCommercial.length
    ? Math.round(withCommercial.reduce((a, b) => a + (b.commercial ?? 0), 0) / withCommercial.length)
    : null
  const clearCount = filtered.filter(p => (p.commercial ?? p.vehicle ?? 99) < 20).length
  const heavyCount = filtered.filter(p => (p.commercial ?? p.vehicle ?? 0) > 45).length
  const bestPort = filtered
    .filter(p => p.commercial !== null)
    .sort((a, b) => (a.commercial ?? 999) - (b.commercial ?? 999))[0]

  async function downloadCsv(days: number) {
    setExportLoading(true)
    const res = await fetch(`/api/export?days=${days}`)
    if (res.ok) {
      const blob = await res.blob()
      const url = URL.createObjectURL(blob)
      const a = document.createElement('a')
      a.href = url
      a.download = `cruza-all-crossings-${days}d.csv`
      a.click()
      URL.revokeObjectURL(url)
    }
    setExportLoading(false)
  }

  const cbpTime = cbpUpdatedAt
    ? new Date(cbpUpdatedAt).toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit', hour12: true })
    : null

  if (authLoading || loading) return (
    <div className="min-h-screen bg-gray-50 dark:bg-gray-950 flex items-center justify-center">
      <div className="w-8 h-8 border-2 border-gray-300 border-t-gray-900 rounded-full animate-spin" />
    </div>
  )

  return (
    <main className="min-h-screen bg-gray-50 dark:bg-gray-950">
      <div className="max-w-2xl mx-auto px-4 pb-10">
        {/* Header */}
        <div className="pt-6 pb-4 flex items-center justify-between">
          <div>
            <Link href="/dashboard" className="flex items-center gap-1 text-xs text-gray-400 hover:text-gray-700 mb-1">
              <ArrowLeft className="w-3 h-3" /> Dashboard
            </Link>
            <h1 className="text-xl font-bold text-gray-900 dark:text-gray-100">🚛 Fleet Command Center</h1>
            {cbpTime && <p className="text-xs text-gray-400">CBP data as of {cbpTime}</p>}
          </div>
          <div className="flex items-center gap-2">
            <Link href="/business" className="text-xs font-semibold text-white bg-gray-900 dark:bg-gray-100 dark:text-gray-900 px-3 py-2 rounded-xl hover:bg-gray-700 dark:hover:bg-gray-200 transition-colors">
              Business Portal →
            </Link>
            <button onClick={loadPorts} className="p-2 rounded-xl bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 text-gray-500 hover:bg-gray-50">
              <RefreshCw className="w-4 h-4" />
            </button>
          </div>
        </div>

        {/* Tabs */}
        <div className="flex bg-gray-100 dark:bg-gray-800 rounded-xl p-1 mb-5">
          {[
            { key: 'overview', label: '📊 Overview' },
            { key: 'alerts',   label: '⚠️ Watch List' },
            { key: 'export',   label: '📥 Export' },
          ].map(t => (
            <button
              key={t.key}
              onClick={() => setActiveTab(t.key as typeof activeTab)}
              className={`flex-1 py-2 text-xs font-medium rounded-lg transition-colors ${
                activeTab === t.key
                  ? 'bg-white dark:bg-gray-700 shadow text-gray-900 dark:text-gray-100'
                  : 'text-gray-500 dark:text-gray-400'
              }`}
            >
              {t.label}
            </button>
          ))}
        </div>

        {/* Overview tab */}
        {activeTab === 'overview' && (
          <div className="space-y-4">
            {/* Stats */}
            <div className="grid grid-cols-2 gap-3">
              <div className="bg-white dark:bg-gray-800 rounded-2xl border border-gray-200 dark:border-gray-700 p-4 shadow-sm">
                <p className="text-xs text-gray-400 mb-1">Avg truck wait</p>
                <p className="text-3xl font-bold text-gray-900 dark:text-gray-100">{avgCommercial ?? '—'}<span className="text-sm font-normal text-gray-400 ml-1">min</span></p>
              </div>
              <div className={`rounded-2xl border p-4 shadow-sm ${bestPort ? 'bg-green-50 dark:bg-green-900/20 border-green-200 dark:border-green-800' : 'bg-white dark:bg-gray-800 border-gray-200 dark:border-gray-700'}`}>
                <p className="text-xs text-green-600 dark:text-green-400 mb-1">Best crossing now</p>
                {bestPort ? (
                  <>
                    <p className="text-sm font-bold text-green-800 dark:text-green-300 leading-tight">{bestPort.portName}</p>
                    <p className="text-xl font-bold text-green-700 dark:text-green-400">{bestPort.commercial} min</p>
                  </>
                ) : <p className="text-sm text-gray-400">No data</p>}
              </div>
              <div className="bg-green-50 dark:bg-green-900/20 rounded-2xl border border-green-200 dark:border-green-800 p-4 shadow-sm flex items-center gap-3">
                <CheckCircle className="w-6 h-6 text-green-500 flex-shrink-0" />
                <div>
                  <p className="text-2xl font-bold text-green-700 dark:text-green-400">{clearCount}</p>
                  <p className="text-xs text-green-600 dark:text-green-500">Crossings &lt;20 min</p>
                </div>
              </div>
              <div className="bg-red-50 dark:bg-red-900/20 rounded-2xl border border-red-200 dark:border-red-800 p-4 shadow-sm flex items-center gap-3">
                <AlertTriangle className="w-6 h-6 text-red-500 flex-shrink-0" />
                <div>
                  <p className="text-2xl font-bold text-red-700 dark:text-red-400">{heavyCount}</p>
                  <p className="text-xs text-red-600 dark:text-red-500">Crossings &gt;45 min</p>
                </div>
              </div>
            </div>

            {/* Region filter */}
            <div>
              <p className="text-xs text-gray-500 dark:text-gray-400 font-medium mb-2">Filter by region <span className="text-gray-400">(empty = all)</span></p>
              <div className="flex flex-wrap gap-2">
                {ALL_REGIONS.filter(r => r !== 'All' && r !== 'Other').map(region => (
                  <button
                    key={region}
                    onClick={() => toggleRegion(region)}
                    className={`text-xs px-3 py-1.5 rounded-full border font-medium transition-colors ${
                      selectedRegions.includes(region)
                        ? 'bg-gray-900 dark:bg-gray-100 text-white dark:text-gray-900 border-gray-900 dark:border-gray-100'
                        : 'bg-white dark:bg-gray-800 text-gray-600 dark:text-gray-400 border-gray-200 dark:border-gray-700 hover:border-gray-400'
                    }`}
                  >
                    {region}
                  </button>
                ))}
              </div>
            </div>

            {/* Sort */}
            <div className="flex items-center gap-2">
              <span className="text-xs text-gray-500 dark:text-gray-400">Sort:</span>
              {[
                { key: 'commercial', label: 'Truck' },
                { key: 'wait', label: 'Car' },
                { key: 'name', label: 'Name' },
              ].map(s => (
                <button
                  key={s.key}
                  onClick={() => setSortBy(s.key as typeof sortBy)}
                  className={`text-xs px-3 py-1.5 rounded-full border font-medium transition-colors ${
                    sortBy === s.key
                      ? 'bg-gray-900 dark:bg-gray-100 text-white dark:text-gray-900 border-gray-900'
                      : 'bg-white dark:bg-gray-800 text-gray-500 dark:text-gray-400 border-gray-200 dark:border-gray-700'
                  }`}
                >
                  {s.label}
                </button>
              ))}
            </div>

            {/* Table */}
            <div className="bg-white dark:bg-gray-800 rounded-2xl border border-gray-200 dark:border-gray-700 shadow-sm overflow-hidden">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b border-gray-100 dark:border-gray-700">
                    <th className="text-left text-xs text-gray-400 font-medium px-4 py-3">Crossing</th>
                    <th className="text-center text-xs text-gray-400 font-medium px-2 py-3">Car</th>
                    <th className="text-center text-xs text-gray-400 font-medium px-2 py-3">Truck</th>
                    <th className="text-center text-xs text-gray-400 font-medium px-2 py-3">SENTRI</th>
                  </tr>
                </thead>
                <tbody>
                  {filtered.map((port, i) => {
                    const level = getWaitLevel(port.commercial ?? port.vehicle)
                    const dot = waitLevelDot(level)
                    const colors = waitLevelColor(level)
                    const truckWait = port.commercial
                    const trend = truckWait !== null && truckWait < 20
                      ? <TrendingDown className="w-3 h-3 text-green-500" />
                      : truckWait !== null && truckWait > 45
                      ? <TrendingUp className="w-3 h-3 text-red-500" />
                      : <Minus className="w-3 h-3 text-gray-300" />

                    return (
                      <tr
                        key={port.portId}
                        className={`border-b border-gray-50 dark:border-gray-700 hover:bg-gray-50 dark:hover:bg-gray-700 cursor-pointer ${i % 2 === 0 ? '' : 'bg-gray-50/30 dark:bg-gray-750'}`}
                        onClick={() => router.push(`/port/${encodeURIComponent(port.portId)}`)}
                      >
                        <td className="px-4 py-3">
                          <div className="flex items-center gap-2">
                            <span className={`w-2 h-2 rounded-full ${dot} flex-shrink-0`} />
                            <div>
                              <p className="font-medium text-gray-900 dark:text-gray-100 text-xs leading-tight">{port.portName}</p>
                              <p className="text-xs text-gray-400 leading-tight">{port.crossingName}</p>
                            </div>
                          </div>
                        </td>
                        <td className="text-center px-2 py-3 text-xs font-medium text-gray-700 dark:text-gray-300">
                          {port.vehicle !== null ? `${port.vehicle}m` : '—'}
                        </td>
                        <td className="text-center px-2 py-3">
                          <div className="flex items-center justify-center gap-1">
                            <span className={`text-xs font-bold px-2 py-0.5 rounded-full border ${colors}`}>
                              {truckWait !== null ? `${truckWait}m` : '—'}
                            </span>
                            {trend}
                          </div>
                        </td>
                        <td className="text-center px-2 py-3 text-xs font-medium text-gray-700 dark:text-gray-300">
                          {port.sentri !== null ? `${port.sentri}m` : '—'}
                        </td>
                      </tr>
                    )
                  })}
                </tbody>
              </table>
              {filtered.length === 0 && (
                <p className="text-center text-gray-400 text-sm py-8">No crossings match your filters.</p>
              )}
            </div>
          </div>
        )}

        {/* Watch List tab — crossings with heavy delays */}
        {activeTab === 'alerts' && (
          <div className="space-y-3">
            <p className="text-xs text-gray-500 dark:text-gray-400">Crossings currently above 45 min commercial wait</p>
            {ports
              .filter(p => (p.commercial ?? p.vehicle ?? 0) > 45)
              .sort((a, b) => (b.commercial ?? b.vehicle ?? 0) - (a.commercial ?? a.vehicle ?? 0))
              .map(port => {
                const wait = port.commercial ?? port.vehicle
                return (
                  <Link key={port.portId} href={`/port/${encodeURIComponent(port.portId)}`}>
                    <div className="bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 rounded-2xl p-4 flex items-center justify-between">
                      <div>
                        <p className="font-semibold text-gray-900 dark:text-gray-100 text-sm">{port.portName}</p>
                        <p className="text-xs text-gray-500 dark:text-gray-400">{port.crossingName}</p>
                      </div>
                      <div className="text-right">
                        <p className="text-2xl font-bold text-red-600 dark:text-red-400">{wait}</p>
                        <p className="text-xs text-red-500">min {port.commercial !== null ? 'truck' : 'car'}</p>
                      </div>
                    </div>
                  </Link>
                )
              })}
            {ports.filter(p => (p.commercial ?? p.vehicle ?? 0) > 45).length === 0 && (
              <div className="bg-green-50 dark:bg-green-900/20 border border-green-200 dark:border-green-800 rounded-2xl p-6 text-center">
                <CheckCircle className="w-8 h-8 text-green-500 mx-auto mb-2" />
                <p className="text-sm font-semibold text-green-800 dark:text-green-300">All clear</p>
                <p className="text-xs text-green-600 dark:text-green-400 mt-1">No crossings above 45 min right now</p>
              </div>
            )}
          </div>
        )}

        {/* Export tab */}
        {activeTab === 'export' && (
          <div className="space-y-4">
            <div className="bg-white dark:bg-gray-800 rounded-2xl border border-gray-200 dark:border-gray-700 p-5 shadow-sm">
              <div className="flex items-center gap-3 mb-4">
                <div className="p-2 bg-gray-100 dark:bg-gray-700 rounded-xl">
                  <Download className="w-5 h-5 text-gray-600 dark:text-gray-400" />
                </div>
                <div>
                  <h3 className="text-sm font-semibold text-gray-900 dark:text-gray-100">Historical Data Export</h3>
                  <p className="text-xs text-gray-400">Download CSV for all crossings</p>
                </div>
              </div>
              <div className="space-y-2">
                {[
                  { days: 7, label: 'Last 7 days' },
                  { days: 30, label: 'Last 30 days' },
                  { days: 90, label: 'Last 90 days' },
                ].map(({ days, label }) => (
                  <button
                    key={days}
                    onClick={() => downloadCsv(days)}
                    disabled={exportLoading}
                    className="w-full flex items-center justify-between px-4 py-3 bg-gray-50 dark:bg-gray-700 hover:bg-gray-100 dark:hover:bg-gray-600 rounded-xl transition-colors disabled:opacity-50"
                  >
                    <span className="text-sm font-medium text-gray-700 dark:text-gray-300">{label}</span>
                    <Download className="w-4 h-4 text-gray-400" />
                  </button>
                ))}
              </div>
              <p className="text-xs text-gray-400 mt-3">
                Includes: vehicle, SENTRI, pedestrian, commercial wait times per crossing per 15-min interval.
              </p>
            </div>

            <div className="bg-blue-50 dark:bg-blue-900/20 border border-blue-200 dark:border-blue-800 rounded-2xl p-4">
              <div className="flex items-center gap-2 mb-1">
                <Users className="w-4 h-4 text-blue-600 dark:text-blue-400" />
                <p className="text-sm font-semibold text-blue-800 dark:text-blue-300">API Access</p>
              </div>
              <p className="text-xs text-blue-600 dark:text-blue-400 mb-3">
                Integrate live border wait times directly into your TMS, dispatch software, or custom dashboard.
              </p>
              <a
                href="mailto:cruzabusiness@gmail.com?subject=API Access Request"
                className="inline-block text-xs font-semibold text-white bg-blue-600 px-4 py-2 rounded-xl hover:bg-blue-700 transition-colors"
              >
                Request API Access →
              </a>
            </div>
          </div>
        )}
      </div>
    </main>
  )
}
