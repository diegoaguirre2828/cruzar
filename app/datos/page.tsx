'use client'

import { useEffect, useState, useMemo, Suspense } from 'react'
import Link from 'next/link'
import { useSearchParams } from 'next/navigation'
import { useLang } from '@/lib/LangContext'
import { useTier } from '@/lib/useTier'
import { usePorts } from '@/lib/usePorts'
import { getPortMeta } from '@/lib/portMeta'
import { formatWaitLabel } from '@/lib/formatWait'
import { PortSearch } from '@/components/PortSearch'
import type { PortWaitTime } from '@/types'

// Analytics tab. Pro-gated. Houses everything we used to stack on
// the home page for every user: hourly patterns, peak-vs-best hour,
// weather-aware predictions. Free users see a preview + upgrade wall.
// Pro users get the full analytics hub.
//
// MVP content: port picker + hourly chart for the chosen bridge,
// with peak/best/now callouts and the current cadence disclosure.
// Future: weather correlation, multi-bridge compare, export.

interface HourlyResponse {
  peak: { hour: number; avgWait: number } | null
  best: { hour: number; avgWait: number } | null
  hours: Array<{ hour: number; avgWait: number | null }>
}

function formatHour(h: number): string {
  return `${h.toString().padStart(2, '0')}:00`
}

