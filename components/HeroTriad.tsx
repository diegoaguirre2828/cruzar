'use client'

import { useEffect, useMemo, useState } from 'react'
import Link from 'next/link'
import { useLang } from '@/lib/LangContext'
import { useHomeRegion } from '@/lib/useHomeRegion'
import { getPortMeta } from '@/lib/portMeta'
import { haversineKm } from '@/lib/geo'
import { splitWaitLabel } from '@/lib/formatWait'
import { trackEvent } from '@/lib/trackEvent'
import type { PortWaitTime } from '@/types'

// Hero "your bridge" triad — renders 1-3 distinct bridges for
// signed-in users with composable badges. Diego's 2026-04-14 spec:
//
//   Priority stack (in order):
//     1. Favorite bridge (user's saved primary)
//     2. Closest bridge by GPS
//     3. Fastest bridge in the user's home region
//     4. (rest of the region renders below in the main port list)
//
//   Dedupe rule: if the same bridge matches multiple categories,
//   render ONCE with combined badges — never twice. If the closest
//   is also the fastest, one card with both badges. If all three
//   match the same bridge, one card with all three badges.
//
// Badge labels:
//   ⭐ Tu puente       (favorite — user explicitly saved)
//   📍 Más cercano    (closest by GPS)
//   ⚡ Más rápido      (fastest in region)
//
// Only shown to signed-in users. Guests get the existing
// HeroLiveDelta treatment (per the "lean into contrast" call).

interface Props {
  ports: PortWaitTime[] | null
  favoritePortId: string | null
}

type Badge = 'favorite' | 'closest' | 'fastest'
interface TriadSlot {
  port: PortWaitTime
  badges: Set<Badge>
}

export function HeroTriad({ ports, favoritePortId }: Props) {
  const { lang } = useLang()
  const { homeRegion } = useHomeRegion()
  const es = lang === 'es'
  const [userLoc, setUserLoc] = useState<{ lat: number; lng: number } | null>(null)

  useEffect(() => {
    if (typeof navigator === 'undefined' || !navigator.geolocation) return
    const timer = setTimeout(() => { /* no-op */ }, 4000)
    navigator.geolocation.getCurrentPosition(
      (pos) => {
        clearTimeout(timer)
        setUserLoc({ lat: pos.coords.latitude, lng: pos.coords.longitude })
      },
      () => clearTimeout(timer),
      { maximumAge: 5 * 60 * 1000, timeout: 4000, enableHighAccuracy: false },
    )
    return () => clearTimeout(timer)
  }, [])

  const triad = useMemo<TriadSlot[]>(() => {
    if (!ports) return []
    const openPorts = ports.filter((p) => !p.isClosed && p.vehicle != null)
    if (openPorts.length === 0) return []

    // Favorite — always included if it exists AND has data
    const favorite = favoritePortId
      ? openPorts.find((p) => p.portId === favoritePortId) ?? null
      : null

    // Closest — nearest open port by GPS, no region filter. If the
    // user is in RGV but physically at El Paso, closest should be
    // El Paso.
    let closest: PortWaitTime | null = null
    if (userLoc) {
      let bestDist = Infinity
      for (const p of openPorts) {
        const meta = getPortMeta(p.portId)
        if (!meta.lat || !meta.lng) continue
        const d = haversineKm(userLoc.lat, userLoc.lng, meta.lat, meta.lng)
        if (d < bestDist) {
          bestDist = d
          closest = p
        }
      }
    }

    // Fastest — lowest wait within the user's home region (not
    // global). If they're an RGV user, "fastest" means fastest RGV
    // bridge, not the lowest across the whole border.
    let fastest: PortWaitTime | null = null
    const regionPool = homeRegion
      ? openPorts.filter((p) => getPortMeta(p.portId).megaRegion === homeRegion)
      : openPorts
    if (regionPool.length > 0) {
      fastest = regionPool.reduce((best, p) =>
        (p.vehicle as number) < (best.vehicle as number) ? p : best
      )
    }

    // Dedupe: build a map portId → { port, badges[] }. Preserves
    // insertion order (favorite first, then closest, then fastest)
    // for the final render.
    const slotMap = new Map<string, TriadSlot>()
    const addBadge = (port: PortWaitTime | null, badge: Badge) => {
      if (!port) return
      const existing = slotMap.get(port.portId)
      if (existing) {
        existing.badges.add(badge)
      } else {
        slotMap.set(port.portId, { port, badges: new Set([badge]) })
      }
    }
    addBadge(favorite, 'favorite')
    addBadge(closest, 'closest')
    addBadge(fastest, 'fastest')

    return Array.from(slotMap.values())
  }, [ports, favoritePortId, userLoc, homeRegion])

  if (triad.length === 0) return null

  return (
    <div className="mt-3 space-y-2">
      {triad.map((slot, i) => (
        <TriadCard key={slot.port.portId} slot={slot} isPrimary={i === 0} es={es} />
      ))}
    </div>
  )
}

