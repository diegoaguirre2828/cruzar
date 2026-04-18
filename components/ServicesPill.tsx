'use client'

import Link from 'next/link'
import { useLang } from '@/lib/LangContext'

// Compact "Cross for services" pill for the home header row. Surfaces
// /services (insurance, dental, pharmacy, restaurants in MX) which was
// previously buried at the bottom of the page below FbPagePill.
//
// Diego ask 2026-04-17: "we can add a services pill to main page, next
// to the leaderboard pill" — sits next to GuardianProgressCard in the
// pill row.
export function ServicesPill() {
  const { lang } = useLang()
  const es = lang === 'es'
  return (
    <Link
      href="/services"
      className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full bg-orange-50 dark:bg-orange-900/30 border border-orange-200 dark:border-orange-700/40 text-[11px] font-bold text-orange-700 dark:text-orange-300 hover:bg-orange-100 dark:hover:bg-orange-900/50 transition-colors"
    >
      <span>🌮</span>
      <span>{es ? 'Servicios' : 'Services'}</span>
    </Link>
  )
}
