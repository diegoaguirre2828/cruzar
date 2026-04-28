'use client'

import { useEffect, useMemo, useState } from 'react'
import Link from 'next/link'
import { TrendingUp, TrendingDown, BarChart3 } from 'lucide-react'
import { useLang } from '@/lib/LangContext'
import { splitWaitLabel } from '@/lib/formatWait'
import type { PortWaitTime } from '@/types'

// Port detail hero — replaces the stacked-card port detail layout
// with a Border Times-style clean card rail plus our moat features.
//
// Layout:
//   1. Header row: "Last updated X min ago" + "Deep stats →" link
//   2. Lane-type tabs: ALL / READY / SENTRI / COMMERCIAL / WALKING
//      Default is personalized if the user has trusted_traveler_program set
//      Each tab shows its current wait inline when ALL is active
//   3. Big current wait number (for the selected lane)
//   4. Horizontal scrolling card rail (grid on desktop):
//      - USD/MXN exchange rate
//      - BEST hour (from historical rollup)
//      - RUSH hour (from historical rollup)
//      - TODAY'S pattern card (mini chart for this day-of-week)
//      - 5 forward forecast cards: NOW / +1H / +2H / +3H / +4H
//   5. Cross-lane savings hint when ALL is active and SENTRI is
//      meaningfully faster than standard ("SENTRI saves 45 min right now")
//
// Desktop breakpoint: rail becomes a grid at md: (3 cols), wait
// number + lane tabs take the left half, card rail the right half.

type LaneKey = 'all' | 'standard' | 'sentri' | 'ready' | 'commercial' | 'pedestrian'

interface Props {
  port: PortWaitTime
  portId: string
  preferredLane?: string | null
  exchangeRate?: number | null
}

interface ForecastResponse {
  portId: string
  lane: string
  generatedAt: string
  bestHour: { hour: number; avgWait: number } | null
  rushHour: { hour: number; avgWait: number } | null
  todayPattern: Array<{ hour: number; avgWait: number | null; samples: number }>
  forecast: Array<{ hour: number; avgWait: number | null; delta: string }>
  dayOfWeek: number
}

function formatHour(h: number): string {
  const hour12 = h % 12 === 0 ? 12 : h % 12
  const ampm = h < 12 ? 'AM' : 'PM'
  return `${hour12}${ampm}`
}

function formatHourRange(h: number): string {
  return `${formatHour(h)}-${formatHour((h + 1) % 24)}`
}

function minutesAgo(iso: string | null | undefined): number | null {
  if (!iso) return null
  const ms = Date.now() - new Date(iso).getTime()
  if (!Number.isFinite(ms)) return null
  return Math.max(0, Math.round(ms / 60000))
}

// Maps the UI tab key → the API's lane param + the PortWaitTime field
// holding the wait for that lane. The "all" tab maps to 'standard' on
// the API side (that's the main vehicle wait).
const LANE_CONFIG: Record<LaneKey, {
  apiParam: 'standard' | 'sentri' | 'pedestrian' | 'commercial'
  waitField: 'vehicle' | 'sentri' | 'pedestrian' | 'commercial'
  labelEs: string
  labelEn: string
}> = {
  all:        { apiParam: 'standard',   waitField: 'vehicle',    labelEs: 'Todos',    labelEn: 'All' },
  standard:   { apiParam: 'standard',   waitField: 'vehicle',    labelEs: 'General',  labelEn: 'General' },
  ready:      { apiParam: 'standard',   waitField: 'vehicle',    labelEs: 'Ready',    labelEn: 'Ready' },
  sentri:     { apiParam: 'sentri',     waitField: 'sentri',     labelEs: 'SENTRI',   labelEn: 'SENTRI' },
  commercial: { apiParam: 'commercial', waitField: 'commercial', labelEs: 'Carga',    labelEn: 'Freight' },
  pedestrian: { apiParam: 'pedestrian', waitField: 'pedestrian', labelEs: 'A pie',    labelEn: 'Walking' },
}

