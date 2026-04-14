'use client'

import { useState, useCallback } from 'react'
import Link from 'next/link'
import { useLang } from '@/lib/LangContext'
import { useAuth } from '@/lib/useAuth'
import { REGIONS, type RegionKey } from '@/lib/regionMatchers'
import { formatWaitLabel } from '@/lib/formatWait'
import { LockedFeatureWall } from '@/components/LockedFeatureWall'
import { ArrowLeft } from 'lucide-react'

// Public trip planner page. Lets users pick a day + hour + region
// and get back "here's the fastest bridge at that time, here's the
// second fastest, and if you can shift your departure by an hour
// you save X min." Backed by /api/planner which groups the last 30
// days of CBP readings by day_of_week + hour_of_day per port.

interface Bridge {
  portId: string
  portName: string
  avgWaitMin: number
  samples: number
}

interface PlannerResult {
  region: RegionKey
  day: number
  hour: number
  bridges: Bridge[]
  shift: { hour: number; avgWaitMin: number; savingsMin: number } | null
  totalSamples: number
}

const DAYS_ES = ['Domingo', 'Lunes', 'Martes', 'Miércoles', 'Jueves', 'Viernes', 'Sábado']
const DAYS_EN = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday']
const DAYS_ES_SHORT = ['D', 'L', 'M', 'X', 'J', 'V', 'S']
const DAYS_EN_SHORT = ['S', 'M', 'T', 'W', 'T', 'F', 'S']

function hourLabel(h: number): string {
  return `${h.toString().padStart(2, '0')}:00`
}

