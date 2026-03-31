'use client'

import { PortList } from '@/components/PortList'
import { NavBar } from '@/components/NavBar'
import { GuestAds } from '@/components/GuestAds'
import { HomeReportsFeed } from '@/components/HomeReportsFeed'
import { ActivityPulse } from '@/components/ActivityPulse'
import { WaitingMode } from '@/components/WaitingMode'
import { BusinessCommandWidget } from '@/components/BusinessCommandWidget'
import { useLang } from '@/lib/LangContext'
import Link from 'next/link'

export default function HomePage() {
  const { t } = useLang()

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

        <div className="flex gap-4 mb-4 text-xs text-gray-500 dark:text-gray-400">
          <span className="flex items-center gap-1.5"><span className="w-2.5 h-2.5 rounded-full bg-green-500" />{t.underMin}</span>
          <span className="flex items-center gap-1.5"><span className="w-2.5 h-2.5 rounded-full bg-yellow-500" />{t.midMin}</span>
          <span className="flex items-center gap-1.5"><span className="w-2.5 h-2.5 rounded-full bg-red-500" />{t.overMin}</span>
        </div>

        {/* Business Command Center — visible only to business tier */}
        <BusinessCommandWidget />

        {/* Geolocation — shows if user is near a crossing */}
        <WaitingMode />

        {/* Live activity pulse */}
        <ActivityPulse />

        {/* Smart Planner promo */}
        <Link href="/predict" className="flex items-center justify-between bg-purple-50 dark:bg-purple-900/20 border border-purple-200 dark:border-purple-800 rounded-2xl px-4 py-3 mb-4 hover:bg-purple-100 dark:hover:bg-purple-900/30 transition-colors">
          <div>
            <p className="text-xs font-bold text-purple-800 dark:text-purple-300">{t.plannerBannerTitle}</p>
            <p className="text-xs text-purple-600 dark:text-purple-400">{t.plannerBannerSub}</p>
          </div>
          <span className="text-xs font-semibold text-purple-700 dark:text-purple-300 flex-shrink-0 ml-3">{t.plannerTry}</span>
        </Link>

        <GuestAds />
        <PortList />

        {/* Community reports feed */}
        <div className="mt-6">
          <h2 className="text-sm font-semibold text-gray-700 dark:text-gray-300 mb-3">{t.recentReports}</h2>
          <HomeReportsFeed />
        </div>
      </div>
    </main>
  )
}
