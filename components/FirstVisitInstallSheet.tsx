'use client'

import { useEffect, useState } from 'react'
import { usePathname } from 'next/navigation'
import { useLang } from '@/lib/LangContext'
import { InstallGuide } from './InstallGuide'
import { useFoundingSlots } from '@/lib/useFoundingSlots'
import { trackEvent } from '@/lib/trackEvent'

// First-visit "Add to Home Screen" sheet. Rendered globally in
// app/layout.tsx so it fires on whichever page a brand-new visitor
// lands on. Phase 1 removed every aggressive install prompt to fix
// bounce rate, but that overcorrected — PWA installs dropped to
// zero because nobody saw the prompt at all. This sheet is the
// compromise: prominently visible on first visit, one-tap dismiss,
// never re-fires on the same device unless localStorage is cleared.
//
// Non-blocking by design: users can swipe down or tap "Primero
// quiero ver" to skip and see the home page. The install path
// remains available afterward via the header InstallPill and the
// /mas install card.

const SEEN_KEY = 'cruzar_first_visit_install_seen_v1'
// Visit counter + port-view flag. 2026-04-20 audit M3: 49% dismiss
// rate on the install sheet (86 of 175 shown). On FIRST visit the
// user hasn't felt the value yet — the install ask is premature.
// Show the sheet only once either condition is true:
//   - visit count >= 2 (they came back)
//   - OR the user has viewed at least one port detail page
//     (proved intent to actually use the product)
const VISITS_KEY = 'cruzar_visit_count'
const PORT_VIEWED_KEY = 'cruzar_port_viewed'
// Cooldown before the sheet re-appears after a dismiss.
//
// Evolution: permanent → 14 days → 3 days (2026-04-18).
// Rationale: funnel audit showed install rate at 8.3% (17/204). The
// 14-day cooldown was still too long — most users tap "browse first"
// on visit #1 meaning "soon," not "never." At 3 days we re-surface
// on the next engaged return visit (while memory of the app is warm
// and they've had time to feel the value of live wait times). Still
// long enough to respect the "not right now" signal. Tap ≠ permanent
// silence.
const DISMISS_COOLDOWN_DAYS = 3
// 2026-04-28 audit: the sheet was firing on every page that wasn't in
// HIDDEN_PATHS, which meant it was overlaying conversion content (/pricing),
// SEO landings (/cruzar/[slug]), product pages (/insights, /transload), and
// the dedicated iOS install walkthrough. Inverted the policy: only fire on
// home `/`, where install is the natural next step and there's no other
// content to obscure. Other entry points get the install ask via /mas
// install card, the home InstallPill, and the post-signup nudge.
const ALLOWED_PATHS = ['/']