function TriadCard({ slot, isPrimary, es }: { slot: TriadSlot; isPrimary: boolean; es: boolean }) {
  const meta = getPortMeta(slot.port.portId)
  const name = slot.port.localNameOverride || meta.localName || slot.port.crossingName || slot.port.portName
  const wait = slot.port.vehicle as number
  const split = splitWaitLabel(wait)

  // Ordered badges: favorite → closest → fastest
  const badges: Badge[] = []
  if (slot.badges.has('favorite')) badges.push('favorite')
  if (slot.badges.has('closest')) badges.push('closest')
  if (slot.badges.has('fastest')) badges.push('fastest')

  // Visual weight — first card in the list (usually the favorite)
  // gets the big gradient treatment; subsequent cards are compact.
  if (isPrimary) {
    return (
      <Link
        href={`/port/${encodeURIComponent(slot.port.portId)}`}
        onClick={() => trackEvent('home_action_taken', { action: 'triad_tap', port_id: slot.port.portId, position: 'primary', badges: badges.join(',') })}
        className="block bg-gradient-to-br from-blue-600 via-indigo-700 to-purple-800 rounded-3xl p-4 shadow-xl text-white relative overflow-hidden active:scale-[0.98] transition-transform"
      >
        <div className="absolute -top-12 -right-12 w-36 h-36 bg-white/10 rounded-full blur-3xl pointer-events-none" />
        <div className="relative">
          <div className="flex flex-wrap items-center gap-1 mb-2">
            {badges.map((b) => (
              <BadgePill key={b} kind={b} es={es} compact={badges.length > 1} />
            ))}
          </div>
          <div className="flex items-baseline justify-between gap-3">
            <p className="text-xl sm:text-2xl font-black leading-tight truncate flex-1">{name}</p>
            <div className="flex items-baseline gap-1 flex-shrink-0">
              <span className="text-base">🚗</span>
              <span className="text-5xl font-black leading-none drop-shadow tabular-nums">{split.value}</span>
              <span className="text-sm font-bold text-blue-100">{split.unit}</span>
            </div>
          </div>
          <p className="mt-2 text-[10px] text-blue-200 uppercase tracking-widest font-bold">
            {meta.city} · {es ? 'Ver detalles →' : 'See details →'}
          </p>
        </div>
      </Link>
    )
  }

  // Secondary/tertiary — compact row
  return (
    <Link
      href={`/port/${encodeURIComponent(slot.port.portId)}`}
      onClick={() => trackEvent('home_action_taken', { action: 'triad_tap', port_id: slot.port.portId, position: 'secondary', badges: badges.join(',') })}
      className="flex items-center justify-between gap-3 bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-2xl px-3 py-2.5 active:scale-[0.98] transition-transform"
    >
      <div className="min-w-0 flex-1">
        <div className="flex flex-wrap items-center gap-1 mb-0.5">
          {badges.map((b) => (
            <BadgePill key={b} kind={b} es={es} compact subtle />
          ))}
        </div>
        <p className="text-sm font-bold text-gray-900 dark:text-gray-100 truncate">{name}</p>
        <p className="text-[10px] text-gray-500 dark:text-gray-400">{meta.city}</p>
      </div>
      <div className="flex items-baseline gap-1 flex-shrink-0">
        <span className="text-sm">🚗</span>
        <span className="text-2xl font-black text-gray-900 dark:text-gray-100 tabular-nums">{split.value}</span>
        <span className="text-xs font-bold text-gray-500 dark:text-gray-400">{split.unit}</span>
      </div>
    </Link>
  )
}

function BadgePill({ kind, es, compact, subtle }: { kind: Badge; es: boolean; compact?: boolean; subtle?: boolean }) {
  const CONFIG: Record<Badge, { emoji: string; es: string; en: string; bg: string; text: string; subtleBg: string; subtleText: string }> = {
    favorite: {
      emoji: '⭐',
      es: 'Tu puente',
      en: 'Your bridge',
      bg: 'bg-amber-400',
      text: 'text-amber-950',
      subtleBg: 'bg-amber-100 dark:bg-amber-900/30',
      subtleText: 'text-amber-700 dark:text-amber-300',
    },
    closest: {
      emoji: '📍',
      es: 'Más cercano',
      en: 'Closest',
      bg: 'bg-blue-400',
      text: 'text-blue-950',
      subtleBg: 'bg-blue-100 dark:bg-blue-900/30',
      subtleText: 'text-blue-700 dark:text-blue-300',
    },
    fastest: {
      emoji: '⚡',
      es: 'Más rápido',
      en: 'Fastest',
      bg: 'bg-green-400',
      text: 'text-green-950',
      subtleBg: 'bg-green-100 dark:bg-green-900/30',
      subtleText: 'text-green-700 dark:text-green-300',
    },
  }
  const cfg = CONFIG[kind]
  const classes = subtle
    ? `${cfg.subtleBg} ${cfg.subtleText}`
    : `${cfg.bg} ${cfg.text}`
  return (
    <span className={`inline-flex items-center gap-0.5 text-[9px] font-black uppercase tracking-wider px-1.5 py-0.5 rounded-full ${classes}`}>
      <span className="text-[10px]">{cfg.emoji}</span>
      {!compact && (es ? cfg.es : cfg.en)}
    </span>
  )
}
