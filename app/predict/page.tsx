'use client'

import { useState, useEffect } from 'react'
import Link from 'next/link'
import { useRouter } from 'next/navigation'
import { useAuth } from '@/lib/useAuth'
import { useTier } from '@/lib/useTier'
import { useLang } from '@/lib/LangContext'
import { ArrowLeft, Clock, Info, Lock, Bell, Zap } from 'lucide-react'

interface PortOption {
  portId: string
  portName: string
  crossingName: string
  vehicle: number | null
  commercial: number | null
}

interface HourAvg {
  day: number
  hour: number
  vehicleAvg: number | null
  commercialAvg: number | null
  samples: number
}

interface PortResult {
  dayAverages: HourAvg[]
  bestHour: { day: number; hour: number; vehicleAvg: number; samples: number } | null
  weekHeatmap: Array<{ day: number; hour: number; level: 'low' | 'medium' | 'high' | 'none' }>
}

const DAYS_EN  = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat']
const DAYS_ES  = ['Dom', 'Lun', 'Mar', 'Mié', 'Jue', 'Vie', 'Sáb']
const FULL_EN  = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday']
const FULL_ES  = ['Domingo', 'Lunes', 'Martes', 'Miércoles', 'Jueves', 'Viernes', 'Sábado']
const HOURS    = Array.from({ length: 24 }, (_, i) => i)

function formatHour(h: number) {
  if (h === 0) return '12am'
  if (h < 12) return `${h}am`
  if (h === 12) return '12pm'
  return `${h - 12}pm`
}

function waitColor(v: number | null) {
  if (v === null) return 'bg-gray-100 dark:bg-gray-700 text-gray-300'
  if (v < 20) return 'bg-green-100 dark:bg-green-900/30 text-green-700 dark:text-green-400'
  if (v < 45) return 'bg-yellow-100 dark:bg-yellow-900/30 text-yellow-700 dark:text-yellow-400'
  return 'bg-red-100 dark:bg-red-900/30 text-red-700 dark:text-red-400'
}

