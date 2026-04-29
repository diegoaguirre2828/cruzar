'use client'

import Link from 'next/link'
import { useLang } from '@/lib/LangContext'
import { BridgeLogo } from '@/components/BridgeLogo'

// Every empty / error / edge state gets a consistent look + a
// no-dead-end exit. "Back to home · Ver puentes" is the universal
// escape hatch so a user lost in a deep route always has one tap
// out.
//
// Usage:
//   <EmptyState emoji="📍" titleEs="Sin datos" titleEn="No data yet" />
//
// Optional actionHref + actionLabelEs/En for a contextual primary
// action (e.g. "Report wait time"); the home link is always rendered
// as secondary.

interface Props {
  emoji?: string
  titleEs: string
  titleEn: string
  subEs?: string
  subEn?: string
  actionHref?: string
  actionLabelEs?: string
  actionLabelEn?: string
}

export function EmptyState({
  emoji,
  titleEs,
  titleEn,
  subEs,
  subEn,
  actionHref,
  actionLabelEs,
  actionLabelEn,
}: Props) {
  const { lang } = useLang()
  const es = lang === 'es'
  // Default state shows the Cruzar logo (replaces the legacy 🌉 emoji
  // default 2026-04-28 — emoji rendering varied across iOS / Android /
  // Windows so the brand glyph kept changing per device). Consumers
  // can still pass a contextual emoji like '📍' or '🔍' to override.
  const showLogo = !emoji || emoji === '🌉'

  return (
    <div className="flex flex-col items-center text-center py-10 px-4">
      {showLogo ? (
        <div className="mb-3"><BridgeLogo size={56} /></div>
      ) : (
        <p className="text-5xl mb-3">{emoji}</p>
      )}
      <h2 className="text-lg font-black text-gray-900 dark:text-gray-100 mb-1 leading-tight">
        {es ? titleEs : titleEn}
      </h2>
      {(subEs || subEn) && (
        <p className="text-sm text-gray-500 dark:text-gray-400 mb-5 max-w-xs leading-snug">
          {es ? subEs : subEn}
        </p>
      )}
      <div className="flex flex-col gap-2 w-full max-w-xs">
        {actionHref && actionLabelEn && (
          <Link
            href={actionHref}
            className="w-full py-2.5 rounded-xl bg-blue-600 hover:bg-blue-700 text-white text-sm font-bold active:scale-[0.98] transition-all"
          >
            {es ? (actionLabelEs ?? actionLabelEn) : actionLabelEn}
          </Link>
        )}
        <Link
          href="/"
          className="w-full py-2.5 rounded-xl border border-gray-200 dark:border-gray-700 text-gray-700 dark:text-gray-200 text-sm font-semibold active:scale-[0.98] transition-all"
        >
          {es ? 'Volver a los puentes' : 'Back to bridges'}
        </Link>
      </div>
    </div>
  )
}