// User's trusted_traveler_program → preferred default tab
const PREFERRED_TAB: Record<string, LaneKey> = {
  sentri: 'sentri',
  nexus: 'sentri',
  global_entry: 'sentri',
  fast: 'commercial',
  ready: 'ready',
}

export function PortDetailHero({ port, portId, preferredLane, exchangeRate }: Props) {
  const { lang } = useLang()
  const es = lang === 'es'

  // Pick the starting tab based on user's trusted traveler program
  const initialTab: LaneKey = preferredLane && PREFERRED_TAB[preferredLane] ? PREFERRED_TAB[preferredLane] : 'all'
  const [activeTab, setActiveTab] = useState<LaneKey>(initialTab)
  const [forecast, setForecast] = useState<ForecastResponse | null>(null)

  useEffect(() => {
    const laneParam = LANE_CONFIG[activeTab].apiParam
    fetch(`/api/ports/${encodeURIComponent(portId)}/forecast?lane=${laneParam}`)
      .then((r) => (r.ok ? r.json() : null))
      .then((d) => setForecast(d))
      .catch(() => setForecast(null))
  }, [portId, activeTab])

  // ─── Current wait for the selected lane ───────────────────────
  const waitForTab = (tab: LaneKey): number | null => {
    return port[LANE_CONFIG[tab].waitField] as number | null
  }
  const currentWait = waitForTab(activeTab)

  // ─── Cross-lane savings hint (only when ALL is active) ────────
  const savingsHint = useMemo(() => {
    if (activeTab !== 'all') return null
    const car = port.vehicle
    const sentri = port.sentri
    if (car == null || sentri == null) return null
    const saving = car - sentri
    if (saving < 10) return null
    return { lane: 'sentri', saving }
  }, [activeTab, port.vehicle, port.sentri])

  // ─── Last-updated label ───────────────────────────────────────
  const lastUpdatedMin = minutesAgo(port.recordedAt)

  return (
    <div>
      {/* Header: last updated + deep stats link */}
      <div className="flex items-center justify-between mb-3">
        <p className="text-[11px] text-gray-500 dark:text-gray-400">
          {es ? 'Actualizado' : 'Updated'}{' '}
          <span className="font-bold text-gray-700 dark:text-gray-300">
            {lastUpdatedMin == null ? '—' : lastUpdatedMin === 0 ? (es ? 'ahora' : 'just now') : `${lastUpdatedMin} min`}
          </span>
          {lastUpdatedMin != null && ' ' + (es ? 'hace' : 'ago')}
        </p>
        <Link
          href={`/port/${encodeURIComponent(portId)}/advanced`}
          className="flex items-center gap-1 text-[11px] font-bold text-indigo-600 dark:text-indigo-400 hover:underline"
        >
          <BarChart3 className="w-3 h-3" />
          {es ? 'Stats avanzadas' : 'Deep stats'} →
        </Link>
      </div>

      {/* Lane tabs */}
      <div className="flex gap-1.5 overflow-x-auto pb-1 scrollbar-hide mb-3">
        {(Object.keys(LANE_CONFIG) as LaneKey[]).map((tab) => {
          const cfg = LANE_CONFIG[tab]
          const isActive = activeTab === tab
          const wait = tab !== 'all' ? waitForTab(tab) : null
          return (
            <button
              key={tab}
              type="button"
              onClick={() => setActiveTab(tab)}
              className={`flex-shrink-0 flex items-center gap-1.5 text-xs font-bold px-3 py-1.5 rounded-full border transition-colors ${
                isActive
                  ? 'bg-gray-900 dark:bg-gray-100 text-white dark:text-gray-900 border-gray-900 dark:border-gray-100'
                  : 'bg-white dark:bg-gray-800 text-gray-600 dark:text-gray-300 border-gray-200 dark:border-gray-700'
              }`}
            >
              <span>{es ? cfg.labelEs : cfg.labelEn}</span>
              {wait != null && !isActive && (
                <span className={`text-[10px] font-black tabular-nums ${
                  wait <= 10 ? 'text-green-600' : wait <= 30 ? 'text-amber-600' : 'text-red-600'
                }`}>
                  {wait}m
                </span>
              )}
            </button>
          )
        })}
      </div>

      {/* Best-time-today strip — hoisted from the compact rail so it's
          visible above the fold on every port. Matches BorderCross's
          prominent "Best time today" callout without losing our lane
          tabs or big number. */}
      {forecast?.bestHour && (
        <div className="mb-3 flex items-center justify-between gap-2 bg-emerald-50 dark:bg-emerald-900/20 border border-emerald-200 dark:border-emerald-800 rounded-2xl px-4 py-2.5">
          <div className="flex items-center gap-2 min-w-0">
            <TrendingDown className="w-4 h-4 text-emerald-600 dark:text-emerald-400 flex-shrink-0" />
            <p className="text-[10px] font-black uppercase tracking-wider text-emerald-700 dark:text-emerald-300">
              {es ? 'Mejor hora hoy' : 'Best time today'}
            </p>
          </div>
          <p className="text-xs font-black text-emerald-900 dark:text-emerald-100 tabular-nums flex-shrink-0">
            {formatHourRange(forecast.bestHour.hour)} · ~{forecast.bestHour.avgWait} min
          </p>
        </div>
      )}

      {/* Big wait number for selected lane */}
      <div className="bg-gradient-to-br from-blue-600 via-indigo-700 to-purple-800 rounded-2xl px-4 py-3 shadow-xl text-white mb-3 relative overflow-hidden">
        {/* Ambient glow — fills the dead space with depth without adding
            another hard UI element. Pure CSS, no render cost. */}
        <div className="absolute -top-10 -right-10 w-44 h-44 bg-white/10 rounded-full blur-3xl pointer-events-none" />
        <div className="absolute -bottom-16 -left-8 w-36 h-36 bg-pink-300/10 rounded-full blur-3xl pointer-events-none" />

        <div className="relative">
          <div className="flex items-center gap-2">
            {/* LIVE pulse dot — the animation Diego asked for. Uses the
                same ping+static pattern as HeroLiveDelta on home. Signals
                that the number is live, not a stale cached value. */}
            <span className="relative flex h-2 w-2">
              <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-white opacity-75" />
              <span className="relative inline-flex rounded-full h-2 w-2 bg-white" />
            </span>
            <p className="text-[10px] font-black uppercase tracking-widest text-blue-100">
              {es ? LANE_CONFIG[activeTab].labelEs : LANE_CONFIG[activeTab].labelEn} · {es ? 'ahora' : 'now'}
            </p>
          </div>

          {currentWait == null ? (
            <div className="mt-2">
              <p className="text-2xl font-black leading-tight">
                {es ? 'CBP no publicó este carril' : 'CBP didn\u2019t publish this lane'}
              </p>
              <p className="text-[11px] text-blue-100/80 mt-1">
                {es
                  ? 'Reportes de la comunidad abajo · próxima actualización en 15 min'
                  : 'Community reports below · next update in 15 min'}
              </p>
            </div>
          ) : (
            <>
              <div className="mt-1 flex items-baseline justify-between gap-3">
                <div className="flex items-baseline gap-2 min-w-0">
                  {(() => {
                    const split = splitWaitLabel(currentWait)
                    return (
                      <>
                        <span className="text-6xl font-black leading-none tabular-nums drop-shadow">
                          {split.value}
                        </span>
                        <span className="text-xl font-bold text-blue-100">{split.unit}</span>
                      </>
                    )
                  })()}
                </div>
                <div className="text-right flex-shrink-0">
                  <p className="text-[10px] font-bold text-blue-200/70">
                    {port.source === 'community' ? (es ? 'Reporte' : 'Report')
                      : port.source === 'traffic' ? 'Traffic API'
                      : 'CBP'}
                  </p>
                  {lastUpdatedMin != null && lastUpdatedMin > 0 && (
                    <p className="text-[9px] text-blue-200/50">
                      {lastUpdatedMin} min {es ? 'hace' : 'ago'}
                    </p>
                  )}
                </div>
              </div>

              {/* Info strip — fills the former dead space with real signal.
                  Three chips, hidden when their data is null so we never
                  show empty placeholders. Each chip is actionable:
                    - lanes open count (operational density)
                    - trend arrow vs +1H forecast ("is this getting worse?")
                    - best-hour nudge ("cross later if you can")
                  Renders in order of certainty: open-lanes first (CBP), then
                  trend (forecast model), then best-hour suggestion. */}
              {(() => {
                // Lane count from CBP — most reliable signal.
                const lanesField = activeTab === 'all' || activeTab === 'standard' || activeTab === 'ready'
                  ? port.vehicleLanesOpen
                  : activeTab === 'sentri'
                    ? port.sentriLanesOpen
                    : activeTab === 'pedestrian'
                      ? port.pedestrianLanesOpen
                      : activeTab === 'commercial'
                        ? port.commercialLanesOpen
                        : null
                // Trend vs +1H forecast. forecast[0] is NOW, forecast[1] is +1H.
                const nextHour = forecast?.forecast?.[1]?.avgWait ?? null
                const delta = nextHour != null ? Math.round(nextHour - currentWait) : null
                const trendArrow = delta == null ? null
                  : delta >= 10 ? '↑'
                  : delta <= -10 ? '↓'
                  : '→'
                const trendTone = delta == null ? null
                  : delta >= 10 ? 'text-red-100'
                  : delta <= -10 ? 'text-emerald-100'
                  : 'text-blue-100'
                // Best-hour suggestion (only if meaningfully better than now)
                const bestHour = forecast?.bestHour
                const bestBetter = bestHour != null && bestHour.avgWait < currentWait - 15

                const chips: React.ReactNode[] = []
                if (typeof lanesField === 'number' && lanesField > 0) {
                  chips.push(
                    <span key="lanes" className="inline-flex items-center gap-1 bg-white/15 backdrop-blur-sm rounded-full px-2.5 py-0.5 text-[10px] font-bold text-white">
                      <span aria-hidden="true">🚦</span>
                      {es
                        ? `${lanesField} ${lanesField === 1 ? 'carril abierto' : 'carriles abiertos'}`
                        : `${lanesField} ${lanesField === 1 ? 'lane open' : 'lanes open'}`}
                    </span>
                  )
                }
                if (trendArrow && delta != null) {
                  chips.push(
                    <span key="trend" className={`inline-flex items-center gap-1 bg-white/15 backdrop-blur-sm rounded-full px-2.5 py-0.5 text-[10px] font-bold ${trendTone}`}>
                      <span aria-hidden="true">{trendArrow}</span>
                      {delta === 0
                        ? (es ? 'estable en 1h' : 'steady in 1h')
                        : (es
                          ? `${delta > 0 ? '+' : ''}${delta} min en 1h`
                          : `${delta > 0 ? '+' : ''}${delta} min in 1h`)}
                    </span>
                  )
                }
                if (bestBetter && bestHour) {
                  chips.push(
                    <span key="best" className="inline-flex items-center gap-1 bg-emerald-400/25 backdrop-blur-sm rounded-full px-2.5 py-0.5 text-[10px] font-bold text-emerald-50">
                      <span aria-hidden="true">🕒</span>
                      {es
                        ? `mejor a las ${formatHour(bestHour.hour)} (~${bestHour.avgWait}m)`
                        : `best at ${formatHour(bestHour.hour)} (~${bestHour.avgWait}m)`}
                    </span>
                  )
                }

                if (chips.length === 0) return null
                return (
                  <div className="mt-2 flex flex-wrap items-center gap-1.5">
                    {chips}
                  </div>
                )
              })()}
            </>
          )}
        </div>
      </div>

      {/* Cross-lane savings hint */}
      {savingsHint && (
        <Link
          href={`#sentri-tab`}
          onClick={(e) => { e.preventDefault(); setActiveTab('sentri') }}
          className="block mb-3 bg-emerald-50 dark:bg-emerald-900/20 border border-emerald-200 dark:border-emerald-800 rounded-2xl px-4 py-3 active:scale-[0.98] transition-transform"
        >
          <div className="flex items-center justify-between gap-2">
            <div className="min-w-0">
              <p className="text-[10px] font-black uppercase tracking-wider text-emerald-700 dark:text-emerald-300">
                {es ? 'SENTRI ahorra tiempo ahorita' : 'SENTRI saves time right now'}
              </p>
              <p className="text-sm font-black text-gray-900 dark:text-gray-100 mt-0.5">
                {es ? `Ahorras ${savingsHint.saving} min con SENTRI` : `Save ${savingsHint.saving} min with SENTRI`}
              </p>
            </div>
            <span className="flex-shrink-0 text-emerald-700 dark:text-emerald-300">→</span>
          </div>
        </Link>
      )}

      {/* All Lanes — scannable comparison table. Every lane CBP publishes
          for this crossing, side-by-side, so a commuter can see Standard
          vs SENTRI vs Ready without tapping tabs. Matches BorderCross's
          "All Lanes" detail table. Cruzar's moat over them: the community
          X-ray tag that can surface on any row when a recent report flags
          that lane as the X-ray lane today. See project_cruzar_lane_details
          for the full moat rationale. */}
      <AllLanesTable port={port} es={es} activeTab={activeTab} onPickLane={setActiveTab} />

      {/* CONTEXT rail — whole-day stats: exchange rate, best/rush hours,
          today's pattern chart. Variable count (exchange is conditional)
          so flex-wrap lets cards size naturally without leaving empty
          grid cells when one is missing. Mobile stays a horizontal
          scroll rail — same as forecast row below. */}
      <div className="flex gap-2 overflow-x-auto pb-2 scrollbar-hide -mx-4 px-4 md:flex-wrap md:mx-0 md:px-0 md:overflow-visible">
        {/* Exchange rate card */}
        {exchangeRate != null && (
          <CompactCard>
            <p className="text-[9px] font-black uppercase tracking-widest text-gray-400">$1 USD</p>
            <p className="text-lg font-black text-emerald-600 dark:text-emerald-400 tabular-nums mt-1">
              ${exchangeRate.toFixed(2)}
            </p>
            <p className="text-[9px] font-bold text-gray-400">MXN</p>
          </CompactCard>
        )}

        {/* Best hour */}
        {forecast?.bestHour && (
          <CompactCard accent="green">
            <div className="flex items-center gap-1 mb-1">
              <TrendingDown className="w-3 h-3 text-green-600" />
              <p className="text-[9px] font-black uppercase tracking-widest text-green-700 dark:text-green-400">
                {es ? 'Mejor hora' : 'Best'}
              </p>
            </div>
            <p className="text-sm font-black text-gray-900 dark:text-gray-100 leading-tight">
              {formatHourRange(forecast.bestHour.hour)}
            </p>
            <p className="text-[10px] font-bold text-green-700 dark:text-green-400 tabular-nums">
              ~{forecast.bestHour.avgWait} min
            </p>
          </CompactCard>
        )}

        {/* Rush hour */}
        {forecast?.rushHour && (
          <CompactCard accent="red">
            <div className="flex items-center gap-1 mb-1">
              <TrendingUp className="w-3 h-3 text-red-600" />
              <p className="text-[9px] font-black uppercase tracking-widest text-red-700 dark:text-red-400">
                {es ? 'Hora pico' : 'Rush'}
              </p>
            </div>
            <p className="text-sm font-black text-gray-900 dark:text-gray-100 leading-tight">
              {formatHourRange(forecast.rushHour.hour)}
            </p>
            <p className="text-[10px] font-bold text-red-700 dark:text-red-400 tabular-nums">
              ~{forecast.rushHour.avgWait} min
            </p>
          </CompactCard>
        )}

        {/* Today's pattern (mini chart) — clickable, links to deep stats */}
        {forecast && forecast.todayPattern.some((h) => h.avgWait != null) && (
          <Link
            href={`/port/${encodeURIComponent(portId)}/advanced`}
            className="flex-shrink-0 w-44 md:w-auto md:min-w-[180px] bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-2xl p-3 active:scale-[0.97] transition-transform"
          >
            <div className="flex items-center justify-between mb-1.5">
              <p className="text-[9px] font-black uppercase tracking-widest text-gray-500">
                {es ? 'Este' : 'This'} {es ? dayNameEs(forecast.dayOfWeek) : dayNameEn(forecast.dayOfWeek)}
              </p>
              <span className="text-[8px] font-bold text-indigo-500">→</span>
            </div>
            <div className="flex items-end gap-[1px]" style={{ height: 40 }}>
              {forecast.todayPattern.map((h) => {
                const max = Math.max(...forecast.todayPattern.map((hh) => hh.avgWait ?? 0), 1)
                const heightPx = Math.max(3, Math.round((((h.avgWait ?? 0) as number) / max) * 36))
                const color = h.avgWait == null ? 'bg-gray-200 dark:bg-gray-700'
                  : (h.avgWait as number) <= 20 ? 'bg-green-400'
                  : (h.avgWait as number) <= 45 ? 'bg-amber-400'
                  : 'bg-red-400'
                return (
                  <div
                    key={h.hour}
                    className={`flex-1 ${color} rounded-t`}
                    style={{ height: heightPx }}
                    title={`${formatHour(h.hour)}: ${h.avgWait == null ? '—' : h.avgWait + 'm'}`}
                  />
                )
              })}
            </div>
            <div className="flex justify-between mt-1">
              <span className="text-[7px] text-gray-400">6AM</span>
              <span className="text-[7px] text-gray-400">12PM</span>
              <span className="text-[7px] text-gray-400">6PM</span>
            </div>
          </Link>
        )}
      </div>

      {/* FORECAST section — header label + 5-card row. Separated from
          the context rail above so the "Based on past trends" caption
          doesn't occupy a grid cell, and the 5 forward-time cards form
          their own clean row. Always-5 count maps cleanly to grid-cols-5
          on desktop without ever leaving an empty cell. */}
      {forecast?.forecast.some((f) => f.avgWait != null) && (
        <>
          <div className="mt-3 mb-2 flex items-center gap-2">
            <p className="text-[9px] font-black uppercase tracking-widest text-gray-500 dark:text-gray-400">
              {es ? 'Pronóstico · según historial' : 'Forecast · based on past trends'}
            </p>
            <div className="h-px flex-1 bg-gray-200 dark:bg-gray-700" />
          </div>
          <div className="flex gap-2 overflow-x-auto pb-2 scrollbar-hide -mx-4 px-4 md:grid md:grid-cols-5 md:gap-2 md:mx-0 md:px-0 md:overflow-visible">
            {forecast.forecast.map((f) => (
              <CompactCard
                key={f.delta}
                accent={f.avgWait == null ? 'gray' : f.avgWait <= 20 ? 'green' : f.avgWait <= 45 ? 'amber' : 'red'}
              >
                <p className="text-[9px] font-black uppercase tracking-widest text-gray-500 dark:text-gray-400">
                  {f.delta === 'NOW'
                    ? (es ? 'Ahora' : 'Now')
                    : es
                      ? `en ${f.delta.replace('+', '').replace('H', ' hr')}`
                      : `in ${f.delta.replace('+', '').replace('H', ' hr')}`}
                </p>
                <p className="text-sm font-black text-gray-900 dark:text-gray-100 leading-tight mt-0.5">
                  {formatHour(f.hour)}
                </p>
                {f.avgWait != null ? (
                  <p className={`text-[10px] font-bold tabular-nums ${
                    f.avgWait <= 20 ? 'text-green-700 dark:text-green-400'
                      : f.avgWait <= 45 ? 'text-amber-700 dark:text-amber-400'
                      : 'text-red-700 dark:text-red-400'
                  }`}>
                    ~{f.avgWait} min
                  </p>
                ) : (
                  <p className="text-[10px] font-bold text-gray-400">—</p>
                )}
              </CompactCard>
            ))}
          </div>
        </>
      )}
    </div>
  )
}