function DatosPageInner() {
  const { lang } = useLang()
  const { tier } = useTier()
  const searchParams = useSearchParams()
  const es = lang === 'es'
  const isPro = tier === 'pro' || tier === 'business'

  const { ports: allPorts, loading: portsLoading } = usePorts()
  const ports = useMemo(
    () => allPorts.filter((p: PortWaitTime) => !p.isClosed && p.vehicle != null),
    [allPorts],
  )
  const [selectedPortId, setSelectedPortId] = useState<string | null>(null)
  const [hourly, setHourly] = useState<HourlyResponse | null>(null)
  const loading = portsLoading

  useEffect(() => {
    try { localStorage.setItem('cruzar_datos_visited', '1') } catch { /* ignore */ }
  }, [])

  useEffect(() => {
    if (ports.length > 0 && !selectedPortId) {
      const portFromQuery = searchParams?.get('port')
      const preferred = portFromQuery && ports.find((p) => p.portId === portFromQuery)
        ? portFromQuery
        : ports[0].portId
      setSelectedPortId(preferred)
    }
  }, [ports, selectedPortId, searchParams])

  useEffect(() => {
    if (!selectedPortId || !isPro) return
    const controller = new AbortController()
    const timer = setTimeout(() => controller.abort(), 8000)
    fetch(`/api/ports/${encodeURIComponent(selectedPortId)}/hourly`, { signal: controller.signal })
      .then((r) => r.json())
      .then((d) => {
        // API may return { error: ... } on a 500 — treat as empty so the
        // skeleton chart still renders instead of disappearing the block.
        if (d && Array.isArray(d.hours)) {
          setHourly(d)
        } else {
          setHourly({ peak: null, best: null, hours: Array.from({ length: 24 }, (_, h) => ({ hour: h, avgWait: null })) })
        }
      })
      .catch(() => setHourly({ peak: null, best: null, hours: Array.from({ length: 24 }, (_, h) => ({ hour: h, avgWait: null })) }))
      .finally(() => clearTimeout(timer))
    return () => { controller.abort(); clearTimeout(timer) }
  }, [selectedPortId, isPro])

  const selectedPort = useMemo(
    () => ports.find((p) => p.portId === selectedPortId),
    [ports, selectedPortId],
  )
  const selectedName = selectedPort
    ? (selectedPort.localNameOverride || getPortMeta(selectedPort.portId).localName || selectedPort.portName)
    : ''

  return (
    <main className="min-h-screen bg-gray-50 dark:bg-gray-950">
      <div className="max-w-lg mx-auto px-4 pb-24">
        <div className="pt-6 pb-2">
          <div className="flex items-center gap-2">
            <h1 className="text-xl font-black text-gray-900 dark:text-gray-100">
              📊 {es ? 'Datos del puente' : 'Border insights'}
            </h1>
            <span className="text-[10px] font-black text-white bg-gradient-to-br from-amber-400 to-orange-500 px-2 py-0.5 rounded-full">
              PRO
            </span>
          </div>
          <p className="text-xs text-gray-500 dark:text-gray-400 mt-0.5">
            {es
              ? 'Patrones históricos, horas pico y mejores horas pa\' cruzar.'
              : 'Historical patterns, peak hours, and best times to cross.'}
          </p>
        </div>

        {!isPro ? (
          <UpgradeWall es={es} />
        ) : (
          <>
            <div className="mt-3">
              <label className="text-[10px] uppercase tracking-widest font-bold text-gray-500 dark:text-gray-400 mb-1 block">
                {es ? 'Puente' : 'Crossing'}
              </label>
              <PortSearch
                ports={ports}
                value={selectedPortId}
                onChange={(portId) => { setSelectedPortId(portId); setHourly(null) }}
                placeholder={es ? 'Busca tu puente — Hidalgo, Pharr, Juárez…' : 'Search your crossing — Hidalgo, Pharr, Juárez…'}
                showWait={false}
              />
            </div>

            {selectedPort && hourly && (() => {
              const currentHour = new Date().getHours()
              const currentBucket = hourly.hours?.find((h) => h.hour === currentHour)
              const currentAvg = currentBucket?.avgWait ?? null
              const liveWait = selectedPort.vehicle ?? null
              const vsAvg = liveWait != null && currentAvg != null ? liveWait - currentAvg : null

              // Find the best window in the next 6 hours
              const upcomingBest = (() => {
                if (!hourly.hours) return null
                let best: { hour: number; avgWait: number } | null = null
                for (let i = 1; i <= 6; i++) {
                  const h = (currentHour + i) % 24
                  const bucket = hourly.hours.find((b) => b.hour === h)
                  if (bucket?.avgWait != null && (best === null || bucket.avgWait < best.avgWait)) {
                    best = { hour: h, avgWait: bucket.avgWait }
                  }
                }
                return best
              })()
              const savingsMin = liveWait != null && upcomingBest ? liveWait - upcomingBest.avgWait : null

              return (
                <>
                  {/* Recommendation card — the most valuable thing on this page */}
                  <div className={`mt-4 rounded-2xl p-4 shadow-lg ${
                    vsAvg != null && vsAvg > 15
                      ? 'bg-gradient-to-br from-red-600 to-orange-700 text-white'
                      : vsAvg != null && vsAvg < -10
                        ? 'bg-gradient-to-br from-emerald-600 to-green-700 text-white'
                        : 'bg-gradient-to-br from-blue-600 to-indigo-700 text-white'
                  }`}>
                    <p className="text-[10px] uppercase tracking-widest font-bold opacity-70">
                      {selectedName}
                    </p>
                    <div className="flex items-baseline gap-3 mt-1">
                      <p className="text-4xl font-black tabular-nums">
                        {formatWaitLabel(liveWait, es ? 'es' : 'en')}
                      </p>
                      {vsAvg != null && Math.abs(vsAvg) >= 5 && (
                        <p className="text-sm font-bold opacity-80">
                          {vsAvg > 0
                            ? (es ? `+${vsAvg} min vs promedio` : `+${vsAvg} min vs average`)
                            : (es ? `${vsAvg} min vs promedio` : `${vsAvg} min vs average`)}
                        </p>
                      )}
                    </div>
                    {savingsMin != null && savingsMin >= 10 && upcomingBest && (
                      <div className="mt-3 bg-white/15 rounded-xl px-3 py-2">
                        <p className="text-sm font-black">
                          {es
                            ? `Espera a las ${formatHour(upcomingBest.hour)} — ahorras ~${savingsMin} min`
                            : `Wait until ${formatHour(upcomingBest.hour)} — save ~${savingsMin} min`}
                        </p>
                        <p className="text-[11px] opacity-70 mt-0.5">
                          {es
                            ? `Promedio a esa hora: ~${upcomingBest.avgWait} min`
                            : `Average at that hour: ~${upcomingBest.avgWait} min`}
                        </p>
                      </div>
                    )}
                    {savingsMin != null && savingsMin < 10 && (
                      <p className="mt-2 text-sm font-bold opacity-80">
                        {es
                          ? 'Las próximas horas se ven parejas — cruza cuando puedas'
                          : 'Next few hours look similar — cross when you can'}
                      </p>
                    )}
                  </div>

                  {/* Peak vs Best — with actual useful context */}
                  {hourly.peak && hourly.best && (
                    <div className="mt-3 grid grid-cols-2 gap-2">
                      <div className="bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 rounded-2xl p-3">
                        <p className="text-[10px] uppercase tracking-widest font-bold text-red-700 dark:text-red-300">
                          {es ? 'Evita' : 'Avoid'}
                        </p>
                        <p className="text-xl font-black text-red-800 dark:text-red-200 mt-0.5 tabular-nums">
                          {formatHour(hourly.peak.hour)}
                        </p>
                        <p className="text-[11px] text-red-700 dark:text-red-300 font-semibold">
                          ~{formatWaitLabel(hourly.peak.avgWait, es ? 'es' : 'en')} {es ? 'promedio' : 'avg'}
                        </p>
                      </div>
                      <div className="bg-emerald-50 dark:bg-emerald-900/20 border border-emerald-200 dark:border-emerald-800 rounded-2xl p-3">
                        <p className="text-[10px] uppercase tracking-widest font-bold text-emerald-700 dark:text-emerald-300">
                          {es ? 'Mejor hora' : 'Best hour'}
                        </p>
                        <p className="text-xl font-black text-emerald-800 dark:text-emerald-200 mt-0.5 tabular-nums">
                          {formatHour(hourly.best.hour)}
                        </p>
                        <p className="text-[11px] text-emerald-700 dark:text-emerald-300 font-semibold">
                          ~{formatWaitLabel(hourly.best.avgWait, es ? 'es' : 'en')} {es ? 'promedio' : 'avg'}
                        </p>
                      </div>
                    </div>
                  )}
                </>
              )
            })()}

            {/* Interactive hourly chart — tap any bar to see details */}
            {selectedPortId && <DetailedHourlyChart hourly={hourly} es={es} />}

            {/* Weekly intelligence — the stuff that actually justifies Pro */}
            {selectedPortId && <WeeklyInsights portId={selectedPortId} es={es} />}

            {/* Bridge alternatives — which bridge should I use? */}
            {selectedPortId && <BridgeAlternatives currentPortId={selectedPortId} ports={ports} es={es} />}

            {selectedPortId && <SentriBreakevenCard portId={selectedPortId} es={es} />}
            {selectedPortId && <WeatherImpactCard portId={selectedPortId} es={es} />}
          </>
        )}
      </div>
    </main>
  )
}

