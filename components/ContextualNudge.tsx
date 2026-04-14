'use client'

import { useEffect } from 'react'
import Link from 'next/link'
import { X } from 'lucide-react'
import { useNudge } from '@/lib/useNudge'

// Passive nudge card. Renders a small callout with an emoji,
// headline, subhead, CTA link, and a dismiss X. Hides itself once
// the user has dismissed or taken the action, and remembers across
// sessions via localStorage (see lib/useNudge.ts).
//
// Intentionally non-blocking: never a modal, never a toast that
// eats input focus. Just an ignorable pill in the normal document
// flow. Diego's rule: "ignorable chips beat auto-spawned sub-content"
// (feedback_user_choice_over_forced_decomposition.md).

interface Props {
  nudgeKey: string
  emoji: string
  titleEs: string
  titleEn: string
  subEs: string
  subEn: string
  ctaEs: string
  ctaEn: string
  href: string
  lang: 'es' | 'en'
  // Color variant — matches other Cruzar pill styles
  tone?: 'blue' | 'green' | 'amber' | 'purple'
}

const TONE: Record<NonNullable<Props['tone']>, string> = {
  blue:   'bg-blue-50 dark:bg-blue-900/20 border-blue-200 dark:border-blue-800',
  green:  'bg-green-50 dark:bg-green-900/20 border-green-200 dark:border-green-800',
  amber:  'bg-amber-50 dark:bg-amber-900/20 border-amber-200 dark:border-amber-800',
  purple: 'bg-purple-50 dark:bg-purple-900/20 border-purple-200 dark:border-purple-800',
}

const TONE_TEXT: Record<NonNullable<Props['tone']>, string> = {
  blue:   'text-blue-900 dark:text-blue-200',
  green:  'text-green-900 dark:text-green-200',
  amber:  'text-amber-900 dark:text-amber-200',
  purple: 'text-purple-900 dark:text-purple-200',
}

const TONE_SUB: Record<NonNullable<Props['tone']>, string> = {
  blue:   'text-blue-700 dark:text-blue-300',
  green:  'text-green-700 dark:text-green-300',
  amber:  'text-amber-700 dark:text-amber-300',
  purple: 'text-purple-700 dark:text-purple-300',
}

const TONE_CTA: Record<NonNullable<Props['tone']>, string> = {
  blue:   'bg-blue-600 hover:bg-blue-700',
  green:  'bg-green-600 hover:bg-green-700',
  amber:  'bg-amber-600 hover:bg-amber-700',
  purple: 'bg-purple-600 hover:bg-purple-700',
}

export function ContextualNudge({
  nudgeKey,
  emoji,
  titleEs,
  titleEn,
  subEs,
  subEn,
  ctaEs,
  ctaEn,
  href,
  lang,
  tone = 'blue',
}: Props) {
  const { state, isActive, dismiss, markTaken, markSeen } = useNudge(nudgeKey)
  const es = lang === 'es'

  // Mark as seen the first time the nudge renders — separates
  // "never showed up" from "user saw and ignored" for future
  // analytics.
  useEffect(() => {
    if (state === 'pending') markSeen()
  }, [state, markSeen])

  if (!isActive) return null

  return (
    <div className={`mt-3 flex items-start gap-3 ${TONE[tone]} border rounded-2xl px-3 py-2.5`}>
      <span className="text-xl leading-none flex-shrink-0 mt-0.5">{emoji}</span>
      <div className="min-w-0 flex-1">
        <p className={`text-sm font-bold leading-tight ${TONE_TEXT[tone]}`}>
          {es ? titleEs : titleEn}
        </p>
        <p className={`text-[11px] mt-0.5 leading-snug ${TONE_SUB[tone]}`}>
          {es ? subEs : subEn}
        </p>
      </div>
      <Link
        href={href}
        onClick={markTaken}
        className={`flex-shrink-0 self-center text-[11px] font-black text-white ${TONE_CTA[tone]} rounded-lg px-2.5 py-1.5 whitespace-nowrap transition-colors`}
      >
        {es ? ctaEs : ctaEn}
      </Link>
      <button
        type="button"
        onClick={dismiss}
        aria-label={es ? 'Cerrar' : 'Dismiss'}
        className={`flex-shrink-0 self-start ${TONE_SUB[tone]} opacity-60 hover:opacity-100 transition-opacity`}
      >
        <X className="w-3.5 h-3.5" />
      </button>
    </div>
  )
}
