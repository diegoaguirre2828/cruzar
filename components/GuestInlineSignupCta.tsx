'use client'

import Link from 'next/link'
import { Bell, Star } from 'lucide-react'
import { useAuth } from '@/lib/useAuth'
import { useLang } from '@/lib/LangContext'
import { trackEvent } from '@/lib/trackEvent'

// Mid-scroll signup nudge for guests, slotted into the home port list
// after a few cards. Picks up users who scrolled past the top
// ConversionRibbon — the single-CTA-at-top model meant anyone scrolling
// the bridges had nothing nudging them to sign up. Renders nothing for
// signed-in users (free-tier and Pro both already have an account, so
// the inline CTA is wasted real estate).
//
// Tagged with ?source=home_inline so /signup analytics can attribute
// which CTA each visit came from.
export function GuestInlineSignupCta() {
  const { user, loading } = useAuth()
  const { lang } = useLang()
  if (loading || user) return null
  const es = lang === 'es'
  return (
    <Link
      href="/signup?source=home_inline&next=%2F"
      onClick={() => trackEvent('signup_cta_clicked', { source: 'home_inline' })}
      className="block rounded-2xl border border-blue-200 dark:border-blue-800/60 bg-gradient-to-br from-blue-50 via-indigo-50 to-purple-50 dark:from-blue-900/20 dark:via-indigo-900/15 dark:to-purple-900/20 p-4 active:scale-[0.99] transition-transform"
    >
      <div className="flex items-center gap-3">
        <div className="flex-shrink-0 w-11 h-11 rounded-2xl bg-gradient-to-br from-blue-500 to-indigo-600 flex items-center justify-center shadow-md">
          <Bell className="w-5 h-5 text-white" />
        </div>
        <div className="flex-1 min-w-0">
          <p className="text-sm font-black text-gray-900 dark:text-gray-100 leading-tight">
            {es
              ? 'Crea cuenta gratis · alertas + favoritos'
              : 'Free account · alerts + favorites'}
          </p>
          <p className="text-[11px] text-gray-600 dark:text-gray-400 leading-snug mt-0.5 inline-flex items-center gap-1">
            <Star className="w-3 h-3 fill-amber-400 text-amber-500" />
            {es
              ? 'Te avisamos cuando baje tu puente'
              : "We'll ping you when your bridge clears"}
          </p>
        </div>
        <span className="shrink-0 text-xs font-black text-blue-700 dark:text-blue-300">
          →
        </span>
      </div>
    </Link>
  )
}
