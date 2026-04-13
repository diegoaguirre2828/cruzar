'use client'

import { useEffect, useState } from 'react'
import Link from 'next/link'
import { Bell, X } from 'lucide-react'
import { useAuth } from '@/lib/useAuth'
import { useLang } from '@/lib/LangContext'
import { trackEvent } from '@/lib/trackEvent'

// Soft signup wall for guest users on port detail pages.
//
// Behavior:
//   - Shows as a dismissible bottom-sheet the first time a guest
//     lands on ANY /port/* URL in a new session
//   - The port detail data renders UNDER the sheet — the user sees
//     the number before being asked to commit, which protects the
//     "trusted on arrival" moment for FB-share deep links
//   - Dismissable via X or tap-outside. Once dismissed, hidden for
//     the rest of this session (localStorage-tracked); re-appears
//     on the next session or after 12 hours
//   - A persistent sticky signup banner stays visible even after
//     dismissal so the upgrade path never vanishes completely
//
// Not a hard wall: the goal is to catch FB-arrival traffic at the
// moment of highest intent without breaking the viral loop.

const SHEET_DISMISSED_KEY = 'cruzar_detail_wall_dismissed_at'
const DISMISS_HOURS = 12

interface Props {
  portName: string
  portId: string
}

export function PortDetailSoftWall({ portName, portId }: Props) {
  const { user, loading: authLoading } = useAuth()
  const { lang } = useLang()
  const es = lang === 'es'
  const [showSheet, setShowSheet] = useState(false)
  const [mounted, setMounted] = useState(false)

  useEffect(() => {
    if (authLoading) return
    setMounted(true)
    if (user) return

    // Check if they dismissed recently
    try {
      const dismissedAt = localStorage.getItem(SHEET_DISMISSED_KEY)
      if (dismissedAt) {
        const ageHours = (Date.now() - parseInt(dismissedAt, 10)) / (1000 * 60 * 60)
        if (ageHours < DISMISS_HOURS) return
      }
    } catch { /* ignore */ }

    // Delay the sheet so the user actually sees the data first —
    // protects the "instant number" trust moment.
    const timer = setTimeout(() => {
      setShowSheet(true)
      trackEvent('port_detail_wall_shown', { port_id: portId })
    }, 2500)
    return () => clearTimeout(timer)
  }, [user, authLoading, portId])

  function dismiss() {
    setShowSheet(false)
    try { localStorage.setItem(SHEET_DISMISSED_KEY, String(Date.now())) } catch {}
    trackEvent('port_detail_wall_dismissed', { port_id: portId })
  }

  // Don't render anything for authed users or while resolving auth
  if (!mounted || user) return null

  const next = `/port/${encodeURIComponent(portId)}`

  return (
    <>
      {/* Persistent sticky signup bar — always visible for guests on
          port detail, even after the sheet is dismissed. Keeps the
          upgrade path one tap away. */}
      <div
        className="fixed left-0 right-0 bottom-0 z-[55] md:hidden"
        style={{ paddingBottom: 'env(safe-area-inset-bottom)' }}
      >
        <div className="mx-auto max-w-lg px-3 pb-16">
          <Link
            href={`/signup?next=${encodeURIComponent(next)}`}
            onClick={() => trackEvent('port_detail_wall_sticky_clicked', { port_id: portId })}
            className="block bg-gradient-to-r from-blue-600 to-indigo-600 rounded-2xl px-4 py-3 shadow-xl active:scale-[0.98] transition-transform"
          >
            <div className="flex items-center gap-3">
              <div className="w-9 h-9 bg-white/20 rounded-full flex items-center justify-center flex-shrink-0">
                <Bell className="w-4 h-4 text-white" />
              </div>
              <div className="flex-1 min-w-0">
                <p className="text-xs font-black text-white leading-tight">
                  {es ? `Avísame cuando ${portName} baje` : `Ping me when ${portName} drops`}
                </p>
                <p className="text-[10px] text-blue-100 mt-0.5 leading-tight">
                  {es ? 'Cuenta gratis · 3 meses Pro al instalar' : 'Free account · 3 months Pro on install'}
                </p>
              </div>
              <span className="text-white text-lg flex-shrink-0">→</span>
            </div>
          </Link>
        </div>
      </div>

      {/* Dismissible signup sheet — one-time per session for guests */}
      {showSheet && (
        <div
          className="fixed inset-0 z-[65] flex items-end md:items-center justify-center bg-black/60 backdrop-blur-sm animate-[fadeIn_0.2s_ease-out]"
          role="dialog"
          aria-modal="true"
          onClick={dismiss}
        >
          <div
            className="w-full max-w-sm bg-white dark:bg-gray-900 rounded-t-3xl md:rounded-3xl shadow-2xl relative overflow-hidden"
            onClick={(e) => e.stopPropagation()}
            style={{ paddingBottom: 'env(safe-area-inset-bottom)' }}
          >
            <button
              onClick={dismiss}
              className="absolute top-3 right-3 w-8 h-8 flex items-center justify-center text-gray-400 hover:text-gray-600 dark:hover:text-gray-300 rounded-full hover:bg-gray-100 dark:hover:bg-gray-800 z-10"
              aria-label={es ? 'Cerrar' : 'Close'}
            >
              <X className="w-4 h-4" />
            </button>

            <div className="p-6">
              <p className="text-3xl leading-none mb-2">🔔</p>
              <h2 className="text-xl font-black text-gray-900 dark:text-gray-100 leading-tight">
                {es
                  ? `Avísame cuando ${portName} baje`
                  : `Ping me when ${portName} drops`}
              </h2>
              <p className="text-sm text-gray-500 dark:text-gray-400 mt-2 leading-snug">
                {es
                  ? 'Push, SMS, o email cuando tu cruce se despeje. Una cuenta gratis y listo.'
                  : 'Push, SMS, or email when your crossing clears. One free account and you\'re set.'}
              </p>

              <div className="mt-4 bg-amber-50 dark:bg-amber-900/20 border border-amber-200 dark:border-amber-800 rounded-2xl px-3 py-2">
                <p className="text-[11px] font-bold text-amber-900 dark:text-amber-200 leading-tight">
                  🎁 {es
                    ? 'Bono: 3 meses de Pro GRATIS al agregarlo a tu pantalla'
                    : 'Bonus: 3 months Pro FREE when you add to home screen'}
                </p>
              </div>

              <Link
                href={`/signup?next=${encodeURIComponent(next)}`}
                onClick={() => trackEvent('port_detail_wall_signup_clicked', { port_id: portId })}
                className="mt-4 flex items-center justify-center gap-2 w-full bg-gradient-to-r from-blue-600 to-indigo-600 text-white font-black text-base rounded-2xl py-3.5 shadow-lg active:scale-[0.98] transition-transform"
              >
                {es ? 'Crear cuenta gratis →' : 'Create free account →'}
              </Link>

              <button
                onClick={dismiss}
                className="mt-2 w-full text-center text-xs font-semibold text-gray-400 dark:text-gray-500 py-2 hover:text-gray-600 dark:hover:text-gray-300"
              >
                {es ? 'Primero quiero ver' : 'Let me browse first'}
              </button>

              <p className="text-[10px] text-gray-400 dark:text-gray-500 text-center mt-2">
                {es
                  ? 'Puedes ignorar esto hoy · te preguntamos mañana'
                  : 'You can skip today · we\'ll ask again tomorrow'}
              </p>
            </div>
          </div>
        </div>
      )}
    </>
  )
}
