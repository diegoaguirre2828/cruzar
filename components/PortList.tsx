'use client'

import { useState, useEffect, useCallback } from 'react'
import { useRouter } from 'next/navigation'
import { PortCard } from './PortCard'
import type { PortSignal } from './PortCard'
import { BorderMap } from './BorderMap'
import { saveCachedPorts, loadCachedPorts } from '@/lib/portCache'
import type { PortWaitTime } from '@/types'
import { RefreshCw, Map, List, Navigation, X, Share2, Check } from 'lucide-react'
import { ALL_REGIONS, getPortMeta } from '@/lib/portMeta'
import { useLang } from '@/lib/LangContext'
import { useTier } from '@/lib/useTier'

const REFRESH_INTERVAL = 5 * 60 * 1000

type Direction = 'entering_us' | 'entering_mexico'

function haversineMi(lat1: number, lng1: number, lat2: number, lng2: number): number {
  const R = 3958.8
  const dLat = (lat2 - lat1) * Math.PI / 180
  const dLng = (lng2 - lng1) * Math.PI / 180
  const a =
    Math.sin(dLat / 2) ** 2 +
    Math.cos(lat1 * Math.PI / 180) * Math.cos(lat2 * Math.PI / 180) * Math.sin(dLng / 2) ** 2
  return R * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a))
}

