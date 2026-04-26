'use client'

import { useEffect, useState } from 'react'
import Link from 'next/link'
import { Users, MessageSquare, Gift } from 'lucide-react'
import { useLang } from '@/lib/LangContext'
import { useAuth } from '@/lib/useAuth'
import { useTier } from '@/lib/useTier'
import { detectInstallState } from '@/lib/detectClient'

// Social proof strip — real numbers only. Sits above the hero on the
// home page so guests see live community evidence before scrolling.
// Replaces the instinct to fake "232/1000" with the real count from
// /api/stats/community (see project memory feedback_lie_vs_real_proof).
//
// Layout:
//   [ 🎯 Oferta: Primeros 1,000 → 3 meses Pro gratis · faltan X ]
//   [ 👥 153 personas ] [ 💬 16 reportes esta semana ] [ 🏆 @Juan, @Maria, @Pedro ]
//
// Promo strip is guest-visible + free-tier-visible (they can still
// benefit). Hidden for existing Pro/Business users since they already
// have what the promo offers. Stats line shows for everyone including
// signed-in users as a retention cue ("look how active this community
// is, you're part of it").

interface StatsResponse {
  totalUsers: number
  reportsLast7d: number
  reportsLast24h: number
  topReporters: { display_name: string; points: number; reports_count: number }[]
  promoRemaining: number
}

export function SocialProofStrip() {
  const { lang } = useLang()
  const { user } = useAuth()
  const { tier } = useTier()
  const es = lang === 'es'
  const [stats, setStats] = useState<StatsResponse | null>(null)
  const [isInstalled, setIsInstalled] = useState(false)

  useEffect(() => {
    if (typeof window !== 'undefined') {
      setIsInstalled(detectInstallState() !== 'web')
    }
  }, [])

  useEffect(() => {
    fetch('/api/stats/community')
      .then((r) => (r.ok ? r.json() : null))
      .then((d) => setStats(d))
      .catch(() => setStats(null))
  }, [])

  if (!stats) return null

  const progressPct = Math.min(100, Math.round(((1000 - stats.promoRemaining) / 1000) * 100))
  const firstNames = stats.topReporters.slice(0, 3).map((r) => r.display_name.split(' ')[0])

  // Hide promo for: already-Pro users (paid or promo), PWA-installed
  // users (they already committed), or when spots are gone.
  const alreadyPro = tier === 'pro' || tier === 'business'
  const showPromo = !alreadyPro && !isInstalled && stats.promoRemaining > 0

  return (
    <div className="mt-3 mb-2 space-y-2">
      {showPromo && (
        <Link
          href="/signup?next=/&promo=first1000"
          className="block bg-gradient-to-r from-amber-400 via-orange-500 to-red-500 rounded-2xl p-3 shadow-sm active:scale-[0.99] transition-transform"
        >
          <div className="flex items-center gap-3">
            <div className="flex-shrink-0 w-9 h-9 bg-white/20 rounded-xl flex items-center justify-center">
              <Gift className="w-5 h-5 text-white" />
            </div>
            <div className="min-w-0 flex-1">
              <p className="text-[10px] font-black uppercase tracking-widest text-white/90">
                {es ? 'Oferta de lanzamiento' : 'Launch offer'}
              </p>
              <p className="text-sm font-black text-white leading-tight">
                {es
                  ? 'Primeros 1,000 · 3 meses de Pro gratis'
                  : 'First 1,000 · 3 months Pro free'}
              </p>
            </div>
            <p className="flex-shrink-0 text-right">
              <span className="text-lg font-black text-white tabular-nums leading-none">
                {stats.promoRemaining}
              </span>
              <span className="block text-[9px] font-bold text-white/80 uppercase tracking-wide">
                {es ? 'cupos' : 'left'}
              </span>
            </p>
          </div>
          <div className="mt-2 h-1 bg-white/25 rounded-full overflow-hidden">
            <div className="h-full bg-white rounded-full transition-all" style={{ width: `${progressPct}%` }} />
          </div>
          <p className="text-[10px] text-white/90 mt-1.5">
            {es
              ? `${stats.totalUsers.toLocaleString()} / 1,000 ya registrados`
              : `${stats.totalUsers.toLocaleString()} / 1,000 already signed up`}
          </p>
        </Link>
      )}

      {/* Data-sources pill row — the accuracy moat (Bordify gap fix
          2026-04-26). Positions Cruzar as multi-source-verified vs
          competitors that just resell CBP. Bordify reviews complain
          "wait times DEAD WRONG" — surfacing the multi-source picture
          is the answer. */}
      <div className="flex flex-wrap items-center gap-1.5 -mt-1">
        <span className="text-[10px] uppercase tracking-wider font-bold text-gray-400 dark:text-gray-500 mr-1">
          {es ? 'Verificado por' : 'Verified by'}
        </span>
        <span className="text-[10px] font-bold text-blue-700 dark:text-blue-400 bg-blue-50 dark:bg-blue-900/20 rounded-full px-2 py-0.5">
          🛰️ CBP
        </span>
        <span className="text-[10px] font-bold text-emerald-700 dark:text-emerald-400 bg-emerald-50 dark:bg-emerald-900/20 rounded-full px-2 py-0.5">
          🎥 {es ? 'Cámaras' : 'Cameras'}
        </span>
        <span className="text-[10px] font-bold text-amber-700 dark:text-amber-400 bg-amber-50 dark:bg-amber-900/20 rounded-full px-2 py-0.5">
          👥 {es ? 'Comunidad' : 'Community'}
        </span>
        <span className="text-[10px] font-bold text-purple-700 dark:text-purple-400 bg-purple-50 dark:bg-purple-900/20 rounded-full px-2 py-0.5">
          📊 230k {es ? 'lecturas' : 'readings'}
        </span>
      </div>

      <div className="flex flex-wrap items-center gap-2">
        <div className="flex items-center gap-1.5 bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-full px-3 py-1.5">
          <Users className="w-3.5 h-3.5 text-blue-500" />
          <span className="text-[11px] font-bold text-gray-900 dark:text-gray-100 tabular-nums">
            {stats.totalUsers.toLocaleString()}
          </span>
          <span className="text-[11px] text-gray-500 dark:text-gray-400">
            {es ? 'en la comunidad' : 'in the community'}
          </span>
        </div>
        {stats.reportsLast7d > 0 && (
          <div className="flex items-center gap-1.5 bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-full px-3 py-1.5">
            <MessageSquare className="w-3.5 h-3.5 text-emerald-500" />
            <span className="text-[11px] font-bold text-gray-900 dark:text-gray-100 tabular-nums">
              {stats.reportsLast7d}
            </span>
            <span className="text-[11px] text-gray-500 dark:text-gray-400">
              {es ? 'reportes esta semana' : 'reports this week'}
            </span>
          </div>
        )}
        {firstNames.length > 0 && (
          <div className="flex items-center gap-1.5 bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-full px-3 py-1.5">
            <span className="text-[11px] text-gray-500 dark:text-gray-400">
              {es ? 'Top:' : 'Top:'}
            </span>
            <span className="text-[11px] font-bold text-gray-900 dark:text-gray-100 truncate max-w-[140px]">
              {firstNames.join(' · ')}
            </span>
          </div>
        )}
      </div>
    </div>
  )
}
