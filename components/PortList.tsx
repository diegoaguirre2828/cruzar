'use client'

import { useState, useEffect, useCallback } from 'react'
import { useRouter } from 'next/navigation'
import { PortCard } from './PortCard'
import { BorderMap } from './BorderMap'
import type { PortWaitTime } from '@/types'
import { RefreshCw, Map, List } from 'lucide-react'
import { ALL_REGIONS, getPortMeta } from '@/lib/portMeta'

const REFRESH_INTERVAL = 5 * 60 * 1000

export function PortList() {
  const router = useRouter()
  const [ports, setPorts] = useState<PortWaitTime[]>([])
  const [fetchedAt, setFetchedAt] = useState<string | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [refreshing, setRefreshing] = useState(false)
  const [selectedRegion, setSelectedRegion] = useState('All')
  const [view, setView] = useState<'list' | 'map'>('list')

  const fetchPorts = useCallback(async (isManual = false) => {
    if (isManual) setRefreshing(true)
    try {
      const res = await fetch('/api/ports', { cache: 'no-store' })
      if (!res.ok) throw new Error('Failed to load')
      const data = await res.json()
      setPorts(data.ports)
      setFetchedAt(data.fetchedAt)
      setError(null)
    } catch {
      setError('Could not load wait times. Showing cached data.')
    } finally {
      setLoading(false)
      setRefreshing(false)
    }
  }, [])

  useEffect(() => {
    fetchPorts()
    const interval = setInterval(() => fetchPorts(), REFRESH_INTERVAL)
    return () => clearInterval(interval)
  }, [fetchPorts])

  const filteredPorts = selectedRegion === 'All'
    ? ports
    : ports.filter(p => getPortMeta(p.portId).region === selectedRegion)

  // Group by region for list view
  const grouped = filteredPorts.reduce<Record<string, PortWaitTime[]>>((acc, port) => {
    const region = getPortMeta(port.portId).region
    if (!acc[region]) acc[region] = []
    acc[region].push(port)
    return acc
  }, {})

  const timeAgo = fetchedAt
    ? Math.round((Date.now() - new Date(fetchedAt).getTime()) / 1000 / 60)
    : null

  if (loading) {
    return (
      <div className="space-y-3">
        {[...Array(6)].map((_, i) => (
          <div key={i} className="bg-gray-100 rounded-2xl h-28 animate-pulse" />
        ))}
      </div>
    )
  }

  return (
    <div>
      {/* Controls row */}
      <div className="flex items-center justify-between mb-3">
        <div className="text-xs text-gray-400">
          {error ? (
            <span className="text-amber-500">{error}</span>
          ) : timeAgo !== null ? (
            <span>Updated {timeAgo === 0 ? 'just now' : `${timeAgo}m ago`}</span>
          ) : null}
        </div>
        <div className="flex items-center gap-2">
          {/* List / Map toggle */}
          <div className="flex bg-gray-100 rounded-lg p-0.5">
            <button
              onClick={() => setView('list')}
              className={`flex items-center gap-1 px-2 py-1 rounded-md text-xs font-medium transition-colors ${view === 'list' ? 'bg-white shadow text-gray-900' : 'text-gray-500'}`}
            >
              <List className="w-3 h-3" /> List
            </button>
            <button
              onClick={() => setView('map')}
              className={`flex items-center gap-1 px-2 py-1 rounded-md text-xs font-medium transition-colors ${view === 'map' ? 'bg-white shadow text-gray-900' : 'text-gray-500'}`}
            >
              <Map className="w-3 h-3" /> Map
            </button>
          </div>
          <button
            onClick={() => fetchPorts(true)}
            className="flex items-center gap-1 text-xs text-gray-500 hover:text-gray-800"
            disabled={refreshing}
          >
            <RefreshCw className={`w-3 h-3 ${refreshing ? 'animate-spin' : ''}`} />
          </button>
        </div>
      </div>

      {/* Region filter */}
      <div className="mb-4">
        <select
          value={selectedRegion}
          onChange={e => setSelectedRegion(e.target.value)}
          className="w-full bg-white border border-gray-200 rounded-xl px-3 py-2.5 text-sm text-gray-800 shadow-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
        >
          {ALL_REGIONS.map(r => (
            <option key={r} value={r}>{r === 'All' ? '📍 All Regions' : r}</option>
          ))}
        </select>
      </div>

      {/* Map view */}
      {view === 'map' && (
        <div className="mb-4">
          <BorderMap
            ports={ports}
            selectedRegion={selectedRegion}
            onPortClick={(portId) => router.push(`/port/${encodeURIComponent(portId)}`)}
          />
          <p className="text-xs text-gray-400 mt-1.5 text-center">Tap a dot to see details</p>
        </div>
      )}

      {/* List view — grouped by region */}
      {view === 'list' && (
        <div className="space-y-5">
          {Object.entries(grouped).map(([region, regionPorts]) => (
            <div key={region}>
              <h2 className="text-xs font-semibold text-gray-400 uppercase tracking-wider mb-2 px-1">
                {region}
              </h2>
              <div className="space-y-3">
                {regionPorts.map(port => (
                  <PortCard key={`${port.portId}-${port.crossingName}`} port={port} />
                ))}
              </div>
            </div>
          ))}
        </div>
      )}

      {filteredPorts.length === 0 && !loading && (
        <p className="text-center text-gray-400 mt-10">No port data available.</p>
      )}
    </div>
  )
}
