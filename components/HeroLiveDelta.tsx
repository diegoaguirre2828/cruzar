'use client'

import { useEffect, useMemo, useState } from 'react'
import { useLang } from '@/lib/LangContext'
import { useAuth } from '@/lib/useAuth'
import { getPortMeta, type MegaRegion } from '@/lib/portMeta'
import { haversineKm } from '@/lib/geo'
import type { PortWaitTime } from '@/types'

// The hero moment.
//
// Product: someone lands from Facebook. They see ONE huge number — the
// wait at the bridge THEY actually use (computed from their device
// location). Below: if there's a significantly faster nearby option,
// show the savings as a loss-aversion nudge. The entire card is clickable:
//   - Guest → /signup?next=/port/{id}  (the 'boom sign up' moment)
//   - Signed-in → /port/{id}
//
// Fallback when location is unavailable: show the fastest crossing in
// their mega region (detected from localStorage or default to rgv).

const MEGA_REGION_LABEL: Record<MegaRegion, { es: string; en: string }> = {
  rgv:           { es: 'Valle de Texas',           en: 'Rio Grande Valley' },
  laredo:        { es: 'Laredo / Nuevo Laredo',    en: 'Laredo' },
  'coahuila-tx': { es: 'Piedras Negras / Acuña',   en: 'Coahuila — Texas' },
  'el-paso':     { es: 'Cd. Juárez / El Paso',     en: 'El Paso' },
  'sonora-az':   { es: 'Sonora / Arizona',         en: 'Sonora / Arizona' },
  baja:          { es: 'Baja California',          en: 'Baja California' },
  other:         { es: 'Frontera',                 en: 'Border' },
}

interface Props {
  ports?: PortWaitTime[] | null
}

