'use client'

import { useEffect, useState } from 'react'
import Link from 'next/link'
import { Clock, TrendingDown, TrendingUp } from 'lucide-react'
import { useLang } from '@/lib/LangContext'
import { getPortMeta } from '@/lib/portMeta'

// Tier 2 personalization — a compact forecast card on home for the
// user's saved bridge. Reuses /api/ports/[portId]/forecast (same
// endpoint powering the port detail card rail).
//
// Shows:
//   - "Now X min" for the saved bridge
//   - Mini 5-hour forecast (NOW, +1H, +2H, +3H, +4H)
//   - "Best today: Xam" / "Rush today: Ypm" tags
//   - Time-shift hint when a nearby hour is meaningfully better
//     than now (e.g. "Wait 20 min, save 15 min")
//
// Only renders for signed-in users with a saved bridge. Self-hides
// if the forecast returns no data (new port with no history).

interface Props {
  favoritePortId: string
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

export function HomeForecast({ favoritePortId }: Props) {
  const { lang } = useLang()
  const es = lang === 'es'
  const [forecast, setForecast] = useState<ForecastResponse | null>(null)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    setLoading(true)
    fetch(`/api/ports/${encodeURIComponent(favoritePortId)}/forecast?lane=standard`)
      .then((r) => (r.ok ? r.json() : null))
      .then((d) => setForecast(d))
      .catch(() => setForecast(null))
      .finally(() => setLoading(false))
  }, [favoritePortId])

  if (loading || !forecast) return null

  const now = forecast.forecast[0]
  const hasAnyData = forecast.forecast.some((f) => f.avgWait != null)
  if (!hasAnyData) return null

  const meta = getPortMeta(favoritePortId)
  const portLabel = meta.localName || meta.city || favoritePortId

  // Time-shift hint: look at NOW + 1..4 hours forward. If any future
  // hour is meaningfully faster (>=10 min savings), suggest waiting.
  // Also check the bestHour if it's within the next 6 hours.
  const timeShiftHint = (() => {
    if (now?.avgWait == null) return null
    const nowWait = now.avgWait
    // Scan forward slots
    for (let i = 1; i <= 4; i++) {
      const slot = forecast.forecast[i]
      if (slot?.avgWait != null && nowWait - slot.avgWait >= 10) {
        return {
          waitHours: i,
          saveMin: nowWait - slot.avgWait,
          targetHour: slot.hour,
        }
      }
    }
    return null
  })()

  return (
    <Link
      href={`/port/${encodeURIComponent(favoritePortId)}`}
      className="mt-3 block bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-2xl p-4 active:scale-[0.98] transition-transform"
    >
      <div className="flex items-center justify-between mb-1">
        <div className="flex items-center gap-2">
          <Clock className="w-4 h-4 text-indigo-600 dark:text-indigo-400" />
          <p className="text-[10px] font-black uppercase tracking-widest text-indigo-700 dark:text-indigo-300">
            {es ? 'Pronóstico' : 'Forecast'}
          </p>
        </div>
        <p className="text-[10px] text-gray-500 dark:text-gray-400 font-semibold truncate max-w-[140px]">
          {portLabel}
        </p>
      </div>
      <p className="text-[9px] text-gray-400 dark:text-gray-500 mb-3">
        {es ? 'Estimado según historial de este día' : 'Estimated from past trends for this day'}
      </p>

      {/* 5-hour forecast rail */}
      <div className="flex gap-1.5">
        {forecast.forecast.map((f) => {
          const isNow = f.delta === 'NOW'
          const color = f.avgWait == null ? 'bg-gray-100 dark:bg-gray-700 text-gray-400'
            : f.avgWait <= 20 ? 'bg-green-50 dark:bg-green-900/20 text-green-700 dark:text-green-400 border-green-200 dark:border-green-800'
            : f.avgWait <= 45 ? 'bg-amber-50 dark:bg-amber-900/20 text-amber-700 dark:text-amber-400 border-amber-200 dark:border-amber-800'
            : 'bg-red-50 dark:bg-red-900/20 text-red-700 dark:text-red-400 border-red-200 dark:border-red-800'
          return (
            <div
              key={f.delta}
              className={`flex-1 rounded-xl border px-1 py-2 text-center ${color} ${isNow ? 'ring-2 ring-indigo-500' : ''}`}
            >
              <p className="text-[8px] font-black uppercase tracking-wider opacity-70">
                {isNow
                  ? (es ? 'Ahora' : 'Now')
                  : es
                    ? `en ${f.delta.replace('+', '').replace('H', ' hr')}`
                    : `in ${f.delta.replace('+', '').replace('H', ' hr')}`}
              </p>
              <p className="text-sm font-black tabular-nums mt-0.5">
                {f.avgWait == null ? '—' : `${f.avgWait}m`}
              </p>
              <p className="text-[8px] font-bold opacity-60 mt-0.5">
                {formatHour(f.hour)}
              </p>
            </div>
          )
        })}
      </div>

      {/* Time-shift hint */}
      {timeShiftHint && (
        <div className="mt-3 flex items-center gap-2 bg-green-50 dark:bg-green-900/20 border border-green-200 dark:border-green-800 rounded-xl px-3 py-2">
          <TrendingDown className="w-4 h-4 text-green-600 dark:text-green-400 flex-shrink-0" />
          <p className="text-[11px] text-green-800 dark:text-green-200 leading-snug">
            {es
              ? `Espera ${timeShiftHint.waitHours}h, ahorras ${timeShiftHint.saveMin} min (salir a las ${formatHour(timeShiftHint.targetHour)})`
              : `Wait ${timeShiftHint.waitHours}h, save ${timeShiftHint.saveMin} min (leave at ${formatHour(timeShiftHint.targetHour)})`}
          </p>
        </div>
      )}

      {/* Best / Rush tags */}
      {(forecast.bestHour || forecast.rushHour) && (
        <div className="mt-3 flex items-center gap-2 text-[10px]">
          {forecast.bestHour && (
            <span className="inline-flex items-center gap-1 bg-green-50 dark:bg-green-900/20 text-green-700 dark:text-green-400 font-bold px-2 py-1 rounded-full">
              <TrendingDown className="w-2.5 h-2.5" />
              {es ? 'Mejor' : 'Best'}: {formatHour(forecast.bestHour.hour)}
            </span>
          )}
          {forecast.rushHour && (
            <span className="inline-flex items-center gap-1 bg-red-50 dark:bg-red-900/20 text-red-700 dark:text-red-400 font-bold px-2 py-1 rounded-full">
              <TrendingUp className="w-2.5 h-2.5" />
              {es ? 'Pico' : 'Rush'}: {formatHour(forecast.rushHour.hour)}
            </span>
          )}
        </div>
      )}
    </Link>
  )
}
