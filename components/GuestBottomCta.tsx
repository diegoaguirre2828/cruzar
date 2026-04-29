'use client'

import Link from 'next/link'
import { useEffect, useState } from 'react'
import { useAuth } from '@/lib/useAuth'
import { useLang } from '@/lib/LangContext'
import { trackEvent } from '@/lib/trackEvent'

// Persistent bottom-of-screen signup CTA for guests on the home page.
// Sits above the BottomNav so it's always visible regardless of scroll
// position — catches the scroll-and-leave guest pattern that the top
// ConversionRibbon misses.
//
// Defers a beat after mount so it doesn't slap the user the instant
// the page loads (gives them a moment to see what the app does first).
// Hidden on /signup itself, on auth flow pages, and once the user
// signs in. Per-day session-storage dismiss keeps it from being
// annoying on repeat visits.
//
// Tagged with ?source=home_bottom_strip for funnel attribution.

const DISMISS_KEY_PREFIX = 'cruzar_bottom_cta_dismissed_'

export function GuestBottomCta() {
  const { user, loading } = useAuth()
  const { lang } = useLang()
  const [show, setShow] = useState(false)
  const [dismissed, setDismissed] = useState(false)
  const es = lang === 'es'

  useEffect(() => {
    if (loading || user) return
    if (typeof window === 'undefined') return
    const dayKey = `${DISMISS_KEY_PREFIX}${new Date().toDateString()}`
    try {
      if (sessionStorage.getItem(dayKey)) {
        setDismissed(true)
        return
      }
    } catch { /* ignore */ }
    // Mount delay so the strip doesn't compete with the first paint
    const t = setTimeout(() => setShow(true), 1500)
    return () => clearTimeout(t)
  }, [loading, user])

  function dismiss() {
    setShow(false)
    setDismissed(true)
    try {
      const dayKey = `${DISMISS_KEY_PREFIX}${new Date().toDateString()}`
      sessionStorage.setItem(dayKey, '1')
    } catch { /* ignore */ }
    trackEvent('signup_cta_dismissed', { source: 'home_bottom_strip' })
  }

  if (loading || user || dismissed || !show) return null

  return (
    <div
      className="fixed left-0 right-0 z-40 px-3 pointer-events-none"
      style={{ bottom: 'calc(env(safe-area-inset-bottom) + 64px)' }}
    >
      <div className="pointer-events-auto mx-auto max-w-md flex items-center gap-2 rounded-2xl bg-gradient-to-r from-blue-600 to-indigo-600 shadow-2xl border border-white/10 px-3 py-2.5">
        <Link
          href="/signup?source=home_bottom_strip&next=%2F"
          onClick={() => trackEvent('signup_cta_clicked', { source: 'home_bottom_strip' })}
          className="flex-1 min-w-0 flex items-center gap-2 text-white"
        >
          <span className="relative flex h-2 w-2 flex-shrink-0">
            <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-white opacity-75" />
            <span className="relative inline-flex rounded-full h-2 w-2 bg-white" />
          </span>
          <span className="text-xs font-bold leading-tight truncate">
            {es
              ? 'Crea cuenta gratis · activa alertas →'
              : 'Free account · turn on alerts →'}
          </span>
        </Link>
        <button
          type="button"
          onClick={dismiss}
          aria-label={es ? 'Cerrar' : 'Dismiss'}
          className="shrink-0 inline-flex items-center justify-center w-7 h-7 rounded-full bg-white/15 hover:bg-white/25 text-white text-sm leading-none"
        >
          ✕
        </button>
      </div>
    </div>
  )
}