export function HeroLiveDelta({ ports: propPorts }: Props) {
  const { lang } = useLang()
  const { user } = useAuth()
  const es = lang === 'es'
  const [ports, setPorts] = useState<PortWaitTime[] | null>(propPorts ?? null)
  const [fetchedAt, setFetchedAt] = useState<Date | null>(null)
  const [secondsAgo, setSecondsAgo] = useState(0)
  const [region, setRegion] = useState<MegaRegion>('rgv')
  const [userLoc, setUserLoc] = useState<{ lat: number; lng: number } | null>(null)
  const [geoDenied, setGeoDenied] = useState(false)
  const [reportCount, setReportCount] = useState<number | null>(null)

  // Detect preferred region from localStorage or last-viewed port
  useEffect(() => {
    if (typeof window === 'undefined') return
    try {
      const override = localStorage.getItem('cruzar_mega_region') as MegaRegion | null
      if (override) { setRegion(override); return }
      const lastPort = localStorage.getItem('cruzar_last_port')
      if (lastPort) {
        const meta = getPortMeta(lastPort)
        if (meta.megaRegion && meta.megaRegion !== 'other') setRegion(meta.megaRegion)
      }
    } catch { /* ignore */ }
  }, [])

  // Ask for geolocation once. Non-blocking: if denied or times out we fall
  // back to the region-based fastest. We don't retry — that'd be annoying.
  useEffect(() => {
    if (typeof navigator === 'undefined' || !navigator.geolocation) {
      setGeoDenied(true)
      return
    }
    const timer = setTimeout(() => setGeoDenied(true), 4500)
    navigator.geolocation.getCurrentPosition(
      (pos) => {
        clearTimeout(timer)
        setUserLoc({ lat: pos.coords.latitude, lng: pos.coords.longitude })
      },
      () => {
        clearTimeout(timer)
        setGeoDenied(true)
      },
      { maximumAge: 5 * 60 * 1000, timeout: 4000, enableHighAccuracy: false }
    )
    return () => clearTimeout(timer)
  }, [])

  // Fetch ports if not provided (and refresh every 60s)
  useEffect(() => {
    if (propPorts) {
      setPorts(propPorts)
      setFetchedAt(new Date())
      return
    }
    let cancelled = false
    const load = async () => {
      try {
        const res = await fetch('/api/ports', { cache: 'no-store' })
        if (!res.ok) return
        const data = await res.json()
        if (!cancelled) {
          setPorts(data.ports || [])
          setFetchedAt(new Date())
        }
      } catch { /* ignore */ }
    }
    load()
    const interval = setInterval(load, 60000)
    return () => { cancelled = true; clearInterval(interval) }
  }, [propPorts])

  // Seconds-ago ticker for the live label
  useEffect(() => {
    if (!fetchedAt) return
    const tick = () => setSecondsAgo(Math.floor((Date.now() - fetchedAt.getTime()) / 1000))
    tick()
    const id = setInterval(tick, 1000)
    return () => clearInterval(id)
  }, [fetchedAt])

  // Today's report count for social proof
  useEffect(() => {
    fetch('/api/reports/recent?limit=100')
      .then((r) => r.json())
      .then((d) => {
        const todayStart = new Date()
        todayStart.setHours(0, 0, 0, 0)
        const count = (d.reports || []).filter((r: { created_at: string }) => new Date(r.created_at) >= todayStart).length
        setReportCount(count)
      })
      .catch(() => {})
  }, [])

  // Compute the display port:
  //   1. If we have geolocation → nearest OPEN port globally
  //   2. Else → fastest OPEN port in the user's mega region
  const display = useMemo(() => {
    if (!ports) return null
    const open = ports.filter(
      (p) => !p.isClosed && p.vehicle != null && p.vehicle !== undefined,
    )
    if (open.length === 0) return null

    // Path 1: nearest-by-geo
    if (userLoc) {
      let best: { port: PortWaitTime; dist: number } | null = null
      for (const p of open) {
        const meta = getPortMeta(p.portId)
        if (!meta.lat || !meta.lng) continue
        const d = haversineKm(userLoc.lat, userLoc.lng, meta.lat, meta.lng)
        if (!best || d < best.dist) best = { port: p, dist: d }
      }
      if (best && best.dist < 300) {
        // Find a faster port within 50 km for the secondary callout
        let faster: { port: PortWaitTime; saving: number } | null = null
        for (const p of open) {
          if (p.portId === best.port.portId) continue
          const meta = getPortMeta(p.portId)
          if (!meta.lat || !meta.lng) continue
          const d = haversineKm(userLoc.lat, userLoc.lng, meta.lat, meta.lng)
          if (d > 50) continue
          const saving = (best.port.vehicle as number) - (p.vehicle as number)
          if (saving >= 10 && (!faster || saving > faster.saving)) {
            faster = { port: p, saving }
          }
        }
        return { mode: 'nearest' as const, port: best.port, distanceKm: best.dist, faster }
      }
    }

    // Path 2: fastest in region
    const regionPorts = open.filter((p) => getPortMeta(p.portId).megaRegion === region)
    const pool = regionPorts.length >= 2 ? regionPorts : open
    const sorted = [...pool].sort((a, b) => (a.vehicle as number) - (b.vehicle as number))
    const fastest = sorted[0]
    const slowest = sorted[sorted.length - 1]
    return {
      mode: 'fastest' as const,
      port: fastest,
      slowest,
      delta: (slowest.vehicle as number) - (fastest.vehicle as number),
    }
  }, [ports, userLoc, region])

  if (!ports || !display) return <HeroSkeleton />

  const headlinePort = display.port
  const headlineWait = headlinePort.vehicle as number
  const headlineMeta = getPortMeta(headlinePort.portId)
  const headlineName = headlinePort.localNameOverride || headlineMeta.localName || headlinePort.crossingName || headlinePort.portName

  // Click destination: guest → signup flow with next=port detail, user → port detail
  const portDetail = `/port/${encodeURIComponent(headlinePort.portId)}`
  const clickHref = user ? portDetail : `/signup?next=${encodeURIComponent(portDetail)}`

  const waitLabel = (n: number) => (n === 0 ? '<1 min' : `${n} min`)

  // Share text — pre-composed snapshot
  const shareText = es
    ? `🌉 ${headlineName} ahorita: ${waitLabel(headlineWait)}\n\nCruzar · tiempos en vivo de todos los puentes\ncruzar.app`
    : `🌉 ${headlineName} right now: ${waitLabel(headlineWait)}\n\nCruzar · live wait times for every crossing\ncruzar.app`
  const waUrl = `https://wa.me/?text=${encodeURIComponent(shareText)}`

  // Secondary 'save X min' card — only when a faster option exists
  const savingDelta =
    display.mode === 'nearest'
      ? display.faster?.saving ?? 0
      : display.mode === 'fastest'
        ? display.delta
        : 0
  const savingPort =
    display.mode === 'nearest'
      ? display.faster?.port
      : display.mode === 'fastest'
        ? display.slowest
        : null

  return (
    <div className="mt-3 relative">
      {/* The giant clickable card — primary CTA */}
      <a
        href={clickHref}
        className="block bg-gradient-to-br from-blue-600 via-indigo-700 to-purple-800 rounded-3xl p-5 shadow-2xl text-white relative overflow-hidden active:scale-[0.98] transition-transform"
      >
        {/* background glow */}
        <div className="absolute -top-16 -right-16 w-48 h-48 bg-white/10 rounded-full blur-3xl" />
        <div className="absolute -bottom-20 -left-10 w-56 h-56 bg-purple-400/20 rounded-full blur-3xl" />

        <div className="relative">
          <LivePulse
            es={es}
            secondsAgo={secondsAgo}
            contextLabel={
              display.mode === 'nearest'
                ? (es ? `A ${display.distanceKm.toFixed(0)} km de ti` : `${display.distanceKm.toFixed(0)} km from you`)
                : (es ? MEGA_REGION_LABEL[region].es : MEGA_REGION_LABEL[region].en)
            }
          />

          <div className="mt-4">
            <p className="text-[11px] uppercase tracking-widest font-bold text-blue-100">
              {display.mode === 'nearest'
                ? (es ? 'Tu puente más cercano' : 'Your nearest crossing')
                : (es ? 'Cruce más rápido ahorita' : 'Fastest crossing right now')}
            </p>
            <p className="mt-1 text-3xl sm:text-4xl font-black leading-tight cruzar-rise">
              {headlineName}
            </p>
            <div className="mt-2 flex items-baseline gap-2 cruzar-rise cruzar-rise-delay-1">
              <span className="text-6xl sm:text-7xl font-black leading-none drop-shadow">
                {headlineWait === 0 ? '<1' : headlineWait}
              </span>
              <span className="text-xl font-bold text-blue-100">min</span>
            </div>
          </div>

          {/* The CTA stripe — makes the click target obvious */}
          <div className="mt-4 flex items-center justify-between bg-white/15 backdrop-blur-sm rounded-2xl px-4 py-3 cruzar-rise cruzar-rise-delay-2">
            <p className="text-sm font-bold text-white">
              {user
                ? (es ? 'Ver detalles del puente →' : 'See crossing details →')
                : (es ? 'Crea tu cuenta gratis — activa tu alerta →' : 'Create your free account — turn on your alert →')}
            </p>
          </div>

          {/* Social proof */}
          <p className="mt-3 text-[11px] text-blue-100 font-medium">
            {reportCount != null && reportCount > 0
              ? (es ? `📣 ${reportCount} reportes de la comunidad hoy` : `📣 ${reportCount} community reports today`)
              : (es ? '📣 Sé el primero en reportar hoy' : '📣 Be the first to report today')}
          </p>
        </div>
      </a>

      {/* Alternative option — calm, positive framing. Only shown when a
          meaningfully faster nearby bridge exists. */}
      {savingDelta >= 10 && savingPort && (
        <a
          href={user
            ? `/port/${encodeURIComponent(savingPort.portId)}`
            : `/signup?next=${encodeURIComponent('/port/' + savingPort.portId)}`}
          className="mt-2 block bg-emerald-50 dark:bg-emerald-900/20 border border-emerald-200 dark:border-emerald-800 rounded-2xl px-4 py-3 active:scale-[0.98] transition-transform"
        >
          <div className="flex items-center justify-between gap-3">
            <div className="min-w-0">
              <p className="text-[10px] uppercase tracking-wider font-bold text-emerald-700 dark:text-emerald-300">
                {es ? 'Opción más rápida cerca' : 'Faster option nearby'}
              </p>
              <p className="text-sm font-black text-gray-900 dark:text-gray-100 mt-0.5 truncate">
                {(getPortMeta(savingPort.portId).localName || savingPort.crossingName)}
                <span className="ml-2 text-emerald-700 dark:text-emerald-300">{waitLabel(savingPort.vehicle as number)}</span>
              </p>
              <p className="text-[11px] text-emerald-700 dark:text-emerald-300">
                {es ? `${savingDelta} min más rápido` : `${savingDelta} min faster`}
              </p>
            </div>
            <span className="flex-shrink-0 bg-emerald-600 text-white text-xs font-bold px-3 py-1.5 rounded-full">
              →
            </span>
          </div>
        </a>
      )}

      {/* Small share button — doesn't compete with the primary CTA */}
      <div className="mt-2 text-right">
        <a
          href={waUrl}
          target="_blank"
          rel="noopener noreferrer"
          className="inline-flex items-center gap-1.5 text-[11px] font-semibold text-gray-500 dark:text-gray-400 hover:text-gray-900 dark:hover:text-gray-200"
        >
          📲 {es ? 'Compartir este puente' : 'Share this crossing'}
        </a>
      </div>

      {/* Tiny geo prompt — only shown if user denied and we fell back */}
      {geoDenied && display.mode === 'fastest' && (
        <p className="mt-1 text-[10px] text-gray-400 text-center">
          {es
            ? '💡 Activa ubicación para ver tu puente más cercano'
            : '💡 Enable location to see your nearest crossing'}
        </p>
      )}
    </div>
  )
}

