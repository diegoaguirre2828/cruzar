'use client'

import { useEffect, useState } from 'react'
import Link from 'next/link'
import { useLang } from '@/lib/LangContext'
import { getPortMeta } from '@/lib/portMeta'
import { useHomeRegion } from '@/lib/useHomeRegion'
import { useTier } from '@/lib/useTier'

interface Report {
  id: string
  port_id: string
  report_type: string
  description: string | null
  wait_minutes: number | null
  created_at: string
  username: string | null
  port_name?: string | null
}

const TYPE_EMOJI: Record<string, string> = {
  delay: '🔴', inspection: '🔵', accident: '💥', clear: '🟢', other: '💬',
  weather_fog: '🌫️', weather_rain: '🌧️', weather_wind: '💨', weather_dust: '🟤',
  officer_k9: '🐕', officer_secondary: '🚔',
  road_construction: '🚧', road_hazard: '⚠️',
  reckless_driver: '😤',
}

const TYPE_LABEL: Record<string, { en: string; es: string }> = {
  delay:              { en: 'Long wait',        es: 'Espera larga' },
  inspection:         { en: 'Heavy inspection', es: 'Inspección fuerte' },
  accident:           { en: 'Accident',         es: 'Accidente' },
  clear:              { en: 'Moving fast',      es: 'Fluye rápido' },
  other:              { en: 'Update',           es: 'Actualización' },
  weather_fog:        { en: 'Fog',              es: 'Neblina' },
  weather_rain:       { en: 'Heavy rain',       es: 'Lluvia fuerte' },
  weather_wind:       { en: 'High winds',       es: 'Viento fuerte' },
  weather_dust:       { en: 'Dust storm',       es: 'Tolvanera' },
  officer_k9:         { en: 'K9 out',           es: 'Perros / K9' },
  officer_secondary:  { en: 'Extra checks',     es: 'Revisiones extra' },
  road_construction:  { en: 'Construction',     es: 'Construcción' },
  road_hazard:        { en: 'Road hazard',      es: 'Peligro en ruta' },
  reckless_driver:    { en: 'Reckless driver',  es: 'Conductor loco' },
}

function ageLabel(iso: string, lang: string): string {
  const mins = Math.round((Date.now() - new Date(iso).getTime()) / 60000)
  if (mins < 1) return lang === 'es' ? 'ahora' : 'now'
  if (mins < 60) return lang === 'es' ? `hace ${mins}m` : `${mins}m ago`
  return lang === 'es' ? `hace ${Math.round(mins / 60)}h` : `${Math.round(mins / 60)}h ago`
}

function filterFresh(list: Report[]): Report[] {
  return list
    .filter((r) => {
      const mins = (Date.now() - new Date(r.created_at).getTime()) / 60000
      return mins < 180
    })
    .slice(0, 5)
}

interface TickerProps {
  initialReports?: Report[]
}