// Suspense wrapper — required because DatosPageInner uses
// useSearchParams which needs to be inside a Suspense boundary
// per Next.js 14+ App Router rules.
export default function DatosPage() {
  return (
    <Suspense fallback={<main className="min-h-screen bg-gray-50 dark:bg-gray-950" />}>
      <DatosPageInner />
    </Suspense>
  )
}

function DetailedHourlyChart({ hourly, es }: { hourly: HourlyResponse | null; es: boolean }) {
  const [tapped, setTapped] = useState<number | null>(null)
  const currentHour = new Date().getHours()

  const hours = hourly?.hours && hourly.hours.length === 24
    ? hourly.hours
    : Array.from({ length: 24 }, (_, h) => ({ hour: h, avgWait: null }))
  const hasMeaningfulData = hours.some((h) => (h.avgWait ?? 0) > 0)
  const numeric = hours.map((d) => d.avgWait ?? 0)
  const max = Math.max(...numeric, 1)

  const focusHour = tapped ?? currentHour
  const focusBucket = hours[focusHour]

  if (!hasMeaningfulData) {
    return (
      <div className="mt-3 bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-2xl p-4 text-center">
        <p className="text-sm font-bold text-gray-500 dark:text-gray-400">
          {es ? 'Recopilando datos de este puente...' : 'Collecting data for this bridge...'}
        </p>
        <p className="text-[11px] text-gray-400 mt-1">
          {es
            ? 'Tomamos lecturas cada 15 min. En 2-3 días ya verás el patrón completo.'
            : 'We take readings every 15 min. In 2-3 days you\'ll see the full pattern.'}
        </p>
      </div>
    )
  }

  return (
    <div className="mt-3 bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-2xl p-4">
      <div className="flex items-center justify-between mb-1">
        <p className="text-[10px] uppercase tracking-widest font-bold text-gray-500 dark:text-gray-400">
          {es ? 'Espera promedio por hora' : 'Average wait by hour'}
        </p>
        <p className="text-[10px] text-gray-400">{es ? 'últimos 14 días' : 'last 14 days'}</p>
      </div>

      {/* Tapped/current hour detail */}
      <div className="mb-3 flex items-center justify-between">
        <p className="text-xs text-gray-500 dark:text-gray-400">
          {tapped == null
            ? (es ? 'Ahora' : 'Now')
            : formatHour(focusHour)}
          {focusBucket?.avgWait != null && (
            <span className="ml-1 font-black text-gray-900 dark:text-gray-100">
              ~{focusBucket.avgWait} min {es ? 'promedio' : 'avg'}
            </span>
          )}
        </p>
        {tapped != null && (
          <button
            onClick={() => setTapped(null)}
            className="text-[10px] text-blue-500 font-bold"
          >
            {es ? 'Ver ahora' : 'Show now'}
          </button>
        )}
      </div>

      {/* Legend */}
      <div className="flex items-center gap-3 mb-3 text-[9px] font-semibold text-gray-400">
        <span className="flex items-center gap-1"><span className="w-2 h-2 rounded-sm bg-emerald-500" />{es ? 'Rápido' : 'Fast'} &le;20m</span>
        <span className="flex items-center gap-1"><span className="w-2 h-2 rounded-sm bg-amber-500" />{es ? 'Moderado' : 'Medium'} 21-45m</span>
        <span className="flex items-center gap-1"><span className="w-2 h-2 rounded-sm bg-red-500" />{es ? 'Lento' : 'Slow'} 45m+</span>
      </div>

      {/* Chart with labeled bars */}
      <div className="flex items-end gap-[2px]" style={{ height: 120 }}>
        {hours.map((d) => {
          const value = d.avgWait ?? 0
          const heightPx = value > 0 ? Math.max(8, Math.round((value / max) * 100)) : 4
          const isCurrent = d.hour === currentHour
          const isTapped = d.hour === tapped
          const color = value <= 0
            ? 'bg-gray-300 dark:bg-gray-600'
            : value <= 20
              ? 'bg-emerald-500'
              : value <= 45
                ? 'bg-amber-500'
                : 'bg-red-500'
          return (
            <button
              key={d.hour}
              type="button"
              onClick={() => setTapped(d.hour === tapped ? null : d.hour)}
              className="flex-1 flex flex-col justify-end items-center relative"
              style={{ height: 120 }}
            >
              {/* Wait time label on top of bar for every 3rd hour or tapped/current */}
              {d.avgWait != null && (d.hour % 3 === 0 || isCurrent || isTapped) && (
                <span className={`text-[7px] font-bold mb-0.5 tabular-nums leading-none ${
                  isCurrent || isTapped ? 'text-gray-900 dark:text-gray-100' : 'text-gray-400'
                }`}>
                  {d.avgWait}m
                </span>
              )}
              <div
                className={`w-full rounded-t-sm ${color} ${
                  isCurrent ? 'ring-2 ring-blue-500 ring-offset-1 ring-offset-white dark:ring-offset-gray-800' : ''
                } ${isTapped ? 'ring-2 ring-indigo-400' : ''}`}
                style={{ height: heightPx }}
              />
            </button>
          )
        })}
      </div>

      {/* Time axis labels */}
      <div className="flex justify-between mt-1 text-[8px] text-gray-400 font-medium">
        <span>12am</span>
        <span>6am</span>
        <span>12pm</span>
        <span>6pm</span>
        <span>11pm</span>
      </div>

      {/* Tap hint */}
      <p className="mt-2 text-center text-[10px] text-gray-400">
        {es ? 'Toca una barra para ver el detalle de esa hora' : 'Tap a bar to see that hour\'s detail'}
      </p>
    </div>
  )
}

