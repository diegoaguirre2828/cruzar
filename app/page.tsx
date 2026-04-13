'use client'

import Link from 'next/link'
import { useState, useEffect } from 'react'
import { PortList } from '@/components/PortList'
import { NavBar } from '@/components/NavBar'
import { HomeReportsFeed } from '@/components/HomeReportsFeed'
import { UrgentAlerts } from '@/components/UrgentAlerts'
import { WaitingMode } from '@/components/WaitingMode'
import { BusinessCommandWidget } from '@/components/BusinessCommandWidget'
import { ExchangeRateWidget } from '@/components/ExchangeRateWidget'
import { OnboardingTour } from '@/components/OnboardingTour'
import { InstallPrompt } from '@/components/InstallPrompt'
import { InAppBrowserBanner } from '@/components/InAppBrowserBanner'
import { useLang } from '@/lib/LangContext'
import { useTier } from '@/lib/useTier'
import { useAuth } from '@/lib/useAuth'

function ShareAppButton({ lang }: { lang: string }) {
  const text = lang === 'es'
    ? 'checen cruzar.app pa ver los tiempos en vivo de todos los puentes 🌉'
    : 'check cruzar.app for live border wait times 🌉'
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
      <span>📲</span>
      {lang === 'es' ? 'Comparte la app con tus contactos' : 'Share the app with your contacts'}
    </button>
  )
}


interface SavedPort {
  port_id: string
  port_name?: string
  vehicle?: number | null
}

function SavedCrossings() {
  const { user } = useAuth()
  const { lang } = useLang()
  const [saved, setSaved] = useState<SavedPort[]>([])

  useEffect(() => {
    if (!user) return
    Promise.all([
      fetch('/api/saved').then(r => r.json()),
      fetch('/api/ports').then(r => r.json()),
    ]).then(([savedData, portsData]) => {
      const ports: SavedPort[] = (savedData.saved || []).map((s: { port_id: string }) => {
        const live = (portsData.ports || []).find((p: { portId: string }) => p.portId === s.port_id)
        return { port_id: s.port_id, port_name: live?.portName || s.port_id, vehicle: live?.vehicle ?? null }
      })
      setSaved(ports)
    }).catch(() => {})
  }, [user])

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

export default function HomePage() {
  const { t, lang } = useLang()
  const { tier } = useTier()
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
      <InAppBrowserBanner />
      <OnboardingTour />
      <InstallPrompt />
      <div className="max-w-lg mx-auto px-4 pb-10">
        <div className="pt-8 pb-2 flex items-start justify-between">
          <div>
            <h1 className="text-2xl font-bold text-gray-900 dark:text-gray-100">🌉 {t.appName}</h1>
            <p className="text-sm text-gray-500 dark:text-gray-400 mt-0.5">{t.subtitle}</p>
          </div>
          <NavBar />
        </div>

        {/* Services in Mexico banner — hidden for business accounts */}
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

        {/* Business Command Center — visible only to business tier */}
        <BusinessCommandWidget />

        {/* Geolocation — shows if user is near a crossing */}
        <WaitingMode />

        {/* Exchange rate — hidden for business accounts */}
        {!isBusiness && <ExchangeRateWidget />}

        {/* Urgent alerts — accidents & inspections from last 30 min, above the list */}
        {!isBusiness && <UrgentAlerts />}

        {/* Time loss hook — shown to non-business users */}
        {!isBusiness && (
          <div className="mt-3 px-1">
            <p className="text-xs text-gray-400 dark:text-gray-500 text-center">
              {lang === 'es'
                ? '⏱ Los que cruzan a diario pierden hasta 200 horas al año en fila. Cruzar te avisa cuándo salir.'
                : '⏱ Daily commuters lose up to 200 hours a year in line. Cruzar tells you the right time to leave.'}
            </p>
          </div>
        )}

        {/* Primary signup hook — guests only, ABOVE the port list so it isn't buried */}
        {tier === 'guest' && (
          <Link href="/signup" className="block mt-3">
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

        <SavedCrossings />
        <PortList />

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
            <HomeReportsFeed />
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
    </main>
  )
}
