'use client'

import { useEffect, useState } from 'react'
import Link from 'next/link'
import { usePathname } from 'next/navigation'
import { Gift, X } from 'lucide-react'
import { useAuth } from '@/lib/useAuth'
import { useTier } from '@/lib/useTier'
import { useLang } from '@/lib/LangContext'
import { useFoundingSlots } from '@/lib/useFoundingSlots'
import { trackEvent } from '@/lib/trackEvent'

// Persistent install nudge for SIGNED-IN users without the PWA. The
// founding-member promo (lifetime Pro for the first 1000) used to fire
// on bare signup — Diego killed that on 2026-04-26 ("seems like we are
// just giving pro away") and gated it to actual PWA install via
// /api/user/claim-pwa-pro. Once the promo is gated, we need a stronger
// post-signup install push.
//
// Visibility:
//   - signed-in user
//   - tier !== 'business' (they have their own UI)
//   - NOT running as standalone PWA
//   - hasn't already shown this session OR dismissed in last 24h
//
// Bottom-sticky banner above the BottomNav. Throttled to ONCE per browser
// session — funnel data 2026-04-28 showed 229 nudge_shown events from 68
// unique sessions (~3.4× per session) which trains users to reflex-dismiss.
// One firing per session is enough exposure without harassment.

const SESSION_SHOWN_KEY = 'cruzar_post_signup_install_shown_session'
const DISMISS_KEY = 'cruzar_post_signup_install_dismissed_at'
const DISMISS_HOURS = 24

// Routes that have their own install carrot or aren't a fit for a global
// nudge. Stacking the nudge on /ios-install or /welcome step 1 obscures
// the dedicated walkthrough.
const HIDDEN_PATHS = [
  '/welcome',
  '/ios-install',
  '/login',
  '/signup',
  '/reset-password',
  '/admin',
  '/driver',
  '/checkin',
  '/business',
]

export function PostSignupInstallNudge() {
  const { user, loading: authLoading } = useAuth()
  const { tier } = useTier()
  const { lang } = useLang()
  const { full: capFull } = useFoundingSlots()
  const pathname = usePathname()
  const es = lang === 'es'
  const [show, setShow] = useState(false)

  useEffect(() => {
    if (authLoading) return
    if (!user) return
    // Only nudge users who'd actually benefit from the install grant.
    // Pro/Business have already converted; pestering them about a
    // "lifetime Pro" carrot they already paid for is annoying. Free
    // users (no grant) are the only audience for this banner.
    if (tier !== 'free') return
    if (typeof window === 'undefined') return
    if (HIDDEN_PATHS.some((p) => pathname === p || pathname.startsWith(p + '/'))) return

    const isStandalone =
      window.matchMedia('(display-mode: standalone)').matches ||
      (navigator as Navigator & { standalone?: boolean }).standalone === true
    if (isStandalone) return

    // Once-per-session throttle. sessionStorage clears on tab close so
    // the next visit sees the nudge again, but a single browse session
    // doesn't get re-pestered on every page nav.
    try {
      if (sessionStorage.getItem(SESSION_SHOWN_KEY) === '1') return
    } catch { /* sessionStorage unavailable — fall through */ }

    try {
      const dismissedAt = localStorage.getItem(DISMISS_KEY)
      if (dismissedAt) {
        const ageH = (Date.now() - parseInt(dismissedAt, 10)) / (1000 * 60 * 60)
        if (ageH < DISMISS_HOURS) return
      }
    } catch { /* ignore */ }

    // Defer a beat so the home content paints first.
    const id = setTimeout(() => {
      setShow(true)
      try { sessionStorage.setItem(SESSION_SHOWN_KEY, '1') } catch { /* ignore */ }
      trackEvent('post_signup_install_nudge_shown')
    }, 800)
    return () => clearTimeout(id)
  }, [user, authLoading, tier, pathname])

  function dismiss(e: React.MouseEvent) {
    e.preventDefault()
    e.stopPropagation()
    try { localStorage.setItem(DISMISS_KEY, String(Date.now())) } catch { /* ignore */ }
    trackEvent('post_signup_install_nudge_dismissed')
    setShow(false)
  }

  if (!show) return null

  return (
    <Link
      href="/mas"
      onClick={() => trackEvent('post_signup_install_nudge_tapped')}
      className="fixed left-3 right-3 z-40 flex items-center gap-3 rounded-2xl bg-gradient-to-r from-amber-400 via-orange-500 to-pink-600 px-3 py-2.5 shadow-2xl active:scale-[0.99] transition-transform"
      style={{ bottom: 'calc(5rem + env(safe-area-inset-bottom))' }}
    >
      <div className="flex-shrink-0 w-9 h-9 rounded-xl bg-white/25 flex items-center justify-center">
        <Gift className="w-5 h-5 text-white" />
      </div>
      <div className="min-w-0 flex-1">
        <p className="text-[13px] font-black text-white leading-tight">
          {capFull
            ? (es ? '🎁 3 meses Pro — instala la app' : '🎁 3 months Pro — install the app')
            : (es ? '🎁 Pro de por vida — instala la app' : '🎁 Lifetime Pro — install the app')}
        </p>
        <p className="text-[10px] text-white/90 mt-0.5 leading-snug">
          {capFull
            ? (es ? 'Alertas + cámaras + favoritos por 3 meses gratis' : 'Alerts + cameras + favorites free for 3 months')
            : (es ? 'Primeros 1,000 que se registren e instalen · alertas + cámaras + favoritos' : 'First 1,000 to sign up + install · alerts + cameras + favorites')}
        </p>
      </div>
      <span className="flex-shrink-0 bg-white text-orange-600 text-[11px] font-black px-3 py-1.5 rounded-full whitespace-nowrap">
        {es ? 'Cómo' : 'How'}
      </span>
      <button
        type="button"
        aria-label={es ? 'Cerrar' : 'Dismiss'}
        onClick={dismiss}
        className="flex-shrink-0 text-white/70 hover:text-white p-1"
      >
        <X className="w-3.5 h-3.5" />
      </button>
    </Link>
  )
}
