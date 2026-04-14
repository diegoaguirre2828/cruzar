'use client'

import Link from 'next/link'
import { useState, useEffect } from 'react'
import { PortList } from '@/components/PortList'
import { NavBar } from '@/components/NavBar'
import { HomeReportsFeed } from '@/components/HomeReportsFeed'
import { UrgentAlerts } from '@/components/UrgentAlerts'
import { WaitingMode } from '@/components/WaitingMode'
import { BusinessCommandWidget } from '@/components/BusinessCommandWidget'
import { ExchangeRatePill } from '@/components/ExchangeRatePill'
import { RegionPicker } from '@/components/RegionPicker'
import { FbPagePill } from '@/components/FbPagePill'
import { OnboardingTour } from '@/components/OnboardingTour'
import { InAppBrowserBanner } from '@/components/InAppBrowserBanner'
import { HeroLiveDelta } from '@/components/HeroLiveDelta'
import { LiveActivityTicker } from '@/components/LiveActivityTicker'
import { HeroCarousel } from '@/components/HeroCarousel'
import { WeatherHook } from '@/components/WeatherHook'
import { NearMeRail } from '@/components/NearMeRail'
import { GuardianProgressCard } from '@/components/GuardianProgressCard'
import { RegionalSnapshot } from '@/components/RegionalSnapshot'
import { InstallPill } from '@/components/InstallPill'
import { ContributionTodayPill } from '@/components/ContributionTodayPill'
import { HolidayOverlay } from '@/components/HolidayOverlay'
import { ReciprocityCard } from '@/components/ReciprocityCard'
import { useLang } from '@/lib/LangContext'
import { useTier } from '@/lib/useTier'
import { useAuth } from '@/lib/useAuth'
import type { PortWaitTime } from '@/types'
import type { RecentReport } from '@/lib/recentReports'

function ShareAppButton({ lang }: { lang: string }) {
  // Framed as "tell your people" instead of "share the app" — the sender
  // is taking care of their community, not doing marketing. The psychological
  // framing is hero, not promoter.
  const text = lang === 'es'
    ? 'Le estoy avisando a mi gente que cruza — Cruzar muestra los tiempos de todos los puentes en vivo, sin tener que andar buscando en grupos 🌉'
    : "I'm letting my people who cross know — Cruzar shows every bridge's wait time live, without scrolling through groups 🌉"
  const url = 'https://cruzar.app'

  async function handleShare() {
    if (navigator.share) {
      try { await navigator.share({ title: 'Cruzar', text, url }) } catch { /* cancelled */ }
    } else {
      const waUrl = `https://wa.me/?text=${encodeURIComponent(text + '\n' + url)}`
      window.open(waUrl, '_blank')
    }
  }

  return (
    <button
      onClick={handleShare}
      className="w-full mt-4 flex items-center justify-center gap-2 py-3 rounded-2xl border-2 border-green-500 text-green-600 dark:text-green-400 text-sm font-bold hover:bg-green-50 dark:hover:bg-green-900/20 transition-colors active:scale-95"
    >
      <span>🤝</span>
      {lang === 'es' ? 'Avisarle a mi gente' : 'Tell my people'}
    </button>
  )
}


interface SavedPort {
  port_id: string
  port_name?: string
  vehicle?: number | null
}