export default function PlannerPage() {
  const { lang } = useLang()
  const { user, loading: authLoading } = useAuth()
  const es = lang === 'es'

  const now = new Date()
  const [region, setRegion] = useState<RegionKey>('rgv')
  const [day, setDay] = useState<number>(now.getDay())
  const [hour, setHour] = useState<number>(now.getHours())
  const [result, setResult] = useState<PlannerResult | null>(null)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)

  if (authLoading) {
    return <main className="min-h-screen bg-gray-50 dark:bg-gray-950" />
  }
  if (!user) {
    return (
      <main className="min-h-screen bg-gray-50 dark:bg-gray-950">
        <div className="max-w-lg mx-auto px-4 pt-6 pb-10">
          <Link href="/" className="inline-flex items-center gap-1 text-sm text-gray-500 dark:text-gray-400 hover:text-gray-900 dark:hover:text-gray-100 mb-4">
            <ArrowLeft className="w-4 h-4" /> {es ? 'Volver al inicio' : 'Back to home'}
          </Link>
          <LockedFeatureWall
            nextPath="/planner"
            featureTitleEs="Planifica tu cruce"
            featureTitleEn="Plan your crossing"
            summaryEs="Dime cuándo quieres cruzar y qué región. Te digo cuál puente está más fluido a esa hora basado en los últimos 30 días de datos — y si esperar 1 hora te ahorra más tiempo."
            summaryEn="Tell me when you want to cross and which region. I'll tell you which bridge moves fastest at that time based on the last 30 days of data — and if shifting by 1 hour saves you more time."
            unlocks={[
              { es: 'Mejor puente pa\' cualquier día + hora', en: 'Best bridge for any day + hour' },
              { es: 'Ahorro estimado en minutos', en: 'Estimated savings in minutes' },
              { es: 'Recomendación de cambio de horario', en: 'Time-shift recommendation' },
              { es: 'Historial del patrón del puente', en: 'Bridge pattern history' },
            ]}
          />
        </div>
      </main>
    )
  }

  const run = useCallback(async () => {
    setLoading(true)
    setError(null)
    try {
      const qs = new URLSearchParams({
        region,
        day: String(day),
        hour: String(hour),
      })
      const res = await fetch(`/api/planner?${qs}`)
      if (!res.ok) {
        const d = await res.json().catch(() => ({}))
        throw new Error(d.error || `HTTP ${res.status}`)
      }
      const data = (await res.json()) as PlannerResult
      setResult(data)
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e))
    } finally {
      setLoading(false)
    }
  }, [region, day, hour])

  return (
    <main className="min-h-screen bg-gray-50 dark:bg-gray-950">
      <div className="max-w-lg mx-auto px-4 pb-24">
        <div className="pt-6 pb-4">
          <h1 className="text-2xl font-black text-gray-900 dark:text-gray-100 leading-tight">
            🗺️ {es ? 'Planifica tu cruce' : 'Plan your crossing'}
          </h1>
          <p className="text-xs text-gray-500 dark:text-gray-400 mt-0.5">
            {es
              ? 'Te decimos qué puente agarrar y a qué hora salir pa\' esperar menos.'
              : 'We tell you which bridge to take and when to leave to wait less.'}
          </p>
        </div>

        {/* Region picker */}
        <div className="mt-2">
          <p className="text-[10px] uppercase tracking-widest font-bold text-gray-500 dark:text-gray-400 mb-1.5">
            {es ? 'Por dónde cruzas' : 'Where you cross'}
          </p>
          <select
            value={region}
            onChange={(e) => { setRegion(e.target.value as RegionKey); setResult(null) }}
            className="w-full bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-2xl px-3 py-3 text-sm font-bold text-gray-900 dark:text-gray-100"
          >
            {REGIONS.filter((r) => r.key !== 'all').map((r) => (
              <option key={r.key} value={r.key}>
                {r.emoji} {es ? r.labelEs : r.labelEn}
              </option>
            ))}
          </select>
        </div>

        {/* Day picker */}
        <div className="mt-4">
          <p className="text-[10px] uppercase tracking-widest font-bold text-gray-500 dark:text-gray-400 mb-1.5">
            {es ? 'Qué día' : 'What day'}
          </p>
          <div className="grid grid-cols-7 gap-1.5">
            {(es ? DAYS_ES_SHORT : DAYS_EN_SHORT).map((label, i) => {
              const active = day === i
              return (
                <button
                  key={i}
                  type="button"
                  onClick={() => { setDay(i); setResult(null) }}
                  className={`h-11 rounded-xl text-xs font-black transition-all active:scale-95 ${
                    active
                      ? 'bg-blue-600 text-white shadow-sm'
                      : 'bg-white dark:bg-gray-800 text-gray-700 dark:text-gray-300 border border-gray-200 dark:border-gray-700'
                  }`}
                >
                  {label}
                </button>
              )
            })}
          </div>
          <p className="text-[10px] text-gray-400 dark:text-gray-500 mt-1 text-center">
            {es ? DAYS_ES[day] : DAYS_EN[day]}
          </p>
        </div>

        {/* Hour picker */}
        <div className="mt-4">
          <div className="flex items-baseline justify-between mb-1.5">
            <p className="text-[10px] uppercase tracking-widest font-bold text-gray-500 dark:text-gray-400">
              {es ? 'Hora aproximada' : 'Approximate hour'}
            </p>
            <p className="text-base font-black text-blue-600 dark:text-blue-400 tabular-nums">{hourLabel(hour)}</p>
          </div>
          <input
            type="range"
            min={0}
            max={23}
            step={1}
            value={hour}
            onChange={(e) => { setHour(Number(e.target.value)); setResult(null) }}
            className="w-full h-2 bg-gray-200 dark:bg-gray-700 rounded-full appearance-none cursor-pointer accent-blue-600"
          />
          <div className="flex justify-between text-[9px] text-gray-400 dark:text-gray-500 mt-1 font-mono">
            <span>12am</span>
            <span>6am</span>
            <span>12pm</span>
            <span>6pm</span>
            <span>11pm</span>
          </div>
        </div>

        <button
          type="button"
          onClick={run}
          disabled={loading}
          className="mt-5 w-full py-4 bg-gradient-to-br from-blue-600 to-indigo-700 text-white font-black text-base rounded-2xl shadow-lg active:scale-[0.98] transition-transform disabled:opacity-50"
        >
          {loading ? (es ? 'Calculando…' : 'Calculating…') : (es ? 'Calcular ruta →' : 'Calculate route →')}
        </button>

        {error && (
          <p className="mt-3 text-center text-xs text-red-500">{error}</p>
        )}

        {result && result.bridges.length === 0 && (
          <div className="mt-5 bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-2xl p-5 text-center">
            <p className="text-2xl mb-2">🤔</p>
            <p className="text-sm font-bold text-gray-900 dark:text-gray-100">
              {es ? 'Aún no tenemos suficientes datos' : 'Not enough data yet'}
            </p>
            <p className="text-xs text-gray-500 dark:text-gray-400 mt-1 leading-snug">
              {es
                ? 'Para esta región, día y hora todavía no hay suficientes lecturas históricas. Vuelve en unos días o prueba otra combinación.'
                : 'Not enough historical readings for this region/day/hour combo yet. Try again in a few days or pick different inputs.'}
            </p>
          </div>
        )}

        {result && result.bridges.length > 0 && (
          <div className="mt-5 space-y-3">
            {/* Winner */}
            <div className="bg-gradient-to-br from-emerald-500 to-teal-600 text-white rounded-3xl p-5 shadow-2xl">
              <p className="text-[10px] uppercase tracking-widest font-black text-emerald-100">
                {es ? 'Mejor opción' : 'Best option'}
              </p>
              <p className="text-2xl font-black mt-1 leading-tight">{result.bridges[0].portName}</p>
              <div className="mt-2 flex items-baseline gap-2">
                <p className="text-4xl font-black tabular-nums">
                  {formatWaitLabel(result.bridges[0].avgWaitMin, es ? 'es' : 'en')}
                </p>
                <p className="text-xs text-emerald-100 font-bold">
                  {es ? 'promedio esperado' : 'expected avg'}
                </p>
              </div>
              <p className="text-[11px] text-emerald-100 mt-2">
                {es
                  ? `Basado en ${result.bridges[0].samples} lecturas de los últimos 30 ${DAYS_ES[result.day].toLowerCase()}s ${hourLabel(result.hour)}`
                  : `Based on ${result.bridges[0].samples} readings from the last 30 ${DAYS_EN[result.day].toLowerCase()}s at ${hourLabel(result.hour)}`}
              </p>
            </div>

            {/* Shift suggestion */}
            {result.shift && (
              <div className="bg-amber-50 dark:bg-amber-900/20 border-2 border-amber-300 dark:border-amber-700 rounded-2xl p-4">
                <div className="flex items-start gap-3">
                  <span className="text-2xl leading-none flex-shrink-0">💡</span>
                  <div className="min-w-0 flex-1">
                    <p className="text-[10px] uppercase tracking-widest font-black text-amber-700 dark:text-amber-400">
                      {es ? 'Truco: cambia la hora' : 'Pro tip: shift your hour'}
                    </p>
                    <p className="text-sm font-black text-amber-900 dark:text-amber-100 mt-0.5 leading-tight">
                      {es
                        ? `Si puedes salir a las ${hourLabel(result.shift.hour)}, ahorras ${result.shift.savingsMin} min`
                        : `If you can leave at ${hourLabel(result.shift.hour)} instead, you save ${result.shift.savingsMin} min`}
                    </p>
                    <p className="text-[11px] text-amber-800 dark:text-amber-300 mt-1 leading-snug">
                      {es
                        ? `En ${result.bridges[0].portName} suele estar en ${formatWaitLabel(result.shift.avgWaitMin, 'es')} a esa hora.`
                        : `${result.bridges[0].portName} typically runs ${formatWaitLabel(result.shift.avgWaitMin, 'en')} at that hour.`}
                    </p>
                  </div>
                </div>
              </div>
            )}

            {/* Other bridges */}
            {result.bridges.length > 1 && (
              <div className="bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-2xl overflow-hidden">
                <p className="text-[10px] uppercase tracking-widest font-bold text-gray-500 dark:text-gray-400 px-4 pt-3 pb-1.5">
                  {es ? 'Otros puentes cercanos' : 'Other bridges nearby'}
                </p>
                <div className="divide-y divide-gray-100 dark:divide-gray-700/50">
                  {result.bridges.slice(1).map((b, i) => (
                    <Link
                      key={b.portId}
                      href={`/port/${encodeURIComponent(b.portId)}`}
                      className="flex items-center gap-3 px-4 py-3 active:bg-gray-50 dark:active:bg-gray-700/30 transition-colors"
                    >
                      <span className="w-5 text-center text-xs font-black text-gray-400">#{i + 2}</span>
                      <div className="flex-1 min-w-0">
                        <p className="text-sm font-bold text-gray-900 dark:text-gray-100 truncate">{b.portName}</p>
                        <p className="text-[10px] text-gray-500 dark:text-gray-400">
                          {es ? `${b.samples} lecturas` : `${b.samples} readings`}
                        </p>
                      </div>
                      <p className="text-base font-black text-gray-900 dark:text-gray-100 tabular-nums">
                        {formatWaitLabel(b.avgWaitMin, es ? 'es' : 'en')}
                      </p>
                      <span className="text-gray-300 dark:text-gray-600 text-sm">→</span>
                    </Link>
                  ))}
                </div>
              </div>
            )}
          </div>
        )}
      </div>
    </main>
  )
}
