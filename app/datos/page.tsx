'use client'

import { useEffect, useState, useMemo, Suspense } from 'react'
import Link from 'next/link'
import { useSearchParams } from 'next/navigation'
import { useLang } from '@/lib/LangContext'
import { useTier } from '@/lib/useTier'
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

  const [ports, setPorts] = useState<PortWaitTime[]>([])
  const [selectedPortId, setSelectedPortId] = useState<string | null>(null)
  const [hourly, setHourly] = useState<HourlyResponse | null>(null)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    try { localStorage.setItem('cruzar_datos_visited', '1') } catch { /* ignore */ }
  }, [])

  useEffect(() => {
    fetch('/api/ports', { cache: 'no-store' })
      .then((r) => r.json())
      .then((d) => {
        const list: PortWaitTime[] = (d.ports || []).filter((p: PortWaitTime) => !p.isClosed && p.vehicle != null)
        setPorts(list)
        if (list.length > 0 && !selectedPortId) {
          // Honor ?port= query param so /port/[id]/advanced can deep-link
          // into this page pre-scoped to a specific bridge.
          const portFromQuery = searchParams?.get('port')
          const preferred = portFromQuery && list.find((p) => p.portId === portFromQuery)
            ? portFromQuery
            : list[0].portId
          setSelectedPortId(preferred)
        }
      })
      .catch(() => { /* ignore */ })
      .finally(() => setLoading(false))
  }, [selectedPortId, searchParams])

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

            {selectedPort && (
              <div className="mt-4 bg-gradient-to-br from-blue-600 to-indigo-700 rounded-2xl p-4 text-white shadow-lg">
                <p className="text-[10px] uppercase tracking-widest font-bold text-blue-100">
                  {es ? 'Ahorita' : 'Right now'}
                </p>
                <p className="text-2xl font-black mt-0.5">
                  {selectedName}
                </p>
                <p className="mt-1 text-3xl font-black tabular-nums">
                  {formatWaitLabel(selectedPort.vehicle ?? null, es ? 'es' : 'en')}
                </p>
              </div>
            )}

            {hourly && hourly.peak && hourly.best && (
              <div className="mt-3 grid grid-cols-2 gap-2">
                <div className="bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 rounded-2xl p-3">
                  <p className="text-[10px] uppercase tracking-widest font-bold text-red-700 dark:text-red-300">
                    {es ? 'Hora pico' : 'Peak hour'}
                  </p>
                  <p className="text-xl font-black text-red-800 dark:text-red-200 mt-0.5 tabular-nums">
                    {formatHour(hourly.peak.hour)}
                  </p>
                  <p className="text-[11px] text-red-700 dark:text-red-300 font-semibold">
                    ~{formatWaitLabel(hourly.peak.avgWait, es ? 'es' : 'en')}
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
                    ~{formatWaitLabel(hourly.best.avgWait, es ? 'es' : 'en')}
                  </p>
                </div>
              </div>
            )}

            {selectedPortId && (() => {
              // Always backfill 24 buckets so the chart renders even when the
              // API has nothing for this bridge. Diego flagged that the chart
              // "doesn't show anything" — root cause was the previous gate
              // (`hourly && hourly.hours.length > 0`) hiding the whole block
              // on empty data. Skeleton always, message inline.
              const hours: Array<{ hour: number; avgWait: number | null }> = hourly?.hours
                && hourly.hours.length === 24
                ? hourly.hours
                : Array.from({ length: 24 }, (_, h) => ({ hour: h, avgWait: hourly?.hours?.find(x => x.hour === h)?.avgWait ?? null }))
              const hasMeaningfulData = hours.some((h) => (h.avgWait ?? 0) > 0)
              return (
                <div className="mt-3 bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-2xl p-4">
                  <div className="flex items-baseline justify-between mb-2">
                    <p className="text-[10px] uppercase tracking-widest font-bold text-gray-500 dark:text-gray-400">
                      {es ? 'Patrón por hora' : 'Hourly pattern'}
                    </p>
                    {!hasMeaningfulData && (
                      <p className="text-[10px] text-amber-500 font-semibold">
                        {es ? 'Recopilando…' : 'Still collecting'}
                      </p>
                    )}
                  </div>
                  <HourlyBarChart data={hours} />
                  {!hasMeaningfulData && (
                    <p className="mt-2 text-[11px] text-gray-500 dark:text-gray-400 leading-snug">
                      {es
                        ? 'Recolectamos lecturas de la CBP cada 15 minutos. En unos días la gráfica se va a llenar con el patrón real de este puente.'
                        : 'We collect CBP readings every 15 minutes. Within a few days this chart will fill in with this bridge\u2019s real pattern.'}
                    </p>
                  )}
                </div>
              )
            })()}

            {selectedPortId && <SentriBreakevenCard portId={selectedPortId} es={es} />}
            {selectedPortId && <AccidentImpactCard portId={selectedPortId} es={es} />}
            {selectedPortId && <LaneStatsCard portId={selectedPortId} es={es} />}
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

function HourlyBarChart({ data }: { data: Array<{ hour: number; avgWait: number | null }> }) {
  // CRITICAL: the API returns avgWait: null for hours with no samples.
  // The previous implementation did Math.max(...data.map(d => d.avgWait), 1)
  // which returns NaN when any element is null, which made EVERY bar
  // height compute to NaN%, which is invalid CSS, which rendered nothing
  // at all. Symptom: Diego said "hourly pattern doesn't show anything."
  // Fix: coerce nulls to 0 BEFORE Math.max, and always render a visible
  // stub for empty hours so users see the full 24-hour spec.
  const numeric = data.map((d) => d.avgWait ?? 0)
  const max = Math.max(...numeric, 1)
  return (
    <div className="flex items-end gap-0.5 h-28">
      {data.map((d) => {
        const value = d.avgWait ?? 0
        // Minimum 12% so empty hours are still visible as grey stubs
        // and users see the 24-hour spec even when data is sparse.
        const h = Math.max(12, (value / max) * 100)
        const color = value <= 0
          ? 'bg-gray-200 dark:bg-gray-700'
          : value <= 20
            ? 'bg-green-500'
            : value <= 45
              ? 'bg-amber-500'
              : 'bg-red-500'
        return (
          <div
            key={d.hour}
            className="flex-1 flex flex-col items-center gap-1"
            title={`${d.hour}:00 — ${d.avgWait != null ? `${d.avgWait} min` : 'sin datos'}`}
          >
            <div className="w-full rounded-t bg-gray-100 dark:bg-gray-700 flex-1 flex items-end">
              <div className={`w-full ${color} rounded-t`} style={{ height: `${h}%` }} />
            </div>
            <span className="text-[8px] text-gray-400 font-mono">{d.hour}</span>
          </div>
        )
      })}
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
