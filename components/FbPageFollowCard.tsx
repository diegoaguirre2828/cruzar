'use client'

import { trackEvent } from '@/lib/trackEvent'
import { useLang } from '@/lib/LangContext'

// Facebook page follow CTA. Three variants matching the three
// insertion points where this is currently mounted:
//   - 'compact'   → sticky strip for the home /mas page
//   - 'full'      → report-done screen reward moment
//   - 'inline'    → generic card for any surface that wants it
//
// The whole point: build page follower count so peak-hour auto-posts
// land as push notifications in users' feeds. Every in-app impression
// is a chance to convert an active user (already in Cruzar) into a
// durable FB page follower who gets pinged 4x/day.
//
// The Cruzar FB page slug is the vanity URL set on the page itself.
// Update FB_PAGE_URL here if the vanity slug changes.

const FB_PAGE_URL = 'https://www.facebook.com/cruzar'

interface Props {
  variant?: 'compact' | 'full' | 'inline'
  source: string // analytics context: 'report_done' | 'mas_page' | 'home'
}

export function FbPageFollowCard({ variant = 'inline', source }: Props) {
  const { lang } = useLang()
  const es = lang === 'es'

  function handleClick() {
    trackEvent('fb_page_follow_click', { source, variant })
  }

  if (variant === 'compact') {
    return (
      <a
        href={FB_PAGE_URL}
        target="_blank"
        rel="noopener noreferrer"
        onClick={handleClick}
        className="flex items-center gap-3 bg-[#1877f2] rounded-2xl px-4 py-3 text-white active:scale-[0.98] transition-transform"
      >
        <span className="w-8 h-8 bg-white/20 rounded-full flex items-center justify-center text-base flex-shrink-0">
          📘
        </span>
        <div className="flex-1 min-w-0">
          <p className="text-xs font-black leading-tight">
            {es ? 'Síguenos en Facebook' : 'Follow us on Facebook'}
          </p>
          <p className="text-[10px] text-blue-100 mt-0.5 leading-tight">
            {es ? 'Notificaciones 4 veces al día con los tiempos' : 'Push notifications 4x/day with wait times'}
          </p>
        </div>
        <span className="text-sm font-black flex-shrink-0">→</span>
      </a>
    )
  }

  if (variant === 'full') {
    return (
      <div className="bg-gradient-to-br from-[#1877f2] to-[#0d5fd9] rounded-2xl p-5 text-white shadow-lg relative overflow-hidden">
        <div className="absolute -top-12 -right-12 w-36 h-36 bg-white/10 rounded-full blur-3xl" />
        <div className="relative">
          <p className="text-3xl leading-none mb-2">📘</p>
          <h3 className="text-lg font-black leading-tight">
            {es
              ? 'Nunca llegues al puente sin saber'
              : "Never show up at the bridge blind"}
          </h3>
          <p className="text-xs text-blue-100 mt-2 leading-snug">
            {es
              ? 'Dale follow a Cruzar en Facebook — te llega una notificación en la mañana, al mediodía, en la tarde y en la noche con los tiempos de todos los puentes.'
              : "Follow Cruzar on Facebook — you get a push notification every morning, midday, afternoon, and night with wait times for every crossing."}
          </p>
          <a
            href={FB_PAGE_URL}
            target="_blank"
            rel="noopener noreferrer"
            onClick={handleClick}
            className="mt-4 flex items-center justify-center gap-2 w-full bg-white text-[#1877f2] font-black text-base rounded-2xl py-3 active:scale-[0.98] transition-transform"
          >
            {es ? '👉 Seguir en Facebook' : '👉 Follow on Facebook'}
          </a>
          <p className="text-[10px] text-blue-200 text-center mt-2">
            {es ? 'Es gratis · cancela cuando quieras' : 'Free · unfollow anytime'}
          </p>
        </div>
      </div>
    )
  }

  // Default: 'inline' — minimal card for any surface
  return (
    <a
      href={FB_PAGE_URL}
      target="_blank"
      rel="noopener noreferrer"
      onClick={handleClick}
      className="block bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-2xl p-4 hover:bg-gray-50 dark:hover:bg-gray-700 transition-colors"
    >
      <div className="flex items-center gap-3">
        <div className="w-10 h-10 bg-[#1877f2] rounded-full flex items-center justify-center text-xl flex-shrink-0">
          📘
        </div>
        <div className="flex-1 min-w-0">
          <p className="text-sm font-black text-gray-900 dark:text-gray-100">
            {es ? 'Seguir a Cruzar en Facebook' : 'Follow Cruzar on Facebook'}
          </p>
          <p className="text-[11px] text-gray-500 dark:text-gray-400 mt-0.5 leading-snug">
            {es
              ? 'Notificaciones en tu teléfono cada 4 horas con los tiempos en vivo'
              : 'Push notifications every 4 hours with live wait times'}
          </p>
        </div>
        <span className="text-gray-400 text-lg flex-shrink-0">→</span>
      </div>
    </a>
  )
}
