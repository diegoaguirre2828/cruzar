'use client'

import { useState, useEffect } from 'react'
import { AlertTriangle, CheckCircle, Truck, ShieldAlert, HelpCircle, Clock, ThumbsUp } from 'lucide-react'
import { useAuth } from '@/lib/useAuth'
import { useLang } from '@/lib/LangContext'

const TYPE_CONFIG: Record<string, { label: string; labelEs: string; icon: typeof AlertTriangle; color: string; bg: string }> = {
  delay:      { label: 'Long Delay',   labelEs: 'Demora larga',  icon: AlertTriangle, color: 'text-yellow-600', bg: 'bg-yellow-50 dark:bg-yellow-900/20' },
  inspection: { label: 'Inspection',   labelEs: 'Inspección',    icon: ShieldAlert,   color: 'text-blue-600',   bg: 'bg-blue-50 dark:bg-blue-900/20' },
  accident:   { label: 'Accident',     labelEs: 'Accidente',     icon: Truck,         color: 'text-red-600',    bg: 'bg-red-50 dark:bg-red-900/20' },
  clear:      { label: 'Moving Fast',  labelEs: 'Fluye rápido',  icon: CheckCircle,   color: 'text-green-600',  bg: 'bg-green-50 dark:bg-green-900/20' },
  other:      { label: 'Update',       labelEs: 'Actualización', icon: HelpCircle,    color: 'text-gray-500',   bg: 'bg-gray-50 dark:bg-gray-800' },
}

interface LaneInfo {
  lanes_open?: number | null
  lanes_xray?: number | null
  slow_lane?: 'con_rayos' | 'sin_rayos' | 'sentri' | 'parejo' | null
}

interface SourceMeta {
  lane_type?: string
  lane_info?: LaneInfo
  extra_tags?: string[]
}

// Mini metadata for rendering extra tag chips — keep in sync with
// REPORT_TYPES in ReportForm. Pruned to label+emoji only.
const EXTRA_TAG_META: Record<string, { emoji: string; es: string; en: string }> = {
  delay:              { emoji: '🔴', es: 'Espera larga',     en: 'Long wait' },
  clear:              { emoji: '🟢', es: 'Fluye rápido',     en: 'Moving fast' },
  accident:           { emoji: '💥', es: 'Accidente',        en: 'Accident' },
  inspection:         { emoji: '🔵', es: 'Inspección',       en: 'Inspection' },
  weather_fog:        { emoji: '🌫️', es: 'Neblina',          en: 'Fog' },
  weather_rain:       { emoji: '🌧️', es: 'Lluvia',           en: 'Rain' },
  weather_wind:       { emoji: '💨', es: 'Viento',           en: 'Wind' },
  weather_dust:       { emoji: '🟤', es: 'Tolvanera',        en: 'Dust' },
  officer_k9:         { emoji: '🐕', es: 'K9',               en: 'K9' },
  officer_secondary:  { emoji: '🚔', es: 'Revisiones extra', en: 'Extra checks' },
  road_construction:  { emoji: '🚧', es: 'Construcción',     en: 'Construction' },
  road_hazard:        { emoji: '⚠️', es: 'Peligro',          en: 'Hazard' },
  reckless_driver:    { emoji: '😤', es: 'Conductor loco',   en: 'Reckless' },
  other:              { emoji: '💬', es: 'Otro',             en: 'Other' },
}

interface Report {
  id: string
  report_type: string
  description: string | null
  severity: string
  upvotes: number
  created_at: string
  wait_minutes: number | null
  username: string | null
  source_meta?: SourceMeta | null
  reporter_tier?: 'guest' | 'free' | 'pro' | 'business' | null
}

const SLOW_LANE_LABEL: Record<string, { es: string; en: string }> = {
  con_rayos: { es: 'Las con rayos X están más lentas', en: 'X-ray lanes are slower' },
  sin_rayos: { es: 'La sin rayos X está más lenta',    en: 'No-X-ray lane is slower' },
  sentri:    { es: 'SENTRI está más lenta',            en: 'SENTRI is slower' },
  parejo:    { es: 'Todas las filas parejas',          en: 'All lanes similar' },
}

interface Props {
  portId: string
  refresh: number
}

function timeAgo(iso: string, es: boolean): string {
  const mins = Math.round((Date.now() - new Date(iso).getTime()) / 60000)
  if (mins < 1) return es ? 'ahorita' : 'just now'
  if (mins < 60) return es ? `hace ${mins}m` : `${mins}m ago`
  return es ? `hace ${Math.round(mins / 60)}h` : `${Math.round(mins / 60)}h ago`
}