function CompactCard({
  children,
  accent = 'default',
}: {
  children: React.ReactNode
  accent?: 'default' | 'green' | 'red' | 'amber' | 'gray'
}) {
  const borderClass =
    accent === 'green' ? 'border-green-200 dark:border-green-800 bg-green-50 dark:bg-green-900/10'
      : accent === 'red' ? 'border-red-200 dark:border-red-800 bg-red-50 dark:bg-red-900/10'
      : accent === 'amber' ? 'border-amber-200 dark:border-amber-800 bg-amber-50 dark:bg-amber-900/10'
      : accent === 'gray' ? 'border-gray-200 dark:border-gray-700 bg-gray-50 dark:bg-gray-800'
      : 'border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-800'
  return (
    <div className={`flex-shrink-0 w-24 md:w-auto border rounded-2xl p-3 ${borderClass}`}>
      {children}
    </div>
  )
}

function dayNameEs(dow: number): string {
  return ['domingo', 'lunes', 'martes', 'miércoles', 'jueves', 'viernes', 'sábado'][dow] || ''
}
function dayNameEn(dow: number): string {
  return ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'][dow] || ''
}

interface AllLanesRow {
  key: LaneKey
  iconEmoji: string
  labelEs: string
  labelEn: string
  wait: number | null
  lanesOpen: number | null
  closed: boolean
}