export function FirstVisitInstallSheet() {
  const { lang } = useLang()
  const pathname = usePathname()
  const { full: capFull } = useFoundingSlots()
  const es = lang === 'es'
  const [show, setShow] = useState(false)
  const [dismissed, setDismissed] = useState(false)
  const [expanded, setExpanded] = useState(false)

  useEffect(() => {
    if (typeof window === 'undefined') return

    // Route gate — only fire on home. Anywhere else, the page's own
    // content / CTA path takes priority.
    if (!ALLOWED_PATHS.includes(pathname)) return

    // Increment visit counter + mark port-view on every mount (cheap).
    // These flags gate the sheet below.
    try {
      const currentCount = parseInt(localStorage.getItem(VISITS_KEY) || '0', 10) || 0
      localStorage.setItem(VISITS_KEY, String(currentCount + 1))
      if (pathname.startsWith('/port/') || pathname.startsWith('/cruzar/')) {
        localStorage.setItem(PORT_VIEWED_KEY, '1')
      }
    } catch { /* ignore */ }

    // Already installed — never show.
    const isStandalone =
      window.matchMedia('(display-mode: standalone)').matches ||
      (navigator as Navigator & { standalone?: boolean }).standalone === true
    if (isStandalone) return

    // Earn-it gate — don't fire on first visit before the user has
    // felt the value. Sheet surfaces on visit 2+ OR after they've
    // viewed any port detail (proved use intent).
    try {
      const visits = parseInt(localStorage.getItem(VISITS_KEY) || '0', 10) || 0
      const portViewed = localStorage.getItem(PORT_VIEWED_KEY) === '1'
      if (visits < 2 && !portViewed) return
    } catch { /* ignore */ }

    // Cooldown gate — respect the user's "not right now" for 3 days,
    // then re-surface on a repeat visit.
    try {
      const dismissedAt = localStorage.getItem(SEEN_KEY)
      if (dismissedAt) {
        const ageMs = Date.now() - parseInt(dismissedAt, 10)
        const cooldownMs = DISMISS_COOLDOWN_DAYS * 24 * 60 * 60 * 1000
        if (Number.isFinite(ageMs) && ageMs < cooldownMs) return
      }
    } catch { /* ignore */ }

    // Small delay so first paint lands first — the user briefly sees
    // the data before the sheet slides up, which keeps perceived
    // trust high (vs blocking the data on first render).
    const timer = setTimeout(() => {
      setShow(true)
      trackEvent('install_sheet_shown')
    }, 1500)
    return () => clearTimeout(timer)
  }, [pathname])

  function dismiss() {
    setDismissed(true)
    try { localStorage.setItem(SEEN_KEY, String(Date.now())) } catch { /* ignore */ }
    trackEvent('install_sheet_dismissed', { expanded })
    setTimeout(() => setShow(false), 200)
  }

  if (!show) return null

  return (
    <div
      className={`fixed inset-0 z-[60] flex items-end md:items-center justify-center bg-black/60 backdrop-blur-sm transition-opacity ${dismissed ? 'opacity-0' : 'opacity-100'}`}
      role="dialog"
      aria-modal="true"
      onClick={dismiss}
    >
      <div
        className={`w-full max-w-sm bg-gradient-to-br from-blue-600 via-indigo-700 to-purple-800 rounded-t-3xl md:rounded-3xl shadow-2xl relative overflow-hidden transition-transform duration-300 ${dismissed ? 'translate-y-8' : 'translate-y-0'}`}
        onClick={(e) => e.stopPropagation()}
        style={{ paddingBottom: 'env(safe-area-inset-bottom)' }}
      >
        {/* Decorative glow */}
        <div className="absolute -top-16 -right-16 w-48 h-48 bg-white/10 rounded-full blur-3xl pointer-events-none" />
        <div className="absolute -bottom-20 -left-10 w-56 h-56 bg-purple-400/20 rounded-full blur-3xl pointer-events-none" />

        <div className="relative p-6">
          <div className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full bg-amber-400/25 border border-amber-300/50 mb-3">
            <span className="text-sm">🎁</span>
            <span className="text-[11px] font-black text-amber-100 uppercase tracking-wide">
              {capFull
                ? (es ? '3 meses Pro gratis' : '3 months Pro free')
                : (es ? 'Pro de por vida · Primeros 1,000' : 'Lifetime Pro · First 1,000')}
            </span>
          </div>
          <h2 className="text-2xl sm:text-3xl font-black text-white leading-[1.05]">
            {capFull
              ? (es
                ? 'Agrega Cruzar a tu pantalla de inicio y desbloquea Pro — gratis por 90 días.'
                : 'Add Cruzar to your home screen and unlock Pro — free for 90 days.')
              : (es
                ? 'Agrega Cruzar a tu pantalla de inicio — Pro de por vida pa\' los primeros 1,000.'
                : 'Add Cruzar to your home screen — lifetime Pro for the first 1,000 founders.')}
          </h2>
          <ul className="mt-3 space-y-1.5 text-sm text-blue-100">
            <li className="flex items-start gap-2">
              <span className="mt-0.5">🔔</span>
              <span className="leading-snug">
                {es
                  ? 'Te avisamos cuando tu puente está rápido — antes de salir'
                  : 'Get notified when your bridge is moving fast — before you leave'}
              </span>
            </li>
            <li className="flex items-start gap-2">
              <span className="mt-0.5">🎥</span>
              <span className="leading-snug">
                {es
                  ? 'Cámaras en vivo de cada puente (solo Pro)'
                  : 'Live video cameras of every bridge (Pro-only)'}
              </span>
            </li>
            <li className="flex items-start gap-2">
              <span className="mt-0.5">📊</span>
              <span className="leading-snug">
                {es
                  ? 'Mejor hora para cruzar hoy, basado en datos reales'
                  : "Today's best time to cross, based on real patterns"}
              </span>
            </li>
          </ul>

          {expanded ? (
            <div className="mt-4 bg-white dark:bg-gray-900 rounded-2xl p-4">
              <InstallGuide variant="banner" onInstalled={dismiss} />
            </div>
          ) : (
            <button
              type="button"
              onClick={() => setExpanded(true)}
              className="mt-4 w-full bg-white text-indigo-700 font-black text-base rounded-2xl py-3.5 shadow-lg active:scale-[0.98] transition-transform"
            >
              {es ? 'Mostrarme cómo' : 'Show me how'}
            </button>
          )}

          <button
            type="button"
            onClick={dismiss}
            className="mt-3 w-full text-center text-xs font-semibold text-blue-200/80 hover:text-blue-100 py-2"
          >
            {es ? 'Primero quiero ver la app' : 'I want to browse first'}
          </button>
        </div>
      </div>
    </div>
  )
}
