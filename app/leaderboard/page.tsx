'use client'

import { useState, useEffect } from 'react'
import Link from 'next/link'
import { ArrowLeft, Trophy } from 'lucide-react'
import { BADGES } from '@/lib/points'
import { useLang } from '@/lib/LangContext'
import { useAuth } from '@/lib/useAuth'
import { GuardianProgressCard } from '@/components/GuardianProgressCard'

interface Leader {
  id: string
  username: string
  points: number
  reports_count: number
  badges: string[]
}

// Guardián tiers — same ladder as the home-page GuardianProgressCard,
// so rank/label/emoji are consistent across the app. Ranks are driven
// by total report count, not arbitrary points.
const TIERS = [
  { at: 1,  emoji: '🌱', es: 'Guardián Novato',      en: 'Novice Guardian' },
  { at: 5,  emoji: '🛡️', es: 'Guardián Confiable',   en: 'Trusted Guardian' },
  { at: 10, emoji: '⚔️', es: 'Guardián Veterano',    en: 'Veteran Guardian' },
  { at: 20, emoji: '👑', es: 'Guardián Legendario',  en: 'Legendary Guardian' },
  { at: 50, emoji: '🔥', es: 'Guardián Mítico',      en: 'Mythic Guardian' },
]

function tierFor(count: number) {
  let curr = null as (typeof TIERS)[number] | null
  for (const t of TIERS) {
    if (count >= t.at) curr = t
  }
  return curr
}

const RANK_ICONS = ['🥇', '🥈', '🥉']

