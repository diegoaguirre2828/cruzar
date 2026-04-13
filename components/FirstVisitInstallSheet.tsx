'use client'

import { useEffect, useState } from 'react'
import { usePathname } from 'next/navigation'
import { useLang } from '@/lib/LangContext'
import { InstallGuide } from './InstallGuide'
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
const HIDDEN_PATHS = [
  '/login',
  '/signup',
  '/welcome', // /welcome step 2 already handles forced install
  '/reset-password',
  '/driver',
  '/checkin',
  '/admin',
  '/chat',
  '/business',
  '/for-fleets', // dispatcher lead page, different audience
]

export function FirstVisitInstallSheet() {
  const { lang } = useLang()
  const pathname = usePathname()
  const es = lang === 'es'
  const [show, setShow] = useState(false)
  const [dismissed, setDismissed] = useState(false)
  const [expanded, setExpanded] = useState(false)

  useEffect(() => {
    if (typeof window === 'undefined') return

    // Route gate — don't fire on auth flows or places with their
    // own install path.
    if (HIDDEN_PATHS.some((p) => pathname === p || pathname.startsWith(p + '/'))) return

    // Already installed — never show.
    const isStandalone =
      window.matchMedia('(display-mode: standalone)').matches ||
      (navigator as Navigator & { standalone?: boolean }).standalone === true
    if (isStandalone) return

    // Seen before on this device — never show again.
    try {
      if (localStorage.getItem(SEEN_KEY)) return
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
          <p className="text-3xl leading-none mb-2">📲</p>
          <h2 className="text-xl sm:text-2xl font-black text-white leading-tight">
            {es
              ? 'Agrega Cruzar a tu pantalla de inicio'
              : 'Add Cruzar to your home screen'}
          </h2>
          <p className="text-sm text-blue-100 mt-2 leading-snug">
            {es
              ? 'Un toque para revisar los puentes · Alertas que sí te llegan al teléfono · Funciona incluso sin señal'
              : 'One tap to check bridges · Alerts that actually reach your phone · Works even with no signal'}
          </p>

          <div className="mt-4 bg-amber-400/20 border border-amber-300/40 rounded-2xl px-3 py-2">
            <p className="text-[11px] font-bold text-amber-100 text-center">
              🎁 {es ? 'Bono: 3 meses de Pro GRATIS al agregarlo' : 'Bonus: 3 months Pro FREE when you add it'}
            </p>
          </div>

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
