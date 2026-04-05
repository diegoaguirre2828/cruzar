'use client'

import Link from 'next/link'
import { PortList } from '@/components/PortList'
import { NavBar } from '@/components/NavBar'
import { HomeReportsFeed } from '@/components/HomeReportsFeed'
import { UrgentAlerts } from '@/components/UrgentAlerts'
import { WaitingMode } from '@/components/WaitingMode'
import { BusinessCommandWidget } from '@/components/BusinessCommandWidget'
import { ExchangeRateWidget } from '@/components/ExchangeRateWidget'
import { useLang } from '@/lib/LangContext'
import { useTier } from '@/lib/useTier'

export default function HomePage() {
  const { t, lang } = useLang()
  const { tier } = useTier()
  const isBusiness = tier === 'business'

  return (
    <main className="min-h-screen bg-gray-50 dark:bg-gray-950">
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

        <PortList />

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
