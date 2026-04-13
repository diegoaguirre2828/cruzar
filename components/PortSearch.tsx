'use client'

import { useMemo, useState, useEffect, useRef } from 'react'
import { Search, X, Check } from 'lucide-react'
import { getPortMeta } from '@/lib/portMeta'
import { useLang } from '@/lib/LangContext'
import type { PortWaitTime } from '@/types'

// Instant-search port picker — replaces the classic <select> dropdown with
// a type-ahead input that filters across port name, city, crossing name,
// local nickname, override, region, and port_id. Much faster for users who
// know their bridge by nickname ("puente nuevo") but wouldn't know to scroll
// to "Brownsville B&M" in a big list.

interface Props {
  ports: PortWaitTime[]
  value: string | null
  onChange: (portId: string) => void
  placeholder?: string
  /** Show live wait time next to each port in the results */
  showWait?: boolean
}

export function PortSearch({ ports, value, onChange, placeholder, showWait = true }: Props) {
  const { lang } = useLang()
  const es = lang === 'es'
  const [query, setQuery] = useState('')
  const [focused, setFocused] = useState(false)
  const containerRef = useRef<HTMLDivElement>(null)

  const selected = value ? ports.find((p) => p.portId === value) : null

  // Close dropdown on outside click
  useEffect(() => {
    function handle(e: MouseEvent) {
      if (containerRef.current && !containerRef.current.contains(e.target as Node)) {
        setFocused(false)
      }
    }
    document.addEventListener('mousedown', handle)
    return () => document.removeEventListener('mousedown', handle)
  }, [])

  const matches = useMemo(() => {
    const q = query.trim().toLowerCase()
    // Build searchable record for each port
    const indexed = ports.map((p) => {
      const meta = getPortMeta(p.portId)
      const effectiveLocal = p.localNameOverride || meta.localName || ''
      const haystack = [
        p.portId,
        p.portName,
        p.crossingName,
        meta.city,
        meta.region,
        effectiveLocal,
      ]
        .filter(Boolean)
        .join(' · ')
        .toLowerCase()
      return { port: p, meta, effectiveLocal, haystack }
    })

    if (!q) {
      // When empty, show all ports grouped visually by mega region
      return indexed.slice(0, 100)
    }

    // Score by: exact match on local name > starts-with on name > contains
    return indexed
      .filter((r) => r.haystack.includes(q))
      .sort((a, b) => {
        const aLocal = (a.effectiveLocal || '').toLowerCase()
        const bLocal = (b.effectiveLocal || '').toLowerCase()
        const aCity = a.meta.city.toLowerCase()
        const bCity = b.meta.city.toLowerCase()
        const score = (r: { haystack: string; effectiveLocal: string; meta: { city: string } }) => {
          const l = r.effectiveLocal.toLowerCase()
          const c = r.meta.city.toLowerCase()
          if (l === q) return 0
          if (l.startsWith(q)) return 1
          if (c === q) return 2
          if (c.startsWith(q)) return 3
          return 4
        }
        const diff = score(a) - score(b)
        if (diff !== 0) return diff
        return (aLocal || aCity).localeCompare(bLocal || bCity)
      })
      .slice(0, 50)
  }, [ports, query])

  function pick(portId: string) {
    onChange(portId)
    setQuery('')
    setFocused(false)
  }

  function clearSelection() {
    onChange('')
    setQuery('')
    setFocused(true)
  }

  const showList = focused
  const placeholderText =
    placeholder ||
    (es ? 'Busca tu puente — Hidalgo, Puente Nuevo, Tijuana…' : 'Search your bridge — Hidalgo, Puente Nuevo, Tijuana…')

  return (
    <div ref={containerRef} className="relative">
      {/* Display: either the selected port chip OR the search input */}
      {selected && !focused ? (
        <button
          type="button"
          onClick={() => setFocused(true)}
          className="w-full flex items-center justify-between gap-3 border border-gray-200 dark:border-gray-600 dark:bg-gray-700 rounded-xl px-3 py-2.5 text-left hover:border-blue-400 transition-colors"
        >
          <div className="flex items-center gap-2 min-w-0">
            <Check className="w-4 h-4 text-green-500 flex-shrink-0" />
            <div className="min-w-0">
              <p className="text-sm font-semibold text-gray-900 dark:text-gray-100 truncate">
                {selected.crossingName || selected.portName}
                {(selected.localNameOverride || getPortMeta(selected.portId).localName) && (
                  <span className="ml-1 text-gray-500 font-normal">
                    · {selected.localNameOverride || getPortMeta(selected.portId).localName}
                  </span>
                )}
              </p>
              <p className="text-[11px] text-gray-500 dark:text-gray-400 truncate">
                {getPortMeta(selected.portId).city} · {getPortMeta(selected.portId).region}
              </p>
            </div>
          </div>
          <span
            role="button"
            aria-label="Clear"
            onClick={(e) => { e.stopPropagation(); clearSelection() }}
            className="flex-shrink-0 text-gray-400 hover:text-gray-700"
          >
            <X className="w-4 h-4" />
          </span>
        </button>
      ) : (
        <div className="relative">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400 pointer-events-none" />
          <input
            type="text"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            onFocus={() => setFocused(true)}
            placeholder={placeholderText}
            className="w-full border border-gray-200 dark:border-gray-600 dark:bg-gray-700 dark:text-gray-100 rounded-xl pl-9 pr-8 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
            autoComplete="off"
          />
          {query && (
            <button
              type="button"
              onClick={() => setQuery('')}
              className="absolute right-2 top-1/2 -translate-y-1/2 p-1 text-gray-400 hover:text-gray-700"
              aria-label="Clear search"
            >
              <X className="w-3.5 h-3.5" />
            </button>
          )}
        </div>
      )}

      {/* Results dropdown */}
      {showList && (
        <div className="absolute z-20 mt-1 w-full bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-xl shadow-2xl max-h-72 overflow-y-auto">
          {matches.length === 0 ? (
            <p className="text-xs text-gray-400 px-3 py-4 text-center">
              {es ? 'Ningún puente encontrado' : 'No crossings found'}
            </p>
          ) : (
            matches.map(({ port, meta, effectiveLocal }) => {
              const primary = port.crossingName || port.portName
              const secondary = `${meta.city}${effectiveLocal ? ' · ' + effectiveLocal : ''}`
              const waitLabel =
                port.vehicle == null ? '—' : port.vehicle === 0 ? '<1 min' : `${port.vehicle} min`
              const waitColor =
                port.vehicle == null ? 'text-gray-400'
                  : port.vehicle <= 20 ? 'text-green-600'
                  : port.vehicle <= 45 ? 'text-amber-600'
                  : 'text-red-600'
              return (
                <button
                  key={port.portId}
                  type="button"
                  onClick={() => pick(port.portId)}
                  className={`w-full flex items-center justify-between gap-2 px-3 py-2.5 text-left hover:bg-gray-50 dark:hover:bg-gray-700/60 border-b border-gray-100 dark:border-gray-700 last:border-0 ${
                    value === port.portId ? 'bg-blue-50 dark:bg-blue-900/30' : ''
                  }`}
                >
                  <div className="min-w-0 flex-1">
                    <p className="text-sm font-semibold text-gray-900 dark:text-gray-100 truncate">{primary}</p>
                    <p className="text-[11px] text-gray-500 dark:text-gray-400 truncate">{secondary}</p>
                  </div>
                  {showWait && (
                    <span className={`text-xs font-bold tabular-nums ${waitColor} flex-shrink-0`}>
                      {waitLabel}
                    </span>
                  )}
                </button>
              )
            })
          )}
        </div>
      )}
    </div>
  )
}
