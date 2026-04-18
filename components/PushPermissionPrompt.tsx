'use client'

import { useState } from 'react'
import { Bell, Check, X } from 'lucide-react'
import { useLang } from '@/lib/LangContext'
import { usePushNotifications } from '@/lib/usePushNotifications'
import { trackEvent } from '@/lib/trackEvent'

// Pre-permission warm-up sheet for browser push notifications.
//
// Why this exists: the raw browser Notification.requestPermission() prompt
// is a one-shot that users who deny it can essentially never get back —
// they have to dig into browser settings. Industry best practice is to
// surface a custom prompt FIRST that explains the value, and only fire the
// OS prompt when the user explicitly opts in. Major SaaS apps all do this.
//
// Flow:
//   1. Component mounts, shows a clean sheet with the value prop
//   2. User taps "Sí, avísame" → calls subscribe() which triggers the OS
//      prompt → if granted, the user has push enabled
//   3. We immediately fire a test notification so they SEE it works
//   4. "Ahorita no" dismisses for 7 days

interface Props {
  bridgeName?: string
  source?: string
  onDone?: (granted: boolean) => void
  onDismiss?: () => void
}

export function PushPermissionPrompt({ bridgeName, source, onDone, onDismiss }: Props) {
  const { lang } = useLang()
  const es = lang === 'es'
  const { supported, subscribe } = usePushNotifications()
  const [state, setState] = useState<'idle' | 'asking' | 'granted' | 'denied' | 'unsupported'>(
    !supported && typeof window !== 'undefined' ? 'unsupported' : 'idle'
  )

  if (!supported && state !== 'unsupported') {
    return null
  }

  async function handleAllow() {
    setState('asking')
    trackEvent('push_prompt_allow_clicked', { bridge: bridgeName || null, source: source || null })
    try {
      await subscribe()
      const granted = typeof Notification !== 'undefined' && Notification.permission === 'granted'
      if (granted) {
        setState('granted')
        trackEvent('push_prompt_granted', { bridge: bridgeName || null, source: source || null })
        // Fire a test notification immediately so the user SEES that it works
        try {
          await fetch('/api/push/test', { method: 'POST' })
        } catch { /* non-blocking */ }
        setTimeout(() => onDone?.(true), 2200)
      } else {
        setState('denied')
        trackEvent('push_prompt_denied', { bridge: bridgeName || null, source: source || null })
        setTimeout(() => onDone?.(false), 2500)
      }
    } catch {
      setState('denied')
      setTimeout(() => onDone?.(false), 2500)
    }
  }

  function handleDismiss() {
    trackEvent('push_prompt_dismissed', { bridge: bridgeName || null, source: source || null })
    try { localStorage.setItem('cruzar_push_prompt_dismissed_at', String(Date.now())) } catch {}
    onDismiss?.()
  }

  // Already granted state — render a compact success card instead of the full sheet
  if (state === 'granted') {
    return (
      <div className="bg-gradient-to-br from-emerald-500 to-teal-600 text-white rounded-2xl p-5 shadow-xl">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-full bg-white/25 flex items-center justify-center flex-shrink-0">
            <Check className="w-5 h-5" />
          </div>
          <div className="flex-1 min-w-0">
            <p className="text-sm font-black leading-tight">
              {es ? 'Listo · alertas activadas' : "You're set · alerts on"}
            </p>
            <p className="text-[11px] text-emerald-100 mt-0.5 leading-snug">
              {es
                ? 'Te mandé una notificación de prueba — revisa tu teléfono'
                : 'I just sent you a test ping — check your phone'}
            </p>
          </div>
        </div>
      </div>
    )
  }

  if (state === 'denied') {
    return (
      <div className="bg-amber-50 dark:bg-amber-900/30 border border-amber-300 dark:border-amber-700 rounded-2xl p-4">
        <div className="flex items-start gap-3">
          <span className="text-xl flex-shrink-0 mt-0.5">⚠️</span>
          <div className="flex-1 min-w-0">
            <p className="text-xs font-black text-amber-900 dark:text-amber-100 leading-tight">
              {es ? 'Notificaciones bloqueadas' : 'Notifications blocked'}
            </p>
            <p className="text-[11px] text-amber-800 dark:text-amber-200 mt-0.5 leading-snug">
              {es
                ? 'No te llegaran avisos sin esto. Activa en: Ajustes → Notificaciones → Cruzar.'
                : "You won't get alerts without this. Enable: Settings → Notifications → Cruzar."}
            </p>
          </div>
        </div>
      </div>
    )
  }

  // idle / asking — full warm-up sheet
  return (
    <div className="bg-gradient-to-br from-blue-600 via-indigo-700 to-purple-800 text-white rounded-3xl p-5 shadow-xl relative overflow-hidden">
      <div className="absolute -top-12 -right-10 w-40 h-40 bg-white/10 rounded-full blur-3xl pointer-events-none" />
      <button
        type="button"
        onClick={handleDismiss}
        aria-label={es ? 'Cerrar' : 'Dismiss'}
        className="absolute top-3 right-3 w-7 h-7 flex items-center justify-center text-white/60 hover:text-white rounded-full hover:bg-white/10"
      >
        <X className="w-4 h-4" />
      </button>
      <div className="relative">
        <div className="w-12 h-12 rounded-2xl bg-white/15 flex items-center justify-center mb-3">
          <Bell className="w-6 h-6 text-white" />
        </div>
        <h3 className="text-lg sm:text-xl font-black leading-tight">
          {bridgeName
            ? (es
                ? `Te avisamos cuando ${bridgeName} esté rápido`
                : `We'll ping you when ${bridgeName} clears`)
            : (es
                ? 'Te avisamos cuando tu puente esté rápido'
                : "We'll ping you when your bridge clears")}
        </h3>
        <p className="text-[12px] text-blue-100 mt-2 leading-snug">
          {es
            ? 'Una notificación al teléfono cuando la espera baje de 30 min — antes de salir de casa. Sin spam, solo cuando vale la pena.'
            : 'A push to your phone when the wait drops below 30 min — before you leave the house. No spam, only when it matters.'}
        </p>
        <button
          type="button"
          onClick={handleAllow}
          disabled={state === 'asking'}
          className="mt-4 w-full bg-white text-indigo-700 font-black text-base rounded-2xl py-3.5 shadow-lg active:scale-[0.98] transition-transform disabled:opacity-60"
        >
          {state === 'asking'
            ? (es ? 'Activando…' : 'Turning on…')
            : (es ? 'Sí, avísame' : 'Yes, ping me')}
        </button>
        <button
          type="button"
          onClick={handleDismiss}
          className="mt-2 w-full text-center text-[11px] font-semibold text-blue-200/80 hover:text-blue-100 py-1.5"
        >
          {es ? 'Ahorita no' : 'Not right now'}
        </button>
      </div>
    </div>
  )
}
