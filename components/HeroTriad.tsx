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
import { slugForPort } from '@/lib/portSlug'

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
  driveMin: number | null
}

// Drive-time guard rails for the "fastest" alternative + savings copy.
// Distance budget keeps cross-city false positives out (Brownsville user
// shouldn't see Donna 70mi away as their "alternative"). Conservative
// road-distance multiplier and average speed produce honest drive-time
// estimates without a HERE API call. Min savings = the threshold where
// the comparison is worth showing the user at all.
const ALT_HAVERSINE_BUDGET_KM = 30
const DRIVE_KM_TO_MIN = (km: number) => (km * 1.4) / 65 * 60
const MIN_SAVINGS_MIN = 15

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

    // Fastest — lowest wait within drive-distance budget of the user.
    // Mega-region (e.g. "RGV") is too coarse: spans Brownsville → McAllen
    // → Roma which are different cities. With userLoc, restrict by
    // haversine ≤ 30km so the alternative is a real switch option rather
    // than a different-city false positive. Without userLoc, fall back
    // to mega-region.
    let fastest: PortWaitTime | null = null
    let candidatePool: PortWaitTime[]
    if (userLoc) {
      candidatePool = openPorts.filter((p) => {
        const meta = getPortMeta(p.portId)
        if (!meta.lat || !meta.lng) return false
        return haversineKm(userLoc.lat, userLoc.lng, meta.lat, meta.lng) <= ALT_HAVERSINE_BUDGET_KM
      })
    } else if (homeRegion) {
      candidatePool = openPorts.filter((p) => getPortMeta(p.portId).megaRegion === homeRegion)
    } else {
      candidatePool = openPorts
    }
    if (candidatePool.length > 0) {
      fastest = candidatePool.reduce((best, p) =>
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
        slotMap.set(port.portId, { port, badges: new Set([badge]), driveMin: null })
      }
    }
    addBadge(favorite, 'favorite')
    addBadge(closest, 'closest')
    addBadge(fastest, 'fastest')

    const slots = Array.from(slotMap.values())

    // Compute drive-time estimates when geolocation is available — used
    // both for the comparison sub-line and for filtering low-savings
    // alternatives out of the secondary slots.
    if (userLoc) {
      for (const s of slots) {
        const meta = getPortMeta(s.port.portId)
        if (meta.lat && meta.lng) {
          const km = haversineKm(userLoc.lat, userLoc.lng, meta.lat, meta.lng)
          s.driveMin = Math.round(DRIVE_KM_TO_MIN(km))
        }
      }
    }

    // Filter secondary slots that don't beat the primary by enough to
    // be worth surfacing. Net savings = (drive_fav + wait_fav) -
    // (drive_alt + wait_alt). Hide alternatives below MIN_SAVINGS_MIN
    // — silence is correct when the math doesn't justify a switch.
    const primary = slots[0]
    if (primary && primary.driveMin != null && primary.badges.has('favorite')) {
      const primaryTotal = primary.driveMin + (primary.port.vehicle as number)
      for (let i = slots.length - 1; i >= 1; i--) {
        const s = slots[i]
        if (s.driveMin == null) continue
        const altTotal = s.driveMin + (s.port.vehicle as number)
        const savings = primaryTotal - altTotal
        if (savings < MIN_SAVINGS_MIN) {
          slots.splice(i, 1)
        }
      }
    }

    return slots
  }, [ports, favoritePortId, userLoc, homeRegion])

  if (triad.length === 0) return null

  const primary = triad[0]
  return (
    <div className="mt-3 space-y-2">
      {triad.map((slot, i) => (
        <TriadCard
          key={slot.port.portId}
          slot={slot}
          isPrimary={i === 0}
          es={es}
          primary={i === 0 ? null : primary}
        />
      ))}
    </div>
  )
}