// SENTRI break-even card — shows users whether SENTRI is worth the
// $122 TTP fee for the bridge they're viewing, based on actual
// wait-time data from the last 30 days. Pulls from
// /api/ports/[id]/sentri-breakeven.
function SentriBreakevenCard({ portId, es }: { portId: string; es: boolean }) {
  const [data, setData] = useState<{
    samples: number
    avgSavingsMin: number | null
    savingsUsdPerCrossing: number | null
    breakEvenCrossings: number | null
  } | null>(null)

  useEffect(() => {
    fetch(`/api/ports/${encodeURIComponent(portId)}/sentri-breakeven`)
      .then((r) => r.json())
      .then((d) => setData(d))
      .catch(() => setData(null))
  }, [portId])

  if (!data || data.samples < 10 || data.avgSavingsMin == null || data.avgSavingsMin < 1) return null

  return (
    <div className="mt-3 bg-gradient-to-br from-yellow-50 to-amber-50 dark:from-yellow-900/20 dark:to-amber-900/20 border-2 border-amber-300 dark:border-amber-700 rounded-2xl p-4">
      <p className="text-[10px] uppercase tracking-widest font-black text-amber-700 dark:text-amber-400">
        ⚡ {es ? '¿Vale la pena SENTRI aquí?' : 'Is SENTRI worth it here?'}
      </p>
      <p className="text-sm font-black text-gray-900 dark:text-gray-100 mt-1 leading-tight">
        {es
          ? `SENTRI te ahorra ~${data.avgSavingsMin} min en promedio`
          : `SENTRI saves you ~${data.avgSavingsMin} min on average`}
      </p>
      <div className="grid grid-cols-2 gap-2 mt-3">
        <div className="bg-white dark:bg-gray-800 rounded-xl p-2.5">
          <p className="text-[9px] uppercase tracking-wide font-bold text-gray-500 dark:text-gray-400">
            {es ? 'Ahorro por cruce' : 'Savings / crossing'}
          </p>
          <p className="text-lg font-black text-emerald-700 dark:text-emerald-300 tabular-nums">
            ${data.savingsUsdPerCrossing?.toFixed(2) || '—'}
          </p>
        </div>
        <div className="bg-white dark:bg-gray-800 rounded-xl p-2.5">
          <p className="text-[9px] uppercase tracking-wide font-bold text-gray-500 dark:text-gray-400">
            {es ? 'Se paga en' : 'Breaks even at'}
          </p>
          <p className="text-lg font-black text-blue-700 dark:text-blue-300 tabular-nums">
            {data.breakEvenCrossings != null ? `${data.breakEvenCrossings} ${es ? 'cruces' : 'uses'}` : '—'}
          </p>
        </div>
      </div>
      <p className="text-[10px] text-amber-700 dark:text-amber-300 mt-2 leading-snug">
        {es
          ? `Calculado con tu tiempo a $40/hr y la tarifa TTP de $122.25. Basado en ${data.samples} lecturas de los últimos 30 días.`
          : `Calculated at $40/hr for your time and the $122.25 TTP fee. Based on ${data.samples} readings from the last 30 days.`}
      </p>
      <a
        href="https://ttp.cbp.dhs.gov/"
        target="_blank"
        rel="noopener noreferrer"
        className="mt-3 block w-full text-center py-2.5 bg-amber-500 hover:bg-amber-600 text-white text-xs font-black rounded-xl active:scale-95 transition-transform"
      >
        {es ? 'Aplicar pa\' SENTRI →' : 'Apply for SENTRI →'}
      </a>
    </div>
  )
}

