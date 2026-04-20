'use client'

import { useEffect, useState } from 'react'
import { X } from 'lucide-react'
import { useLang } from '@/lib/LangContext'
import { usePushNotifications } from '@/lib/usePushNotifications'
import { PushPermissionPrompt } from './PushPermissionPrompt'

// Global listener for `cruzar:alert-created`. Mounted once in app/layout.tsx
// so the push warm-up sheet fires the moment an alert is created from ANY
// page — port detail, camaras tile, dashboard, /welcome, wherever.
//
// Previously DashboardPushNudgeBlock (app/dashboard/page.tsx) was the only
// listener, meaning alerts created from /port/[portId] or /camaras dispatched
// the event into the void. Push opt-in sat at 2.3% (5/219 users). The alert-
// creation moment is the highest-intent signal we have — user just committed
// to being notified — so surfacing the prompt there converts far better than
// the static dashboard nudge on cold load.
//
// Positioned as a fixed bottom sheet so it works as an overlay from any
// page without disturbing the page layout. 7-day dismiss cooldown; force-
// shown on alert-created regardless of cooldown (intent signal overrides).

const COOLDOWN_DAYS = 7
const DISMISS_KEY = 'cruzar_push_prompt_dismissed_at'

export function GlobalPushPromptOnAlertCreated() {
  const { lang } = useLang()
  const { supported, subscribed } = usePushNotifications()
  const [show, setShow] = useState(false)
  const [bridgeName, setBridgeName] = useState<string | null>(null)

  useEffect(() => {
    if (typeof window === 'undefined') return

    function onAlertCreated(e: Event) {
      if (!supported || subscribed) return
      const detail = (e as CustomEvent<{ portId?: string; bridgeName?: string }>).detail
      setBridgeName(detail?.bridgeName ?? null)
      // Force-show regardless of cooldown — the user just expressed explicit
      // intent to be notified, which overrides a prior "not now."
      setShow(true)
    }

    window.addEventListener('cruzar:alert-created', onAlertCreated)
    return () => window.removeEventListener('cruzar:alert-created', onAlertCreated)
  }, [supported, subscribed])

  function dismiss() {
    try { localStorage.setItem(DISMISS_KEY, String(Date.now())) } catch { /* ignore */ }
    setShow(false)
  }

  if (!show || !supported || subscribed) return null

  return (
    <div
      className="fixed inset-x-0 bottom-0 z-50 pb-[calc(3.5rem+env(safe-area-inset-bottom))] md:pb-4 md:bottom-4 md:right-4 md:left-auto md:max-w-sm"
      role="dialog"
      aria-live="polite"
    >
      <div className="mx-3 md:mx-0 relative">
        <button
          onClick={dismiss}
          aria-label={lang === 'es' ? 'Cerrar' : 'Close'}
          className="absolute top-2 right-2 z-10 w-7 h-7 rounded-full bg-white/10 hover:bg-white/20 text-white flex items-center justify-center"
        >
          <X className="w-4 h-4" />
        </button>
        <PushPermissionPrompt
          bridgeName={bridgeName || undefined}
          source="alert_created_global"
          onDone={(granted) => { if (granted) setShow(false) }}
          onDismiss={dismiss}
        />
      </div>
    </div>
  )
}
