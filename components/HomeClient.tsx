'use client'

import Link from 'next/link'
import dynamic from 'next/dynamic'
import { useState, useEffect, useMemo } from 'react'
import { ChevronDown, ChevronUp } from 'lucide-react'
import { PortList } from '@/components/PortList'
import { NavBar } from '@/components/NavBar'
import { UrgentAlerts } from '@/components/UrgentAlerts'
import { WaitingMode } from '@/components/WaitingMode'
import { BusinessCommandWidget } from '@/components/BusinessCommandWidget'
import { ExchangeRatePill } from '@/components/ExchangeRatePill'
import { RegionPicker } from '@/components/RegionPicker'
import { OnboardingTour } from '@/components/OnboardingTour'
import { InAppBrowserBanner } from '@/components/InAppBrowserBanner'
import { HeroLiveDelta } from '@/components/HeroLiveDelta'
import { LiveActivityTicker } from '@/components/LiveActivityTicker'
import { HeroCarousel } from '@/components/HeroCarousel'
import { WeatherHook } from '@/components/WeatherHook'
import { GuardianProgressCard } from '@/components/GuardianProgressCard'
import { ContributionTodayPill } from '@/components/ContributionTodayPill'
import { CirclesPill } from '@/components/CirclesPill'
import { ReciprocityCard } from '@/components/ReciprocityCard'
import { HeroTriad } from '@/components/HeroTriad'
import { UserCrossingInsights } from '@/components/UserCrossingInsights'
import { HomeForecast } from '@/components/HomeForecast'
import { PriorityNudge, type NudgeSpec } from '@/components/PriorityNudge'
import { SetFavoriteBanner } from '@/components/SetFavoriteBanner'
import { ConversionRibbon } from '@/components/ConversionRibbon'
import { HomeSwipe, type SwipePanel } from '@/components/HomeSwipe'
import { OneTapAlertCard } from '@/components/OneTapAlertCard'
import { PlannerCTACard } from '@/components/PlannerCTACard'
import { ReportBridgePrompt } from '@/components/ReportBridgePrompt'
import { InsightsPill } from '@/components/InsightsPill'

// PERF: below-the-fold + conditional surfaces split into their own
// chunks so they don't bloat the home-page initial JS.
const HomeReportsFeed = dynamic(
  () => import('@/components/HomeReportsFeed').then((m) => ({ default: m.HomeReportsFeed })),
  { ssr: false },
)
const RegionalSnapshot = dynamic(
  () => import('@/components/RegionalSnapshot').then((m) => ({ default: m.RegionalSnapshot })),
  { ssr: false },
)
const AdBanner = dynamic(
  () => import('@/components/AdBanner').then((m) => ({ default: m.AdBanner })),
  { ssr: false },
)
const HolidayOverlay = dynamic(
  () => import('@/components/HolidayOverlay').then((m) => ({ default: m.HolidayOverlay })),
  { ssr: false },
)
import { useLang } from '@/lib/LangContext'
import { useTier } from '@/lib/useTier'
import { useAuth } from '@/lib/useAuth'
import { useSessionPing } from '@/lib/useSessionPing'
import { PwaFirstLaunchWelcome } from '@/components/PwaFirstLaunchWelcome'
import { SocialProofStrip } from '@/components/SocialProofStrip'
import { armNudge } from '@/lib/useNudge'
import { trackEvent } from '@/lib/trackEvent'
import { fetchWithTimeout } from '@/lib/fetchWithTimeout'
import type { PortWaitTime } from '@/types'
import type { RecentReport } from '@/lib/recentReports'
import { slugForPort } from '@/lib/portSlug'

