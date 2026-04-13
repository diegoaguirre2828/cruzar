'use client'

import { useState, useEffect } from 'react'
import Link from 'next/link'
import { Clock, ThumbsUp, MessageSquare } from 'lucide-react'
import { useLang } from '@/lib/LangContext'

interface Report {
  id: string
  port_id: string
  report_type: string
  description: string | null
  wait_minutes: number | null
  upvotes: number
  created_at: string
  username: string | null
}

// How long each report type stays "active" in minutes
const EXPIRY_MINUTES: Record<string, number> = {
  weather_fog: 120, weather_rain: 120, weather_wind: 120, weather_dust: 120,
  accident: 180, road_hazard: 180, reckless_driver: 60,
  officer_k9: 90, officer_secondary: 90,
  road_construction: 480,
  delay: 60, inspection: 90, clear: 45,
  other: 120,
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
  accident:           { en: 'Accident / crash', es: 'Accidente' },
  clear:              { en: 'Moving fast',       es: 'Fluye rápido' },
  other:              { en: 'Update',            es: 'Actualización' },
  weather_fog:        { en: 'Fog',              es: 'Neblina' },
  weather_rain:       { en: 'Heavy rain',       es: 'Lluvia fuerte' },
  weather_wind:       { en: 'High winds',       es: 'Viento fuerte' },
  weather_dust:       { en: 'Dust storm',       es: 'Tolvanera' },
  officer_k9:         { en: 'K9 / Dogs out',    es: 'Perros / K9' },
  officer_secondary:  { en: 'Extra checks',     es: 'Revisiones extra' },
  road_construction:  { en: 'Construction',     es: 'Construcción' },
  road_hazard:        { en: 'Road hazard',      es: 'Peligro en ruta' },
  reckless_driver:    { en: 'Reckless driver',  es: 'Conductor loco' },
}

function getReportAge(iso: string) {
  return Math.round((Date.now() - new Date(iso).getTime()) / 60000)
}

function isExpired(report: Report) {
  const age = getReportAge(report.created_at)
  const limit = EXPIRY_MINUTES[report.report_type] ?? 120
  return age > limit
}

function timeAgoLabel(iso: string, lang: string): string {
  const mins = getReportAge(iso)
  if (mins < 1) return lang === 'es' ? 'ahora' : 'now'
  if (mins < 60) return lang === 'es' ? `${mins}m` : `${mins}m ago`
  return lang === 'es' ? `${Math.round(mins / 60)}h` : `${Math.round(mins / 60)}h ago`
}

function freshnessColor(iso: string): string {
  const mins = getReportAge(iso)
  if (mins < 15) return 'text-green-500'
  if (mins < 45) return 'text-yellow-500'
  return 'text-gray-400'
}

interface Props {
  initialReports?: Report[]
}

export function HomeReportsFeed({ initialReports }: Props = {}) {
  const { lang } = useLang()
  const [reports, setReports] = useState<Report[]>(() => initialReports || [])
  const [loading, setLoading] = useState(() => !initialReports || initialReports.length === 0)
  const [showExpired, setShowExpired] = useState(false)

  useEffect(() => {
    // Skip the round-trip if the server already handed us data.
    if (initialReports && initialReports.length > 0) return
    fetch('/api/reports/recent')
      .then(r => r.json())
      .then(d => setReports(d.reports || []))
      .finally(() => setLoading(false))
  }, [initialReports])

  if (loading) return (
    <div className="space-y-2">
      {[1, 2, 3].map(i => <div key={i} className="h-16 bg-gray-100 dark:bg-gray-800 rounded-xl animate-pulse" />)}
    </div>
  )

  const active = reports.filter(r => !isExpired(r))
  const expired = reports.filter(r => isExpired(r))
  const visible = showExpired ? reports : active

  if (reports.length === 0) {
    return (
      <div className="bg-white dark:bg-gray-800 rounded-2xl border border-gray-200 dark:border-gray-700 p-6 text-center">
        <MessageSquare className="w-6 h-6 text-gray-300 mx-auto mb-2" />
        <p className="text-sm text-gray-400">
          {lang === 'es' ? 'Sin reportes recientes' : 'No recent reports'}
        </p>
        <p className="text-xs text-gray-400 mt-0.5">
          {lang === 'es' ? 'Sé el primero en reportar' : 'Be the first to report'}
        </p>
      </div>
    )
  }

  return (
    <div className="space-y-2">
      {visible.map((r, i) => {
        const label = TYPE_LABEL[r.report_type] ?? { en: 'Update', es: 'Actualización' }
        const expired = isExpired(r)
        // Stagger the rise-in entrance so the feed feels alive on first paint
        const delayClass = i < 3 ? `cruzar-rise cruzar-rise-delay-${i + 1}` : 'cruzar-rise'
        return (
          <Link key={r.id} href={`/port/${encodeURIComponent(r.port_id)}`}>
            <div className={`${delayClass} bg-white dark:bg-gray-800 rounded-xl border border-gray-200 dark:border-gray-700 p-3 flex items-center gap-3 hover:bg-gray-50 dark:hover:bg-gray-700 transition-colors ${expired ? 'opacity-50' : ''}`}>
              <span className="text-2xl flex-shrink-0 leading-none">{TYPE_EMOJI[r.report_type] ?? '💬'}</span>
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-1.5 flex-wrap">
                  <span className="text-sm font-bold text-gray-800 dark:text-gray-200">
                    {lang === 'es' ? label.es : label.en}
                  </span>
                  {r.wait_minutes !== null && (
                    <span className="text-xs bg-gray-100 dark:bg-gray-700 text-gray-600 dark:text-gray-400 font-bold px-1.5 py-0.5 rounded-full">
                      {r.wait_minutes}m
                    </span>
                  )}
                  {expired && (
                    <span className="text-xs text-gray-400 italic">
                      {lang === 'es' ? 'expirado' : 'expired'}
                    </span>
                  )}
                </div>
                <p className="text-xs text-gray-400 truncate mt-0.5">
                  {r.username ? `@${r.username}` : (lang === 'es' ? 'Anónimo' : 'Anonymous')}
                  {r.description && r.description !== 'Reported via Just Crossed prompt' && ` · ${r.description}`}
                </p>
              </div>
              <div className="flex flex-col items-end gap-1 flex-shrink-0">
                <span className={`text-xs font-medium flex items-center gap-1 ${freshnessColor(r.created_at)}`}>
                  <Clock className="w-3 h-3" />{timeAgoLabel(r.created_at, lang)}
                </span>
                {r.upvotes > 0 && (
                  <span className="text-xs text-gray-400 flex items-center gap-1">
                    <ThumbsUp className="w-3 h-3" />{r.upvotes}
                  </span>
                )}
              </div>
            </div>
          </Link>
        )
      })}

      {expired.length > 0 && !showExpired && (
        <button
          onClick={() => setShowExpired(true)}
          className="w-full text-xs text-gray-400 py-2 hover:text-gray-600 dark:hover:text-gray-300 transition-colors"
        >
          {lang === 'es' ? `Ver ${expired.length} reporte${expired.length > 1 ? 's' : ''} más antiguo${expired.length > 1 ? 's' : ''}` : `Show ${expired.length} older report${expired.length > 1 ? 's' : ''}`}
        </button>
      )}
    </div>
  )
}