export default function LeaderboardPage() {
  const [leaders, setLeaders] = useState<Leader[]>([])
  const [loading, setLoading] = useState(true)
  const { lang } = useLang()
  const { user } = useAuth()

  useEffect(() => {
    fetch('/api/leaderboard')
      .then(r => r.json())
      .then(d => setLeaders(d.leaders || []))
      .finally(() => setLoading(false))
  }, [])

  const es = lang === 'es'

  return (
    <main className="min-h-screen bg-gray-50 dark:bg-gray-950">
      <div className="max-w-lg mx-auto px-4 pb-24">
        <div className="pt-6 pb-4 flex items-center gap-3">
          <Link href="/" className="p-2 rounded-xl bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 text-gray-600 dark:text-gray-400 hover:bg-gray-50 dark:hover:bg-gray-700">
            <ArrowLeft className="w-4 h-4" />
          </Link>
          <div>
            <h1 className="text-xl font-black text-gray-900 dark:text-gray-100">
              {es ? 'Guardianes del puente' : 'Bridge guardians'}
            </h1>
            <p className="text-xs text-gray-500 dark:text-gray-400">
              {es ? 'La raza protegiendo a los que cruzan' : 'The community looking out for crossers'}
            </p>
          </div>
        </div>

        {/* User's own progress card — shown only to signed-in users.
            Makes this page function as a full Guardián tab (your
            progress + community ranking) instead of a pure ranking
            list. Unsigned users see the tier ladder + leaderboard
            which still gives them context. */}
        {user && <div className="-mt-2 mb-2"><GuardianProgressCard /></div>}

        {/* Guardián tier ladder — replaces the old "how to earn points"
            section. This is service framing, not gamification. Same
            ladder used on the homepage GuardianProgressCard. */}
        <div className="bg-gradient-to-br from-amber-50 to-orange-50 dark:from-amber-900/20 dark:to-orange-900/20 rounded-2xl border-2 border-amber-200 dark:border-amber-800 p-4 mb-4">
          <h2 className="text-[10px] font-black text-amber-700 dark:text-amber-300 uppercase tracking-widest mb-3">
            {es ? 'Rangos de guardián' : 'Guardian ranks'}
          </h2>
          <div className="grid grid-cols-1 gap-1.5">
            {TIERS.map((tier) => (
              <div key={tier.at} className="flex items-center gap-3">
                <span className="text-xl leading-none flex-shrink-0 w-6 text-center">{tier.emoji}</span>
                <span className="text-xs font-bold text-gray-800 dark:text-gray-100 flex-1 min-w-0">
                  {es ? tier.es : tier.en}
                </span>
                <span className="text-[11px] font-bold text-amber-700 dark:text-amber-300 tabular-nums flex-shrink-0">
                  {tier.at}+ {es ? 'reportes' : 'reports'}
                </span>
              </div>
            ))}
          </div>
          <p className="mt-3 pt-3 border-t border-amber-200 dark:border-amber-800 text-[11px] text-amber-800 dark:text-amber-300 leading-snug">
            {es
              ? 'Cada reporte le ahorra tiempo a alguien cruzando. No son puntos, es ayudarle a la raza.'
              : "Every report saves someone time at the border. Not points — just looking out for the community."}
          </p>
        </div>

        {/* Badge legend — kept because badges are one-time milestones,
            not points. Founder / First Cross / Trusted Reporter etc. */}
        <div className="bg-white dark:bg-gray-800 rounded-2xl border border-gray-200 dark:border-gray-700 p-4 shadow-sm mb-4">
          <h2 className="text-[10px] font-black text-gray-500 dark:text-gray-400 uppercase tracking-widest mb-3">
            {es ? 'Insignias' : 'Badges'}
          </h2>
          <div className="grid grid-cols-2 gap-2">
            {Object.entries(BADGES).map(([key, badge]) => (
              <div key={key} className="flex items-center gap-2">
                <span className="text-base">{badge.emoji}</span>
                <div className="min-w-0">
                  <p className="text-xs font-semibold text-gray-700 dark:text-gray-300 truncate">{badge.label}</p>
                  <p className="text-[10px] text-gray-400 leading-tight">{badge.description}</p>
                </div>
              </div>
            ))}
          </div>
        </div>

        {/* Leaderboard list — now ranks by reports_count and shows tier */}
        <div className="bg-white dark:bg-gray-800 rounded-2xl border border-gray-200 dark:border-gray-700 shadow-sm overflow-hidden">
          {loading ? (
            <div className="p-8 flex justify-center">
              <div className="w-6 h-6 border-2 border-gray-200 border-t-gray-900 rounded-full animate-spin" />
            </div>
          ) : leaders.length === 0 ? (
            <div className="p-8 text-center">
              <Trophy className="w-8 h-8 text-gray-300 mx-auto mb-3" />
              <p className="text-sm text-gray-500 dark:text-gray-400">
                {es ? 'Aún no hay guardianes' : 'No guardians yet'}
              </p>
              <p className="text-xs text-gray-400 mt-1">
                {es ? 'Sé el primero en reportar' : 'Be the first to report'}
              </p>
            </div>
          ) : (
            <div className="divide-y divide-gray-100 dark:divide-gray-700">
              {[...leaders]
                .sort((a, b) => (b.reports_count || 0) - (a.reports_count || 0))
                .map((leader, i) => {
                  const tier = tierFor(leader.reports_count || 0)
                  return (
                    <div key={leader.id} className={`flex items-center gap-3 p-4 ${i < 3 ? 'bg-gradient-to-r from-amber-50/60 to-transparent dark:from-amber-900/10' : ''}`}>
                      <div className="w-8 text-center flex-shrink-0">
                        {i < 3 ? (
                          <span className="text-xl">{RANK_ICONS[i]}</span>
                        ) : (
                          <span className="text-sm font-bold text-gray-400">#{i + 1}</span>
                        )}
                      </div>
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-1.5 flex-wrap">
                          <span className="text-sm font-bold text-gray-900 dark:text-gray-100">@{leader.username}</span>
                          {leader.badges?.slice(0, 3).map(b => (
                            <span key={b} title={BADGES[b]?.label}>{BADGES[b]?.emoji}</span>
                          ))}
                        </div>
                        <p className="text-[11px] text-gray-500 dark:text-gray-400 mt-0.5 flex items-center gap-1">
                          {tier && <span className="text-sm leading-none">{tier.emoji}</span>}
                          <span>{tier ? (es ? tier.es : tier.en) : (es ? 'Sin rango' : 'Unranked')}</span>
                        </p>
                      </div>
                      <div className="text-right flex-shrink-0">
                        <p className="text-lg font-black text-gray-900 dark:text-gray-100 tabular-nums leading-none">
                          {leader.reports_count || 0}
                        </p>
                        <p className="text-[10px] text-gray-400 uppercase tracking-wide font-bold">
                          {es ? 'reportes' : 'reports'}
                        </p>
                      </div>
                    </div>
                  )
                })}
            </div>
          )}
        </div>

        <p className="text-center text-xs text-gray-400 dark:text-gray-500 mt-4">
          {es ? 'Reporta un puente y únete a los guardianes.' : 'Report a crossing and join the guardians.'}{' '}
          <Link href="/" className="text-blue-500 hover:underline">
            {es ? 'Ver puentes' : 'See crossings'}
          </Link>
        </p>
      </div>
    </main>
  )
}