// Priority-ordered list of feature-discovery nudges. Conversion-class
// nudges (set an alert, sign up) are now handled by ConversionRibbon
// at the top — these are the buried-feature pointers that surface
// inside the "Mi puente" panel after personalization.
const HOME_NUDGES: NudgeSpec[] = [
  {
    nudgeKey: 'pro_insights_unlocked',
    emoji: '📊',
    titleEs: 'Ya tienes insights desbloqueados',
    titleEn: 'Your insights are unlocked',
    subEs: 'Patrones por hora, mejor día, predicción con clima — todo en /datos',
    subEn: 'Hourly patterns, best day, weather-aware predictions — all in /datos',
    ctaEs: 'Abrir',
    ctaEn: 'Open',
    href: '/datos',
    tone: 'purple',
  },
  {
    nudgeKey: 'reports_see_leaderboard',
    emoji: '🏆',
    titleEs: 'Ya eres Guardián — mira tu rango',
    titleEn: "You're a Guardian — see your rank",
    subEs: 'Los mejores reportantes de tu región suben en la tabla cada semana',
    subEn: 'The top reporters in your region climb the leaderboard every week',
    ctaEs: 'Ver tabla',
    ctaEn: 'See board',
    href: '/leaderboard',
    tone: 'amber',
  },
  {
    nudgeKey: 'saved_bridge_invite_circle',
    emoji: '👥',
    titleEs: 'Invita a tu gente a tu círculo',
    titleEn: 'Invite your people to your circle',
    subEs: 'Cuando cruces, a tu mamá/esposa/hijos les llega una alerta automática',
    subEn: 'When you cross, mom/spouse/kids get an automatic alert',
    ctaEs: 'Invitar',
    ctaEn: 'Invite',
    href: '/dashboard?tab=circle',
    tone: 'green',
  },
  {
    nudgeKey: 'home_discover_features',
    emoji: '✨',
    titleEs: '¿Sabías todo lo que hace Cruzar?',
    titleEn: 'Know what Cruzar can do?',
    subEs: 'Alertas, insights, optimizador de ruta, cámaras en vivo — todo en una lista',
    subEn: 'Alerts, insights, route optimizer, live cameras — everything in one list',
    ctaEs: 'Ver',
    ctaEn: 'See',
    href: '/features',
    tone: 'purple',
  },
]

interface SavedPort {
  port_id: string
  port_name?: string
  vehicle?: number | null
}

