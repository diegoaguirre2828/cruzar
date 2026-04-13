'use client'

import { useEffect, useState } from 'react'
import Link from 'next/link'
import { useLang } from '@/lib/LangContext'

interface Stats {
  weekCount: number
  todayCount: number
  rank: number | null
  totalGuardians: number
}

// Guardián-tier progress card. Uses /api/user/stats to show the current
// user's reports this week + the next milestone they're working toward.
// Humans can't ignore an almost-complete progress bar — this is the
// gamification hook, but framed as service ("guardianes protegiendo la
// raza") instead of points.
//
// Only renders for signed-in users and only after stats load, so guests
// never see a flash of empty progress.

const MILESTONES = [
  { at: 1, emoji: '🌱', es: 'Guardián Novato', en: 'Novice Guardian' },
  { at: 5, emoji: '🛡️', es: 'Guardián Confiable', en: 'Trusted Guardian' },
  { at: 10, emoji: '⚔️', es: 'Guardián Veterano', en: 'Veteran Guardian' },
  { at: 20, emoji: '👑', es: 'Guardián Legendario', en: 'Legendary Guardian' },
  { at: 50, emoji: '🔥', es: 'Guardián Mítico', en: 'Mythic Guardian' },
]

function nextMilestone(count: number) {
  return MILESTONES.find((m) => m.at > count) || MILESTONES[MILESTONES.length - 1]
}

function currentMilestone(count: number) {
  let curr = MILESTONES[0]
  for (const m of MILESTONES) {
    if (count >= m.at) curr = m
  }
  return count >= MILESTONES[0].at ? curr : null
}

interface GuardianCardProps {
  variant?: 'card' | 'pill'
}

export function GuardianProgressCard({ variant = 'card' }: GuardianCardProps = {}) {
  const { lang } = useLang()
  const es = lang === 'es'
  const [stats, setStats] = useState<Stats | null>(null)

  useEffect(() => {
    fetch('/api/user/stats')
      .then((r) => r.ok ? r.json() : null)
      .then((d) => { if (d && typeof d.weekCount === 'number') setStats(d) })
      .catch(() => { /* silent */ })
  }, [])

  if (!stats) return null

  const next = nextMilestone(stats.weekCount)
  const curr = currentMilestone(stats.weekCount)
  const prevAt = curr ? curr.at : 0
  const span = next.at - prevAt
  const progressInSpan = stats.weekCount - prevAt
  const pct = Math.max(4, Math.min(100, (progressInSpan / span) * 100))
  const remaining = Math.max(0, next.at - stats.weekCount)

  const milestoneLabel = es ? next.es : next.en
  const currentLabel = curr ? (es ? curr.es : curr.en) : (es ? 'Aún no eres guardián' : 'Not a guardian yet')

  if (variant === 'pill') {
    return (
      <Link
        href="/leaderboard"
        className="inline-flex items-center gap-1.5 bg-amber-50 dark:bg-amber-900/30 border border-amber-200 dark:border-amber-800 rounded-full pl-2 pr-3 py-1.5 active:scale-[0.97] transition-transform"
        title={currentLabel}
      >
        <span className="text-base leading-none">{curr?.emoji || '🌱'}</span>
        <span className="text-[11px] font-bold text-amber-800 dark:text-amber-200 whitespace-nowrap tabular-nums">
          {stats.weekCount}/{next.at}
          {stats.rank != null && stats.totalGuardians >= 3 && (
            <span className="ml-1 text-amber-600 dark:text-amber-400">· #{stats.rank}</span>
          )}
        </span>
      </Link>
    )
  }

  return (
    <Link
      href="/leaderboard"
      className="mt-3 block bg-gradient-to-br from-amber-50 via-orange-50 to-rose-50 dark:from-amber-900/20 dark:via-orange-900/20 dark:to-rose-900/20 border-2 border-amber-300 dark:border-amber-700 rounded-2xl p-4 shadow-sm active:scale-[0.99] transition-transform"
    >
      <div className="flex items-center gap-3 mb-2.5">
        <span className="text-2xl leading-none flex-shrink-0">{curr?.emoji || '🌱'}</span>
        <div className="min-w-0 flex-1">
          <p className="text-[10px] uppercase tracking-widest font-bold text-amber-700 dark:text-amber-400">
            {es ? 'Tu progreso esta semana' : 'Your progress this week'}
          </p>
          <p className="text-sm font-black text-gray-900 dark:text-gray-100 leading-tight">
            {currentLabel}
          </p>
        </div>
        {stats.rank != null && stats.totalGuardians >= 3 && (
          <div className="flex-shrink-0 text-right">
            <p className="text-xs font-black text-amber-700 dark:text-amber-300 leading-none">
              #{stats.rank}
            </p>
            <p className="text-[9px] text-gray-500 dark:text-gray-400">
              {es ? `de ${stats.totalGuardians}` : `of ${stats.totalGuardians}`}
            </p>
          </div>
        )}
      </div>

      <div className="relative h-2.5 bg-white dark:bg-gray-800 rounded-full overflow-hidden">
        <div
          className="absolute inset-y-0 left-0 bg-gradient-to-r from-amber-400 to-orange-500 rounded-full transition-all"
          style={{ width: `${pct}%` }}
        />
      </div>

      <p className="mt-2 text-[11px] text-gray-700 dark:text-gray-300 font-medium leading-snug">
        {remaining === 0
          ? (es ? `¡Eres ${milestoneLabel}! Sigue reportando.` : `You're ${milestoneLabel}! Keep reporting.`)
          : (es
              ? `${remaining} reporte${remaining === 1 ? '' : 's'} más y subes a ${milestoneLabel} ${next.emoji}`
              : `${remaining} more report${remaining === 1 ? '' : 's'} and you reach ${milestoneLabel} ${next.emoji}`)}
      </p>
    </Link>
  )
}