function AllLanesTable({
  port,
  es,
  activeTab,
  onPickLane,
}: {
  port: PortWaitTime
  es: boolean
  activeTab: LaneKey
  onPickLane: (lane: LaneKey) => void
}) {
  const rows: AllLanesRow[] = [
    {
      key: 'standard',
      iconEmoji: '🚗',
      labelEs: 'General',
      labelEn: 'Standard',
      wait: port.vehicle,
      lanesOpen: port.vehicleLanesOpen,
      closed: port.vehicleClosed,
    },
    {
      key: 'sentri',
      iconEmoji: '⚡',
      labelEs: 'SENTRI / NEXUS',
      labelEn: 'SENTRI / NEXUS',
      wait: port.sentri,
      lanesOpen: port.sentriLanesOpen,
      closed: false,
    },
    {
      key: 'pedestrian',
      iconEmoji: '🚶',
      labelEs: 'A pie',
      labelEn: 'Pedestrian',
      wait: port.pedestrian,
      lanesOpen: port.pedestrianLanesOpen,
      closed: port.pedestrianClosed,
    },
    {
      key: 'commercial',
      iconEmoji: '🚛',
      labelEs: 'Carga',
      labelEn: 'Commercial',
      wait: port.commercial,
      lanesOpen: port.commercialLanesOpen,
      closed: port.commercialClosed,
    },
  ]

  // Hide rows with nothing to show at all (null + not closed).
  const visibleRows = rows.filter((r) => r.wait != null || r.closed || (r.lanesOpen != null && r.lanesOpen > 0))

  if (visibleRows.length <= 1) return null

  // Find the fastest open lane so we can tag it with a green "fastest" chip.
  const openWaits = visibleRows.filter((r) => !r.closed && r.wait != null) as (AllLanesRow & { wait: number })[]
  const fastest = openWaits.length > 1 ? openWaits.reduce((a, b) => (b.wait < a.wait ? b : a)) : null

  return (
    <div className="mb-3 bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-2xl overflow-hidden">
      <div className="px-4 py-2.5 border-b border-gray-200 dark:border-gray-700 flex items-center justify-between">
        <p className="text-[10px] font-black uppercase tracking-widest text-gray-500 dark:text-gray-400">
          {es ? 'Todos los carriles' : 'All Lanes'}
        </p>
        <p className="text-[10px] text-gray-400 dark:text-gray-500">
          {es ? 'Según CBP' : 'Per CBP'}
        </p>
      </div>
      <ul className="divide-y divide-gray-100 dark:divide-gray-700">
        {visibleRows.map((r) => {
          const isActive = activeTab === r.key || (activeTab === 'all' && r.key === 'standard')
          const isFastest = fastest?.key === r.key
          const waitColor =
            r.closed ? 'text-gray-400 dark:text-gray-500'
              : r.wait == null ? 'text-gray-400 dark:text-gray-500'
              : r.wait <= 15 ? 'text-emerald-600 dark:text-emerald-400'
              : r.wait <= 30 ? 'text-lime-600 dark:text-lime-400'
              : r.wait <= 60 ? 'text-amber-600 dark:text-amber-400'
              : 'text-red-600 dark:text-red-400'
          const waitDisplay =
            r.closed ? (es ? 'Cerrado' : 'Closed')
              : r.wait == null ? '—'
              : r.wait === 0 ? (es ? '<1 min' : '<1 min')
              : `${r.wait} min`
          return (
            <li key={r.key}>
              <button
                type="button"
                onClick={() => onPickLane(r.key)}
                className={`w-full flex items-center justify-between gap-3 px-4 py-3 text-left transition-colors ${
                  isActive ? 'bg-indigo-50 dark:bg-indigo-900/20' : 'hover:bg-gray-50 dark:hover:bg-gray-700/40'
                }`}
              >
                <div className="flex items-center gap-3 min-w-0">
                  <span className="text-lg flex-shrink-0">{r.iconEmoji}</span>
                  <div className="min-w-0">
                    <p className="text-sm font-bold text-gray-900 dark:text-gray-100 truncate">
                      {es ? r.labelEs : r.labelEn}
                    </p>
                    <p className="text-[11px] text-gray-500 dark:text-gray-400">
                      {r.closed
                        ? (es ? 'Carril cerrado ahora' : 'Lane closed now')
                        : r.lanesOpen != null && r.lanesOpen > 0
                          ? (es
                              ? `${r.lanesOpen} ${r.lanesOpen === 1 ? 'carril abierto' : 'carriles abiertos'}`
                              : `${r.lanesOpen} ${r.lanesOpen === 1 ? 'lane open' : 'lanes open'}`)
                          : (es ? 'Sin datos de carriles' : 'No lane count')}
                    </p>
                  </div>
                </div>
                <div className="flex items-center gap-2 flex-shrink-0">
                  {isFastest && !r.closed && (
                    <span className="text-[9px] font-black uppercase tracking-wider text-emerald-700 dark:text-emerald-400 bg-emerald-100 dark:bg-emerald-900/40 px-1.5 py-0.5 rounded">
                      {es ? 'Más rápido' : 'Fastest'}
                    </span>
                  )}
                  <span className={`text-sm font-black tabular-nums ${waitColor}`}>
                    {waitDisplay}
                  </span>
                </div>
              </button>
            </li>
          )
        })}
      </ul>
    </div>
  )
}

