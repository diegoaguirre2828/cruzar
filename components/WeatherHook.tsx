'use client'

import { useEffect, useState } from 'react'
import { useLang } from '@/lib/LangContext'

// Weather hook for border crossings. Uses Open-Meteo (free, no key
// needed) to pull the next 6h forecast for the user's region and
// surface a single specific warning when heavy rain, fog, or strong
// winds are incoming. These conditions slow down crossings — honestly
// framed as general knowledge, not derived from your historical data.
//
// This is something nobody else at the border has: predictive context
// that turns "check the wait times" into "check if I should leave now
// before the rain hits." Drives signup for alerts.

const REGION_COORDS: Array<{ key: string; lat: number; lng: number; labelEs: string; labelEn: string }> = [
  { key: 'rgv',        lat: 26.20, lng: -98.23, labelEs: 'el RGV',         labelEn: 'the RGV' },
  { key: 'laredo',     lat: 27.53, lng: -99.50, labelEs: 'Laredo',         labelEn: 'Laredo' },
  { key: 'el-paso',    lat: 31.76, lng: -106.49, labelEs: 'El Paso',       labelEn: 'El Paso' },
  { key: 'tijuana',    lat: 32.54, lng: -117.03, labelEs: 'Tijuana',       labelEn: 'Tijuana' },
  { key: 'mexicali',   lat: 32.65, lng: -115.47, labelEs: 'Mexicali',      labelEn: 'Mexicali' },
  { key: 'nogales',    lat: 31.34, lng: -110.94, labelEs: 'Nogales',       labelEn: 'Nogales' },
]

type Warning = {
  kind: 'rain' | 'fog' | 'wind'
  hoursAway: number
  regionLabel: string
}

function haversineKm(a: { lat: number; lng: number }, b: { lat: number; lng: number }): number {
  const toRad = (d: number) => (d * Math.PI) / 180
  const dLat = toRad(b.lat - a.lat)
  const dLng = toRad(b.lng - a.lng)
  const h = Math.sin(dLat / 2) ** 2 +
    Math.cos(toRad(a.lat)) * Math.cos(toRad(b.lat)) * Math.sin(dLng / 2) ** 2
  return 2 * 6371 * Math.asin(Math.sqrt(h))
}

function nearestRegion(lat: number, lng: number) {
  let best = REGION_COORDS[0]
  let bestD = Infinity
  for (const r of REGION_COORDS) {
    const d = haversineKm({ lat, lng }, { lat: r.lat, lng: r.lng })
    if (d < bestD) { best = r; bestD = d }
  }
  return best
}

interface WeatherHookProps {
  variant?: 'card' | 'pill'
}

