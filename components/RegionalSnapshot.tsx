'use client'

import Link from 'next/link'
import { useMemo } from 'react'
import { useLang } from '@/lib/LangContext'
import { getPortMeta } from '@/lib/portMeta'
import { formatWaitLabel } from '@/lib/formatWait'
import type { PortWaitTime } from '@/types'

// "De un vistazo" regional snapshot. Replaces the old StaticBorderMap
// SVG which was an abstract cloud of dots with no geography, labels,
// or legend — users (including Diego) couldn't tell what they were
// looking at. This version is concrete: each major border region on
// one row, with count of green/amber/red bridges, the fastest open
// crossing, and a tap target to jump to that bridge.

interface Props {
  ports: PortWaitTime[] | null
}

interface Region {
  key: string
  emoji: string
  es: string
  en: string
  // City substrings that identify this region's ports in portMeta.
  matchers: string[]
}

const REGIONS: Region[] = [
  { key: 'rgv',         emoji: '🌵', es: 'RGV / McAllen',           en: 'RGV / McAllen',           matchers: ['McAllen', 'Hidalgo', 'Pharr', 'Progreso', 'Donna', 'Rio Grande City', 'Roma'] },
  { key: 'brownsville', emoji: '🏙️', es: 'Matamoros / Brownsville', en: 'Matamoros / Brownsville', matchers: ['Brownsville'] },
  { key: 'laredo',      emoji: '🛣️', es: 'Laredo / N. Laredo',      en: 'Laredo / N. Laredo',      matchers: ['Laredo'] },
  { key: 'eagle_pass',  emoji: '🦅', es: 'Eagle Pass / P. Negras',  en: 'Eagle Pass / P. Negras',  matchers: ['Eagle Pass', 'Del Rio'] },
  { key: 'el_paso',     emoji: '⛰️', es: 'El Paso / Juárez',        en: 'El Paso / Juárez',        matchers: ['El Paso'] },
  { key: 'nogales',     emoji: '🌮', es: 'Nogales / Sonora',        en: 'Nogales / Sonora',        matchers: ['Nogales', 'Douglas', 'Naco', 'Lukeville'] },
  { key: 'san_luis',    emoji: '☀️', es: 'San Luis / Yuma',         en: 'San Luis / Yuma',         matchers: ['San Luis', 'Yuma'] },
  { key: 'tijuana',     emoji: '🌊', es: 'Tijuana / San Ysidro',    en: 'Tijuana / San Ysidro',    matchers: ['San Ysidro', 'Otay Mesa', 'Tecate'] },
  { key: 'mexicali',    emoji: '🏜️', es: 'Mexicali / Calexico',     en: 'Mexicali / Calexico',     matchers: ['Calexico', 'Andrade'] },
]

function waitBucket(min: number | null, isClosed: boolean): 'green' | 'amber' | 'red' | 'gray' {
  if (isClosed || min == null) return 'gray'
  if (min <= 20) return 'green'
  if (min <= 45) return 'amber'
  return 'red'
}

