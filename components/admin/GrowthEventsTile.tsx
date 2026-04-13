'use client'

import { useEffect, useState } from 'react'

// Admin tile that reads /api/admin/growth-events and shows counts
// per event_name for the last 7 and 30 days. Grows with the app —
// every new trackEvent() call in the codebase automatically shows
// up here without requiring a new widget per event type.

interface EventRow {
  name: string
  last7: number
  last30: number
}

export function GrowthEventsTile() {
  const [events, setEvents] = useState<EventRow[] | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    fetch('/api/admin/growth-events')
      .then(async (r) => {
        if (!r.ok) throw new Error((await r.json()).error || `HTTP ${r.status}`)
        return r.json()
      })
      .then((d) => setEvents(d.events || []))
      .catch((e) => setError(e.message))
      .finally(() => setLoading(false))
  }, [])

  if (loading) return <p className="mt-4 text-xs text-gray-400">Loading events…</p>
  if (error) return <p className="mt-4 text-xs text-red-500">Error: {error}</p>
  if (!events || events.length === 0) {
    return (
      <div className="mt-4 bg-white border border-gray-200 rounded-2xl p-4">
        <p className="text-xs font-bold text-gray-700">Growth events</p>
        <p className="text-[11px] text-gray-400 italic mt-1">
          No events logged yet. Once users start interacting with tracked surfaces (report
          submit, install sheet, IAB banner, etc.) this will populate.
        </p>
      </div>
    )
  }

  const max30 = Math.max(...events.map((e) => e.last30), 1)

  return (
    <div className="mt-4 bg-white border border-gray-200 rounded-2xl overflow-hidden">
      <div className="px-4 py-3 border-b border-gray-100 bg-gray-50">
        <p className="text-xs font-bold text-gray-700">Growth events</p>
        <p className="text-[10px] text-gray-500 mt-0.5">
          Per-event counts · last 7d / last 30d · sorted by 30d volume
        </p>
      </div>
      <div className="divide-y divide-gray-100">
        {events.map((e) => {
          const pct = Math.round((e.last30 / max30) * 100)
          return (
            <div key={e.name} className="px-4 py-2.5">
              <div className="flex items-center justify-between gap-3">
                <p className="text-[11px] font-mono font-bold text-gray-700 truncate flex-1 min-w-0">
                  {e.name}
                </p>
                <div className="flex items-center gap-3 flex-shrink-0 text-right">
                  <div>
                    <p className="text-sm font-black text-blue-700 tabular-nums leading-none">{e.last7}</p>
                    <p className="text-[9px] text-gray-400 uppercase font-bold">7d</p>
                  </div>
                  <div>
                    <p className="text-sm font-black text-gray-900 tabular-nums leading-none">{e.last30}</p>
                    <p className="text-[9px] text-gray-400 uppercase font-bold">30d</p>
                  </div>
                </div>
              </div>
              <div className="mt-1.5 h-1 bg-gray-100 rounded-full overflow-hidden">
                <div className="h-full bg-gradient-to-r from-blue-400 to-indigo-500 rounded-full" style={{ width: `${pct}%` }} />
              </div>
            </div>
          )
        })}
      </div>
    </div>
  )
}