// Accident impact card — computed from crossing_reports + wait_time_readings
// for the last 60 days at this port. "When an accident is reported,
// wait typically jumps +35 min and recovers in ~80 min."
function AccidentImpactCard({ portId, es }: { portId: string; es: boolean }) {
  const [data, setData] = useState<{
    samples: number
    avgJumpMin: number | null
    avgRecoveryMin: number | null
  } | null>(null)

  useEffect(() => {
    fetch(`/api/ports/${encodeURIComponent(portId)}/accident-impact`)
      .then((r) => r.json())
      .then((d) => setData(d))
      .catch(() => setData(null))
  }, [portId])

  if (!data || data.samples < 3 || !data.avgJumpMin) return null

  return (
    <div className="mt-3 bg-gradient-to-br from-red-50 to-orange-50 dark:from-red-900/20 dark:to-orange-900/20 border-2 border-red-300 dark:border-red-800 rounded-2xl p-4">
      <p className="text-[10px] uppercase tracking-widest font-black text-red-700 dark:text-red-400">
        🚨 {es ? 'Impacto de incidentes' : 'Incident impact'}
      </p>
      <p className="text-sm font-black text-gray-900 dark:text-gray-100 mt-1 leading-tight">
        {es
          ? `Cuando reportan un incidente aquí, la espera típicamente sube +${data.avgJumpMin} min`
          : `When an incident is reported here, wait typically jumps +${data.avgJumpMin} min`}
      </p>
      {data.avgRecoveryMin != null && (
        <p className="text-[12px] text-red-800 dark:text-red-300 mt-1 font-semibold">
          {es
            ? `y se recupera en ~${data.avgRecoveryMin} min`
            : `and recovers in ~${data.avgRecoveryMin} min`}
        </p>
      )}
      <p className="text-[10px] text-red-700 dark:text-red-300 mt-2 leading-snug">
        {es
          ? `Modelo basado en ${data.samples} incidentes reportados en los últimos 60 días cruzados con las lecturas de espera.`
          : `Model based on ${data.samples} reported incidents over the last 60 days cross-referenced with wait readings.`}
      </p>
    </div>
  )
}

// Lane-level community stats card — aggregates the source_meta
// lane_info that Enrique's feature captures. "The sin-rayos lane
// was marked slowest in 68% of reports."
function LaneStatsCard({ portId, es }: { portId: string; es: boolean }) {
  const [data, setData] = useState<{
    samples: number
    slowLaneCounts: Record<string, number>
    slowLanePct: Record<string, number>
    avgLanesOpen: number | null
    avgLanesXray: number | null
  } | null>(null)

  useEffect(() => {
    fetch(`/api/ports/${encodeURIComponent(portId)}/lane-stats`)
      .then((r) => r.json())
      .then((d) => setData(d))
      .catch(() => setData(null))
  }, [portId])

  if (!data || data.samples < 3) return null

  const slowLaneLabels: Record<string, { es: string; en: string }> = {
    con_rayos: { es: 'Con rayos X', en: 'With X-ray' },
    sin_rayos: { es: 'Sin rayos X', en: 'No X-ray' },
    sentri:    { es: 'SENTRI',      en: 'SENTRI' },
    parejo:    { es: 'Parejas',     en: 'All similar' },
  }

  const ordered = Object.entries(data.slowLanePct).sort((a, b) => b[1] - a[1])
  const topSlow = ordered[0]

  return (
    <div className="mt-3 bg-gradient-to-br from-purple-50 to-indigo-50 dark:from-purple-900/20 dark:to-indigo-900/20 border-2 border-purple-300 dark:border-purple-800 rounded-2xl p-4">
      <p className="text-[10px] uppercase tracking-widest font-black text-purple-700 dark:text-purple-400">
        🛣️ {es ? 'Datos de filas (de la gente)' : 'Lane data (from the community)'}
      </p>
      {topSlow && topSlow[1] > 0 && (
        <p className="text-sm font-black text-gray-900 dark:text-gray-100 mt-1 leading-tight">
          {es
            ? `"${slowLaneLabels[topSlow[0]]?.es || topSlow[0]}" marcada como más lenta el ${topSlow[1]}% del tiempo`
            : `"${slowLaneLabels[topSlow[0]]?.en || topSlow[0]}" marked slowest ${topSlow[1]}% of the time`}
        </p>
      )}
      {(data.avgLanesOpen != null || data.avgLanesXray != null) && (
        <p className="text-[12px] text-purple-800 dark:text-purple-300 mt-1 font-semibold">
          {es ? 'Típicamente ' : 'Typically '}
          {data.avgLanesOpen != null ? `${data.avgLanesOpen} ${es ? 'filas abiertas' : 'lanes open'}` : ''}
          {data.avgLanesOpen != null && data.avgLanesXray != null ? ' · ' : ''}
          {data.avgLanesXray != null ? `${data.avgLanesXray} ${es ? 'con rayos X' : 'with X-ray'}` : ''}
        </p>
      )}
      <p className="text-[10px] text-purple-700 dark:text-purple-300 mt-2 leading-snug">
        {es
          ? `Basado en ${data.samples} reportes de la comunidad con detalles de fila.`
          : `Based on ${data.samples} community reports with lane details.`}
      </p>
    </div>
  )
}