export function WeatherHook({ variant = 'card' }: WeatherHookProps = {}) {
  const { lang } = useLang()
  const es = lang === 'es'
  const [warning, setWarning] = useState<Warning | null>(null)

  useEffect(() => {
    let cancelled = false

    async function load() {
      // Try geolocation to pick the closest region; if blocked, fall back
      // to the user's preferred mega-region from localStorage (or RGV).
      let region = REGION_COORDS[0]
      try {
        const stored = localStorage.getItem('cruzar_mega_region')
        const match = REGION_COORDS.find((r) => r.key === stored)
        if (match) region = match
      } catch { /* ignore */ }

      if (typeof navigator !== 'undefined' && navigator.geolocation) {
        await new Promise<void>((resolve) => {
          const timer = setTimeout(() => resolve(), 3500)
          navigator.geolocation.getCurrentPosition(
            (pos) => {
              clearTimeout(timer)
              region = nearestRegion(pos.coords.latitude, pos.coords.longitude)
              resolve()
            },
            () => { clearTimeout(timer); resolve() },
            { timeout: 3000, maximumAge: 10 * 60 * 1000, enableHighAccuracy: false },
          )
        })
      }
      if (cancelled) return

      // Open-Meteo: free, no key. Pull hourly precipitation, visibility,
      // and wind for the next 6 hours.
      const url = `https://api.open-meteo.com/v1/forecast?latitude=${region.lat}&longitude=${region.lng}&hourly=precipitation,visibility,wind_speed_10m&forecast_hours=6&timezone=auto`
      try {
        const res = await fetch(url)
        if (!res.ok) return
        const data = await res.json()
        if (cancelled) return
        const hourly = data?.hourly
        if (!hourly) return
        const precip: number[] = hourly.precipitation || []
        const vis: number[] = hourly.visibility || []
        const wind: number[] = hourly.wind_speed_10m || []

        // Find the first hour with a meaningful condition.
        let warn: Warning | null = null
        for (let i = 0; i < Math.min(6, precip.length); i++) {
          const label = es ? region.labelEs : region.labelEn
          if (precip[i] >= 2) { warn = { kind: 'rain', hoursAway: i, regionLabel: label }; break }
          if (vis[i] > 0 && vis[i] < 1500) { warn = { kind: 'fog', hoursAway: i, regionLabel: label }; break }
          if (wind[i] >= 40) { warn = { kind: 'wind', hoursAway: i, regionLabel: label }; break }
        }
        if (warn) setWarning(warn)
      } catch { /* silent */ }
    }

    load()
    return () => { cancelled = true }
  }, [es])

  if (!warning) return null

  const hoursLabel = warning.hoursAway === 0
    ? (es ? 'en menos de 1 hora' : 'in under an hour')
    : warning.hoursAway === 1
      ? (es ? 'en 1 hora' : 'in 1 hour')
      : (es ? `en ${warning.hoursAway} horas` : `in ${warning.hoursAway} hours`)

  const COPY: Record<Warning['kind'], { emoji: string; es: string; en: string }> = {
    rain: {
      emoji: '🌧️',
      es: `Va a llover en ${warning.regionLabel} ${hoursLabel} — con lluvia los puentes suelen lentarse. Si puedes cruzar antes, mejor.`,
      en: `Rain coming to ${warning.regionLabel} ${hoursLabel} — crossings usually slow down in rain. Cross earlier if you can.`,
    },
    fog: {
      emoji: '🌫️',
      es: `Viene neblina en ${warning.regionLabel} ${hoursLabel} — visibilidad baja, los puentes se lentan. Maneja con cuidado.`,
      en: `Fog incoming to ${warning.regionLabel} ${hoursLabel} — low visibility slows bridges. Drive carefully.`,
    },
    wind: {
      emoji: '💨',
      es: `Viento fuerte en ${warning.regionLabel} ${hoursLabel}. Los camiones altos se lentan — la fila suele crecer.`,
      en: `Strong winds in ${warning.regionLabel} ${hoursLabel}. High-profile trucks slow — lines usually grow.`,
    },
  }

  const c = COPY[warning.kind]

  if (variant === 'pill') {
    const shortEs = warning.kind === 'rain' ? 'Lluvia'
      : warning.kind === 'fog' ? 'Neblina' : 'Viento'
    const shortEn = warning.kind === 'rain' ? 'Rain'
      : warning.kind === 'fog' ? 'Fog' : 'Wind'
    const when = warning.hoursAway === 0
      ? (es ? 'ya' : 'now')
      : warning.hoursAway === 1
        ? (es ? 'en 1h' : 'in 1h')
        : (es ? `en ${warning.hoursAway}h` : `in ${warning.hoursAway}h`)
    return (
      <div
        className="cruzar-pill inline-flex items-center gap-1.5 bg-sky-50 dark:bg-sky-900/30 border border-sky-200 dark:border-sky-800 rounded-full pl-2 pr-3 py-1.5"
        title={es ? c.es : c.en}
      >
        <span className="text-base leading-none">{c.emoji}</span>
        <span className="text-[11px] font-bold text-sky-800 dark:text-sky-200 whitespace-nowrap">
          {es ? shortEs : shortEn} {when}
        </span>
      </div>
    )
  }

  return (
    <div className="mt-3 bg-gradient-to-r from-sky-50 to-blue-50 dark:from-sky-900/20 dark:to-blue-900/20 border border-sky-200 dark:border-sky-800 rounded-2xl px-4 py-3 flex items-start gap-3">
      <span className="text-2xl leading-none flex-shrink-0">{c.emoji}</span>
      <div className="min-w-0 flex-1">
        <p className="text-[10px] uppercase tracking-widest font-bold text-sky-700 dark:text-sky-300">
          {es ? 'Pronóstico fronterizo' : 'Border forecast'}
        </p>
        <p className="text-xs font-semibold text-gray-800 dark:text-gray-100 mt-0.5 leading-snug">
          {es ? c.es : c.en}
        </p>
      </div>
    </div>
  )
}