function SavedCrossings({ initialPorts }: { initialPorts: PortWaitTime[] | null }) {
  const { user } = useAuth()
  const { lang } = useLang()
  const [saved, setSaved] = useState<SavedPort[]>([])
  const [status, setStatus] = useState<'idle' | 'loading' | 'error'>('idle')

  const load = () => {
    if (!user) return
    setStatus('loading')
    const portsPromise = initialPorts
      ? Promise.resolve({ ports: initialPorts })
      : fetchWithTimeout('/api/ports', {}, 7000).then(r => r.json())
    Promise.all([
      fetchWithTimeout('/api/saved', {}, 5000).then(r => r.json()),
      portsPromise,
    ]).then(([savedData, portsData]) => {
      const ports: SavedPort[] = (savedData.saved || []).map((s: { port_id: string }) => {
        const live = (portsData.ports || []).find((p: { portId: string }) => p.portId === s.port_id)
        return { port_id: s.port_id, port_name: live?.portName || s.port_id, vehicle: live?.vehicle ?? null }
      })
      setSaved(ports)
      setStatus('idle')
    }).catch(() => {
      setStatus('error')
    })
  }

  useEffect(() => { load() }, [user, initialPorts])  // eslint-disable-line react-hooks/exhaustive-deps

  if (!user) return null
  if (status === 'error') {
    return (
      <div className="mt-3 mb-1 bg-amber-50 dark:bg-amber-900/20 border border-amber-200 dark:border-amber-800 rounded-2xl px-3 py-2 flex items-center justify-between">
        <p className="text-[11px] text-amber-800 dark:text-amber-200 font-medium">
          {lang === 'es' ? 'No pudimos cargar tus favoritos' : "Couldn't load your favorited bridges"}
        </p>
        <button
          onClick={load}
          className="text-[11px] font-bold text-amber-700 dark:text-amber-300 underline underline-offset-2"
        >
          {lang === 'es' ? 'Reintentar' : 'Retry'}
        </button>
      </div>
    )
  }
  if (saved.length === 0) return null

  return (
    <div className="mt-3 mb-1">
      <div className="flex items-center justify-between mb-2">
        <p className="text-xs font-semibold text-gray-500 dark:text-gray-400 uppercase tracking-wide">
          {lang === 'es' ? '⭐ Favoritos' : '⭐ Favorited'}
        </p>
        <Link href="/dashboard" className="text-xs text-blue-500 hover:underline">
          {lang === 'es' ? 'Ver todos' : 'Manage'}
        </Link>
      </div>
      <div className="flex gap-2 overflow-x-auto pb-1 scrollbar-hide">
        {saved.map(s => (
          <Link
            key={s.port_id}
            href={`/cruzar/${slugForPort(s.port_id)}`}
            onClick={() => trackEvent('home_action_taken', { action: 'saved_bridge_tap', port_id: s.port_id })}
            className="flex-shrink-0 bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-2xl px-3 py-2.5 flex flex-col items-center min-w-[80px] shadow-sm active:scale-95 transition-transform"
          >
            <span className={`text-sm font-black ${
              s.vehicle == null ? 'text-gray-400' :
              s.vehicle <= 20 ? 'text-green-600 dark:text-green-400' :
              s.vehicle <= 45 ? 'text-yellow-600 dark:text-yellow-400' :
              'text-red-600 dark:text-red-400'
            }`}>
              {s.vehicle == null ? '—' : s.vehicle === 0 ? '<1' : `${s.vehicle}`}
              {s.vehicle != null && <span className="text-xs font-medium ml-0.5">m</span>}
            </span>
            <span className="text-[10px] text-gray-500 dark:text-gray-400 text-center leading-tight mt-0.5 max-w-[72px] truncate">
              {s.port_name}
            </span>
          </Link>
        ))}
      </div>
    </div>
  )
}

interface Props {
  initialPorts: PortWaitTime[] | null
  initialReports: RecentReport[]
}