export function ReportsFeed({ portId, refresh }: Props) {
  const { user } = useAuth()
  const { lang } = useLang()
  const es = lang === 'es'
  const [reports, setReports] = useState<Report[]>([])
  const [loading, setLoading] = useState(true)
  const [upvoted, setUpvoted] = useState<Set<string>>(new Set())
  const [upvoting, setUpvoting] = useState<string | null>(null)

  useEffect(() => {
    setLoading(true)
    fetch(`/api/reports?portId=${encodeURIComponent(portId)}`)
      .then(r => r.json())
      .then(d => setReports(d.reports || []))
      .finally(() => setLoading(false))
  }, [portId, refresh])

  // Hydrate `upvoted` Set from server so the thumbs-up button reflects
  // prior-session state. Without this, every session started with an
  // empty Set — clicking a previously-upvoted report toggled it OFF
  // and the count went down, which looked like "thumbs-up is broken."
  useEffect(() => {
    if (!user) { setUpvoted(new Set()); return }
    let cancelled = false
    fetch(`/api/reports/my-upvotes?portId=${encodeURIComponent(portId)}`, { credentials: 'include' })
      .then(r => r.ok ? r.json() : { upvoted: [] })
      .then((d: { upvoted: string[] }) => {
        if (cancelled) return
        setUpvoted(new Set(d.upvoted || []))
      })
      .catch(() => { if (!cancelled) setUpvoted(new Set()) })
    return () => { cancelled = true }
  }, [user, portId, refresh])

  async function handleUpvote(reportId: string) {
    if (!user || upvoting) return
    setUpvoting(reportId)
    const res = await fetch('/api/reports/upvote', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ reportId }),
    })
    if (res.ok) {
      const { upvoted: nowUpvoted } = await res.json()
      setUpvoted(prev => {
        const next = new Set(prev)
        if (nowUpvoted) next.add(reportId)
        else next.delete(reportId)
        return next
      })
      setReports(prev => prev.map(r => r.id === reportId
        ? { ...r, upvotes: r.upvotes + (nowUpvoted ? 1 : -1) }
        : r
      ))
    }
    setUpvoting(null)
  }

  if (loading) return <div className="h-16 bg-gray-100 dark:bg-gray-800 rounded-xl animate-pulse" />

  if (reports.length === 0) {
    return (
      <div className="text-center py-4">
        <p className="text-xs text-gray-400">
          {es ? 'Sin reportes en las últimas 24 horas.' : 'No reports in the last 24 hours.'}
        </p>
      </div>
    )
  }

  return (
    <div className="space-y-2">
      {reports.map(r => {
        const config = TYPE_CONFIG[r.report_type] ?? TYPE_CONFIG.other
        const Icon = config.icon
        const hasUpvoted = upvoted.has(r.id)

        return (
          <div key={r.id} className={`rounded-xl p-3 ${config.bg}`}>
            <div className="flex items-start gap-2.5">
              <Icon className={`w-4 h-4 mt-0.5 flex-shrink-0 ${config.color}`} />
              <div className="flex-1 min-w-0">
                <div className="flex items-center justify-between gap-2">
                  <div className="flex items-center gap-2 flex-wrap">
                    <span className={`text-xs font-semibold ${config.color}`}>
                      {es ? config.labelEs : config.label}
                    </span>
                    {r.wait_minutes !== null && (
                      <span className="text-xs bg-white dark:bg-gray-700 text-gray-700 dark:text-gray-300 font-bold px-2 py-0.5 rounded-full border border-gray-200 dark:border-gray-600">
                        {r.wait_minutes} min {es ? 'actual' : 'actual'}
                      </span>
                    )}
                  </div>
                  <div className="flex items-center gap-1 text-xs text-gray-400 flex-shrink-0">
                    <Clock className="w-3 h-3" />{timeAgo(r.created_at, es)}
                  </div>
                </div>

                {r.description && r.description !== 'Reported via Just Crossed prompt' && (
                  <p className="text-xs text-gray-600 dark:text-gray-400 mt-0.5">{r.description}</p>
                )}

                {/* Extra facets — when the reporter combined multiple
                    tags in one submission (e.g. "moving fast" + rain +
                    K9), the primary shows as the header and the rest
                    render here as chips. */}
                {r.source_meta?.extra_tags && r.source_meta.extra_tags.length > 0 && (
                  <div className="mt-1 flex flex-wrap gap-1">
                    {r.source_meta.extra_tags.map(tag => {
                      const meta = EXTRA_TAG_META[tag]
                      if (!meta) return null
                      return (
                        <span
                          key={tag}
                          className="inline-flex items-center gap-0.5 text-[10px] font-semibold bg-white/70 dark:bg-gray-900/40 text-gray-600 dark:text-gray-300 border border-gray-200 dark:border-gray-700 px-1.5 py-0.5 rounded-full"
                        >
                          <span className="text-xs leading-none">{meta.emoji}</span>
                          {es ? meta.es : meta.en}
                        </span>
                      )
                    })}
                  </div>
                )}

                {/* Lane-level detail — the moat feature. Community reports
                    capture what CBP can't: how many lanes are open, how
                    many have X-ray, which lane is slower. Feature origin:
                    Enrique Rodriguez's FB comment on 2026-04-13. */}
                {r.source_meta?.lane_info && (() => {
                  const li = r.source_meta!.lane_info!
                  const parts: string[] = []
                  if (li.lanes_open != null) {
                    if (es) {
                      parts.push(`${li.lanes_open} ${li.lanes_open === 1 ? 'fila abierta' : 'filas abiertas'}`)
                    } else {
                      parts.push(`${li.lanes_open} ${li.lanes_open === 1 ? 'lane open' : 'lanes open'}`)
                    }
                  }
                  if (li.lanes_xray != null && li.lanes_open != null && li.lanes_open > 0) {
                    const noXray = li.lanes_open - li.lanes_xray
                    if (es) {
                      parts.push(`${li.lanes_xray} con rayos · ${noXray} sin rayos`)
                    } else {
                      parts.push(`${li.lanes_xray} X-ray · ${noXray} no X-ray`)
                    }
                  } else if (li.lanes_xray != null) {
                    parts.push(`${li.lanes_xray} ${es ? 'con rayos X' : 'X-ray lanes'}`)
                  }
                  const slowLabel = li.slow_lane ? SLOW_LANE_LABEL[li.slow_lane] : null
                  const defaultLaneTitle = es ? 'Detalles de la fila' : 'Lane details'
                  return (
                    <div className="mt-1.5 bg-white/70 dark:bg-gray-900/40 border border-amber-200 dark:border-amber-700/50 rounded-lg px-2 py-1.5">
                      <p className="text-[10px] font-black uppercase tracking-wider text-amber-700 dark:text-amber-400 leading-none">
                        🛣️ {parts.join(' · ') || defaultLaneTitle}
                      </p>
                      {slowLabel && (
                        <p className="text-[11px] text-amber-800 dark:text-amber-300 font-semibold mt-0.5 leading-snug">
                          {es ? slowLabel.es : slowLabel.en}
                        </p>
                      )}
                    </div>
                  )
                })()}

                <div className="flex items-center justify-between mt-1.5">
                  <span className="text-xs text-gray-400 flex items-center gap-1">
                    {r.username ? `@${r.username}` : (es ? 'Anónimo' : 'Anonymous')}
                    {(r.reporter_tier === 'pro' || r.reporter_tier === 'business') && (
                      <span
                        className="inline-flex items-center gap-0.5 bg-gradient-to-br from-amber-400 to-orange-500 text-white text-[9px] font-black px-1.5 py-0.5 rounded-full leading-none"
                        title={es ? 'Reportero Pro verificado' : 'Verified Pro reporter'}
                      >
                        ✓ PRO
                      </span>
                    )}
                  </span>
                  <button
                    onClick={() => handleUpvote(r.id)}
                    disabled={!user || upvoting === r.id}
                    className={`flex items-center gap-1 text-xs px-2 py-0.5 rounded-full transition-colors ${
                      hasUpvoted
                        ? 'bg-blue-100 dark:bg-blue-900/40 text-blue-600 dark:text-blue-400'
                        : 'text-gray-400 hover:text-blue-500 hover:bg-blue-50 dark:hover:bg-blue-900/20'
                    } ${!user ? 'cursor-default' : 'cursor-pointer'}`}
                    title={!user ? (es ? 'Inicia sesión pa\' dar upvote' : 'Sign in to upvote') : ''}
                  >
                    <ThumbsUp className="w-3 h-3" />
                    <span>{r.upvotes || 0}</span>
                  </button>
                </div>
              </div>
            </div>
          </div>
        )
      })}
    </div>
  )
}
