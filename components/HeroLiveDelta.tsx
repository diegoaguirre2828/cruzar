'use client'

import { useEffect, useMemo, useState } from 'react'
import { useLang } from '@/lib/LangContext'
import { useAuth } from '@/lib/useAuth'
import { getPortMeta, type MegaRegion } from '@/lib/portMeta'
import { haversineKm } from '@/lib/geo'
import { trackShare } from '@/lib/trackShare'
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
  const [hourly, setHourly] = useState<{ peak: { hour: number; avgWait: number } | null; best: { hour: number; avgWait: number } | null } | null>(null)
  const [copied, setCopied] = useState(false)

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
        const bestMeta = getPortMeta(best.port.portId)
        const bestName = (best.port.localNameOverride || bestMeta.localName || best.port.crossingName || '').toLowerCase().trim()

        // "Faster option nearby" rules — intentionally conservative:
        //   1. Must be in the SAME mega region (don't tell a Hidalgo user
        //      to drive to Brownsville; same for Tijuana → Mexicali etc.)
        //   2. Must be within 25 km of the user (driving 30+ min usually
        //      kills the savings unless the delta is huge)
        //   3. Must save at least 10 min on the wait itself
        //   4. Must pass the worth-it test: wait savings must exceed
        //      estimated drive time × 1.5 (so a 10 min drive requires
        //      at least 15 min of wait savings)
        //   5. Must not be the SAME bridge by name (extra safety against
        //      port_overrides collisions or duplicate CBP entries)
        let faster: { port: PortWaitTime; saving: number; driveMin: number } | null = null
        for (const p of open) {
          if (p.portId === best.port.portId) continue
          const meta = getPortMeta(p.portId)
          if (!meta.lat || !meta.lng) continue
          // Rule 1: same mega region
          if (meta.megaRegion !== bestMeta.megaRegion) continue
          // Rule 5: different bridge name
          const altName = (p.localNameOverride || meta.localName || p.crossingName || '').toLowerCase().trim()
          if (altName && bestName && altName === bestName) continue
          // Rule 2: within 25 km of user
          const altDistFromUser = haversineKm(userLoc.lat, userLoc.lng, meta.lat, meta.lng)
          if (altDistFromUser > 25) continue
          // Rule 3: wait savings ≥ 10 min
          const saving = (best.port.vehicle as number) - (p.vehicle as number)
          if (saving < 10) continue
          // Rule 4: worth-it test vs drive time
          // Drive distance ≈ straight-line distance between the two bridges,
          // using 50 km/h average (urban border roads with stops, lights)
          const driveKm = haversineKm(bestMeta.lat, bestMeta.lng, meta.lat, meta.lng)
          const driveMin = Math.max(2, Math.round((driveKm / 50) * 60))
          if (saving < driveMin * 1.5) continue
          // Pick the alternative with the best NET savings (after drive time)
          const netSaving = saving - driveMin
          if (!faster || netSaving > (faster.saving - faster.driveMin)) {
            faster = { port: p, saving, driveMin }
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

  // Fetch the hourly pattern for whichever port the hero is showing.
  // Powers the "today's pattern" hook below the hero — pulls users
  // deeper into the page instead of letting them bounce.
  const heroPortId = display?.port?.portId
  useEffect(() => {
    if (!heroPortId) return
    let cancelled = false
    fetch(`/api/ports/${encodeURIComponent(heroPortId)}/hourly`)
      .then((r) => r.json())
      .then((d) => {
        if (cancelled) return
        setHourly({ peak: d.peak ?? null, best: d.best ?? null })
      })
      .catch(() => { if (!cancelled) setHourly(null) })
    return () => { cancelled = true }
  }, [heroPortId])

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
  // FB sharer opens the share dialog with our OG preview — the user then
  // picks which group / page to post into. This is the Cruzar growth vector.
  const fbUrl = `https://www.facebook.com/sharer/sharer.php?u=${encodeURIComponent('https://cruzar.app')}&quote=${encodeURIComponent(shareText)}`

  async function handleCopyLink() {
    try {
      await navigator.clipboard.writeText(shareText)
      setCopied(true)
      trackShare('copy', 'hero_live_delta')
      setTimeout(() => setCopied(false), 2000)
    } catch { /* clipboard blocked */ }
  }

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
  const savingDriveMin =
    display.mode === 'nearest' ? display.faster?.driveMin ?? 0 : 0
  const savingNet = Math.max(0, savingDelta - savingDriveMin)

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

            {/* Loss-aversion microcopy: staying = uncertainty, signing up = certainty.
                Only shown to guests — logged-in users have already committed. */}
            {!user && (
              <p className="mt-2 text-[11px] text-amber-200 font-semibold leading-snug cruzar-rise cruzar-rise-delay-1">
                {es
                  ? '⚠️ Esta espera cambia cada 5 minutos. Te puede subir 20 min sin avisarte.'
                  : '⚠️ This wait changes every 5 min. It can jump 20 min without warning.'}
              </p>
            )}
          </div>

          {/* Fake notification preview — shows GUESTS the product they get.
              This is the climax of the card: "here's literally what arrives
              on your phone when you sign up." Hidden for logged-in users. */}
          {!user && (
            <div className="mt-4 bg-white rounded-2xl px-3 py-2.5 shadow-xl cruzar-rise cruzar-rise-delay-2 border border-white/40">
              <div className="flex items-start gap-2.5">
                <div className="flex-shrink-0 w-8 h-8 rounded-lg bg-gradient-to-br from-blue-600 to-purple-700 flex items-center justify-center text-sm font-black text-white">
                  C
                </div>
                <div className="flex-1 min-w-0">
                  <div className="flex items-center justify-between gap-2">
                    <p className="text-[10px] font-bold text-gray-500 uppercase tracking-wide truncate">Cruzar</p>
                    <p className="text-[9px] text-gray-400 flex-shrink-0">{es ? 'ahora' : 'now'}</p>
                  </div>
                  <p className="text-[11px] font-bold text-gray-900 leading-snug truncate">
                    🌉 {headlineName} — {Math.max(5, headlineWait - 15)} min
                  </p>
                  <p className="text-[10px] text-gray-600 leading-snug">
                    {es
                      ? 'La espera bajó. Es tu mejor momento pa\' cruzar.'
                      : 'The wait just dropped. Your best window to cross.'}
                  </p>
                </div>
              </div>
            </div>
          )}

          {/* The CTA button — now the visual climax, not a passive stripe */}
          <div className="mt-3 cruzar-rise cruzar-rise-delay-2">
            {user ? (
              <div className="bg-white/15 backdrop-blur-sm rounded-2xl px-4 py-3 text-center">
                <p className="text-sm font-bold text-white">
                  {es ? 'Ver detalles del puente →' : 'See crossing details →'}
                </p>
              </div>
            ) : (
              <div className="bg-white text-indigo-700 rounded-2xl px-4 py-3.5 text-center shadow-lg cruzar-shimmer">
                <p className="text-base font-black leading-tight">
                  {es ? 'Activa tu alerta gratis →' : 'Turn on your free alert →'}
                </p>
                <p className="text-[11px] text-indigo-500 font-semibold mt-0.5 leading-snug">
                  {es
                    ? 'Te avisamos en 30 segundos cuando baje. 10 segundos pa\' registrarte.'
                    : "We ping you within 30 seconds when it drops. 10 sec to sign up."}
                </p>
              </div>
            )}
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
          meaningfully faster nearby bridge exists AND the drive is worth it.
          Shown with transparent math: "10 min faster (after 5 min drive)". */}
      {savingNet > 0 && savingPort && (
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
                {((savingPort.localNameOverride) || getPortMeta(savingPort.portId).localName || savingPort.crossingName)}
                <span className="ml-2 text-emerald-700 dark:text-emerald-300">{waitLabel(savingPort.vehicle as number)}</span>
              </p>
              <p className="text-[11px] text-emerald-700 dark:text-emerald-300">
                {es
                  ? `Ahorras ${savingNet} min (después de ~${savingDriveMin} min de manejo)`
                  : `Save ${savingNet} min (after ~${savingDriveMin} min drive)`}
              </p>
            </div>
            <span className="flex-shrink-0 bg-emerald-600 text-white text-xs font-bold px-3 py-1.5 rounded-full">
              →
            </span>
          </div>
        </a>
      )}

      {/* Today's pattern hook — pulls users deeper. Shows the peak/worst
          hour and the best hour for the bridge they're looking at, with
          a click-through that converts to signup for guests. Only renders
          when there's enough historical data to mean anything. */}
      {hourly && hourly.peak && hourly.best && hourly.peak.avgWait > hourly.best.avgWait + 15 && (
        <a
          href={clickHref}
          className="mt-2 block bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-2xl px-4 py-3.5 shadow-sm active:scale-[0.98] transition-transform"
        >
          <div className="flex items-center gap-3">
            <div className="flex-shrink-0 w-10 h-10 rounded-xl bg-orange-100 dark:bg-orange-900/30 flex items-center justify-center text-lg">
              📊
            </div>
            <div className="flex-1 min-w-0">
              <p className="text-[10px] uppercase tracking-wider font-bold text-gray-500 dark:text-gray-400">
                {es ? `Patrón de hoy en ${headlineName}` : `Today's pattern at ${headlineName}`}
              </p>
              <p className="text-sm font-black text-gray-900 dark:text-gray-100 mt-0.5 leading-tight">
                {es
                  ? `Pico ${formatHourLabel(hourly.peak.hour, true)}: sube a ~${hourly.peak.avgWait} min`
                  : `Peak ${formatHourLabel(hourly.peak.hour, false)}: jumps to ~${hourly.peak.avgWait} min`}
              </p>
              <p className="text-[11px] text-emerald-600 dark:text-emerald-400 font-semibold mt-0.5">
                {es
                  ? `Mejor hora ${formatHourLabel(hourly.best.hour, true)} · solo ${hourly.best.avgWait} min`
                  : `Best hour ${formatHourLabel(hourly.best.hour, false)} · only ${hourly.best.avgWait} min`}
              </p>
            </div>
            <span className="flex-shrink-0 text-gray-400 text-lg">→</span>
          </div>
        </a>
      )}

      {/* Big community share block — Facebook groups are the stated growth
          vector, so FB is the lead button. Framed as community duty ("corre
          la voz") rather than self-promo, which is what actually works in
          RGV border groups. */}
      <div className="mt-3 bg-gradient-to-br from-emerald-50 to-teal-50 dark:from-emerald-900/20 dark:to-teal-900/20 border-2 border-emerald-300 dark:border-emerald-700 rounded-2xl p-4 shadow-sm">
        <div className="flex items-start gap-3">
          <div className="flex-shrink-0 w-12 h-12 rounded-2xl bg-gradient-to-br from-emerald-500 to-teal-600 flex items-center justify-center text-2xl shadow-md">
            📣
          </div>
          <div className="flex-1 min-w-0">
            <p className="text-base font-black text-gray-900 dark:text-gray-100 leading-tight">
              {es ? 'Corre la voz' : 'Spread the word'}
            </p>
            <p className="text-[12px] text-gray-700 dark:text-gray-300 mt-1 leading-snug">
              {es
                ? 'Comparte esta espera en tu grupo de Facebook o WhatsApp. Ayuda a que otros no se queden atorados en el puente.'
                : 'Share this wait in your Facebook or WhatsApp group. Help others skip the line.'}
            </p>
          </div>
        </div>
        <div className="mt-3 grid grid-cols-3 gap-2">
          <a
            href={fbUrl}
            target="_blank"
            rel="noopener noreferrer"
            onClick={() => trackShare('facebook', 'hero_live_delta')}
            className="flex items-center justify-center gap-1.5 py-3 bg-[#1877f2] hover:bg-[#166fe5] text-white text-[13px] font-black rounded-xl active:scale-95 transition-all shadow-md"
          >
            <svg width="16" height="16" viewBox="0 0 24 24" fill="currentColor" aria-hidden="true"><path d="M24 12.073c0-6.627-5.373-12-12-12s-12 5.373-12 12c0 5.99 4.388 10.954 10.125 11.854v-8.385H7.078v-3.47h3.047V9.43c0-3.007 1.792-4.669 4.533-4.669 1.312 0 2.686.235 2.686.235v2.953H15.83c-1.491 0-1.956.925-1.956 1.874v2.25h3.328l-.532 3.47h-2.796v8.385C19.612 23.027 24 18.062 24 12.073z"/></svg>
            Facebook
          </a>
          <a
            href={waUrl}
            target="_blank"
            rel="noopener noreferrer"
            onClick={() => trackShare('whatsapp', 'hero_live_delta')}
            className="flex items-center justify-center gap-1.5 py-3 bg-[#25d366] hover:bg-[#20bd5a] text-white text-[13px] font-black rounded-xl active:scale-95 transition-all shadow-md"
          >
            <svg width="16" height="16" viewBox="0 0 24 24" fill="currentColor" aria-hidden="true"><path d="M.057 24l1.687-6.163c-1.041-1.804-1.588-3.849-1.587-5.946.003-6.556 5.338-11.891 11.893-11.891 3.181.001 6.167 1.24 8.413 3.488 2.245 2.248 3.481 5.236 3.48 8.414-.003 6.557-5.338 11.892-11.893 11.892-1.99-.001-3.951-.5-5.688-1.448l-6.305 1.654zm6.597-3.807c1.676.995 3.276 1.591 5.392 1.592 5.448 0 9.886-4.434 9.889-9.885.002-5.462-4.415-9.89-9.881-9.892-5.452 0-9.887 4.434-9.889 9.884-.001 2.225.651 3.891 1.746 5.634l-.999 3.648 3.742-.981zm11.387-5.464c-.074-.124-.272-.198-.57-.347-.297-.149-1.758-.868-2.031-.967-.272-.099-.47-.149-.669.149-.198.297-.768.967-.941 1.165-.173.198-.347.223-.644.074-.297-.149-1.255-.462-2.39-1.475-.883-.788-1.48-1.761-1.653-2.059-.173-.297-.018-.458.13-.606.134-.133.297-.347.446-.521.151-.172.2-.296.3-.495.099-.198.05-.372-.025-.521-.075-.148-.669-1.611-.916-2.206-.242-.579-.487-.501-.669-.51l-.57-.01c-.198 0-.52.074-.792.372s-1.04 1.016-1.04 2.479 1.065 2.876 1.213 3.074c.149.198 2.095 3.2 5.076 4.487.709.306 1.263.489 1.694.626.712.226 1.36.194 1.872.118.571-.085 1.758-.719 2.006-1.413.248-.695.248-1.29.173-1.414z"/></svg>
            WhatsApp
          </a>
          <button
            type="button"
            onClick={handleCopyLink}
            className="flex items-center justify-center gap-1.5 py-3 bg-gray-900 dark:bg-gray-700 hover:bg-gray-800 text-white text-[13px] font-black rounded-xl active:scale-95 transition-all shadow-md"
          >
            {copied ? '✓' : '🔗'} {copied ? (es ? 'Copiado' : 'Copied') : (es ? 'Copiar' : 'Copy')}
          </button>
        </div>
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

function formatHourLabel(h: number, es: boolean): string {
  if (es) return `${h.toString().padStart(2, '0')}:00`
  if (h === 0) return '12am'
  if (h < 12) return `${h}am`
  if (h === 12) return '12pm'
  return `${h - 12}pm`
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