// A compact "what's happening at the border right now" strip. Shows ONE
// community report at a time and rotates through the 5 freshest every 4s.
// This is the page's heartbeat — the reason to come back. Replaces the
// big hero card for guests.
export function LiveActivityTicker({ initialReports }: TickerProps = {}) {
  const { lang } = useLang()
  const es = lang === 'es'
  const { homeRegion } = useHomeRegion()
  const { tier } = useTier()
  const isBusiness = tier === 'business'
  const scopeActive = !isBusiness && homeRegion != null

  // Apply the home-region scope to the incoming reports so users in
  // RGV never see an El Paso or Tijuana report rotating through the
  // ticker. Matches PortList / RegionalSnapshot scoping.
  const scopeReports = (list: Report[]): Report[] => {
    if (!scopeActive) return list
    return list.filter((r) => getPortMeta(r.port_id).megaRegion === homeRegion)
  }

  const [reports, setReports] = useState<Report[]>(() => initialReports ? scopeReports(filterFresh(initialReports)) : [])
  const [idx, setIdx] = useState(0)

  // Re-scope when homeRegion changes (user switches region in picker)
  useEffect(() => {
    setReports((prev) => scopeReports(filterFresh(prev)))
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [homeRegion, scopeActive])

  useEffect(() => {
    let cancelled = false
    const load = () => {
      fetch('/api/reports/recent?limit=30')
        .then(r => r.json())
        .then(d => {
          if (cancelled) return
          // Fetch more (30 instead of 10) to give us enough headroom
          // after region scoping takes a bite. Then filter to fresh +
          // scope to home region.
          setReports(scopeReports(filterFresh(d.reports || [])))
        })
        .catch(() => { /* ignore — keep whatever we had */ })
    }
    // Only fetch on mount if we didn't get initial data from the server —
    // avoids a wasted round-trip on first paint. Still refreshes every 60s.
    if (!initialReports || initialReports.length === 0) load()
    const refresh = setInterval(load, 60_000)
    return () => { cancelled = true; clearInterval(refresh) }
  }, [initialReports])

  useEffect(() => {
    if (reports.length <= 1) return
    const rotate = setInterval(() => {
      setIdx(i => (i + 1) % reports.length)
    }, 4000)
    return () => clearInterval(rotate)
  }, [reports.length])

  if (reports.length === 0) {
    return (
      <div className="mt-3 bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-2xl px-4 py-3 flex items-center gap-3">
        <span className="relative flex h-2.5 w-2.5 flex-shrink-0">
          <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-green-400 opacity-75" />
          <span className="relative inline-flex rounded-full h-2.5 w-2.5 bg-green-500" />
        </span>
        <div className="min-w-0 flex-1">
          <p className="text-[10px] uppercase tracking-widest font-bold text-gray-500 dark:text-gray-400">
            {es ? 'EN VIVO' : 'LIVE'}
          </p>
          <p className="text-xs font-semibold text-gray-700 dark:text-gray-300 truncate">
            {es ? 'Sin reportes en tu zona ahorita' : 'No reports in your zone right now'}
          </p>
        </div>
      </div>
    )
  }

  // idx can point past reports.length briefly after the reports array
  // shrinks (e.g., a refetch filters more aggressively than the last).
  // Guard before accessing r.report_type — caused 3+ TypeError reports.
  const r = reports[idx] ?? reports[0]
  if (!r) return null
  const label = TYPE_LABEL[r.report_type] ?? { en: 'Update', es: 'Actualización' }
  const emoji = TYPE_EMOJI[r.report_type] ?? '💬'

  return (
    <Link
      href={`/port/${encodeURIComponent(r.port_id)}`}
      className="mt-3 block bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-2xl px-4 py-3 active:scale-[0.99] transition-transform"
    >
      <div className="flex items-center gap-2 mb-1.5">
        <span className="relative flex h-2.5 w-2.5 flex-shrink-0">
          <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-red-400 opacity-75" />
          <span className="relative inline-flex rounded-full h-2.5 w-2.5 bg-red-500" />
        </span>
        <span className="text-[10px] uppercase tracking-widest font-bold text-gray-500 dark:text-gray-400">
          {es ? 'EN VIVO · La comunidad reportando' : 'LIVE · Community reporting'}
        </span>
        <span className="ml-auto text-[10px] text-gray-400 flex-shrink-0">
          {reports.length > 1 ? `${idx + 1}/${reports.length}` : ''}
        </span>
      </div>
      <div className="flex items-center gap-3">
        <span className="text-2xl leading-none flex-shrink-0">{emoji}</span>
        <div className="min-w-0 flex-1">
          <p className="text-sm font-bold text-gray-900 dark:text-gray-100 truncate">
            {es ? label.es : label.en}
            {r.wait_minutes !== null && (
              <span className="ml-2 text-xs bg-gray-100 dark:bg-gray-700 text-gray-600 dark:text-gray-300 font-bold px-1.5 py-0.5 rounded-full tabular-nums">
                {r.wait_minutes >= 60
                  ? (r.wait_minutes % 60 === 0
                      ? `${Math.floor(r.wait_minutes / 60)}h`
                      : `${Math.floor(r.wait_minutes / 60)}h${r.wait_minutes % 60}`)
                  : `${r.wait_minutes}m`}
              </span>
            )}
          </p>
          <p className="text-[11px] text-gray-500 dark:text-gray-400 truncate">
            {getPortMeta(r.port_id).localName || r.port_id} · {ageLabel(r.created_at, lang)}
          </p>
        </div>
        <span className="text-gray-300 dark:text-gray-600 flex-shrink-0">→</span>
      </div>
    </Link>
  )
}
