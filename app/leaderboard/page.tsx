'use client'

import { useState, useEffect } from 'react'
import Link from 'next/link'
import { ArrowLeft, Trophy, Star, Shield, Repeat2, Crown, ThumbsUp, CheckCircle } from 'lucide-react'
import { BADGES } from '@/lib/points'
import { useLang } from '@/lib/LangContext'

interface Leader {
  id: string
  username: string
  points: number
  reports_count: number
  badges: string[]
}

const BADGE_ICONS: Record<string, string> = {
  first_cross: '🌉',
  regular:     '🔁',
  veteran:     '⭐',
  expert:      '🏆',
  legend:      '👑',
  helpful:     '👍',
  trusted:     '✅',
}

const RANK_COLORS = ['text-yellow-500', 'text-gray-400', 'text-amber-600']
const RANK_ICONS = ['🥇', '🥈', '🥉']

export default function LeaderboardPage() {
  const [leaders, setLeaders] = useState<Leader[]>([])
  const [loading, setLoading] = useState(true)
  const { t, lang } = useLang()

  useEffect(() => {
    fetch('/api/leaderboard')
      .then(r => r.json())
      .then(d => setLeaders(d.leaders || []))
      .finally(() => setLoading(false))
  }, [])

  return (
    <main className="min-h-screen bg-gray-50 dark:bg-gray-950">
      <div className="max-w-lg mx-auto px-4 pb-16">
        <div className="pt-6 pb-4 flex items-center gap-3">
          <Link href="/" className="p-2 rounded-xl bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 text-gray-600 dark:text-gray-400 hover:bg-gray-50 dark:hover:bg-gray-700">
            <ArrowLeft className="w-4 h-4" />
          </Link>
          <div>
            <h1 className="text-xl font-bold text-gray-900 dark:text-gray-100">{t.leaderboardTitle}</h1>
            <p className="text-xs text-gray-500 dark:text-gray-400">{t.leaderboardSubtitle}</p>
          </div>
        </div>

        {/* Badge legend */}
        <div className="bg-white dark:bg-gray-800 rounded-2xl border border-gray-200 dark:border-gray-700 p-4 shadow-sm mb-4">
          <h2 className="text-xs font-semibold text-gray-500 dark:text-gray-400 uppercase tracking-wide mb-3">{t.leaderboardBadges}</h2>
          <div className="grid grid-cols-2 gap-2">
            {Object.entries(BADGES).map(([key, badge]) => (
              <div key={key} className="flex items-center gap-2">
                <span className="text-base">{badge.emoji}</span>
                <div>
                  <p className="text-xs font-semibold text-gray-700 dark:text-gray-300">{badge.label}</p>
                  <p className="text-xs text-gray-400">{badge.description}</p>
                </div>
              </div>
            ))}
          </div>
        </div>

        {/* Points guide */}
        <div className="bg-blue-50 dark:bg-blue-900/20 rounded-2xl border border-blue-200 dark:border-blue-800 p-4 mb-4">
          <h2 className="text-xs font-semibold text-blue-700 dark:text-blue-300 uppercase tracking-wide mb-2">{t.leaderboardHowToEarn}</h2>
          <div className="space-y-1">
            {[
              { label: lang === 'es' ? 'Enviar un reporte' : 'Submit a report', pts: '+5' },
              { label: lang === 'es' ? 'Incluir tiempo de espera real' : 'Include actual wait time', pts: '+10' },
              { label: lang === 'es' ? 'Primer reporte del día en un puente' : 'First report at a crossing today', pts: '+15' },
              { label: lang === 'es' ? 'Tu reporte recibe un voto' : 'Your report gets upvoted', pts: '+2' },
            ].map(item => (
              <div key={item.label} className="flex items-center justify-between">
                <span className="text-xs text-blue-800 dark:text-blue-200">{item.label}</span>
                <span className="text-xs font-bold text-blue-600 dark:text-blue-400">{item.pts}</span>
              </div>
            ))}
          </div>
        </div>

        {/* Leaderboard list */}
        <div className="bg-white dark:bg-gray-800 rounded-2xl border border-gray-200 dark:border-gray-700 shadow-sm overflow-hidden">
          {loading ? (
            <div className="p-8 flex justify-center">
              <div className="w-6 h-6 border-2 border-gray-200 border-t-gray-900 rounded-full animate-spin" />
            </div>
          ) : leaders.length === 0 ? (
            <div className="p-8 text-center">
              <Trophy className="w-8 h-8 text-gray-300 mx-auto mb-3" />
              <p className="text-sm text-gray-500 dark:text-gray-400">{t.leaderboardNoReports}</p>
              <p className="text-xs text-gray-400 mt-1">{t.leaderboardBeFirst}</p>
            </div>
          ) : (
            <div className="divide-y divide-gray-100 dark:divide-gray-700">
              {leaders.map((leader, i) => (
                <div key={leader.id} className={`flex items-center gap-3 p-4 ${i < 3 ? 'bg-gray-50/50 dark:bg-gray-700/20' : ''}`}>
                  <div className="w-8 text-center flex-shrink-0">
                    {i < 3 ? (
                      <span className="text-xl">{RANK_ICONS[i]}</span>
                    ) : (
                      <span className="text-sm font-bold text-gray-400">#{i + 1}</span>
                    )}
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-1.5 flex-wrap">
                      <span className="text-sm font-semibold text-gray-900 dark:text-gray-100">@{leader.username}</span>
                      {leader.badges?.slice(0, 3).map(b => (
                        <span key={b} title={BADGES[b]?.label}>{BADGES[b]?.emoji}</span>
                      ))}
                    </div>
                    <p className="text-xs text-gray-400 mt-0.5">{t.leaderboardReports(leader.reports_count)}</p>
                  </div>
                  <div className="text-right flex-shrink-0">
                    <p className="text-sm font-bold text-gray-900 dark:text-gray-100">{leader.points}</p>
                    <p className="text-xs text-gray-400">pts</p>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>

        <p className="text-center text-xs text-gray-400 dark:text-gray-500 mt-4">
          {t.leaderboardBottom}{' '}
          <Link href="/" className="text-blue-500 hover:underline">{t.leaderboardViewCrossings}</Link>
        </p>
      </div>
    </main>
  )
}