export function HomeClient({ initialPorts, initialReports }: Props) {
  useSessionPing()
  const { t, lang } = useLang()
  const { tier } = useTier()
  const { user, loading: authLoading } = useAuth()
  const isBusiness = tier === 'business'
  const es = lang === 'es'

  // ─── Personalization state ─────────────────────────────────
  const [displayName, setDisplayName] = useState<string | null>(null)
  const [favoritePortId, setFavoritePortId] = useState<string | null>(null)

  useEffect(() => {
    if (!user) {
      setDisplayName(null)
      setFavoritePortId(null)
      return
    }
    Promise.all([
      fetchWithTimeout('/api/profile', {}, 5000).then((r) => r.ok ? r.json() : null).catch(() => null),
      fetchWithTimeout('/api/saved', {}, 5000).then((r) => r.ok ? r.json() : null).catch(() => null),
    ]).then(([profileData, savedData]) => {
      setDisplayName(profileData?.profile?.display_name || null)
      const firstSaved = savedData?.saved?.[0]?.port_id || null
      setFavoritePortId(firstSaved)

      if (firstSaved) armNudge('saved_bridge_invite_circle')
      const reportsCount: number = profileData?.profile?.reports_count ?? 0
      if (reportsCount >= 3) armNudge('reports_see_leaderboard')
      const userTier: string = profileData?.profile?.tier ?? 'free'
      if (userTier === 'pro' || userTier === 'business') {
        try {
          if (!localStorage.getItem('cruzar_datos_visited')) {
            armNudge('pro_insights_unlocked')
          }
        } catch { /* ignore */ }
      }
    })
  }, [user])

  const salutation = useMemo(() => {
    const hour = new Date().getHours()
    if (hour < 12) return es ? 'Buenos días' : 'Good morning'
    if (hour < 19) return es ? 'Buenas tardes' : 'Good afternoon'
    return es ? 'Buenas noches' : 'Good evening'
  }, [es])

  useEffect(() => {
    if (!user) return
    trackEvent('home_visited', { has_saved_bridge: !!favoritePortId })
  }, [user, favoritePortId])

  useEffect(() => {
    if (typeof window === 'undefined') return
    const ref = new URLSearchParams(window.location.search).get('ref')
    if (ref && ref.length > 10 && ref.length < 100) {
      try {
        localStorage.setItem('cruzar_ref', ref)
        localStorage.setItem('cruzar_ref_ts', String(Date.now()))
      } catch { /* ignore */ }
    }
  }, [])

  useEffect(() => {
    if (typeof window === 'undefined') return
    try {
      const raw = localStorage.getItem('cruzar_home_visits')
      const visits = raw ? parseInt(raw, 10) || 0 : 0
      const next = visits + 1
      localStorage.setItem('cruzar_home_visits', String(next))
      if (next === 3) armNudge('home_discover_features')
    } catch { /* ignore */ }
  }, [])

  // Collapsable header — chevron toggles RegionPicker + status pills
  // + ConversionRibbon. Default expanded; remembers last state per
  // device. Logo + cruzar wordmark + nav stay visible always.
  const [headerOpen, setHeaderOpen] = useState(true)
  useEffect(() => {
    if (typeof window === 'undefined') return
    try {
      const v = localStorage.getItem('cruzar_header_open')
      if (v === '0') setHeaderOpen(false)
    } catch { /* ignore */ }
  }, [])
  function toggleHeader() {
    setHeaderOpen((prev) => {
      const next = !prev
      try { localStorage.setItem('cruzar_header_open', next ? '1' : '0') } catch { /* ignore */ }
      trackEvent('home_header_toggled', { open: next })
      return next
    })
  }

  // ─── Panels ────────────────────────────────────────────────
  // Default panel = "Cerca" (the bridge list). Universal landing
  // surface — every visitor sees the data they came for, no scroll.
  // Community signals (live ticker + report prompt) sit at the very
  // top so reporting feels like the social contract, not a buried
  // side action — Diego 2026-04-26: "this feels like a check your
  // wait app not a community thing."
  const cercaPanel = (
    <>
      <LiveActivityTicker initialReports={initialReports} />
      <ReportBridgePrompt favoritePortId={favoritePortId} />
      <div className="mt-3 flex flex-wrap items-center justify-center gap-1.5">
        <ExchangeRatePill />
        <WeatherHook variant="pill" />
      </div>
      <HolidayOverlay />
      <ReciprocityCard />
      <UrgentAlerts initialReports={initialReports} />
      <SavedCrossings initialPorts={initialPorts} />
      <div id="port-list" />
      <PortList />
      <SocialProofStrip />
    </>
  )

  // Panel 2 — "Mi puente". Personal hero + forecast + insights for the
  // user's saved bridge. For signed-in users without a favorite, this
  // panel is the favorite-picker. For guests, a generic hero carousel
  // + signup hook.
  const mioPanel = (() => {
    if (authLoading) {
      return (
        <div
          aria-hidden="true"
          className="bg-gradient-to-br from-blue-600 via-indigo-700 to-purple-800 rounded-3xl p-5 shadow-2xl animate-pulse"
        >
          <div className="h-4 w-28 bg-white/25 rounded-full" />
          <div className="h-8 w-48 bg-white/25 rounded-lg mt-4" />
          <div className="h-20 w-40 bg-white/25 rounded-lg mt-3" />
          <div className="h-12 w-full bg-white/15 rounded-2xl mt-4" />
        </div>
      )
    }
    if (user && favoritePortId) {
      return (
        <>
          <HeroTriad ports={initialPorts} favoritePortId={favoritePortId} />
          {/* One-tap alert setup — pre-fills threshold for the favorite
              and posts to /api/alerts directly. Skips /dashboard. The
              biggest activation lift on this rewrite. */}
          <OneTapAlertCard favoritePortId={favoritePortId} tier={tier} />
          {/* Plan-tu-cruce — surfaces /planner (day-of-week + hour
              prediction) which had zero inbound links. Quick fix to
              alert-noise: pick a departure hour instead of 24/7
              threshold pings. */}
          <PlannerCTACard />
          <HomeForecast favoritePortId={favoritePortId} />
          <UserCrossingInsights />
          <PriorityNudge
            lang={lang}
            nudges={HOME_NUDGES.filter(n => {
              if (n.nudgeKey === 'pro_insights_unlocked') return tier === 'pro'
              return tier !== 'guest'
            })}
          />
        </>
      )
    }
    if (user && !favoritePortId) {
      return (
        <>
          <p className="mt-2 mb-3 text-sm font-semibold text-gray-700 dark:text-gray-300">
            {es ? 'Elige tu puente' : 'Pick your bridge'}
          </p>
          <SetFavoriteBanner
            user={user ? { id: user.id } : null}
            ports={(initialPorts || []) as unknown as Array<{ port_id: string }>}
          />
        </>
      )
    }
    return (
      <>
        <HeroCarousel
          slides={[
            {
              key: 'hero',
              labelEs: 'Tu cruce',
              labelEn: 'Your crossing',
              content: <HeroLiveDelta ports={initialPorts} />,
            },
            {
              key: 'ticker',
              labelEs: 'Reportes en vivo',
              labelEn: 'Live reports',
              content: <LiveActivityTicker initialReports={initialReports} />,
            },
          ]}
        />
        <Link href="/signup" className="block mt-3">
          <div className="cruzar-press cruzar-shimmer cruzar-rise bg-gradient-to-r from-blue-600 to-indigo-600 rounded-2xl p-4 flex items-center justify-between gap-3">
            <div className="min-w-0">
              <p className="text-sm font-bold text-white">
                {es
                  ? '🔔 Te avisamos cuando tu puente baje'
                  : "🔔 We'll ping you when your bridge clears"}
              </p>
              <p className="text-xs text-blue-100 mt-0.5">
                {es ? 'Gratis · sin spam' : 'Free · no spam'}
              </p>
            </div>
            <span className="flex-shrink-0 bg-white text-blue-700 text-xs font-bold px-3 py-1.5 rounded-full whitespace-nowrap">
              {es ? 'Activar →' : 'Turn on →'}
            </span>
          </div>
        </Link>
      </>
    )
  })()

  // Panel 3 — "Comunidad". Reports feed + regional snapshot + ad slot.
  // LiveActivityTicker moved up to Cerca panel for community-vibe
  // reasons; full reports feed lives here as the deep-dive view.
  const comunidadPanel = (
    <>
      <div className="mt-1">
        <h2 className="text-sm font-semibold text-gray-700 dark:text-gray-300 mb-3">{t.recentReports}</h2>
        <HomeReportsFeed initialReports={initialReports} />
      </div>
      <div className="mt-4">
        <RegionalSnapshot ports={initialPorts} />
      </div>
      <div className="mt-4">
        <AdBanner slot={process.env.NEXT_PUBLIC_ADSENSE_SLOT_HOME} />
      </div>
    </>
  )

  const panels: SwipePanel[] = [
    { id: 'cerca', labelEs: 'Cerca', labelEn: 'Nearby', content: cercaPanel },
    { id: 'mio', labelEs: 'Mi puente', labelEn: 'My bridge', content: mioPanel },
    { id: 'comunidad', labelEs: 'Comunidad', labelEn: 'Community', content: comunidadPanel },
  ]

  return (
    <main className="min-h-screen bg-gray-50 dark:bg-gray-950">
      <PwaFirstLaunchWelcome />
      <div className="max-w-lg mx-auto px-4 pb-10">
        {/* Sticky app-shell header. Top row (logo + wordmark + nav) is
            always shown. Expandable middle carries the region picker,
            status pills, and conversion ribbon. A drawer-pull chevron
            at the bottom toggles collapse — kept out of the top row
            so it doesn't compete with NavBar's wrap and squeeze the
            logo off the screen. */}
        <div className="sticky top-0 z-30 -mx-4 px-4 pt-3 pb-1 bg-gray-50/85 dark:bg-gray-950/85 backdrop-blur-md">
          <div className="flex items-start justify-between gap-2 flex-wrap">
            <div className="flex items-center gap-3 flex-shrink-0">
              <img
                src="/logo-icon.svg"
                alt=""
                width={36}
                height={36}
                className="rounded-xl flex-shrink-0"
              />
              <div className="min-w-0">
                <h1 className="text-2xl font-bold text-gray-900 dark:text-gray-100 leading-none tracking-tight lowercase whitespace-nowrap">
                  cruzar
                </h1>
                {headerOpen && (
                  user && displayName ? (
                    <p className="text-[11px] text-gray-500 dark:text-gray-400 mt-1.5 leading-tight whitespace-nowrap">
                      {salutation}, <span className="font-bold text-gray-700 dark:text-gray-200">{displayName}</span>
                    </p>
                  ) : (
                    <p className="text-[11px] text-gray-500 dark:text-gray-400 mt-1.5 leading-tight whitespace-nowrap">{t.subtitle}</p>
                  )
                )}
              </div>
            </div>
            <div className="min-w-0 flex-shrink">
              <NavBar />
            </div>
          </div>
          {headerOpen && !isBusiness && (
            <>
              <div className="mt-2 flex justify-center">
                <RegionPicker />
              </div>
              {/* Personal status pills — Guardian progress + Circles +
                  daily contribution + (Pro only) Insights shortcut.
                  Always-visible in the header so the user feels the
                  gamification loop on every screen, not buried inside
                  Mi puente panel. */}
              {tier !== 'guest' && (
                <div className="mt-2 flex flex-wrap items-center justify-center gap-1.5">
                  <GuardianProgressCard variant="pill" />
                  <CirclesPill />
                  <ContributionTodayPill />
                  {tier === 'pro' && <InsightsPill />}
                </div>
              )}
              {/* Single conversion ribbon — guest signup or alert nudge
                  based on tier. Visible across all panels. */}
              <ConversionRibbon />
            </>
          )}
          {/* Drawer-pull chevron — bottom of header, centered. Toggles
              collapse. Compact when expanded; slightly larger tap
              target when collapsed since it's the only way back. */}
          {!isBusiness && (
            <button
              type="button"
              onClick={toggleHeader}
              aria-label={es ? (headerOpen ? 'Colapsar encabezado' : 'Expandir encabezado') : (headerOpen ? 'Collapse header' : 'Expand header')}
              aria-expanded={headerOpen}
              className="mt-1 mx-auto flex items-center justify-center gap-1 px-3 py-1 rounded-full text-gray-400 dark:text-gray-500 hover:text-gray-600 dark:hover:text-gray-300 active:scale-95 transition-transform"
            >
              {headerOpen ? (
                <ChevronUp className="w-3.5 h-3.5" />
              ) : (
                <>
                  <ChevronDown className="w-3.5 h-3.5" />
                  <span className="text-[10px] font-bold uppercase tracking-wider">
                    {es ? 'Más' : 'More'}
                  </span>
                </>
              )}
            </button>
          )}
        </div>

        {/* Business tier — flat layout with the command widget; no
            swipe panels. Fleets need their dispatcher view, not the
            consumer hero/community split. */}
        {isBusiness && <BusinessCommandWidget />}

        {/* Consumer tier — three-panel swipe shell. */}
        {!isBusiness && <HomeSwipe panels={panels} />}

        <WaitingMode />
      </div>

      <InAppBrowserBanner />
      <OnboardingTour />
    </main>
  )
}
