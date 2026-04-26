'use client'

import { useEffect, useState } from 'react'
import Link from 'next/link'
import { useLang } from '@/lib/LangContext'
import { useAuth } from '@/lib/useAuth'
import { useTier } from '@/lib/useTier'
import { fetchWithTimeout } from '@/lib/fetchWithTimeout'
import { trackEvent } from '@/lib/trackEvent'

// Single conversion ribbon shown under the sticky header. Replaces the
// stack of {GuestSignupBanner, ProNoAlertBanner, bottom Signup CTA,
// free-tier alert upsell} that all fired at once and made the home
// page feel like a billboard. One slot, picked by tier:
//
//   guest          → "Crea cuenta — alertas + cámaras + favoritos"
//   free, 0 alerts → "Activa tu alerta gratis"
//   free, 1+ alert → null (already nudged into the loop)
//   pro, 0 alerts  → "Pro sin alerta — actívala pa' que valga"
//   pro, 1+ alert  → null
//   business       → null (own dashboard widget)
//
// Per-day session-storage dismiss so it doesn't pester. Visible across
// all swipe panels because it sits under the sticky header.

const DAY_DISMISS_KEY_PREFIX = 'cruzar_ribbon_dismissed_'

interface RibbonState {
  show: boolean
  variant: 'guest' | 'free_no_alert' | 'pro_no_alert'
  href: string
  titleEs: string
  titleEn: string
  ctaEs: string
  ctaEn: string
}

export function ConversionRibbon() {
  const { lang } = useLang()
  const { user, loading: authLoading } = useAuth()
  const { tier } = useTier()
  const es = lang === 'es'
  const [state, setState] = useState<RibbonState | null>(null)
  const [dismissed, setDismissed] = useState(false)

  useEffect(() => {
    if (authLoading) return
    if (typeof window === 'undefined') return

    const dayKey = `${DAY_DISMISS_KEY_PREFIX}${new Date().toDateString()}`
    try {
      if (sessionStorage.getItem(dayKey)) {
        setDismissed(true)
        return
      }
    } catch { /* ignore */ }

    if (!user) {
      setState({
        show: true,
        variant: 'guest',
        href: '/signup',
        titleEs: 'Alertas + cámaras + favoritos cuando creas cuenta',
        titleEn: 'Alerts + cameras + favorites when you make an account',
        ctaEs: 'Gratis →',
        ctaEn: 'Free →',
      })
      return
    }

    if (tier === 'business') return

    fetchWithTimeout('/api/alerts', { cache: 'no-store' }, 5000)
      .then((r) => (r.ok ? r.json() : { alerts: [] }))
      .then((data) => {
        const n = Array.isArray(data?.alerts) ? data.alerts.length : 0
        if (n > 0) return
        if (tier === 'pro') {
          setState({
            show: true,
            variant: 'pro_no_alert',
            href: '/dashboard?tab=alerts',
            titleEs: 'Pro sin alerta — actívala pa\' que valga',
            titleEn: "You're Pro but no alert is set",
            ctaEs: 'Activar →',
            ctaEn: 'Set →',
          })
        } else {
          setState({
            show: true,
            variant: 'free_no_alert',
            href: '/dashboard?tab=alerts',
            titleEs: 'Te avisamos cuando tu puente baje',
            titleEn: "We'll ping you when your bridge clears",
            ctaEs: 'Activar →',
            ctaEn: 'Set →',
          })
        }
      })
      .catch(() => { /* keep hidden */ })
  }, [user, authLoading, tier])

  if (authLoading || dismissed || !state) return null

  function dismiss(e: React.MouseEvent) {
    e.preventDefault()
    e.stopPropagation()
    if (typeof window !== 'undefined') {
      try {
        sessionStorage.setItem(`${DAY_DISMISS_KEY_PREFIX}${new Date().toDateString()}`, '1')
      } catch { /* ignore */ }
    }
    if (state) {
      trackEvent('conversion_ribbon_dismissed', { variant: state.variant })
    }
    setDismissed(true)
  }

  return (
    <Link
      href={state.href}
      onClick={() => trackEvent('conversion_ribbon_tapped', { variant: state.variant })}
      className="mt-2 flex items-center gap-2 rounded-2xl bg-gradient-to-r from-blue-600 to-indigo-600 px-3 py-2 active:scale-[0.99] transition-transform"
    >
      <p className="flex-1 min-w-0 text-[12px] font-bold text-white leading-snug truncate">
        {es ? state.titleEs : state.titleEn}
      </p>
      <span className="flex-shrink-0 bg-white text-blue-700 text-[11px] font-black px-2.5 py-1 rounded-full whitespace-nowrap">
        {es ? state.ctaEs : state.ctaEn}
      </span>
      <button
        type="button"
        aria-label={es ? 'Cerrar' : 'Dismiss'}
        onClick={dismiss}
        className="flex-shrink-0 text-white/70 hover:text-white text-base leading-none px-1"
      >
        ×
      </button>
    </Link>
  )
}
