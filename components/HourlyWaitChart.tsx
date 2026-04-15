'use client'

import { useEffect, useState } from 'react'
import { useLang } from '@/lib/LangContext'
import { formatWaitLabel } from '@/lib/formatWait'

interface HourBucket {
  hour: number
  avgWait: number | null
  todayAvg: number | null
  samples: number
}

interface Props {
  portId: string
}

function formatHour(h: number, es: boolean): string {
  if (es) {
    return `${h.toString().padStart(2, '0')}:00`
  }
  if (h === 0) return '12am'
  if (h < 12) return `${h}am`
  if (h === 12) return '12pm'
  return `${h - 12}pm`
}

function colorFor(wait: number | null): string {
  // Null-data slots render as a faint light slot so the column
  // positions are still anchored visually. Previously these were
  // dark-gray-on-dark-gray and completely invisible in dark mode,
  // which made the chart look broken when only a few hours had data.
  if (wait == null) return 'bg-gray-200 dark:bg-gray-600/60'
  if (wait <= 15) return 'bg-emerald-500'
  if (wait <= 30) return 'bg-lime-500'
  if (wait <= 45) return 'bg-amber-500'
  if (wait <= 60) return 'bg-orange-500'
  return 'bg-red-600'
}

export function HourlyWaitChart({ portId }: Props) {
  const { lang } = useLang()
  const es = lang === 'es'
  const [hours, setHours] = useState<HourBucket[]>([])
  const [loading, setLoading] = useState(true)
  const [peak, setPeak] = useState<{ hour: number; avgWait: number } | null>(null)
  const [best, setBest] = useState<{ hour: number; avgWait: number } | null>(null)
  const [hovered, setHovered] = useState<number | null>(null)

  useEffect(() => {
    let cancelled = false
    fetch(`/api/ports/${encodeURIComponent(portId)}/hourly`)
      .then(r => r.json())
      .then(d => {
        if (cancelled) return
        setHours(d.hours || [])
        setPeak(d.peak || null)
        setBest(d.best || null)
        setLoading(false)
      })
      .catch(() => {
        if (cancelled) return
        setLoading(false)
      })
    return () => { cancelled = true }
  }, [portId])

  const validCount = hours.filter(h => h.avgWait != null).length
  const maxWait = hours.reduce((m, h) => (h.avgWait != null && h.avgWait > m ? h.avgWait : m), 0)
  const currentHour = new Date().getHours()
  const focusHour = hovered ?? currentHour
  const focusBucket = hours[focusHour]

  return (
    <div className="bg-white dark:bg-gray-800 rounded-2xl border border-gray-200 dark:border-gray-700 p-5 shadow-sm">
      <div className="flex items-center justify-between mb-1">
        <h2 className="text-sm font-semibold text-gray-700 dark:text-gray-200">
          {es ? 'Espera por hora del día' : 'Wait by hour of day'}
        </h2>
        <span className="text-[10px] text-gray-400 dark:text-gray-500">
          {es ? 'últimos 14 días' : 'last 14 days'}
        </span>
      </div>
      <p className="text-xs text-gray-500 dark:text-gray-400 mb-4">
        {es ? 'Patrón típico de un día — verde es rápido, rojo es lento' : 'Typical day pattern — green is fast, red is slow'}
      </p>

      {loading ? (
        <div className="h-40 bg-gray-100 dark:bg-gray-700 rounded-xl animate-pulse" />
      ) : validCount < 4 ? (
        <p className="text-sm text-gray-400 text-center py-8">
          {es ? 'Aún no hay suficientes datos. Vuelve en unos días.' : 'Not enough history yet. Check back in a few days.'}
        </p>
      ) : (
        <>
          <div className="flex items-end gap-[3px] h-32">
            {hours.map((h) => {
              const heightPct = h.avgWait != null && maxWait > 0 ? Math.max(8, (h.avgWait / maxWait) * 100) : 6
              const isCurrent = h.hour === currentHour
              const isHovered = h.hour === hovered
              return (
                <button
                  key={h.hour}
                  type="button"
                  onMouseEnter={() => setHovered(h.hour)}
                  onMouseLeave={() => setHovered(null)}
                  onFocus={() => setHovered(h.hour)}
                  onBlur={() => setHovered(null)}
                  className="flex-1 h-full flex flex-col justify-end items-center group relative"
                  aria-label={`${formatHour(h.hour, es)}: ${h.avgWait != null ? formatWaitLabel(h.avgWait, es ? 'es' : 'en') : 'sin datos'}`}
                >
                  <div
                    className={`w-full rounded-t-sm transition-all ${colorFor(h.avgWait)} ${
                      isCurrent ? 'ring-2 ring-blue-500 ring-offset-1 ring-offset-white dark:ring-offset-gray-800' : ''
                    } ${isHovered ? 'opacity-100' : ''}`}
                    style={{ height: `${heightPct}%` }}
                  />
                </button>
              )
            })}
          </div>

          <div className="flex justify-between mt-1 text-[9px] text-gray-400 dark:text-gray-500 font-medium">
            <span>12a</span>
            <span>6a</span>
            <span>12p</span>
            <span>6p</span>
            <span>11p</span>
          </div>

          {focusBucket && (
            <div className="mt-3 flex items-center justify-between text-xs">
              <span className="text-gray-500 dark:text-gray-400">
                {hovered == null
                  ? (es ? 'Ahora' : 'Now')
                  : formatHour(focusBucket.hour, es)}
              </span>
              {focusBucket.avgWait != null ? (
                <span className="font-semibold text-gray-800 dark:text-gray-100">
                  ~{formatWaitLabel(focusBucket.avgWait, es ? 'es' : 'en')} {es ? 'promedio' : 'avg'}
                  {focusBucket.todayAvg != null && focusBucket.todayAvg !== focusBucket.avgWait && (
                    <span className="ml-2 text-gray-400 font-normal">
                      ({es ? 'hoy' : 'today'} ~{formatWaitLabel(focusBucket.todayAvg, es ? 'es' : 'en')})
                    </span>
                  )}
                </span>
              ) : (
                <span className="text-gray-400">{es ? 'todavía recopilando' : 'still collecting'}</span>
              )}
            </div>
          )}

          {(peak || best) && (
            <div className="mt-3 pt-3 border-t border-gray-100 dark:border-gray-700 grid grid-cols-2 gap-3 text-xs">
              {best && (
                <div>
                  <p className="text-gray-400 dark:text-gray-500">{es ? 'Mejor hora' : 'Best hour'}</p>
                  <p className="font-bold text-emerald-600 dark:text-emerald-400">
                    {formatHour(best.hour, es)} · ~{formatWaitLabel(best.avgWait, es ? 'es' : 'en')}
                  </p>
                </div>
              )}
              {peak && (
                <div>
                  <p className="text-gray-400 dark:text-gray-500">{es ? 'Más lento' : 'Worst hour'}</p>
                  <p className="font-bold text-red-600 dark:text-red-400">
                    {formatHour(peak.hour, es)} · ~{formatWaitLabel(peak.avgWait, es ? 'es' : 'en')}
                  </p>
                </div>
              )}
            </div>
          )}
        </>
      )}
    </div>
  )
}