// Weather impact card — bucket avg waits by weather condition.
// Depends on schema-v24's weather columns being populated, which
// kicks in ~15 min after the migration lands and the cron fires.
// Gracefully hides when there aren't enough readings per bucket.
function WeatherImpactCard({ portId, es }: { portId: string; es: boolean }) {
  const [data, setData] = useState<{
    samples: number
    baselineCondition: string | null
    baselineWaitMin: number | null
    conditions: Array<{
      key: string
      label: { emoji: string; es: string; en: string }
      avgWaitMin: number
      samples: number
      deltaVsBaselineMin: number
    }>
  } | null>(null)

  useEffect(() => {
    fetch(`/api/ports/${encodeURIComponent(portId)}/weather-impact`)
      .then((r) => r.json())
      .then((d) => setData(d))
      .catch(() => setData(null))
  }, [portId])

  if (!data || data.conditions.length < 2) return null

  return (
    <div className="mt-3 bg-gradient-to-br from-sky-50 to-cyan-50 dark:from-sky-900/20 dark:to-cyan-900/20 border-2 border-sky-300 dark:border-sky-800 rounded-2xl p-4">
      <p className="text-[10px] uppercase tracking-widest font-black text-sky-700 dark:text-sky-400">
        🌤️ {es ? 'Impacto del clima' : 'Weather impact'}
      </p>
      <p className="text-xs text-sky-800 dark:text-sky-300 mt-0.5 font-semibold leading-snug">
        {es
          ? `Cómo cambia la espera con el clima en este puente.`
          : `How wait time shifts with weather at this bridge.`}
      </p>
      <div className="mt-3 space-y-1.5">
        {data.conditions.map((c) => (
          <div key={c.key} className="flex items-center gap-2 text-xs">
            <span className="text-base leading-none w-5 text-center">{c.label.emoji}</span>
            <span className="font-bold text-gray-800 dark:text-gray-200 flex-1 min-w-0 truncate">
              {es ? c.label.es : c.label.en}
            </span>
            <span className="font-black text-gray-900 dark:text-gray-100 tabular-nums">
              ~{c.avgWaitMin} min
            </span>
            {c.deltaVsBaselineMin !== 0 && (
              <span
                className={`text-[10px] font-black tabular-nums w-12 text-right ${
                  c.deltaVsBaselineMin > 0 ? 'text-red-600 dark:text-red-400' : 'text-emerald-600 dark:text-emerald-400'
                }`}
              >
                {c.deltaVsBaselineMin > 0 ? '+' : ''}{c.deltaVsBaselineMin} min
              </span>
            )}
          </div>
        ))}
      </div>
      <p className="text-[10px] text-sky-700 dark:text-sky-300 mt-2 leading-snug">
        {es
          ? `${data.samples} lecturas de los últimos 30 días.`
          : `${data.samples} readings from the last 30 days.`}
      </p>
    </div>
  )
}

