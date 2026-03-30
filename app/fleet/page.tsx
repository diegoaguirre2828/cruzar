'use client'

import { useState, useEffect, useCallback } from 'react'
import { useRouter } from 'next/navigation'
import Link from 'next/link'
import { useAuth } from '@/lib/useAuth'
import { getWaitLevel, waitLevelDot, waitLevelColor } from '@/lib/cbp'
import { getPortMeta, ALL_REGIONS } from '@/lib/portMeta'
import { ArrowLeft, RefreshCw, TrendingUp, TrendingDown, Minus } from 'lucide-react'
import type { PortWaitTime } from '@/types'

export default function FleetPage() {
  const { user, loading: authLoading } = useAuth()
  const router = useRouter()
  const [ports, setPorts] = useState<PortWaitTime[]>([])
  const [loading, setLoading] = useState(true)
  const [selectedRegions, setSelectedRegions] = useState<string[]>(['Laredo', 'RGV – McAllen / Hidalgo'])
  const [sortBy, setSortBy] = useState<'wait' | 'commercial' | 'name'>('commercial')
  const [fetchedAt, setFetchedAt] = useState<string | null>(null)

  const loadPorts = useCallback(async () => {
    const res = await fetch('/api/ports')
    if (res.ok) {
      const d = await res.json()
      setPorts(d.ports || [])
      setFetchedAt(d.fetchedAt)
    }
    setLoading(false)
  }, [])

  const [tier, setTier] = useState<string>('free')

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
    .filter(p => {
      const meta = getPortMeta(p.portId)
      return selectedRegions.length === 0 || selectedRegions.includes(meta.region)
    })
    .sort((a, b) => {
      if (sortBy === 'commercial') return (a.commercial ?? 999) - (b.commercial ?? 999)
      if (sortBy === 'wait') return (a.vehicle ?? 999) - (b.vehicle ?? 999)
      return a.portName.localeCompare(b.portName)
    })

  const stats = {
    avgCommercial: filtered.filter(p => p.commercial !== null).reduce((a, b, _, arr) =>
      a + (b.commercial ?? 0) / arr.length, 0),
    clearCount: filtered.filter(p => (p.commercial ?? p.vehicle ?? 99) < 20).length,
    heavyCount: filtered.filter(p => (p.commercial ?? p.vehicle ?? 0) > 45).length,
  }

  const timeAgo = fetchedAt
    ? Math.round((Date.now() - new Date(fetchedAt).getTime()) / 60000)
    : null

  if (authLoading || loading) return (
    <div className="min-h-screen bg-gray-50 flex items-center justify-center">
      <div className="w-8 h-8 border-2 border-gray-300 border-t-gray-900 rounded-full animate-spin" />
    </div>
  )

  return (
    <main className="min-h-screen bg-gray-50">
      <div className="max-w-2xl mx-auto px-4 pb-10">
        {/* Header */}
        <div className="pt-6 pb-4 flex items-center justify-between">
          <div>
            <Link href="/dashboard" className="flex items-center gap-1 text-xs text-gray-400 hover:text-gray-700 mb-1">
              <ArrowLeft className="w-3 h-3" /> Dashboard
            </Link>
            <h1 className="text-xl font-bold text-gray-900">🚛 Fleet Overview</h1>
            <p className="text-xs text-gray-400">
              {timeAgo !== null ? `Updated ${timeAgo === 0 ? 'just now' : `${timeAgo}m ago`}` : ''}
            </p>
          </div>
          <button onClick={loadPorts} className="p-2 rounded-xl bg-white border border-gray-200 text-gray-500 hover:bg-gray-50">
            <RefreshCw className="w-4 h-4" />
          </button>
        </div>

        {/* Summary stats */}
        <div className="grid grid-cols-3 gap-3 mb-5">
          <div className="bg-white rounded-2xl border border-gray-200 p-3 text-center shadow-sm">
            <p className="text-2xl font-bold text-gray-900">{Math.round(stats.avgCommercial)}</p>
            <p className="text-xs text-gray-400 mt-0.5">Avg truck wait (min)</p>
          </div>
          <div className="bg-green-50 rounded-2xl border border-green-200 p-3 text-center shadow-sm">
            <p className="text-2xl font-bold text-green-700">{stats.clearCount}</p>
            <p className="text-xs text-green-600 mt-0.5">Crossings &lt;20 min</p>
          </div>
          <div className="bg-red-50 rounded-2xl border border-red-200 p-3 text-center shadow-sm">
            <p className="text-2xl font-bold text-red-700">{stats.heavyCount}</p>
            <p className="text-xs text-red-600 mt-0.5">Crossings &gt;45 min</p>
          </div>
        </div>

        {/* Region filter */}
        <div className="mb-4">
          <p className="text-xs text-gray-500 font-medium mb-2">Filter by region</p>
          <div className="flex flex-wrap gap-2">
            {ALL_REGIONS.filter(r => r !== 'All' && r !== 'Other').map(region => (
              <button
                key={region}
                onClick={() => toggleRegion(region)}
                className={`text-xs px-3 py-1.5 rounded-full border font-medium transition-colors ${
                  selectedRegions.includes(region)
                    ? 'bg-gray-900 text-white border-gray-900'
                    : 'bg-white text-gray-600 border-gray-200 hover:border-gray-400'
                }`}
              >
                {region}
              </button>
            ))}
          </div>
        </div>

        {/* Sort */}
        <div className="flex items-center gap-2 mb-4">
          <span className="text-xs text-gray-500">Sort by:</span>
          {[
            { key: 'commercial', label: 'Truck Wait' },
            { key: 'wait', label: 'Car Wait' },
            { key: 'name', label: 'Name' },
          ].map(s => (
            <button
              key={s.key}
              onClick={() => setSortBy(s.key as typeof sortBy)}
              className={`text-xs px-3 py-1.5 rounded-full border font-medium transition-colors ${
                sortBy === s.key
                  ? 'bg-gray-900 text-white border-gray-900'
                  : 'bg-white text-gray-500 border-gray-200'
              }`}
            >
              {s.label}
            </button>
          ))}
        </div>

        {/* Crossings table */}
        <div className="bg-white rounded-2xl border border-gray-200 shadow-sm overflow-hidden">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-gray-100">
                <th className="text-left text-xs text-gray-400 font-medium px-4 py-3">Crossing</th>
                <th className="text-center text-xs text-gray-400 font-medium px-2 py-3">Car</th>
                <th className="text-center text-xs text-gray-400 font-medium px-2 py-3">Truck</th>
                <th className="text-center text-xs text-gray-400 font-medium px-2 py-3">Status</th>
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
                  <tr key={port.portId} className={`border-b border-gray-50 hover:bg-gray-50 cursor-pointer ${i % 2 === 0 ? '' : 'bg-gray-50/30'}`}
                    onClick={() => router.push(`/port/${encodeURIComponent(port.portId)}`)}>
                    <td className="px-4 py-3">
                      <div className="flex items-center gap-2">
                        <span className={`w-2 h-2 rounded-full ${dot} flex-shrink-0`} />
                        <div>
                          <p className="font-medium text-gray-900 text-xs leading-tight">{port.portName}</p>
                          <p className="text-xs text-gray-400 leading-tight">{port.crossingName}</p>
                        </div>
                      </div>
                    </td>
                    <td className="text-center px-2 py-3 text-xs font-medium text-gray-700">
                      {port.vehicle !== null ? `${port.vehicle}m` : '—'}
                    </td>
                    <td className="text-center px-2 py-3">
                      <span className={`text-xs font-bold px-2 py-0.5 rounded-full border ${colors}`}>
                        {truckWait !== null ? `${truckWait}m` : '—'}
                      </span>
                    </td>
                    <td className="text-center px-2 py-3">
                      <div className="flex justify-center">{trend}</div>
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
    </main>
  )
}
