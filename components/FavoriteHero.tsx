'use client'

import { useEffect, useState } from 'react'
import Link from 'next/link'
import { useLang } from '@/lib/LangContext'
import { PORT_META } from '@/lib/portMeta'
import { Star, Zap } from 'lucide-react'

// Personalized hero card for logged-in users with a favorite_port_id set.
// Phase A of the home redesign — pulls the user's favorite bridge to the
// top of the page, shows its current wait + a "faster right now"
// alternative when another bridge in the same mega-region is >30%
// quicker. Anonymous + favorite-less users see nothing (the existing
// list view + SetFavoriteBanner handle them).

interface Port {
  port_id: string
  port_name?: string
  vehicle_wait?: number | null
  pedestrian_wait?: number | null
  commercial_wait?: number | null
}

interface Props {
  ports: Port[]
}

function combinedWait(p: Port): number | null {
  const candidates = [p.vehicle_wait, p.pedestrian_wait, p.commercial_wait]
    .map((v) => (typeof v === 'number' && v >= 0 ? v : null))
    .filter((v): v is number => v != null)
  if (candidates.length === 0) return null
  return Math.min(...candidates)
}

function waitColor(min: number | null): { bg: string; text: string; border: string } {
  if (min == null) return { bg: 'bg-gray-100 dark:bg-gray-800', text: 'text-gray-500', border: 'border-gray-300' }
  if (min <= 20) return { bg: 'bg-emerald-50 dark:bg-emerald-900/20', text: 'text-emerald-700 dark:text-emerald-400', border: 'border-emerald-300 dark:border-emerald-700' }
  if (min <= 45) return { bg: 'bg-amber-50 dark:bg-amber-900/20', text: 'text-amber-700 dark:text-amber-400', border: 'border-amber-300 dark:border-amber-700' }
  return { bg: 'bg-red-50 dark:bg-red-900/20', text: 'text-red-700 dark:text-red-400', border: 'border-red-300 dark:border-red-700' }
}

export function FavoriteHero({ ports }: Props) {
  const { lang } = useLang()
  const [favoriteId, setFavoriteId] = useState<string | null>(null)
  const [authChecked, setAuthChecked] = useState(false)

  useEffect(() => {
    fetch('/api/profile')
      .then((r) => (r.ok ? r.json() : Promise.reject()))
      .then((d) => {
        setFavoriteId(d?.profile?.favorite_port_id ?? null)
        setAuthChecked(true)
      })
      .catch(() => setAuthChecked(true))
  }, [])

  if (!authChecked || !favoriteId) return null

  const fav = ports.find((p) => p.port_id === favoriteId)
  const favMeta = PORT_META[favoriteId]
  if (!fav || !favMeta) return null

  const favWait = combinedWait(fav)
  const favColors = waitColor(favWait)

  // Compute "faster alternative": other ports in same megaRegion with
  // wait <= favWait * 0.7. Pick the absolute fastest.
  let alt: { port: Port; meta: typeof favMeta; wait: number } | null = null
  if (favWait != null && favWait >= 15) {
    const sameRegion = ports
      .filter((p) => p.port_id !== favoriteId && PORT_META[p.port_id]?.megaRegion === favMeta.megaRegion)
      .map((p) => ({ port: p, meta: PORT_META[p.port_id]!, wait: combinedWait(p) }))
      .filter((x): x is { port: Port; meta: typeof favMeta; wait: number } => x.wait != null && x.wait < favWait * 0.7)
      .sort((a, b) => a.wait - b.wait)
    if (sameRegion.length > 0) alt = sameRegion[0]
  }

  const favName = favMeta.localName || favMeta.city
  const favLabel = `${favMeta.city}${favMeta.localName ? ` (${favMeta.localName})` : ''}`

  return (
    <div className="mb-4">
      {/* Favorite bridge hero */}
      <Link
        href={`/port/${encodeURIComponent(favoriteId)}`}
        className={`block rounded-2xl border-2 ${favColors.border} ${favColors.bg} p-5 shadow-sm hover:shadow-md transition-shadow`}
      >
        <div className="flex items-center justify-between gap-3">
          <div className="min-w-0">
            <p className="text-[10px] uppercase tracking-wide font-semibold text-gray-500 dark:text-gray-400 flex items-center gap-1 mb-1">
              <Star className="w-3 h-3 fill-current" />
              {lang === 'es' ? 'Tu puente' : 'Your bridge'}
            </p>
            <p className="text-base font-bold text-gray-900 dark:text-gray-100 truncate">{favLabel}</p>
            <p className="text-[11px] text-gray-500 dark:text-gray-400 mt-0.5">
              {lang === 'es' ? 'Toca para ver detalles' : 'Tap for details'}
            </p>
          </div>
          <div className={`text-right flex-shrink-0 ${favColors.text}`}>
            <p className="text-4xl font-black tabular-nums leading-none">
              {favWait != null ? favWait : '—'}
            </p>
            <p className="text-xs font-semibold mt-1">min</p>
          </div>
        </div>
      </Link>

      {/* "Faster right now" alternative — only shown when materially faster */}
      {alt && (
        <Link
          href={`/port/${encodeURIComponent(alt.port.port_id)}`}
          className="block mt-2 rounded-2xl border border-blue-200 dark:border-blue-800 bg-white dark:bg-gray-800 p-3.5 shadow-sm hover:bg-blue-50 dark:hover:bg-blue-900/20 transition-colors"
        >
          <div className="flex items-center justify-between gap-3">
            <div className="flex items-center gap-2 min-w-0">
              <Zap className="w-4 h-4 text-blue-600 dark:text-blue-400 flex-shrink-0" />
              <div className="min-w-0">
                <p className="text-xs font-semibold text-blue-800 dark:text-blue-300">
                  {lang === 'es' ? 'Más rápido ahorita' : 'Faster right now'}
                </p>
                <p className="text-sm font-bold text-gray-900 dark:text-gray-100 truncate">
                  {alt.meta.localName || alt.meta.city}
                </p>
              </div>
            </div>
            <div className="text-right flex-shrink-0">
              <p className="text-2xl font-black tabular-nums text-emerald-600 dark:text-emerald-400 leading-none">{alt.wait}</p>
              <p className="text-[10px] text-gray-500 mt-0.5">
                {lang === 'es' ? `${favWait! - alt.wait} min menos` : `${favWait! - alt.wait} min less`}
              </p>
            </div>
          </div>
        </Link>
      )}
    </div>
  )
}