// Weekly intelligence — day-of-week patterns, rush windows, time blocks.
// This is the core of what makes Pro worth paying for.
function WeeklyInsights({ portId, es }: { portId: string; es: boolean }) {
  const [data, setData] = useState<{
    days: Array<{ dow: number; nameEn: string; nameEs: string; avgWait: number | null; samples: number }>
    bestDay: { dow: number; nameEn: string; nameEs: string; avgWait: number } | null
    worstDay: { dow: number; nameEn: string; nameEs: string; avgWait: number } | null
    rushWindows: Array<{ startHour: number; endHour: number; avgWait: number }>
    timeBlocks: Array<{ key: string; labelEn: string; labelEs: string; avgWait: number | null }>
    weekdayAvg: number | null
    weekendAvg: number | null
    totalSamples: number
  } | null>(null)

  useEffect(() => {
    fetch(`/api/ports/${encodeURIComponent(portId)}/weekly`)
      .then(r => r.json())
      .then(d => { if (d.days) setData(d) })
      .catch(() => {})
  }, [portId])

  if (!data || data.totalSamples < 50) return null

  const todayDow = new Date().getDay()

  return (
    <>
      {/* Rush windows — avoid these times */}
      {data.rushWindows.length > 0 && (
        <div className="mt-3 bg-red-50 dark:bg-red-900/20 border-2 border-red-200 dark:border-red-800 rounded-2xl p-4">
          <p className="text-[10px] uppercase tracking-widest font-black text-red-700 dark:text-red-400">
            {es ? 'Ventanas de tráfico pesado' : 'Rush windows to avoid'}
          </p>
          <div className="mt-2 space-y-2">
            {data.rushWindows.map((w, i) => (
              <div key={i} className="flex items-center justify-between">
                <p className="text-sm font-black text-red-800 dark:text-red-200">
                  {formatHour(w.startHour)} – {formatHour(w.endHour + 1)}
                </p>
                <p className="text-xs font-bold text-red-700 dark:text-red-300">
                  ~{w.avgWait} min {es ? 'promedio' : 'avg'}
                </p>
              </div>
            ))}
          </div>
          <p className="mt-2 text-[10px] text-red-600 dark:text-red-400 leading-snug">
            {es
              ? 'Basado en los últimos 30 días. Horas donde la espera pasa de 40 min consistentemente.'
              : 'Based on the last 30 days. Hours where wait consistently exceeds 40 min.'}
          </p>
        </div>
      )}

      {/* Time block comparison — morning vs afternoon vs evening */}
      {data.timeBlocks.some(b => b.avgWait != null) && (
        <div className="mt-3 bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-2xl p-4">
          <p className="text-[10px] uppercase tracking-widest font-bold text-gray-500 dark:text-gray-400 mb-3">
            {es ? 'Mejor momento del día' : 'Best time of day'}
          </p>
          <div className="space-y-2">
            {data.timeBlocks.filter(b => b.avgWait != null).map(block => {
              const isLowest = data.timeBlocks.every(
                b => b.avgWait == null || b.avgWait >= block.avgWait!
              )
              return (
                <div key={block.key} className="flex items-center gap-3">
                  <div className={`flex-1 rounded-xl px-3 py-2 ${
                    isLowest
                      ? 'bg-emerald-50 dark:bg-emerald-900/20 border border-emerald-200 dark:border-emerald-800'
                      : 'bg-gray-50 dark:bg-gray-700/50'
                  }`}>
                    <div className="flex items-center justify-between">
                      <p className={`text-xs font-bold ${
                        isLowest ? 'text-emerald-800 dark:text-emerald-200' : 'text-gray-700 dark:text-gray-300'
                      }`}>
                        {es ? block.labelEs : block.labelEn}
                        {isLowest && <span className="ml-1.5 text-[9px]">{es ? '(mejor)' : '(best)'}</span>}
                      </p>
                      <p className={`text-sm font-black tabular-nums ${
                        isLowest ? 'text-emerald-700 dark:text-emerald-300' : 'text-gray-600 dark:text-gray-400'
                      }`}>
                        ~{block.avgWait} min
                      </p>
                    </div>
                  </div>
                </div>
              )
            })}
          </div>
        </div>
      )}

      {/* Day of week breakdown — which days are fastest */}
      <div className="mt-3 bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-2xl p-4">
        <p className="text-[10px] uppercase tracking-widest font-bold text-gray-500 dark:text-gray-400 mb-1">
          {es ? 'Promedio por día de la semana' : 'Average by day of week'}
        </p>
        {data.weekdayAvg != null && data.weekendAvg != null && (
          <p className="text-[11px] text-gray-500 dark:text-gray-400 mb-3">
            {es
              ? `Entre semana ~${data.weekdayAvg} min · Fin de semana ~${data.weekendAvg} min`
              : `Weekdays ~${data.weekdayAvg} min · Weekends ~${data.weekendAvg} min`}
          </p>
        )}
        <div className="space-y-1.5">
          {data.days.map(day => {
            if (day.avgWait == null) return null
            const isBest = data.bestDay?.dow === day.dow
            const isWorst = data.worstDay?.dow === day.dow
            const isToday = day.dow === todayDow
            const maxDayWait = Math.max(...data.days.map(d => d.avgWait ?? 0), 1)
            const barWidth = Math.max(8, Math.round((day.avgWait / maxDayWait) * 100))
            return (
              <div key={day.dow} className="flex items-center gap-2">
                <span className={`text-[11px] font-bold w-12 flex-shrink-0 ${
                  isToday ? 'text-blue-600 dark:text-blue-400' : 'text-gray-600 dark:text-gray-400'
                }`}>
                  {(es ? day.nameEs : day.nameEn).slice(0, 3)}
                  {isToday && <span className="text-[8px] ml-0.5">{es ? 'hoy' : 'today'}</span>}
                </span>
                <div className="flex-1 h-5 bg-gray-100 dark:bg-gray-700 rounded-full overflow-hidden">
                  <div
                    className={`h-full rounded-full ${
                      isBest ? 'bg-emerald-500' : isWorst ? 'bg-red-500' : 'bg-blue-400 dark:bg-blue-500'
                    }`}
                    style={{ width: `${barWidth}%` }}
                  />
                </div>
                <span className={`text-[11px] font-black tabular-nums w-12 text-right flex-shrink-0 ${
                  isBest ? 'text-emerald-600 dark:text-emerald-400'
                    : isWorst ? 'text-red-600 dark:text-red-400'
                    : 'text-gray-700 dark:text-gray-300'
                }`}>
                  ~{day.avgWait}m
                </span>
              </div>
            )
          })}
        </div>
        {data.bestDay && data.worstDay && (
          <p className="mt-3 text-[11px] text-gray-500 dark:text-gray-400 leading-snug">
            {es
              ? `Mejor día: ${data.bestDay.nameEs} (~${data.bestDay.avgWait} min). Peor: ${data.worstDay.nameEs} (~${data.worstDay.avgWait} min). Diferencia de ${data.worstDay.avgWait - data.bestDay.avgWait} min.`
              : `Best day: ${data.bestDay.nameEn} (~${data.bestDay.avgWait} min). Worst: ${data.worstDay.nameEn} (~${data.worstDay.avgWait} min). ${data.worstDay.avgWait - data.bestDay.avgWait} min difference.`}
          </p>
        )}
      </div>
    </>
  )
}

