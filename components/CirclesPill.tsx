'use client'

import Link from 'next/link'
import { useLang } from '@/lib/LangContext'

// Compact "Mi círculo" pill for the home header row. Surfaces the
// circles feature (life360-style invite-your-people-to-this-bridge)
// which currently only exists at /dashboard?tab=circle. Without
// surfacing on home, almost nobody discovers it.
//
// Diego ask 2026-04-17: "pill for circles" — sits next to
// ServicesPill in the home pill row.
export function CirclesPill() {
  const { lang } = useLang()
  const es = lang === 'es'
  return (
    <Link
      href="/dashboard?tab=circle"
      className="cruzar-pill inline-flex items-center gap-1.5 pl-2 pr-3 py-1.5 rounded-full bg-purple-50 dark:bg-purple-900/30 border border-purple-200 dark:border-purple-700/40 text-[11px] font-bold text-purple-700 dark:text-purple-300 hover:bg-purple-100 dark:hover:bg-purple-900/50 max-w-full"
    >
      <span>👥</span>
      <span>{es ? 'Mi círculo' : 'My circle'}</span>
    </Link>
  )
}