function SavedCrossings({ initialPorts }: { initialPorts: PortWaitTime[] | null }) {
  const { user } = useAuth()
  const { lang } = useLang()
  const [saved, setSaved] = useState<SavedPort[]>([])

  useEffect(() => {
    if (!user) return
    // Use server-provided ports for instant render; fall back to API if absent.
    const portsPromise = initialPorts
      ? Promise.resolve({ ports: initialPorts })
      : fetch('/api/ports').then(r => r.json())
    Promise.all([
      fetch('/api/saved').then(r => r.json()),
      portsPromise,
    ]).then(([savedData, portsData]) => {
      const ports: SavedPort[] = (savedData.saved || []).map((s: { port_id: string }) => {
        const live = (portsData.ports || []).find((p: { portId: string }) => p.portId === s.port_id)
        return { port_id: s.port_id, port_name: live?.portName || s.port_id, vehicle: live?.vehicle ?? null }
      })
      setSaved(ports)
    }).catch(() => {})
  }, [user, initialPorts])

  if (!user || saved.length === 0) return null

  return (
    <div className="mt-3 mb-1">
      <div className="flex items-center justify-between mb-2">
        <p className="text-xs font-semibold text-gray-500 dark:text-gray-400 uppercase tracking-wide">
          {lang === 'es' ? '⭐ Favoritos' : '⭐ Saved'}
        </p>
        <Link href="/dashboard" className="text-xs text-blue-500 hover:underline">
          {lang === 'es' ? 'Ver todos' : 'Manage'}
        </Link>
      </div>
      <div className="flex gap-2 overflow-x-auto pb-1 scrollbar-hide">
        {saved.map(s => (
          <Link
            key={s.port_id}
            href={`/port/${encodeURIComponent(s.port_id)}`}
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
  const { t, lang } = useLang()
  const { tier } = useTier()
  const { loading: authLoading } = useAuth()
  const isBusiness = tier === 'business'

  // Capture referrer ID on any landing path so shares that point to the
  // homepage ('cruzar.app/?ref=...') actually credit the inviter. Previously
  // this was only done on port detail pages, which meant WhatsApp / FB shares
  // pointing at the root URL lost the ref entirely.
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

  return (
    <main className="min-h-screen bg-gray-50 dark:bg-gray-950">
      <div className="max-w-lg mx-auto px-4 pb-10">
        <div className="pt-8 pb-2 flex items-start justify-between">
          <div className="min-w-0 flex items-center gap-3">
            {/* Real app logo — dark navy square with a white arch bridge.
                Paired with the lowercase "cruzar" wordmark in the design
                Diego locked on 2026-04-13. Source SVG in public/logo-icon.svg. */}
            <img
              src="/logo-icon.svg"
              alt=""
              width={48}
              height={48}
              className="rounded-xl flex-shrink-0"
            />
            <div className="min-w-0">
              <h1 className="text-3xl font-bold text-gray-900 dark:text-gray-100 leading-none tracking-tight lowercase">
                cruzar
              </h1>
              <p className="text-[11px] text-gray-500 dark:text-gray-400 mt-1.5 leading-tight">{t.subtitle}</p>
            </div>
          </div>
          <NavBar />
        </div>

        {/* Pill row — compact replacements for what used to be full-size
            cards. Install + exchange rate + weather + guardián +
            "contribution today" all live here as single-line pills.
            Wraps to a second line on narrow screens. Each is tappable.
            Install pill hides itself when the app is already running as
            a standalone PWA. ContributionTodayPill only renders for
            signed-in users with at least one report today. */}
        {!isBusiness && (
          <div className="mt-1 flex flex-wrap items-center justify-center gap-1.5">
            <RegionPicker />
            <InstallPill />
            <ExchangeRatePill />
            <WeatherHook variant="pill" />
            {tier !== 'guest' && <GuardianProgressCard variant="pill" />}
            {tier !== 'guest' && <ContributionTodayPill />}
          </div>
        )}

        {/* Holiday / heavy-day warning — fires when a known surge date
            (Thanksgiving, Christmas, Semana Santa, etc.) is within the
            next 14 days. Gives users planning lead time for the days
            FB groups can't warn them about in advance. */}
        {!isBusiness && <HolidayOverlay />}

        {/* Reciprocity card — signed-in users with saved bridges see
            a "someone reported your bridge" pill when fresh community
            activity lands on a port they care about. Conditional and
            rare, so kept as a widget (it's more of an alert than
            ambient content). */}
        {!isBusiness && tier !== 'guest' && <ReciprocityCard />}

        {/* Hero carousel — two swipeable slides on mobile, grid on desktop:
              1. HeroLiveDelta (personalized nearest crossing + alert CTA)
              2. LiveActivityTicker (live community reporting)
            The third DailyTip slide was removed — it read as sparse and
            low-value compared to the other two. */}
        {!isBusiness && authLoading && (
          <div
            aria-hidden="true"
            className="mt-3 bg-gradient-to-br from-blue-600 via-indigo-700 to-purple-800 rounded-3xl p-5 shadow-2xl animate-pulse"
          >
            <div className="h-4 w-28 bg-white/25 rounded-full" />
            <div className="h-8 w-48 bg-white/25 rounded-lg mt-4" />
            <div className="h-20 w-40 bg-white/25 rounded-lg mt-3" />
            <div className="h-12 w-full bg-white/15 rounded-2xl mt-4" />
          </div>
        )}
        {!isBusiness && !authLoading && (
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
        )}

        {/* Near-me horizontal rail — swipeable preview of the 8 nearest
            crossings. Every flick is an interaction. */}
        {!isBusiness && <NearMeRail ports={initialPorts} />}

        {/* Urgent alerts — real-time accidents / inspections. Stays above
            the list because these are actionable warnings, not fluff. */}
        {!isBusiness && <UrgentAlerts initialReports={initialReports} />}

        {/* Business Command Center — visible only to business tier */}
        <BusinessCommandWidget />

        {/* Geolocation — shows if user is near a crossing */}
        <WaitingMode />

        <SavedCrossings initialPorts={initialPorts} />
        <div id="port-list" />
        <PortList />

        {/* Regional snapshot — replaces the old StaticBorderMap SVG
            which was an abstract cloud of dots with no labels. This
            one groups ports by border region and shows green/amber/
            red counts + the fastest crossing in each region. Users
            can tap a region to jump straight to its fastest bridge. */}
        {!isBusiness && <RegionalSnapshot ports={initialPorts} />}

        {/* Primary signup hook — guests only, now BELOW the list so the data
            is the first thing they get, and the pitch lands after they've
            already seen the value. */}
        {tier === 'guest' && (
          <Link href="/signup" className="block mt-4">
            <div className="cruzar-shimmer cruzar-rise bg-gradient-to-r from-blue-600 to-indigo-600 rounded-2xl p-4 shadow-sm flex items-center justify-between gap-3 active:scale-[0.98] transition-transform">
              <div className="min-w-0">
                <p className="text-sm font-bold text-white">
                  {lang === 'es'
                    ? '🔔 Te avisamos cuando tu puente baje de 30 min'
                    : '🔔 We\'ll ping you when your bridge drops below 30 min'}
                </p>
                <p className="text-xs text-blue-100 mt-0.5">
                  {lang === 'es'
                    ? 'Gratis · sin spam · cancela cuando quieras'
                    : 'Free · no spam · cancel anytime'}
                </p>
              </div>
              <span className="flex-shrink-0 bg-white text-blue-700 text-xs font-bold px-3 py-1.5 rounded-full whitespace-nowrap">
                {lang === 'es' ? 'Activar →' : 'Turn on →'}
              </span>
            </div>
          </Link>
        )}

        {/* Exchange rate lives as a pill in the header now, on tap it opens
            the full widget in a bottom sheet — no big card below the list. */}

        {/* FB page follow — moved out of the top header row because Diego
            didn't want the Follow FB pill as the first thing users see.
            Lives here as a small, non-prominent action below the main list. */}
        {!isBusiness && (
          <div className="mt-4 flex justify-center">
            <FbPagePill />
          </div>
        )}

        {/* Services in Mexico banner — moved below the list */}
        {!isBusiness && (
          <Link href="/services" className="block mt-3">
            <div className="bg-gradient-to-r from-emerald-600 to-teal-600 rounded-2xl p-4 shadow-sm">
              <div className="flex items-center justify-between mb-3">
                <div>
                  <p className="text-base font-bold text-white">
                    {lang === 'es' ? '🇲🇽 Servicios en México' : '🇲🇽 Services in Mexico'}
                  </p>
                  <p className="text-xs text-emerald-100 mt-0.5">
                    {lang === 'es'
                      ? 'Dental, farmacias, taxis y más cerca del puente'
                      : 'Dental, pharmacy, taxis & more near the bridge'}
                  </p>
                </div>
                <span className="text-white text-sm font-semibold flex-shrink-0 ml-3">
                  {lang === 'es' ? 'Ver →' : 'See →'}
                </span>
              </div>
              <div className="flex gap-2 flex-wrap">
                {[
                  { emoji: '🦷', en: 'Dental', es: 'Dental' },
                  { emoji: '💊', en: 'Pharmacy', es: 'Farmacia' },
                  { emoji: '🚕', en: 'Taxis', es: 'Taxis' },
                  { emoji: '🔧', en: 'Auto', es: 'Mecánico' },
                ].map(c => (
                  <span key={c.en} className="bg-white/20 text-white text-xs font-medium px-2.5 py-1 rounded-full">
                    {c.emoji} {lang === 'es' ? c.es : c.en}
                  </span>
                ))}
              </div>
            </div>
          </Link>
        )}

        <ShareAppButton lang={lang} />

        {/* Pro upsell — shown to free users only */}
        {tier === 'free' && (
          <Link href="/dashboard?tab=alerts" className="block mt-4">
            <div className="bg-gradient-to-r from-blue-600 to-indigo-600 rounded-2xl p-4 shadow-sm flex items-center justify-between gap-3">
              <div>
                <p className="text-sm font-bold text-white">
                  {lang === 'es' ? '🔔 Activa tu alerta para tu puente' : '🔔 Set an alert for your crossing'}
                </p>
                <p className="text-xs text-blue-100 mt-0.5">
                  {lang === 'es' ? '1 alerta incluida gratis — sube a Pro para todas' : '1 alert free — upgrade to Pro for all your crossings'}
                </p>
              </div>
              <span className="flex-shrink-0 bg-white text-blue-700 text-xs font-bold px-3 py-1.5 rounded-full whitespace-nowrap">
                {lang === 'es' ? 'Activar →' : 'Set alert →'}
              </span>
            </div>
          </Link>
        )}

        {/* Community reports feed — just below the list, hidden for business accounts */}
        {!isBusiness && (
          <div className="mt-6">
            <h2 className="text-sm font-semibold text-gray-700 dark:text-gray-300 mb-3">{t.recentReports}</h2>
            <HomeReportsFeed initialReports={initialReports} />
          </div>
        )}

        {/* SENTRI banner — bottom, hidden for business accounts */}
        {!isBusiness && (
          <a href="https://ttp.cbp.dhs.gov/" target="_blank" rel="noopener noreferrer" className="block mt-4">
            <div className="bg-gradient-to-r from-amber-500 to-yellow-500 rounded-2xl p-4 shadow-sm">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-base font-bold text-white">
                    ⚡ {lang === 'es' ? 'Obtén SENTRI — Cruza Más Rápido' : 'Get SENTRI — Skip the Line'}
                  </p>
                  <p className="text-xs text-amber-100 mt-0.5">
                    {lang === 'es'
                      ? 'Ahorra 30–90 min en promedio · Cuota única de $122.25'
                      : 'Save 30–90 min on average · One-time $122.25 fee'}
                  </p>
                </div>
                <span className="text-white text-sm font-semibold flex-shrink-0 ml-3">
                  {lang === 'es' ? 'Ver →' : 'Apply →'}
                </span>
              </div>
            </div>
          </a>
        )}
      </div>

      {/* Overlays render AFTER the hero in DOM so they can't push the
          above-the-fold hero down during hydration. They're fixed/modal
          anyway — the position in JSX only matters for paint order.
          CruzFab moved to app/layout.tsx so it floats on every tab,
          not just Home. */}
      <InAppBrowserBanner />
      <OnboardingTour />
    </main>
  )
}