// Bridge alternatives — show nearby bridges that are faster right now
function BridgeAlternatives({ currentPortId, ports, es }: {
  currentPortId: string
  ports: PortWaitTime[]
  es: boolean
}) {
  const currentPort = ports.find(p => p.portId === currentPortId)
  if (!currentPort || currentPort.vehicle == null) return null

  const currentMeta = getPortMeta(currentPortId)

  // Find ports in the same mega region that are faster
  const alternatives = ports
    .filter(p => {
      if (p.portId === currentPortId) return false
      if (p.vehicle == null) return false
      const meta = getPortMeta(p.portId)
      return meta.megaRegion === currentMeta.megaRegion
    })
    .sort((a, b) => (a.vehicle ?? 999) - (b.vehicle ?? 999))
    .slice(0, 3)

  if (alternatives.length === 0) return null

  const fasterExists = alternatives.some(a => (a.vehicle ?? 999) < (currentPort.vehicle ?? 0) - 5)

  return (
    <div className={`mt-3 rounded-2xl p-4 border ${
      fasterExists
        ? 'bg-emerald-50 dark:bg-emerald-900/20 border-emerald-200 dark:border-emerald-800'
        : 'bg-white dark:bg-gray-800 border-gray-200 dark:border-gray-700'
    }`}>
      <p className="text-[10px] uppercase tracking-widest font-black text-gray-500 dark:text-gray-400">
        {es ? 'Puentes cercanos ahorita' : 'Nearby bridges right now'}
      </p>
      {fasterExists && (
        <p className="text-[11px] font-bold text-emerald-700 dark:text-emerald-300 mt-0.5">
          {es ? 'Hay opciones más rápidas cerca' : 'There are faster options nearby'}
        </p>
      )}
      <div className="mt-2 space-y-1.5">
        {alternatives.map(alt => {
          const name = alt.localNameOverride || getPortMeta(alt.portId).localName || alt.portName
          const diff = (currentPort.vehicle ?? 0) - (alt.vehicle ?? 0)
          const isFaster = diff > 5
          return (
            <div key={alt.portId} className="flex items-center justify-between">
              <p className="text-xs font-bold text-gray-800 dark:text-gray-200 truncate flex-1 mr-2">
                {name}
              </p>
              <div className="flex items-center gap-2 flex-shrink-0">
                <span className={`text-sm font-black tabular-nums ${
                  (alt.vehicle ?? 0) <= 20 ? 'text-emerald-600 dark:text-emerald-400'
                    : (alt.vehicle ?? 0) <= 45 ? 'text-amber-600 dark:text-amber-400'
                    : 'text-red-600 dark:text-red-400'
                }`}>
                  {alt.vehicle} min
                </span>
                {isFaster && (
                  <span className="text-[10px] font-bold text-emerald-600 dark:text-emerald-400">
                    -{diff}m
                  </span>
                )}
              </div>
            </div>
          )
        })}
      </div>
    </div>
  )
}

function UpgradeWall({ es }: { es: boolean }) {
  return (
    <div className="mt-4 bg-gradient-to-br from-amber-50 via-orange-50 to-rose-50 dark:from-amber-900/20 dark:via-orange-900/20 dark:to-rose-900/20 border-2 border-amber-300 dark:border-amber-700 rounded-3xl p-6 text-center">
      <p className="text-4xl mb-2">📊</p>
      <p className="text-lg font-black text-gray-900 dark:text-gray-100 leading-tight">
        {es ? 'Datos son del plan Pro' : 'Insights are a Pro feature'}
      </p>
      <p className="text-xs text-gray-700 dark:text-gray-300 mt-2 leading-snug">
        {es
          ? 'Los que cruzan diario lo usan pa\' saber la hora pico, la mejor hora pa\' cruzar y los patrones del día.'
          : 'Daily crossers use this to know peak hours, best times to cross, and daily patterns.'}
      </p>
      <div className="mt-4 grid grid-cols-2 gap-2 text-left">
        {[
          { es: 'Hora pico del día', en: 'Peak hour of the day' },
          { es: 'Mejor hora pa\' cruzar', en: 'Best time to cross' },
          { es: 'Patrón por hora', en: 'Hourly pattern' },
          { es: 'Alertas ilimitadas', en: 'Unlimited alerts' },
        ].map((f) => (
          <div key={f.en} className="flex items-center gap-1.5 bg-white/70 dark:bg-gray-900/40 rounded-xl px-2.5 py-2">
            <span className="text-amber-600 dark:text-amber-400 text-sm">✓</span>
            <span className="text-[11px] font-semibold text-gray-800 dark:text-gray-200 leading-tight">
              {es ? f.es : f.en}
            </span>
          </div>
        ))}
      </div>
      <Link
        href="/pricing"
        className="mt-5 block w-full py-3.5 bg-gradient-to-br from-amber-500 to-orange-600 text-white text-sm font-black rounded-2xl shadow-lg active:scale-[0.98] transition-transform"
      >
        {es ? 'Activar Pro — $2.99/mes' : 'Unlock Pro — $2.99/mo'}
      </Link>
      <p className="mt-2 text-[10px] text-gray-500 dark:text-gray-400">
        {es ? 'Instala la app y los primeros 3 meses son gratis' : 'Install the app and get the first 3 months free'}
      </p>
    </div>
  )
}
