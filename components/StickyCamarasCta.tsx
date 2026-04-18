'use client'

import { useEffect, useState } from 'react'
import Link from 'next/link'
import { Bell, X } from 'lucide-react'
import { useLang } from '@/lib/LangContext'
import { useAuth } from '@/lib/useAuth'
import { trackEvent } from '@/lib/trackEvent'

// Sticky bottom-bar conversion CTA for /camaras.
//
// Why: /camaras is the top entry point (217 visits 2026-04-18, +97%).
// FB-arrival visitors get the camera, leave, never sign up — the page
// gives them everything they came for. Need a light-friction value
// exchange at the moment of highest engagement (after they've actually
// scrolled the grid for ~30 seconds, signaling they care).
//
// Design rules:
//   - Fires after 30s on the page — not on first paint (would feel pushy)
//   - Single tap to /signup with the bridge-specific carrot ("get pinged")
//   - Dismissible, 3-day cooldown (not 7d — repeat /camaras visitors are
//     warm; we want to re-prompt them quickly)
//   - Hides for authed users (no point showing "create account" to them)
//   - Hides on standalone PWA (they're already converted as far as install)

const DISMISS_KEY = 'cruzar_camaras_sticky_dismissed_at'
const DISMISS_HOURS = 72
const SHOW_AFTER_MS = 30_000

export function StickyCamarasCta() {
  const { lang } = useLang()
  const { user, loading } = useAuth()
  const es = lang === 'es'
  const [show, setShow] = useState(false)

  useEffect(() => {
    if (loading || user) return
    if (typeof window === 'undefined') return

    const isStandalone =
      window.matchMedia('(display-mode: standalone)').matches ||
      (navigator as Navigator & { standalone?: boolean }).standalone === true
    if (isStandalone) return

    try {
      const dismissedAt = localStorage.getItem(DISMISS_KEY)
      if (dismissedAt) {
        const ageHours = (Date.now() - parseInt(dismissedAt, 10)) / (1000 * 60 * 60)
        if (ageHours < DISMISS_HOURS) return
      }
    } catch { /* ignore */ }

    const timer = setTimeout(() => {
      setShow(true)
      trackEvent('camaras_sticky_shown')
    }, SHOW_AFTER_MS)
    return () => clearTimeout(timer)
  }, [loading, user])

  function dismiss() {
    try { localStorage.setItem(DISMISS_KEY, String(Date.now())) } catch { /* ignore */ }
    trackEvent('camaras_sticky_dismissed')
    setShow(false)
  }

  if (!show) return null

  return (
    <div
      className="fixed left-0 right-0 z-40 md:hidden pointer-events-none"
      style={{ bottom: 'calc(4.5rem + env(safe-area-inset-bottom))' }}
    >
      <div className="mx-3 mb-2 pointer-events-auto">
        <div className="relative bg-gradient-to-r from-blue-600 to-indigo-700 rounded-2xl shadow-2xl border border-blue-500/40 overflow-hidden">
          <button
            type="button"
            onClick={dismiss}
            aria-label={es ? 'Cerrar' : 'Dismiss'}
            className="absolute top-2 right-2 w-6 h-6 flex items-center justify-center text-white/60 hover:text-white rounded-full hover:bg-white/10 z-10"
          >
            <X className="w-3.5 h-3.5" />
          </button>
          <Link
            href="/signup?next=%2Fcamaras"
            onClick={() => trackEvent('camaras_sticky_clicked')}
            className="block px-4 py-3 active:scale-[0.99] transition-transform"
          >
            <div className="flex items-center gap-3 pr-6">
              <div className="flex-shrink-0 w-9 h-9 rounded-full bg-white/20 flex items-center justify-center">
                <Bell className="w-4 h-4 text-white" />
              </div>
              <div className="flex-1 min-w-0">
                <p className="text-[13px] font-black text-white leading-tight">
                  {es ? 'Avísame cuando mi puente baje' : 'Ping me when my bridge clears'}
                </p>
                <p className="text-[11px] text-blue-100 mt-0.5 leading-tight">
                  {es ? 'Cuenta gratis · 10 segundos' : 'Free account · 10 seconds'}
                </p>
              </div>
              <span className="flex-shrink-0 text-white text-base font-black">→</span>
            </div>
          </Link>
        </div>
      </div>
    </div>
  )
}