function TriadCard({ slot, isPrimary, es, primary }: { slot: TriadSlot; isPrimary: boolean; es: boolean; primary: TriadSlot | null }) {
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
        href={`/cruzar/${slugForPort(slot.port.portId)}`}
        onClick={() => trackEvent('home_action_taken', { action: 'triad_tap', port_id: slot.port.portId, position: 'primary', badges: badges.join(',') })}
        className="block bg-gradient-to-br from-blue-600 via-indigo-700 to-purple-800 rounded-3xl p-4 shadow-xl text-white relative overflow-hidden active:scale-[0.98] transition-transform"
      >
        <div className="absolute -top-12 -right-12 w-36 h-36 bg-white/10 rounded-full blur-3xl pointer-events-none" />
        <div className="relative">
          <div className="flex flex-wrap items-center gap-1 mb-2">
            {badges.map((b) => (
              <BadgePill key={b} kind={b} es={es} />
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

  // Comparison line — only when we have drive-time data on both this
  // slot and the primary. Acknowledges "closer but" / "farther but"
  // explicitly so the user can sanity-check the math instead of trusting
  // a naked savings number.
  let comparison: { savings: number; closer: boolean; primaryName: string } | null = null
  if (
    primary &&
    slot.driveMin != null &&
    primary.driveMin != null &&
    primary.badges.has('favorite')
  ) {
    const primaryTotal = primary.driveMin + (primary.port.vehicle as number)
    const altTotal = slot.driveMin + (slot.port.vehicle as number)
    const savings = primaryTotal - altTotal
    if (savings >= 0) {
      const primaryMeta = getPortMeta(primary.port.portId)
      const primaryDisplay =
        primary.port.localNameOverride ||
        primaryMeta.localName ||
        primary.port.crossingName ||
        primary.port.portName
      comparison = {
        savings,
        closer: slot.driveMin <= primary.driveMin,
        primaryName: primaryDisplay,
      }
    }
  }

  // Secondary/tertiary — compact row
  return (
    <Link
      href={`/cruzar/${slugForPort(slot.port.portId)}`}
      onClick={() => trackEvent('home_action_taken', { action: 'triad_tap', port_id: slot.port.portId, position: 'secondary', badges: badges.join(',') })}
      className="flex items-center justify-between gap-3 bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-2xl px-3 py-2.5 active:scale-[0.98] transition-transform"
    >
      <div className="min-w-0 flex-1">
        <div className="flex flex-wrap items-center gap-1 mb-0.5">
          {badges.map((b) => (
            <BadgePill key={b} kind={b} es={es} subtle />
          ))}
        </div>
        <p className="text-sm font-bold text-gray-900 dark:text-gray-100 truncate">{name}</p>
        <p className="text-[10px] text-gray-500 dark:text-gray-400">{meta.city}</p>
        {comparison && (
          <p className="text-[11px] text-emerald-700 dark:text-emerald-400 font-semibold mt-1 leading-snug">
            {comparison.closer
              ? (es
                  ? `Más cerca y ahorra ~${comparison.savings} min vs ${comparison.primaryName}`
                  : `Closer and saves ~${comparison.savings} min vs ${comparison.primaryName}`)
              : (es
                  ? `Más lejos pero ahorra ~${comparison.savings} min vs ${comparison.primaryName}`
                  : `Farther but saves ~${comparison.savings} min vs ${comparison.primaryName}`)}
            {slot.driveMin != null && (
              <span className="block text-[10px] text-gray-500 dark:text-gray-400 font-normal">
                {es
                  ? `~${slot.driveMin} min manejo + ${slot.port.vehicle} min espera`
                  : `~${slot.driveMin} min drive + ${slot.port.vehicle} min wait`}
              </span>
            )}
          </p>
        )}
      </div>
      <div className="flex items-baseline gap-1 flex-shrink-0">
        <span className="text-sm">🚗</span>
        <span className="text-2xl font-black text-gray-900 dark:text-gray-100 tabular-nums">{split.value}</span>
        <span className="text-xs font-bold text-gray-500 dark:text-gray-400">{split.unit}</span>
      </div>
    </Link>
  )
}

function BadgePill({ kind, es, subtle }: { kind: Badge; es: boolean; subtle?: boolean }) {
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
    <span className={`inline-flex items-center gap-1 text-[9px] font-black uppercase tracking-wider px-1.5 py-0.5 rounded-full ${classes}`}>
      <span className="text-[10px]">{cfg.emoji}</span>
      <span>{es ? cfg.es : cfg.en}</span>
    </span>
  )
}