export function RegionalSnapshot({ ports }: Props) {
  const { lang } = useLang()
  const es = lang === 'es'

  const rows = useMemo(() => {
    if (!ports || ports.length === 0) return []

    return REGIONS.map((region) => {
      const inRegion = ports.filter((p) => {
        const meta = getPortMeta(p.portId)
        return region.matchers.some((m) => meta.city.includes(m))
      })
      if (inRegion.length === 0) return null

      let green = 0, amber = 0, red = 0
      let fastest: { port: PortWaitTime; wait: number } | null = null
      for (const p of inRegion) {
        const bucket = waitBucket(p.vehicle ?? null, !!p.isClosed)
        if (bucket === 'green') green++
        else if (bucket === 'amber') amber++
        else if (bucket === 'red') red++
        if (p.vehicle != null && !p.isClosed) {
          if (!fastest || p.vehicle < fastest.wait) fastest = { port: p, wait: p.vehicle }
        }
      }
      return { region, green, amber, red, fastest, total: inRegion.length }
    }).filter((r): r is NonNullable<typeof r> => r !== null)
  }, [ports])

  if (rows.length === 0) return null

  return (
    <div className="mt-3 bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-2xl overflow-hidden">
      <div className="px-4 pt-3 pb-2 flex items-center justify-between">
        <div>
          <p className="text-[10px] uppercase tracking-widest font-bold text-gray-500 dark:text-gray-400">
            {es ? '🌎 Toda la frontera' : '🌎 Whole border'}
          </p>
          <p className="text-[11px] text-gray-600 dark:text-gray-300 mt-0.5">
            {es
              ? 'Puentes rápidos, moderados y lentos por región'
              : 'Fast, moderate, and slow crossings by region'}
          </p>
        </div>
        <Link href="/mapa" className="text-[11px] font-bold text-blue-600 dark:text-blue-400 hover:underline flex-shrink-0 ml-3">
          {es ? 'Mapa →' : 'Map →'}
        </Link>
      </div>
      <div className="divide-y divide-gray-100 dark:divide-gray-700/50">
        {rows.map(({ region, green, amber, red, fastest }) => {
          const fastestName = fastest
            ? (fastest.port.localNameOverride || getPortMeta(fastest.port.portId).localName || fastest.port.portName)
            : ''
          const href = fastest ? `/port/${encodeURIComponent(fastest.port.portId)}` : '/mapa'
          return (
            <Link
              key={region.key}
              href={href}
              className="flex items-center gap-3 px-4 py-3 active:bg-gray-50 dark:active:bg-gray-700/40 transition-colors"
            >
              <span className="text-xl leading-none flex-shrink-0">{region.emoji}</span>
              <div className="flex-1 min-w-0">
                <p className="text-[13px] font-bold text-gray-900 dark:text-gray-100 leading-tight truncate">
                  {es ? region.es : region.en}
                </p>
                {fastest && (
                  <p className="text-[11px] text-gray-500 dark:text-gray-400 truncate leading-snug">
                    {es ? 'Más rápido: ' : 'Fastest: '}
                    <span className="font-semibold text-gray-700 dark:text-gray-200">
                      {fastestName} · {formatWaitLabel(fastest.wait, es ? 'es' : 'en')}
                    </span>
                  </p>
                )}
              </div>
              <div className="flex items-center gap-1 flex-shrink-0">
                {green > 0 && (
                  <span
                    title={es ? `${green} puentes rápidos` : `${green} fast crossings`}
                    className="inline-flex items-center gap-0.5 bg-green-100 dark:bg-green-900/30 text-green-700 dark:text-green-300 rounded-full px-1.5 py-0.5 text-[10px] font-black tabular-nums"
                  >
                    <span className="w-1.5 h-1.5 rounded-full bg-green-500" />
                    {green}
                  </span>
                )}
                {amber > 0 && (
                  <span
                    title={es ? `${amber} puentes moderados` : `${amber} moderate`}
                    className="inline-flex items-center gap-0.5 bg-amber-100 dark:bg-amber-900/30 text-amber-700 dark:text-amber-300 rounded-full px-1.5 py-0.5 text-[10px] font-black tabular-nums"
                  >
                    <span className="w-1.5 h-1.5 rounded-full bg-amber-500" />
                    {amber}
                  </span>
                )}
                {red > 0 && (
                  <span
                    title={es ? `${red} puentes lentos` : `${red} slow`}
                    className="inline-flex items-center gap-0.5 bg-red-100 dark:bg-red-900/30 text-red-700 dark:text-red-300 rounded-full px-1.5 py-0.5 text-[10px] font-black tabular-nums"
                  >
                    <span className="w-1.5 h-1.5 rounded-full bg-red-500" />
                    {red}
                  </span>
                )}
              </div>
              <span className="text-gray-300 dark:text-gray-600 text-sm flex-shrink-0">→</span>
            </Link>
          )
        })}
      </div>
    </div>
  )
}