function distLabel(mi: number, lang: string): string {
  if (mi < 0.5) return lang === 'es' ? 'Muy cerca' : 'Very close'
  return `${mi.toFixed(1)} mi`
}

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
  const router = useRouter()
  const { t, lang } = useLang()
  const { tier } = useTier()
  const isBusiness = tier === 'business'
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
  const [selectedRegion, setSelectedRegion] = useState('All')
  const [searchQuery, setSearchQuery] = useState('')
  const [view, setView] = useState<'list' | 'map'>('list')
  const [direction, setDirection] = useState<Direction>('entering_us')

  // Near Me
  const [userLoc, setUserLoc] = useState<{ lat: number; lng: number } | null>(null)
  const [nearMe, setNearMe] = useState(false)
  const [geoLoading, setGeoLoading] = useState(false)
  const [geoError, setGeoError] = useState<string | null>(null)

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
        fetch('/api/ports', { cache: 'no-store' }),
        fetch('/api/reports/recent?limit=100', { cache: 'no-store' }),
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
    const onVisible = () => {
      if (document.visibilityState === 'visible') fetchPorts()
    }
    document.addEventListener('visibilitychange', onVisible)
    window.addEventListener('focus', onVisible)
    return () => {
      clearInterval(interval)
      document.removeEventListener('visibilitychange', onVisible)
      window.removeEventListener('focus', onVisible)
    }
  }, [fetchPorts])

  // Auto-sort by proximity on load
  useEffect(() => {
    if (!navigator.geolocation) return
    navigator.geolocation.getCurrentPosition(
      pos => {
        setUserLoc({ lat: pos.coords.latitude, lng: pos.coords.longitude })
        setNearMe(true)
      },
      () => { /* denied — stay with region grouping */ },
      { timeout: 6000 }
    )
  }, [])

  function requestNearMe() {
    if (nearMe) { setNearMe(false); setGeoError(null); return }
    if (!navigator.geolocation) {
      setGeoError(lang === 'es' ? 'Geolocalización no disponible' : 'Geolocation not available')
      return
    }
    setGeoLoading(true)
    setGeoError(null)
    navigator.geolocation.getCurrentPosition(
      pos => { setUserLoc({ lat: pos.coords.latitude, lng: pos.coords.longitude }); setNearMe(true); setGeoLoading(false) },
      () => { setGeoError(lang === 'es' ? 'No se pudo obtener tu ubicación' : 'Could not get your location'); setGeoLoading(false) },
      { timeout: 8000 }
    )
  }

  function handleShare() {
    const list = (selectedRegion === 'All' ? ports : ports.filter(p => getPortMeta(p.portId).region === selectedRegion))
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
    await fetch('/api/reports', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ portId: mexPortId, condition, direction: 'mexico', ref: typeof window !== 'undefined' ? localStorage.getItem('cruzar_ref') : null }),
    }).catch(() => {})
    setMexSubmitting(false)
    setMexSubmitted(true)
    setTimeout(() => setMexSubmitted(false), 4000)
  }

  const filteredPorts = (() => {
    let list = selectedRegion === 'All'
      ? ports
      : ports.filter(p => getPortMeta(p.portId).region === selectedRegion)
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

  const sortedByDistance = userLoc
    ? [...ports]
        .map(p => ({ port: p, dist: haversineMi(userLoc.lat, userLoc.lng, getPortMeta(p.portId).lat, getPortMeta(p.portId).lng) }))
        .sort((a, b) => a.dist - b.dist)
    : []

  const grouped = filteredPorts.reduce<Record<string, PortWaitTime[]>>((acc, port) => {
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
      {/* Direction toggle */}
      <div className="flex bg-gray-100 dark:bg-gray-800 rounded-xl p-1 mb-4">
        <button
          onClick={() => setDirection('entering_us')}
          className={`flex-1 py-2 text-xs font-semibold rounded-lg transition-colors ${direction === 'entering_us' ? 'bg-white dark:bg-gray-700 shadow text-gray-900 dark:text-gray-100' : 'text-gray-500 dark:text-gray-400'}`}
        >
          {t.enteringUS}
        </button>
        <button
          onClick={() => setDirection('entering_mexico')}
          className={`flex-1 py-2 text-xs font-semibold rounded-lg transition-colors ${direction === 'entering_mexico' ? 'bg-white dark:bg-gray-700 shadow text-gray-900 dark:text-gray-100' : 'text-gray-500 dark:text-gray-400'}`}
        >
          {t.enteringMexico}
        </button>
      </div>

      {/* ── ENTERING MEXICO ── */}
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
              <div className="flex bg-gray-100 dark:bg-gray-800 rounded-lg p-0.5">
                <button
                  onClick={() => setView('list')}
                  className={`flex items-center gap-1 px-2 py-1 rounded-md text-xs font-medium transition-colors ${view === 'list' ? 'bg-white dark:bg-gray-700 shadow text-gray-900 dark:text-gray-100' : 'text-gray-500 dark:text-gray-400'}`}
                >
                  <List className="w-3 h-3" /> {t.list}
                </button>
                <button
                  onClick={() => setView('map')}
                  className={`flex items-center gap-1 px-2 py-1 rounded-md text-xs font-medium transition-colors ${view === 'map' ? 'bg-white dark:bg-gray-700 shadow text-gray-900 dark:text-gray-100' : 'text-gray-500 dark:text-gray-400'}`}
                >
                  <Map className="w-3 h-3" /> {t.map}
                </button>
              </div>
              <button
                onClick={() => fetchPorts(true)}
                className="flex items-center gap-1 text-xs text-gray-500 dark:text-gray-400 hover:text-gray-800 dark:hover:text-gray-200"
                disabled={refreshing}
              >
                <RefreshCw className={`w-3 h-3 ${refreshing ? 'animate-spin' : ''}`} />
              </button>
            </div>
          </div>

          {/* Near Me + Region row */}
          <div className="mb-4 space-y-2">
            <div className="flex items-center gap-2">
              <button
                onClick={requestNearMe}
                disabled={geoLoading}
                className={`flex items-center gap-1.5 text-xs font-semibold px-3 py-2 rounded-xl border transition-colors flex-shrink-0 ${
                  nearMe
                    ? 'bg-blue-600 text-white border-blue-600'
                    : 'bg-white dark:bg-gray-800 text-gray-600 dark:text-gray-300 border-gray-200 dark:border-gray-700 hover:border-blue-400'
                }`}
              >
                {geoLoading ? <RefreshCw className="w-3 h-3 animate-spin" /> : nearMe ? <X className="w-3 h-3" /> : <Navigation className="w-3 h-3" />}
                {lang === 'es' ? 'Cerca' : 'Near Me'}
              </button>

              {!nearMe && (
                <select
                  value={selectedRegion}
                  onChange={e => setSelectedRegion(e.target.value)}
                  className="flex-1 bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-xl px-3 py-2 text-xs text-gray-900 dark:text-gray-100 font-medium shadow-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                >
                  <option value="All">{lang === 'es' ? '🗺️ Todos los cruces' : '🗺️ All crossings'}</option>
                  {ALL_REGIONS.filter(r => r !== 'All' && r !== 'Other').map(r => (
                    <option key={r} value={r}>{r}</option>
                  ))}
                </select>
              )}

              {nearMe && (
                <p className="flex-1 text-xs text-blue-600 dark:text-blue-400 font-medium">
                  {lang === 'es' ? 'Ordenado por distancia' : 'Sorted by distance'}
                </p>
              )}
            </div>
            {geoError && <p className="text-xs text-red-500 dark:text-red-400 px-1">{geoError}</p>}

            {/* Port name search — lets users type 'hidalgo', 'puente nuevo',
                'tijuana' etc. instead of hunting through the region dropdown */}
            {!nearMe && (
              <div className="relative">
                <input
                  type="text"
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  placeholder={lang === 'es' ? 'Busca tu puente — Hidalgo, Puente Nuevo, Tijuana…' : 'Search your bridge — Hidalgo, Puente Nuevo, Tijuana…'}
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
            )}
          </div>

          {/* Insurance banner — top of list, hidden for business accounts */}
          {!loading && filteredPorts.length > 0 && !isBusiness && (
            <div className="mb-3 flex items-center justify-between bg-indigo-50 dark:bg-indigo-900/20 border border-indigo-200 dark:border-indigo-800 rounded-2xl px-4 py-3">
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

          {view === 'map' && (
            <div className="mb-4">
              <BorderMap
                ports={ports}
                selectedRegion={selectedRegion}
                onPortClick={(portId) => router.push(`/port/${encodeURIComponent(portId)}`)}
              />
              <p className="text-xs text-gray-500 mt-1.5 text-center">{t.tapDot}</p>
            </div>
          )}

          {view === 'list' && nearMe && userLoc && (
            <div className="space-y-3">
              <h2 className="text-xs font-semibold text-blue-600 dark:text-blue-400 uppercase tracking-wider mb-2 px-1 flex items-center gap-1">
                <Navigation className="w-3 h-3" />
                {lang === 'es' ? 'Más cercanos a ti' : 'Nearest to you'}
              </h2>
              {sortedByDistance.map(({ port, dist }) => (
                <div key={`${port.portId}-${port.crossingName}`}>
                  <p className="text-xs text-gray-400 dark:text-gray-500 px-1 mb-1 font-medium">
                    {distLabel(dist, lang)} · {getPortMeta(port.portId).city}
                  </p>
                  <PortCard port={port} signal={signals[port.portId]} />
                </div>
              ))}
            </div>
          )}

          {view === 'list' && !nearMe && (
            <div className="space-y-5">
              {Object.entries(grouped).map(([region, regionPorts]) => (
                <div key={region}>
                  <h2 className="text-xs font-semibold text-gray-500 dark:text-gray-400 uppercase tracking-wider mb-2 px-1">
                    {region === 'Other' ? (lang === 'es' ? 'Otros' : 'Other') : region}
                  </h2>
                  <div className="space-y-3">
                    {regionPorts.map(port => (
                      <PortCard key={`${port.portId}-${port.crossingName}`} port={port} />
                    ))}
                  </div>
                </div>
              ))}
            </div>
          )}

          {filteredPorts.length === 0 && !loading && !nearMe && (
            <p className="text-center text-gray-600 mt-10">No port data available.</p>
          )}

        </>
      )}
    </div>
  )
}