export default function PredictPage() {
  const { user } = useAuth()
  const { tier } = useTier()
  const { lang } = useLang()
  const router = useRouter()
  const isPro = tier === 'pro' || tier === 'business'
  const es = lang === 'es'

  const [ports, setPorts]               = useState<PortOption[]>([])
  const [selectedPorts, setSelectedPorts] = useState<string[]>([])
  const [selectedDay, setSelectedDay]   = useState<number>(new Date().getDay())
  const [results, setResults]           = useState<Record<string, PortResult>>({})
  const [hasData, setHasData]           = useState<boolean | null>(null)
  const [loading, setLoading]           = useState(false)
  const [view, setView]                 = useState<'compare' | 'heatmap'>('compare')

  // Load ports (keep live wait times too)
  useEffect(() => {
    fetch('/api/ports')
      .then(r => r.json())
      .then(d => {
        const opts = (d.ports || []).map((p: {
          portId: string; portName: string; crossingName: string
          vehicle: number | null; commercial: number | null
        }) => ({
          portId: p.portId,
          portName: p.portName,
          crossingName: p.crossingName,
          vehicle: p.vehicle ?? null,
          commercial: p.commercial ?? null,
        }))
        setPorts(opts)
        setSelectedPorts(opts.slice(0, 3).map((p: PortOption) => p.portId))
      })
  }, [])

  // Load historical predictions
  useEffect(() => {
    if (selectedPorts.length === 0 || !isPro) return
    setLoading(true)
    fetch(`/api/predict?portIds=${selectedPorts.join(',')}&day=${selectedDay}`)
      .then(r => r.json())
      .then(d => {
        setResults(d.results || {})
        setHasData(d.hasData ?? false)
      })
      .finally(() => setLoading(false))
  }, [selectedPorts, selectedDay, isPro])

  function togglePort(portId: string) {
    setSelectedPorts(prev =>
      prev.includes(portId) ? prev.filter(p => p !== portId) : [...prev, portId].slice(0, 5)
    )
  }

  function getAvg(result: PortResult, day: number, hour: number): number | null {
    return result.dayAverages.find(d => d.day === day && d.hour === hour)?.vehicleAvg ?? null
  }

  function getBestHoursForDay(portId: string): HourAvg[] {
    const result = results[portId]
    if (!result) return []
    return result.dayAverages
      .filter(d => d.day === selectedDay && d.vehicleAvg !== null)
      .sort((a, b) => (a.vehicleAvg ?? 999) - (b.vehicleAvg ?? 999))
      .slice(0, 6)
  }

  // Best live crossing among selected ports right now
  const bestLiveCrossing = selectedPorts
    .map(id => ports.find(p => p.portId === id))
    .filter((p): p is PortOption => p !== undefined && p.vehicle !== null)
    .sort((a, b) => (a.vehicle ?? 999) - (b.vehicle ?? 999))[0] ?? null

  const dayLabels  = es ? DAYS_ES : DAYS_EN
  const fullLabels = es ? FULL_ES  : FULL_EN

  function goSetAlert(portId: string, threshold: number) {
    router.push(`/dashboard?tab=alerts&portId=${encodeURIComponent(portId)}&threshold=${threshold}`)
  }

  return (
    <main className="min-h-screen bg-gray-50 dark:bg-gray-950">
      <div className="max-w-3xl mx-auto px-4 pb-16">

        {/* Header */}
        <div className="pt-6 pb-4 flex items-center gap-3">
          <Link href="/" className="p-2 rounded-xl bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 text-gray-600 dark:text-gray-400 hover:bg-gray-50 dark:hover:bg-gray-700">
            <ArrowLeft className="w-4 h-4" />
          </Link>
          <div>
            <h1 className="text-xl font-bold text-gray-900 dark:text-gray-100">
              {es ? 'Planificador de Cruce' : 'Smart Crossing Planner'}
            </h1>
            <p className="text-xs text-gray-500 dark:text-gray-400">
              {es ? 'Encuentra el mejor horario — basado en datos históricos' : 'Find the best time to cross — based on historical wait patterns'}
            </p>
          </div>
        </div>

        {/* Best crossing RIGHT NOW (Pro only) */}
        {isPro && bestLiveCrossing && (
          <div className="bg-gradient-to-r from-green-500 to-emerald-600 rounded-2xl p-4 mb-4 shadow-sm">
            <div className="flex items-center gap-2 mb-1">
              <Zap className="w-4 h-4 text-white" />
              <p className="text-xs font-semibold text-green-100 uppercase tracking-wide">
                {es ? 'Mejor cruce ahora mismo' : 'Best crossing right now'}
              </p>
            </div>
            <div className="flex items-center justify-between">
              <div>
                <p className="text-lg font-bold text-white">{bestLiveCrossing.portName}</p>
                <p className="text-sm text-green-100">{bestLiveCrossing.crossingName}</p>
                {bestLiveCrossing.commercial !== null && (
                  <p className="text-xs text-green-200 mt-0.5">
                    🚛 {bestLiveCrossing.commercial}m {es ? 'camión' : 'truck'}
                  </p>
                )}
              </div>
              <div className="text-right">
                <p className="text-4xl font-bold text-white">{bestLiveCrossing.vehicle}m</p>
                <p className="text-xs text-green-100">{es ? 'espera autos' : 'car wait'}</p>
              </div>
            </div>
            <Link
              href={`/port/${encodeURIComponent(bestLiveCrossing.portId)}`}
              className="mt-3 block text-center text-xs font-semibold bg-white/20 hover:bg-white/30 text-white rounded-xl py-2 transition-colors"
            >
              {es ? 'Ver detalles →' : 'View details →'}
            </Link>
          </div>
        )}

        {/* Pro gate */}
        {!isPro && (
          <div className="bg-purple-50 dark:bg-purple-900/20 border border-purple-200 dark:border-purple-800 rounded-2xl p-5 mb-5">
            <div className="flex items-start gap-3">
              <Lock className="w-5 h-5 text-purple-600 dark:text-purple-400 mt-0.5 flex-shrink-0" />
              <div>
                <p className="text-sm font-bold text-purple-800 dark:text-purple-300">
                  {es ? 'Función Pro: Planificador de Cruce' : 'Pro Feature: Smart Crossing Planner'}
                </p>
                <p className="text-xs text-purple-600 dark:text-purple-400 mt-1 mb-3">
                  {es
                    ? 'Ve tiempos de espera predecidos para cualquier cruce, cualquier día — basado en meses de datos históricos.'
                    : 'See predicted wait times for any crossing, any day of the week — based on months of historical data. Plan days in advance.'}
                </p>
                <div className="space-y-1.5 mb-4">
                  {(es ? [
                    'Mapa de calor semanal: ve qué horas son más rápidas',
                    'Compara varios cruces al mismo tiempo',
                    'Mejor cruce ahora mismo en tiempo real',
                    'Nivel de confianza basado en datos reales',
                    'Predicciones para camiones (carril comercial)',
                  ] : [
                    'Week-view heatmap: see which hours are fastest at a glance',
                    'Compare multiple crossings side-by-side',
                    'Best crossing right now — live + historical combined',
                    'Confidence level based on real crossing data',
                    'Commercial (truck) wait predictions',
                  ]).map(f => (
                    <div key={f} className="flex items-center gap-2">
                      <span className="text-purple-500 text-xs">✓</span>
                      <span className="text-xs text-purple-700 dark:text-purple-300">{f}</span>
                    </div>
                  ))}
                </div>
                <Link href="/pricing" className="inline-block text-xs font-semibold text-white bg-purple-600 px-5 py-2.5 rounded-xl hover:bg-purple-700 transition-colors">
                  {es ? 'Mejorar a Pro →' : 'Upgrade to Pro →'}
                </Link>
              </div>
            </div>
          </div>
        )}

        {/* Port selector */}
        <div className="bg-white dark:bg-gray-800 rounded-2xl border border-gray-200 dark:border-gray-700 p-4 shadow-sm mb-4">
          <p className="text-xs font-semibold text-gray-500 dark:text-gray-400 uppercase tracking-wide mb-3">
            {es ? 'Selecciona cruces a comparar (máx. 5)' : 'Select crossings to compare (up to 5)'}
          </p>
          <div className="flex flex-wrap gap-2">
            {ports.map(p => (
              <button
                key={p.portId}
                onClick={() => isPro && togglePort(p.portId)}
                className={`text-xs px-3 py-1.5 rounded-full border font-medium transition-colors ${
                  selectedPorts.includes(p.portId)
                    ? 'bg-gray-900 dark:bg-gray-100 text-white dark:text-gray-900 border-gray-900'
                    : 'bg-white dark:bg-gray-700 text-gray-600 dark:text-gray-400 border-gray-200 dark:border-gray-600 hover:border-gray-400'
                } ${!isPro ? 'opacity-50 cursor-default' : 'cursor-pointer'}`}
              >
                {p.portName}
                {p.vehicle !== null && (
                  <span className={`ml-1.5 font-bold ${p.vehicle < 20 ? 'text-green-500' : p.vehicle < 45 ? 'text-yellow-500' : 'text-red-500'}`}>
                    {p.vehicle}m
                  </span>
                )}
              </button>
            ))}
          </div>
        </div>

        {/* Day selector */}
        <div className="bg-white dark:bg-gray-800 rounded-2xl border border-gray-200 dark:border-gray-700 p-4 shadow-sm mb-4">
          <p className="text-xs font-semibold text-gray-500 dark:text-gray-400 uppercase tracking-wide mb-3">
            {es ? 'Día de la semana' : 'Day of week'}
          </p>
          <div className="grid grid-cols-7 gap-1">
            {dayLabels.map((day, i) => (
              <button
                key={day}
                onClick={() => isPro && setSelectedDay(i)}
                className={`py-2 text-xs font-semibold rounded-xl transition-colors ${
                  selectedDay === i
                    ? 'bg-gray-900 dark:bg-gray-100 text-white dark:text-gray-900'
                    : 'bg-gray-50 dark:bg-gray-700 text-gray-500 dark:text-gray-400 hover:bg-gray-100 dark:hover:bg-gray-600'
                } ${!isPro ? 'opacity-50 cursor-default' : 'cursor-pointer'}`}
              >
                {day}
              </button>
            ))}
          </div>
        </div>

        {/* View tabs */}
        {isPro && (
          <div className="flex bg-gray-100 dark:bg-gray-800 rounded-xl p-1 mb-4">
            {[
              { key: 'compare', label: es ? 'Mejores Horas' : 'Best Hours' },
              { key: 'heatmap', label: es ? 'Mapa de Calor' : 'Week Heatmap' },
            ].map(t => (
              <button
                key={t.key}
                onClick={() => setView(t.key as typeof view)}
                className={`flex-1 py-2 text-xs font-medium rounded-lg transition-colors ${
                  view === t.key
                    ? 'bg-white dark:bg-gray-700 shadow text-gray-900 dark:text-gray-100'
                    : 'text-gray-500 dark:text-gray-400'
                }`}
              >
                {t.label}
              </button>
            ))}
          </div>
        )}

        {/* Loading */}
        {loading && (
          <div className="flex justify-center py-12">
            <div className="w-6 h-6 border-2 border-gray-200 border-t-gray-900 rounded-full animate-spin" />
          </div>
        )}

        {/* No data yet */}
        {!loading && isPro && hasData === false && (
          <div className="bg-gray-50 dark:bg-gray-800 rounded-2xl border border-dashed border-gray-300 dark:border-gray-700 p-8 text-center">
            <Clock className="w-8 h-8 text-gray-300 mx-auto mb-3" />
            <p className="text-sm font-semibold text-gray-600 dark:text-gray-400">
              {es ? 'No hay suficientes datos históricos aún' : 'Not enough historical data yet'}
            </p>
            <p className="text-xs text-gray-400 mt-1">
              {es
                ? 'El sistema necesita algunas semanas para construir patrones precisos. Los datos se recolectan cada 15 minutos.'
                : 'The prediction engine needs a few weeks of data to build accurate patterns. Check back soon — data is collected every 15 minutes.'}
            </p>
          </div>
        )}

        {/* ── COMPARE VIEW ── */}
        {!loading && isPro && hasData && view === 'compare' && (
          <div className="space-y-4">
            <p className="text-xs text-gray-400 dark:text-gray-500 flex items-center gap-1">
              <Info className="w-3 h-3" />
              {es
                ? `Mejores horas para ${fullLabels[selectedDay]} — basado en promedios históricos`
                : `Showing best hours for ${fullLabels[selectedDay]} based on historical averages`}
            </p>

            {selectedPorts.map(portId => {
              const port = ports.find(p => p.portId === portId)
              const result = results[portId]
              const bestHours = getBestHoursForDay(portId)

              return (
                <div key={portId} className="bg-white dark:bg-gray-800 rounded-2xl border border-gray-200 dark:border-gray-700 shadow-sm overflow-hidden">
                  <div className="px-4 py-3 border-b border-gray-100 dark:border-gray-700 flex items-center justify-between">
                    <div>
                      <p className="text-sm font-bold text-gray-900 dark:text-gray-100">{port?.portName}</p>
                      <p className="text-xs text-gray-400">{port?.crossingName}</p>
                    </div>
                    <div className="flex flex-col items-end gap-1">
                      {result?.bestHour && (
                        <div className="text-right">
                          <p className="text-xs text-gray-400">{es ? 'Mejor hora' : 'Best time'}</p>
                          <p className="text-sm font-bold text-green-600 dark:text-green-400">
                            {formatHour(result.bestHour.hour)} · ~{result.bestHour.vehicleAvg}m
                          </p>
                        </div>
                      )}
                      {/* Live wait badge */}
                      {port?.vehicle !== null && port?.vehicle !== undefined && (
                        <span className={`text-xs font-semibold px-2 py-0.5 rounded-full ${waitColor(port.vehicle)}`}>
                          {es ? 'Ahora: ' : 'Live: '}{port.vehicle}m
                        </span>
                      )}
                    </div>
                  </div>

                  {bestHours.length === 0 ? (
                    <div className="p-4 text-center text-xs text-gray-400">
                      {es ? `Sin datos para ${fullLabels[selectedDay]} aún` : `No data for ${fullLabels[selectedDay]} yet`}
                    </div>
                  ) : (
                    <div className="p-4">
                      <div className="grid grid-cols-3 gap-2">
                        {bestHours.map((h, i) => (
                          <div
                            key={`${h.day}-${h.hour}`}
                            className={`rounded-xl p-3 text-center ${i === 0 ? 'bg-green-50 dark:bg-green-900/20 border border-green-200 dark:border-green-800' : 'bg-gray-50 dark:bg-gray-700'}`}
                          >
                            <p className={`text-xs font-bold ${i === 0 ? 'text-green-600 dark:text-green-400' : 'text-gray-500 dark:text-gray-400'}`}>
                              {i === 0 && '✓ '}{formatHour(h.hour)}
                            </p>
                            <p className={`text-xl font-bold mt-0.5 ${i === 0 ? 'text-green-700 dark:text-green-300' : 'text-gray-700 dark:text-gray-300'}`}>
                              {h.vehicleAvg}m
                            </p>
                            <p className="text-xs text-gray-400 mt-0.5">{es ? 'auto prom.' : 'avg car'}</p>
                            {h.commercialAvg !== null && (
                              <p className="text-xs text-gray-500 dark:text-gray-400 font-medium mt-0.5">
                                {h.commercialAvg}m {es ? 'camión' : 'truck'}
                              </p>
                            )}
                            {/* Confidence */}
                            <p className="text-xs text-gray-300 dark:text-gray-600 mt-1">
                              {h.samples} {es ? 'registros' : 'samples'}
                            </p>
                          </div>
                        ))}
                      </div>

                      {/* Set alert shortcut */}
                      {bestHours[0] && (
                        <button
                          onClick={() => goSetAlert(portId, bestHours[0].vehicleAvg ?? 20)}
                          className="mt-3 w-full flex items-center justify-center gap-1.5 text-xs font-medium text-blue-600 dark:text-blue-400 border border-blue-200 dark:border-blue-800 bg-blue-50 dark:bg-blue-900/20 rounded-xl py-2 hover:bg-blue-100 dark:hover:bg-blue-900/40 transition-colors"
                        >
                          <Bell className="w-3.5 h-3.5" />
                          {es
                            ? `Alertarme cuando baje a ~${bestHours[0].vehicleAvg}m`
                            : `Alert me when it drops to ~${bestHours[0].vehicleAvg}m`}
                        </button>
                      )}

                      {/* Mini bar chart */}
                      {result && (
                        <div className="mt-3">
                          <p className="text-xs text-gray-400 mb-1.5">
                            {es ? `Espera por hora (${fullLabels[selectedDay]})` : `Wait by hour (${fullLabels[selectedDay]})`}
                          </p>
                          <div className="flex items-end gap-0.5" style={{ height: 48 }}>
                            {HOURS.map(hour => {
                              const a = getAvg(result, selectedDay, hour)
                              const heightPx = a !== null ? Math.max(4, Math.round((Math.min(a, 60) / 60) * 44)) : 2
                              const color = a === null ? 'bg-gray-100 dark:bg-gray-700' : a < 20 ? 'bg-green-400' : a < 45 ? 'bg-yellow-400' : 'bg-red-400'
                              const isCurrent = hour === new Date().getHours()
                              return (
                                <div key={hour} className="flex-1 flex flex-col items-center justify-end" style={{ height: 48 }}>
                                  <div
                                    className={`w-full rounded-t-sm ${color} ${isCurrent ? 'ring-1 ring-blue-400' : ''}`}
                                    style={{ height: heightPx }}
                                    title={a !== null ? `${formatHour(hour)}: ~${a}m` : `${formatHour(hour)}: ${es ? 'sin datos' : 'no data'}`}
                                  />
                                </div>
                              )
                            })}
                          </div>
                          <div className="flex justify-between text-xs text-gray-300 mt-0.5">
                            <span>12am</span><span>6am</span><span>12pm</span><span>6pm</span><span>11pm</span>
                          </div>
                        </div>
                      )}
                    </div>
                  )}
                </div>
              )
            })}
          </div>
        )}

        {/* ── HEATMAP VIEW ── */}
        {!loading && isPro && hasData && view === 'heatmap' && selectedPorts.length > 0 && (
          <div className="space-y-6">
            {selectedPorts.map(portId => {
              const port = ports.find(p => p.portId === portId)
              const result = results[portId]
              if (!result) return null
              const hoursToShow = [6, 7, 8, 9, 10, 11, 12, 13, 14, 15, 16, 17, 18, 19, 20, 21]

              return (
                <div key={portId} className="bg-white dark:bg-gray-800 rounded-2xl border border-gray-200 dark:border-gray-700 shadow-sm overflow-hidden">
                  <div className="px-4 py-3 border-b border-gray-100 dark:border-gray-700 flex items-center justify-between">
                    <div>
                      <p className="text-sm font-bold text-gray-900 dark:text-gray-100">{port?.portName}</p>
                      <p className="text-xs text-gray-400">{port?.crossingName}</p>
                    </div>
                    {port?.vehicle !== null && port?.vehicle !== undefined && (
                      <span className={`text-xs font-semibold px-2 py-0.5 rounded-full ${waitColor(port.vehicle)}`}>
                        {es ? 'Ahora: ' : 'Live: '}{port.vehicle}m
                      </span>
                    )}
                  </div>
                  <div className="p-4 overflow-x-auto">
                    <table className="min-w-full text-xs">
                      <thead>
                        <tr>
                          <th className="text-left text-gray-400 font-normal pr-3 py-1 w-10">{es ? 'Hora' : 'Hour'}</th>
                          {dayLabels.map(d => (
                            <th key={d} className="text-center text-gray-400 font-normal px-1 py-1">{d}</th>
                          ))}
                        </tr>
                      </thead>
                      <tbody>
                        {hoursToShow.map(hour => (
                          <tr key={hour}>
                            <td className="text-gray-400 pr-3 py-0.5 text-xs">{formatHour(hour)}</td>
                            {DAYS_EN.map((_, dayIdx) => {
                              const cell = result.weekHeatmap.find(c => c.day === dayIdx && c.hour === hour)
                              const level = cell?.level ?? 'none'
                              const avg = result.dayAverages.find(d => d.day === dayIdx && d.hour === hour)?.vehicleAvg
                              const samples = result.dayAverages.find(d => d.day === dayIdx && d.hour === hour)?.samples
                              return (
                                <td key={dayIdx} className="px-1 py-0.5 text-center">
                                  <div
                                    className={`w-full h-6 rounded flex items-center justify-center text-xs font-medium ${
                                      level === 'none'   ? 'bg-gray-50 dark:bg-gray-700 text-gray-300' :
                                      level === 'low'    ? 'bg-green-100 dark:bg-green-900/30 text-green-700 dark:text-green-400' :
                                      level === 'medium' ? 'bg-yellow-100 dark:bg-yellow-900/30 text-yellow-700 dark:text-yellow-400' :
                                                           'bg-red-100 dark:bg-red-900/30 text-red-700 dark:text-red-400'
                                    }`}
                                    title={avg != null ? `~${avg}m (${samples ?? 0} ${es ? 'registros' : 'samples'})` : (es ? 'Sin datos' : 'No data')}
                                  >
                                    {avg != null ? avg : '—'}
                                  </div>
                                </td>
                              )
                            })}
                          </tr>
                        ))}
                      </tbody>
                    </table>
                    <div className="flex gap-3 mt-3">
                      {[
                        { level: 'low',    label: es ? 'Rápido (<20m)'     : 'Fast (<20m)',     color: 'bg-green-100 text-green-700' },
                        { level: 'medium', label: es ? 'Moderado (20-45m)' : 'Moderate (20-45m)', color: 'bg-yellow-100 text-yellow-700' },
                        { level: 'high',   label: es ? 'Lento (>45m)'      : 'Slow (>45m)',     color: 'bg-red-100 text-red-700' },
                      ].map(l => (
                        <div key={l.level} className="flex items-center gap-1">
                          <span className={`w-3 h-3 rounded ${l.color} inline-block`} />
                          <span className="text-xs text-gray-400">{l.label}</span>
                        </div>
                      ))}
                    </div>
                  </div>
                </div>
              )
            })}
          </div>
        )}

        {/* Free user blurred preview */}
        {!isPro && (
          <div className="relative">
            <div className="blur-sm pointer-events-none select-none" aria-hidden>
              <div className="bg-white dark:bg-gray-800 rounded-2xl border border-gray-200 p-4 shadow-sm mb-4">
                <p className="text-sm font-bold mb-2 text-gray-900">Pharr-Reynosa International Bridge</p>
                <div className="grid grid-cols-3 gap-2">
                  {['6am', '10am', '2pm'].map(t => (
                    <div key={t} className="bg-green-50 rounded-xl p-3 text-center">
                      <p className="text-xs font-bold text-green-600">{t}</p>
                      <p className="text-xl font-bold text-green-700">12m</p>
                      <p className="text-xs text-gray-400">avg car</p>
                    </div>
                  ))}
                </div>
              </div>
            </div>
            <div className="absolute inset-0 flex items-center justify-center">
              <div className="bg-white dark:bg-gray-900 rounded-2xl border border-gray-200 dark:border-gray-700 p-5 shadow-lg text-center max-w-xs">
                <Lock className="w-6 h-6 text-purple-600 mx-auto mb-2" />
                <p className="text-sm font-bold text-gray-900 dark:text-gray-100">
                  {es ? 'Mejora a Pro' : 'Upgrade to Pro'}
                </p>
                <p className="text-xs text-gray-500 mt-1 mb-3">
                  {es ? 'Activa el Planificador y deja de adivinar cuándo cruzar.' : 'Unlock the Smart Crossing Planner and stop guessing when to go.'}
                </p>
                <Link href="/pricing" className="inline-block text-xs font-semibold text-white bg-purple-600 px-5 py-2 rounded-xl hover:bg-purple-700 transition-colors">
                  {es ? 'Ver Planes Pro →' : 'See Pro Plans →'}
                </Link>
              </div>
            </div>
          </div>
        )}

      </div>
    </main>
  )
}
