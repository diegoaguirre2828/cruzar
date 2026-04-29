'use client'

import { useState, useEffect, useCallback } from 'react'
import { PortCard } from './PortCard'
import { GuestInlineSignupCta } from './GuestInlineSignupCta'
import type { PortSignal } from './PortCard'
import { saveCachedPorts, loadCachedPorts } from '@/lib/portCache'
import type { PortWaitTime } from '@/types'
import { RefreshCw, X, Share2, Check } from 'lucide-react'
import Link from 'next/link'
import { getPortMeta } from '@/lib/portMeta'
import { useLang } from '@/lib/LangContext'
import { useTier } from '@/lib/useTier'
import { useFavorites } from '@/lib/useFavorites'
import { useHomeRegion, MEGA_REGION_LABELS } from '@/lib/useHomeRegion'
import { trackEvent } from '@/lib/trackEvent'

const REFRESH_INTERVAL = 5 * 60 * 1000

type Direction = 'entering_us' | 'entering_mexico'

const MEX_CROSSINGS = [
  // RGV – McAllen area
  { portId: '230501', name: 'Hidalgo / McAllen (Puente Hidalgo)' },
  { portId: '230502', name: 'Pharr–Reynosa' },
  { portId: '230503', name: 'Anzaldúas' },
  { portId: '230901', name: 'Progreso' },
  { portId: '230902', name: 'Donna' },
  { portId: '230701', name: 'Rio Grande City (Camargo)' },
  { portId: '231001', name: 'Roma (Miguel Alemán)' },
  // RGV – Brownsville
  { portId: '535501', name: 'Brownsville – Gateway (Puente Nuevo)' },
  { portId: '535502', name: 'Brownsville – Veterans (Puente Viejo)' },
  { portId: '535503', name: 'Brownsville – Los Tomates' },
  // Laredo
  { portId: '230401', name: 'Laredo I – Gateway to Americas' },
  { portId: '230402', name: 'Laredo II – Juárez-Lincoln' },
  // Other
  { portId: '230301', name: 'Eagle Pass I' },
  { portId: '240201', name: 'El Paso' },
  { portId: '250401', name: 'San Ysidro' },
  { portId: '250601', name: 'Otay Mesa' },
]

