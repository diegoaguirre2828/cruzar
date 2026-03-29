'use client'

import { useState, useEffect, useCallback } from 'react'
import { PortCard } from './PortCard'
import type { PortWaitTime } from '@/types'
import { RefreshCw } from 'lucide-react'

const REFRESH_INTERVAL = 5 * 60 * 1000 // 5 minutes

export function PortList() {
  const [ports, setPorts] = useState<PortWaitTime[]>([])
  const [fetchedAt, setFetchedAt] = useState<string | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [refreshing, setRefreshing] = useState(false)

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
      <div className="flex items-center justify-between mb-3">
        <div className="text-xs text-gray-400">
          {error ? (
            <span className="text-amber-500">{error}</span>
          ) : timeAgo !== null ? (
            <span>Updated {timeAgo === 0 ? 'just now' : `${timeAgo}m ago`}</span>
          ) : null}
        </div>
        <button
          onClick={() => fetchPorts(true)}
          className="flex items-center gap-1 text-xs text-gray-500 hover:text-gray-800"
          disabled={refreshing}
        >
          <RefreshCw className={`w-3 h-3 ${refreshing ? 'animate-spin' : ''}`} />
          Refresh
        </button>
      </div>

      <div className="space-y-3">
        {ports.map((port) => (
          <PortCard key={`${port.portId}-${port.crossingName}`} port={port} />
        ))}
      </div>

      {ports.length === 0 && !loading && (
        <p className="text-center text-gray-400 mt-10">No port data available.</p>
      )}
    </div>
  )
}