function LivePulse({ es, secondsAgo, contextLabel }: { es: boolean; secondsAgo: number; contextLabel?: string }) {
  const label = secondsAgo < 10
    ? (es ? 'ahora' : 'now')
    : secondsAgo < 60
      ? (es ? `hace ${secondsAgo}s` : `${secondsAgo}s ago`)
      : (es ? `hace ${Math.floor(secondsAgo / 60)} min` : `${Math.floor(secondsAgo / 60)} min ago`)
  return (
    <div className="flex items-center gap-2">
      <span className="relative flex h-2.5 w-2.5">
        <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-red-400 opacity-75" />
        <span className="relative inline-flex rounded-full h-2.5 w-2.5 bg-red-500" />
      </span>
      <span className="text-[10px] uppercase font-bold tracking-widest text-white/90">
        {es ? 'EN VIVO' : 'LIVE'}
      </span>
      <span className="text-[10px] text-white/60">· {label}</span>
      {contextLabel && <span className="text-[10px] text-white/60">· {contextLabel}</span>}
    </div>
  )
}

function HeroSkeleton() {
  return (
    <div className="mt-3 bg-gradient-to-br from-blue-600 to-indigo-800 rounded-3xl p-5 shadow-2xl text-white animate-pulse">
      <div className="h-3 w-24 bg-white/30 rounded-full" />
      <div className="h-8 w-56 bg-white/30 rounded-lg mt-4" />
      <div className="h-20 w-40 bg-white/30 rounded-lg mt-3" />
      <div className="h-12 w-full bg-white/20 rounded-2xl mt-4" />
    </div>
  )
}