export function PortList() {
  const { t, lang } = useLang()
  const { tier } = useTier()
  const { homeRegion } = useHomeRegion()
  const { favorites, signedIn: hasAccount } = useFavorites()
  const isBusiness = tier === 'business'
  // Scope the visible list to the user's home mega region unless they
  // are business tier (fleets cross multiple regions and need the full
  // picture). homeRegion === null means "show all", so no scoping.
  // Per Diego 2026-04-14 late: the home page is ONLY the user's region.
  // To browse other regions, users tap into /mapa (read-only all bridges).
  const scopeActive = !isBusiness && homeRegion != null
  // Hydrate from the localStorage cache on first render so even a
  // cold-offline load shows data. The network fetch below still
  // fires and replaces this with fresh data when possible.
  const [ports, setPorts] = useState<PortWaitTime[]>(() => {
    if (typeof window === 'undefined') return []
    return loadCachedPorts()?.ports ?? []
  })
  const [fetchedAt, setFetchedAt] = useState<string | null>(null)
  const [cbpUpdatedAt, setCbpUpdatedAt] = useState<string | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [refreshing, setRefreshing] = useState(false)
  const [searchQuery, setSearchQuery] = useState('')
  // Direction is sticky per device. Defaults to 'entering_us' on first visit.
  // Re-enabled 2026-04-25 with toggle for Cruzar Insights B2B data needs +
  // legitimate consumer use (RGV crowd does cross TO Mexico for family/shopping).
  const [direction, setDirectionState] = useState<Direction>(() => {
    if (typeof window === 'undefined') return 'entering_us'
    const stored = window.localStorage.getItem('cruzar_direction') as Direction | null
    return stored === 'entering_mexico' ? 'entering_mexico' : 'entering_us'
  })
  const setDirection = useCallback((d: Direction) => {
    setDirectionState(d)
    if (typeof window !== 'undefined') window.localStorage.setItem('cruzar_direction', d)
    trackEvent('direction_toggled', { direction: d })
  }, [])

  // Share
  const [shareLabel, setShareLabel] = useState<'idle' | 'copied'>('idle')
  const [showShareToast, setShowShareToast] = useState(false)

  // Mexico quick report
  const [mexPortId, setMexPortId] = useState(MEX_CROSSINGS[0].portId)
  const [mexSubmitting, setMexSubmitting] = useState(false)
  const [mexSubmitted, setMexSubmitted] = useState(false)
  const [signals, setSignals] = useState<Record<string, PortSignal>>({})

  const fetchPorts = useCallback(async (isManual = false) => {
    if (isManual) setRefreshing(true)
    try {
      const [portsRes, reportsRes] = await Promise.all([
        // PERF (2026-04-25 audit): use the route handlers' Cache-Control
        // headers (s-maxage=30, stale-while-revalidate=120) instead of
        // forcing every visitor through the origin. With no-store the
        // home page was hitting Supabase + CBP + HERE per request,
        // ~30× origin pressure at 1k DAU vs the cached path.
        fetch('/api/ports'),
        fetch('/api/reports/recent?limit=100'),
      ])
      if (!portsRes.ok) throw new Error('Failed to load')
      const data = await portsRes.json()
      setPorts(data.ports)
      setFetchedAt(data.fetchedAt)
      setCbpUpdatedAt(data.cbpUpdatedAt ?? null)
      setError(null)
      // Stash the successful response so offline/dead-signal users
      // can still see something on next visit. Survives SW cache
      // eviction and reinstalls.
      saveCachedPorts(data.ports)

      if (reportsRes.ok) {
        const { reports } = await reportsRes.json()
        const cutoff = Date.now() - 30 * 60 * 1000
        const recent = (reports || []).filter((r: { created_at: string }) => new Date(r.created_at).getTime() > cutoff)
        const signalMap: Record<string, PortSignal> = {}

        // Group by port
        const byPort: Record<string, typeof recent> = {}
        for (const r of recent) {
          if (!byPort[r.port_id]) byPort[r.port_id] = []
          byPort[r.port_id].push(r)
        }

        for (const [portId, portReports] of Object.entries(byPort)) {
          const accidents = portReports.filter((r: { report_type: string }) => r.report_type === 'accident').length
          const delays    = portReports.filter((r: { report_type: string }) => r.report_type === 'delay').length
          const clears    = portReports.filter((r: { report_type: string }) => r.report_type === 'clear').length
          const crossed   = portReports.find((r: { wait_minutes?: number; created_at: string }) => r.wait_minutes != null)

          if (accidents >= 1) {
            signalMap[portId] = { type: 'accident', count: accidents }
          } else if (delays >= 2) {
            signalMap[portId] = { type: 'delay', count: delays }
          } else if (clears >= 2) {
            signalMap[portId] = { type: 'clear', count: clears }
          } else if (crossed) {
            const minutesAgo = Math.round((Date.now() - new Date(crossed.created_at).getTime()) / 60000)
            const lane = (crossed as { source_meta?: { lane_type?: string } }).source_meta?.lane_type || null
            signalMap[portId] = { type: 'crossed', minutesAgo, waited: crossed.wait_minutes, laneType: lane }
          }
        }
        setSignals(signalMap)
      }
    } catch {
      // Network died — try to hydrate from the local cache so the
      // user still has numbers to look at. Common case: spotty cell
      // at the actual bridge.
      const cached = loadCachedPorts()
      if (cached && cached.ports.length > 0) {
        setPorts(cached.ports)
        setError(null)
      } else {
        setError('Could not load wait times. Showing cached data.')
      }
    } finally {
      setLoading(false)
      setRefreshing(false)
    }
  }, [])

  useEffect(() => {
    fetchPorts()
    const interval = setInterval(() => fetchPorts(), REFRESH_INTERVAL)
    // Refetch whenever the tab comes back to focus. Massive UX upgrade
    // for the "I opened the app and the number looked old" complaint
    // that was getting the app trashed in FB comment threads — users
    // switching away and coming back now see fresh data immediately
    // instead of whatever was cached when they left.
    //
    // PERF (2026-04-25 audit): debounce so a power user toggling
    // between tabs doesn't fire a fetch on every flip. 30s threshold
    // lines up with the route handler's s-maxage=30 — anything sooner
    // would be served from edge cache anyway.
    let lastFetchAt = Date.now()
    const onVisible = () => {
      if (document.visibilityState !== 'visible') return
      if (Date.now() - lastFetchAt < 30_000) return
      lastFetchAt = Date.now()
      fetchPorts()
    }
    document.addEventListener('visibilitychange', onVisible)
    window.addEventListener('focus', onVisible)
    return () => {
      clearInterval(interval)
      document.removeEventListener('visibilitychange', onVisible)
      window.removeEventListener('focus', onVisible)
    }
  }, [fetchPorts])

  function handleShare() {
    // Share what the user is actually looking at — their home region
    // (or the full list for business tier).
    const list = (scopeActive
      ? ports.filter(p => getPortMeta(p.portId).megaRegion === homeRegion)
      : ports)
      .filter(p => p.vehicle !== null && p.vehicle > 0)
      .slice(0, 8)
      .map(p => {
        const lvl = !p.vehicle || p.vehicle <= 20 ? '🟢' : p.vehicle <= 45 ? '🟡' : '🔴'
        return `${lvl} ${p.portName}: ${p.vehicle} min`
      })
      .join('\n')

    const url = 'https://cruzar.app'
    const text = lang === 'es'
      ? `🌉 Tiempos en los puentes ahorita:\n\n${list}\n\n📱 En vivo: ${url}`
      : `🌉 Border wait times right now:\n\n${list}\n\n📱 Live: ${url}`

    if (navigator.share) {
      navigator.share({ title: 'Cruzar – Tiempos de espera', text, url }).catch(() => {})
    } else {
      navigator.clipboard.writeText(text).catch(() => {})
      setShowShareToast(true)
      setTimeout(() => setShowShareToast(false), 3000)
    }
    setShareLabel('copied')
    setTimeout(() => setShareLabel('idle'), 2500)
  }

  async function submitMexReport(condition: string) {
    setMexSubmitting(true)
    // 'southbound' matches /api/reports normalization (anything-not-'southbound'
    // gets stored as 'northbound'). Earlier 'mexico' value silently mis-stored.
    await fetch('/api/reports', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ portId: mexPortId, condition, direction: 'southbound', ref: typeof window !== 'undefined' ? localStorage.getItem('cruzar_ref') : null }),
    }).catch(() => {})
    trackEvent('report_submitted', {
      port_id: mexPortId,
      source: 'home_mex_direction_prompt',
      report_type: condition,
      direction: 'southbound',
    })
    setMexSubmitting(false)
    setMexSubmitted(true)
    setTimeout(() => setMexSubmitted(false), 4000)
  }

  const filteredPorts = (() => {
    // Home page is hard-scoped to the user's home mega-region (unless
    // business tier). Search bypasses scope so users can still find a
    // bridge by name across the full list.
    let list = ports
    if (scopeActive && !searchQuery.trim()) {
      list = ports.filter(p => getPortMeta(p.portId).megaRegion === homeRegion)
    }
    const q = searchQuery.trim().toLowerCase()
    if (q) {
      list = list.filter(p => {
        const meta = getPortMeta(p.portId)
        const localName = p.localNameOverride || meta.localName || ''
        const haystack = [
          p.portId,
          p.portName,
          p.crossingName,
          meta.city,
          meta.region,
          localName,
        ].filter(Boolean).join(' · ').toLowerCase()
        return haystack.includes(q)
      })
    }
    return list
  })()

  // When the favorites section is rendered above the regional groups,
  // exclude favorites from the regional list so the same bridge doesn't
  // appear twice on screen. Falls back to the full list when the user
  // has no favorites or isn't signed in.
  const portsForRegionalList = (hasAccount && favorites.size > 0)
    ? filteredPorts.filter(p => !favorites.has(p.portId))
    : filteredPorts

  const grouped = portsForRegionalList.reduce<Record<string, PortWaitTime[]>>((acc, port) => {
    const region = getPortMeta(port.portId).region
    if (!acc[region]) acc[region] = []
    acc[region].push(port)
    return acc
  }, {})

  const timeAgo = fetchedAt ? Math.round((Date.now() - new Date(fetchedAt).getTime()) / 1000 / 60) : null
  const cbpTime = cbpUpdatedAt
    ? new Date(cbpUpdatedAt).toLocaleTimeString(lang === 'es' ? 'es-MX' : 'en-US', { hour: 'numeric', minute: '2-digit', hour12: true, timeZone: 'America/Chicago' })
    : null

  if (loading) {
    return (
      <div className="space-y-3">
        {[...Array(6)].map((_, i) => (
          <div key={i} className="bg-gray-100 rounded-2xl h-28 animate-pulse" />
        ))}
      </div>
    )
  }

  return (
    <div>
      {/* Insurance nudge removed from the top of PortList 2026-04-25 —
          it was duplicating the lighter insurance banner that already
          renders inside the port list itself (line ~497). The home
          page only needs ONE insurance affiliate slot. The MX-direction
          tab still has its own contextual one when relevant. */}

      {/* Direction toggle — sticky per device. Re-enabled 2026-04-25
          (was gated off via `false &&` — see git history). Both directions
          now write to crossing_reports.direction with the correct
          'northbound' / 'southbound' values that /api/reports expects. */}
      <div className="mb-3 grid grid-cols-2 gap-1.5 p-1 bg-gray-100 dark:bg-gray-800 rounded-2xl">
        <button
          onClick={() => setDirection('entering_us')}
          className={`py-2.5 rounded-xl text-xs font-bold transition-colors ${
            direction === 'entering_us'
              ? 'bg-white dark:bg-gray-900 text-gray-900 dark:text-gray-100 shadow-sm'
              : 'text-gray-500 dark:text-gray-400 hover:text-gray-800 dark:hover:text-gray-200'
          }`}
        >
          🇺🇸 {lang === 'es' ? 'Entrando a EE.UU.' : 'Entering U.S.'}
        </button>
        <button
          onClick={() => setDirection('entering_mexico')}
          className={`py-2.5 rounded-xl text-xs font-bold transition-colors ${
            direction === 'entering_mexico'
              ? 'bg-white dark:bg-gray-900 text-gray-900 dark:text-gray-100 shadow-sm'
              : 'text-gray-500 dark:text-gray-400 hover:text-gray-800 dark:hover:text-gray-200'
          }`}
        >
          🇲🇽 {lang === 'es' ? 'Entrando a México' : 'Entering Mexico'}
        </button>
      </div>

      {/* ── ENTERING MEXICO ── (re-enabled 2026-04-25) */}
      {direction === 'entering_mexico' && (
        <div className="space-y-4 mb-4">

          {/* Insurance nudge — top of Mexico tab, hidden for business accounts */}
          {!isBusiness && <a
            href="/insurance"
            className="flex items-center justify-between bg-indigo-600 hover:bg-indigo-700 rounded-2xl px-4 py-3.5 transition-colors"
          >
            <div className="flex items-center gap-3">
              <span className="text-2xl">🛡️</span>
              <div>
                <p className="text-sm font-bold text-white">
                  {lang === 'es' ? '¿Llevas seguro para México?' : 'Do you have Mexico auto insurance?'}
                </p>
                <p className="text-xs text-indigo-200">
                  {lang === 'es' ? 'Obligatorio por ley — desde $7/día' : 'Required by law — from $7/day'}
                </p>
              </div>
            </div>
            <span className="text-white text-sm font-semibold flex-shrink-0 ml-2">
              {lang === 'es' ? 'Ver →' : 'Get covered →'}
            </span>
          </a>}

          {/* Community quick report */}
          <div className="bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-2xl p-4 shadow-sm">
            <p className="text-sm font-bold text-gray-900 dark:text-gray-100 mb-1">
              {lang === 'es' ? '🇲🇽 ¿Cómo está el cruce a México?' : '🇲🇽 How\'s the crossing into Mexico?'}
            </p>
            <p className="text-xs text-gray-500 dark:text-gray-400 mb-3">
              {lang === 'es'
                ? 'Ayuda a otros reportando las condiciones ahora mismo.'
                : 'Help others by reporting conditions right now.'}
            </p>

            <select
              value={mexPortId}
              onChange={e => setMexPortId(e.target.value)}
              className="w-full mb-3 bg-gray-50 dark:bg-gray-700 border border-gray-200 dark:border-gray-600 rounded-xl px-3 py-2.5 text-sm text-gray-900 dark:text-gray-100 focus:outline-none focus:ring-2 focus:ring-blue-500"
            >
              {MEX_CROSSINGS.map(c => <option key={c.portId} value={c.portId}>{c.name}</option>)}
            </select>

            {mexSubmitted ? (
              <div className="bg-green-50 dark:bg-green-900/20 rounded-xl px-4 py-3 text-center">
                <p className="text-sm font-bold text-green-700 dark:text-green-400">
                  {lang === 'es' ? '✅ ¡Gracias! Tu reporte ayuda a todos.' : '✅ Thanks! Your report helps everyone.'}
                </p>
              </div>
            ) : (
              <div className="grid grid-cols-3 gap-2">
                {[
                  { cond: 'fast',   emoji: '🟢', label: lang === 'es' ? 'Rápido' : 'Fast' },
                  { cond: 'normal', emoji: '🟡', label: lang === 'es' ? 'Normal' : 'Normal' },
                  { cond: 'slow',   emoji: '🔴', label: lang === 'es' ? 'Lento' : 'Slow' },
                ].map(({ cond, emoji, label }) => (
                  <button
                    key={cond}
                    onClick={() => submitMexReport(cond)}
                    disabled={mexSubmitting}
                    className="flex flex-col items-center gap-1 py-3 rounded-xl bg-gray-50 dark:bg-gray-700 border border-gray-200 dark:border-gray-600 hover:bg-gray-100 dark:hover:bg-gray-600 transition-colors disabled:opacity-40 active:scale-95"
                  >
                    <span className="text-xl">{emoji}</span>
                    <span className="text-xs font-semibold text-gray-700 dark:text-gray-300">{label}</span>
                  </button>
                ))}
              </div>
            )}
          </div>

          {/* Community tip */}
          <div className="bg-amber-50 dark:bg-amber-900/20 border border-amber-200 dark:border-amber-800 rounded-2xl p-4">
            <p className="text-xs font-semibold text-amber-800 dark:text-amber-300 mb-1">{t.communityTip}</p>
            <p className="text-xs text-amber-700 dark:text-amber-400 leading-relaxed">{t.communityTipDesc}</p>
          </div>

          <p className="text-xs text-gray-400 dark:text-gray-500 text-center px-4">
            {lang === 'es'
              ? 'México no publica tiempos oficiales. Esta información es reportada por la comunidad.'
              : 'Mexico doesn\'t publish official wait times. This data is community-reported.'}
          </p>
        </div>
      )}

      {/* ── ENTERING US ── */}
      {direction === 'entering_us' && (
        <>
          <div className="flex items-center justify-between mb-3">
            <div className="text-xs text-gray-500 dark:text-gray-400 font-medium">
              {error ? (
                <span className="text-amber-500">{error}</span>
              ) : cbpTime ? (
                <span>CBP {lang === 'es' ? 'actualizado' : 'as of'} {cbpTime} · {lang === 'es' ? 'cada 15 min' : 'every 15 min'}</span>
              ) : timeAgo !== null ? (
                <span>{timeAgo === 0 ? t.updatedJustNow : t.updatedAgo(timeAgo)}</span>
              ) : null}
            </div>
            <div className="flex items-center gap-2">
              <button
                onClick={() => fetchPorts(true)}
                className="flex items-center gap-1 text-xs text-gray-500 dark:text-gray-400 hover:text-gray-800 dark:hover:text-gray-200"
                disabled={refreshing}
              >
                <RefreshCw className={`w-3 h-3 ${refreshing ? 'animate-spin' : ''}`} />
              </button>
            </div>
          </div>

          {/* Main list is ALWAYS scoped to the user's home region now —
              the region dropdown and Near Me button are both gone. Users
              who want to browse outside their region use the dedicated
              read-only "All bridges" view (replacing /mapa). Search is
              kept because it's the fastest way to find a specific bridge
              by name. */}
          <div className="mb-4 space-y-2">
            {homeRegion && scopeActive && (
              <p className="px-1 text-xs text-blue-600 dark:text-blue-400 font-semibold flex items-center gap-1.5">
                📍 {lang === 'es'
                  ? `Tu zona: ${MEGA_REGION_LABELS[homeRegion].es}`
                  : `Your zone: ${MEGA_REGION_LABELS[homeRegion].en}`}
              </p>
            )}

            <div className="relative">
              <input
                type="text"
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                placeholder={lang === 'es' ? 'Busca tu puente — Hidalgo, Puente Nuevo…' : 'Search your bridge — Hidalgo, Puente Nuevo…'}
                className="w-full bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-xl pl-9 pr-8 py-2 text-xs text-gray-900 dark:text-gray-100 focus:outline-none focus:ring-2 focus:ring-blue-500"
              />
              <svg className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400 pointer-events-none" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-4.35-4.35m0 0A7.5 7.5 0 1010.5 3a7.5 7.5 0 006.15 13.65z" />
              </svg>
              {searchQuery && (
                <button
                  type="button"
                  onClick={() => setSearchQuery('')}
                  className="absolute right-2 top-1/2 -translate-y-1/2 p-1 text-gray-400 hover:text-gray-700"
                  aria-label="Clear search"
                >
                  <X className="w-3.5 h-3.5" />
                </button>
              )}
            </div>
          </div>

          {/* Desktop share toast */}
          {showShareToast && (
            <div className="mb-3 bg-blue-50 border border-blue-200 rounded-xl px-4 py-2.5 flex items-center gap-2 text-sm text-blue-800 font-medium">
              <Check className="w-4 h-4 text-blue-500 flex-shrink-0" />
              {lang === 'es'
                ? '¡Texto copiado! Pégalo en tu grupo de Facebook.'
                : 'Text copied! Paste it into your Facebook group post.'}
            </div>
          )}

          {/* Legend + Share row */}
          <div className="flex items-center justify-between mb-3 px-1">
            <div className="flex items-center gap-4">
              <div className="flex items-center gap-1.5 text-xs text-gray-500 dark:text-gray-400">
                <span className="w-2 h-2 rounded-full bg-green-500 flex-shrink-0" /> {t.legendNoWait}
              </div>
              <div className="flex items-center gap-1.5 text-xs text-gray-500 dark:text-gray-400">
                <span className="w-2 h-2 rounded-full bg-yellow-500 flex-shrink-0" /> {t.midMin}
              </div>
              <div className="flex items-center gap-1.5 text-xs text-gray-500 dark:text-gray-400">
                <span className="w-2 h-2 rounded-full bg-red-500 flex-shrink-0" /> {t.overMin}
              </div>
            </div>
            <button
              onClick={handleShare}
              className="flex items-center gap-1 text-xs font-medium text-gray-500 dark:text-gray-400 hover:text-gray-800 dark:hover:text-gray-200 transition-colors"
              title={lang === 'es' ? 'Compartir en grupo de Facebook' : 'Share to Facebook group'}
            >
              {shareLabel === 'copied' ? <Check className="w-3.5 h-3.5 text-green-500" /> : <Share2 className="w-3.5 h-3.5" />}
              <span className="hidden sm:inline">{shareLabel === 'copied' ? (lang === 'es' ? '¡Copiado!' : 'Copied!') : (lang === 'es' ? 'Compartir' : 'Share')}</span>
            </button>
          </div>

          {/* (Live cameras entry point relocated 2026-04-28: was here
              between the legend and the region/favorites banners,
              creating a 3-banner cluster Diego flagged as misclick-
              prone. Now lives in HomeClient's Cerca panel right after
              <LiveActivityTicker /> so it pairs with the live
              community reports surface.) */}

          {/* "See all bridges" deep-link into the read-only /mapa view
              that replaced the Leaflet map. Users stuck in their region
              who want to peek at the whole border can still do so. */}
          {scopeActive && !searchQuery.trim() && homeRegion && (
            <div className="mb-3 flex items-center justify-between gap-2 bg-blue-50 dark:bg-blue-900/20 border border-blue-200 dark:border-blue-800 rounded-xl px-3 py-2">
              <p className="text-[11px] font-bold text-blue-900 dark:text-blue-200 leading-tight">
                📍 {lang === 'es'
                  ? `Mostrando ${MEGA_REGION_LABELS[homeRegion].es}`
                  : `Showing ${MEGA_REGION_LABELS[homeRegion].en}`}
              </p>
              <Link
                href="/mapa"
                className="text-[10px] font-bold text-blue-700 dark:text-blue-300 underline underline-offset-2"
              >
                {lang === 'es' ? 'Ver todos →' : 'See all →'}
              </Link>
            </div>
          )}

          {/* Favoritos — sticky section at the top of the home list for
              signed-in users with saved bridges. Replaces the need for a
              dedicated bottom-nav tab and keeps the starred bridges one
              tap away. Matches BorderCross's "Favorites" IA pillar without
              displacing any existing nav. */}
          {hasAccount && favorites.size > 0 && (() => {
            const favPorts = ports.filter(p => favorites.has(p.portId))
            if (favPorts.length === 0) return null
            return (
              <div className="mb-5">
                <div className="flex items-center justify-between mb-2 px-1">
                  <h2 className="text-xs font-semibold text-yellow-600 dark:text-yellow-400 uppercase tracking-wider flex items-center gap-1.5">
                    <svg viewBox="0 0 24 24" fill="currentColor" className="w-3.5 h-3.5">
                      <path d="M12 2l3.09 6.26L22 9.27l-5 4.87 1.18 6.88L12 17.77l-6.18 3.25L7 14.14 2 9.27l6.91-1.01L12 2z" />
                    </svg>
                    {lang === 'es' ? 'Tus favoritos' : 'Your favorites'}
                  </h2>
                  <Link
                    href="/favorites"
                    className="text-[10px] font-bold text-yellow-600 dark:text-yellow-400 underline underline-offset-2"
                  >
                    {lang === 'es' ? 'Ver todos →' : 'See all →'}
                  </Link>
                </div>
                <div className="space-y-5">
                  {favPorts.map(port => (
                    <PortCard key={`fav-${port.portId}`} port={port} signal={signals[port.portId]} />
                  ))}
                </div>
              </div>
            )
          })()}

          <div className="space-y-7">
            {Object.entries(grouped).map(([region, regionPorts], regionIdx) => (
              <div key={region}>
                <h2 className="text-xs font-semibold text-gray-500 dark:text-gray-400 uppercase tracking-wider mb-3 px-1">
                  {region === 'Other' ? (lang === 'es' ? 'Otros' : 'Other') : region}
                </h2>
                <div className="space-y-5">
                  {regionPorts.map(port => (
                    <PortCard key={`${port.portId}-${port.crossingName}`} port={port} signal={signals[port.portId]} />
                  ))}
                </div>
                {/* Inline signup CTA for guests, slotted after the
                    FIRST region. By that point the user has seen
                    ~3-12 bridges and has demonstrated intent. The
                    CTA returns null for signed-in users, so it's
                    invisible to free + Pro tiers. Tagged with
                    ?source=home_inline for funnel attribution. */}
                {regionIdx === 0 && (
                  <div className="mt-5">
                    <GuestInlineSignupCta />
                  </div>
                )}
              </div>
            ))}
          </div>

          {filteredPorts.length === 0 && !loading && (
            <p className="text-center text-gray-600 mt-10">No port data available.</p>
          )}

          {/* Insurance banner — footer of the bridge list, below the
              cards. Hidden for business accounts. Moved here from above
              the list so it doesn't interrupt the user's primary task
              (find the bridge, see the wait). Affiliate revenue. */}
          {!loading && filteredPorts.length > 0 && !isBusiness && (
            <div className="mt-6 flex items-center justify-between bg-indigo-50 dark:bg-indigo-900/20 border border-indigo-200 dark:border-indigo-800 rounded-2xl px-4 py-3">
              <div className="flex items-center gap-3">
                <span className="text-xl">🛡️</span>
                <div>
                  <p className="text-xs font-semibold text-indigo-900 dark:text-indigo-200">
                    {lang === 'es' ? 'Seguro de auto para México' : 'Mexico auto insurance'}
                  </p>
                  <p className="text-xs text-indigo-600 dark:text-indigo-400">
                    {lang === 'es' ? 'Obligatorio por ley — desde $7/día' : 'Required by law — from $7/day'}
                  </p>
                </div>
              </div>
              <a
                href="/insurance"
                className="flex-shrink-0 ml-3 text-xs font-semibold text-white bg-indigo-600 hover:bg-indigo-700 px-3 py-2 rounded-xl transition-colors"
              >
                {lang === 'es' ? 'Ver →' : 'Get covered →'}
              </a>
            </div>
          )}

        </>
      )}
    </div>
  )
}
