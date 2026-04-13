'use client'

import { useEffect, useState, useMemo } from 'react'
import Link from 'next/link'
import { useLang } from '@/lib/LangContext'
import { useTier } from '@/lib/useTier'
import { getPortMeta } from '@/lib/portMeta'
import { formatWaitLabel } from '@/lib/formatWait'
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
  hours: Array<{ hour: number; avgWait: number }>
}

function formatHour(h: number): string {
  return `${h.toString().padStart(2, '0')}:00`
}

export default function DatosPage() {
  const { lang } = useLang()
  const { tier } = useTier()
  const es = lang === 'es'
  const isPro = tier === 'pro' || tier === 'business'

  const [ports, setPorts] = useState<PortWaitTime[]>([])
  const [selectedPortId, setSelectedPortId] = useState<string | null>(null)
  const [hourly, setHourly] = useState<HourlyResponse | null>(null)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    fetch('/api/ports', { cache: 'no-store' })
      .then((r) => r.json())
      .then((d) => {
        const list: PortWaitTime[] = (d.ports || []).filter((p: PortWaitTime) => !p.isClosed && p.vehicle != null)
        setPorts(list)
        if (list.length > 0 && !selectedPortId) setSelectedPortId(list[0].portId)
      })
      .catch(() => { /* ignore */ })
      .finally(() => setLoading(false))
  }, [selectedPortId])

  useEffect(() => {
    if (!selectedPortId || !isPro) return
    fetch(`/api/ports/${encodeURIComponent(selectedPortId)}/hourly`)
      .then((r) => r.json())
      .then((d) => setHourly(d))
      .catch(() => setHourly(null))
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
              <label className="text-[10px] uppercase tracking-widest font-bold text-gray-500 dark:text-gray-400">
                {es ? 'Puente' : 'Crossing'}
              </label>
              <select
                value={selectedPortId || ''}
                onChange={(e) => { setSelectedPortId(e.target.value); setHourly(null) }}
                className="mt-1 w-full bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-2xl px-3 py-2.5 text-sm font-semibold text-gray-900 dark:text-gray-100"
              >
                {ports.map((p) => {
                  const meta = getPortMeta(p.portId)
                  const name = p.localNameOverride || meta.localName || p.portName
                  return (
                    <option key={p.portId} value={p.portId}>
                      {name} — {meta.city}
                    </option>
                  )
                })}
              </select>
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

            {hourly && hourly.hours && hourly.hours.length > 0 && (
              <div className="mt-3 bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-2xl p-4">
                <p className="text-[10px] uppercase tracking-widest font-bold text-gray-500 dark:text-gray-400 mb-2">
                  {es ? 'Patrón por hora' : 'Hourly pattern'}
                </p>
                <HourlyBarChart data={hourly.hours} />
              </div>
            )}

            {!hourly && selectedPortId && (
              <p className="mt-6 text-center text-xs text-gray-400">
                {loading ? (es ? 'Cargando…' : 'Loading…') : (es ? 'Sin datos históricos pa\' este puente' : 'No historical data for this crossing')}
              </p>
            )}
          </>
        )}
      </div>
    </main>
  )
}

function HourlyBarChart({ data }: { data: Array<{ hour: number; avgWait: number }> }) {
  const max = Math.max(...data.map((d) => d.avgWait), 1)
  return (
    <div className="flex items-end gap-0.5 h-28">
      {data.map((d) => {
        const h = Math.max(4, (d.avgWait / max) * 100)
        const color = d.avgWait <= 20 ? 'bg-green-500' : d.avgWait <= 45 ? 'bg-amber-500' : 'bg-red-500'
        return (
          <div key={d.hour} className="flex-1 flex flex-col items-center gap-1" title={`${d.hour}:00 — ${d.avgWait} min`}>
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
