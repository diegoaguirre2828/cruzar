'use client'

import { useEffect, useState } from 'react'
import { useLang } from '@/lib/LangContext'
import { trackEvent } from '@/lib/trackEvent'
import { subscribe, consume, getPrompt, type BIPEvent } from '@/lib/installPromptStore'

// Reusable install instructions block. Used by /welcome step 2 and the
// dashboard nag banner. Auto-detects the platform and renders the right
// flow (animated iOS share-button hint, or a single install button on
// Android via beforeinstallprompt).
//
// This exists as a separate component because the psychology shifts
// depending on context:
//   - /welcome → framed as "your alert won't reach you without this"
//   - dashboard → framed as "your alert is waiting — finish setup"
//   - but the mechanical install UX is identical, so the platform logic
//     lives here once.
//
// Install-prompt capture now lives in a global module store
// (lib/installPromptStore.ts) mounted once via
// <GlobalInstallPromptCapture />. This component just subscribes so it
// always has the latest value, even if the event fired on a page before
// this component ever mounted (the old failure mode on /camaras, /).

interface Props {
  onInstalled?: () => void
  variant?: 'welcome' | 'banner'
}

export function InstallGuide({ onInstalled, variant = 'welcome' }: Props) {
  const { lang } = useLang()
  const es = lang === 'es'
  const [platform, setPlatform] = useState<'ios' | 'android' | 'desktop'>('desktop')
  const [deferredPrompt, setDeferredPrompt] = useState<BIPEvent | null>(null)

  useEffect(() => {
    if (typeof navigator === 'undefined') return
    const ua = navigator.userAgent || ''
    const isIos = /iphone|ipad|ipod/i.test(ua) && !ua.includes('CriOS')
    const isAndroid = /android/i.test(ua)
    setPlatform(isIos ? 'ios' : isAndroid ? 'android' : 'desktop')

    // Pull the currently cached prompt (may have fired before mount).
    const current = getPrompt()
    if (current) {
      setDeferredPrompt(current)
      trackEvent('install_prompt_available', { variant, platform: isAndroid ? 'android' : isIos ? 'ios' : 'desktop' })
    }

    // Subscribe for future captures (rare — the event fires once per
    // page load, but keeps us consistent if the user navigates SPA-
    // style from a page that captured mid-session).
    const unsub = subscribe((e) => {
      setDeferredPrompt(e)
      if (e) {
        trackEvent('install_prompt_available', { variant, platform: isAndroid ? 'android' : isIos ? 'ios' : 'desktop' })
      }
    })

    const installed = () => {
      // Telemetry: user actually completed the install. Numerator for
      // the accepted-install conversion rate.
      trackEvent('install_completed', { variant })
      onInstalled?.()
    }
    window.addEventListener('appinstalled', installed)
    return () => {
      unsub()
      window.removeEventListener('appinstalled', installed)
    }
  }, [onInstalled, variant])

  async function triggerInstall() {
    // Consume from the store so no other component reuses the same
    // single-shot event. If it's already been consumed elsewhere, bail.
    const event = consume()
    if (!event) return
    setDeferredPrompt(null)
    // Telemetry: user tapped our "install" button. Diego needs this to
    // know whether the install gap is people never tapping (awareness)
    // or tapping-but-cancelling (friction).
    trackEvent('install_button_tapped', { variant })
    event.prompt()
    try {
      const { outcome } = await event.userChoice
      trackEvent('install_prompt_choice', { variant, outcome })
      if (outcome === 'accepted') onInstalled?.()
    } catch { /* user dismissed */ }
  }

  const compact = variant === 'banner'

  if (platform === 'ios') {
    return (
      <div className={compact ? 'space-y-2.5' : 'space-y-3'}>
        <IosShareVisual compact={compact} />
        <ol className={`${compact ? 'text-xs' : 'text-sm'} space-y-1.5 text-gray-800 dark:text-gray-100`}>
          <li className="flex items-start gap-2.5">
            <span className="flex-shrink-0 w-5 h-5 rounded-full bg-blue-600 text-white text-[10px] font-black flex items-center justify-center">1</span>
            <span className="leading-snug">
              {es ? (
                <>Toca el botón <b>Compartir</b> abajo en Safari <span className="inline-block align-middle">
                  <svg width="14" height="14" viewBox="0 0 24 24" fill="none" className="inline text-blue-600"><path d="M12 3v12M12 3l-4 4M12 3l4 4M5 12v6a2 2 0 002 2h10a2 2 0 002-2v-6" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"/></svg>
                </span></>
              ) : (
                <>Tap the <b>Share</b> button at the bottom of Safari</>
              )}
            </span>
          </li>
          <li className="flex items-start gap-2.5">
            <span className="flex-shrink-0 w-5 h-5 rounded-full bg-blue-600 text-white text-[10px] font-black flex items-center justify-center">2</span>
            <span className="leading-snug">
              {es ? (
                <>Baja y toca <b>&ldquo;Agregar a pantalla de inicio&rdquo;</b></>
              ) : (
                <>Scroll and tap <b>&ldquo;Add to Home Screen&rdquo;</b></>
              )}
            </span>
          </li>
          <li className="flex items-start gap-2.5">
            <span className="flex-shrink-0 w-5 h-5 rounded-full bg-blue-600 text-white text-[10px] font-black flex items-center justify-center">3</span>
            <span className="leading-snug">
              {es ? <>Toca <b>&ldquo;Agregar&rdquo;</b> arriba a la derecha</> : <>Tap <b>&ldquo;Add&rdquo;</b> in the top right</>}
            </span>
          </li>
        </ol>
      </div>
    )
  }

  if (platform === 'android') {
    return (
      <div className={compact ? 'space-y-2' : 'space-y-3'}>
        {deferredPrompt ? (
          <button
            onClick={triggerInstall}
            className="w-full py-3.5 bg-blue-600 hover:bg-blue-700 text-white text-sm font-black rounded-2xl active:scale-[0.98] transition-transform shadow-lg"
          >
            {es ? '📲 Agregar Cruzar a pantalla de inicio' : '📲 Add Cruzar to Home Screen'}
          </button>
        ) : (
          <div className="space-y-2">
            <p className="text-xs text-gray-700 dark:text-gray-300 leading-snug">
              {es
                ? 'En Chrome: toca el menú ⋮ arriba a la derecha y escoge "Agregar a pantalla de inicio" (o "Instalar aplicación").'
                : 'In Chrome: tap the ⋮ menu in the top right and pick "Add to Home Screen" (or "Install app").'}
            </p>
          </div>
        )}
      </div>
    )
  }

  return (
    <p className="text-xs text-gray-500 dark:text-gray-400 leading-snug">
      {es
        ? 'Abre Cruzar en tu teléfono para instalarlo. Desde la computadora no se puede.'
        : 'Open Cruzar on your phone to install. Desktop install is not supported.'}
    </p>
  )
}

// Visual illustration of the iOS share button + arrow pointing at it.
// This is the single most important element in the iOS flow — most
// non-technical users don't know which button is the "share" button.
function IosShareVisual({ compact }: { compact: boolean }) {
  return (
    <div className={`relative ${compact ? 'h-20' : 'h-28'} rounded-2xl bg-gradient-to-b from-gray-100 to-gray-200 dark:from-gray-800 dark:to-gray-900 border border-gray-200 dark:border-gray-700 overflow-hidden`}>
      {/* Fake Safari bottom bar */}
      <div className="absolute inset-x-0 bottom-0 h-10 bg-white/90 dark:bg-gray-800/90 border-t border-gray-200 dark:border-gray-700 flex items-center justify-around px-2">
        <div className="w-4 h-4 rounded-full border-2 border-gray-400" />
        <div className="w-4 h-4 rounded-full border-2 border-gray-400" />
        {/* The share button — highlighted with pulse ring */}
        <div className="relative">
          <span className="absolute inset-0 rounded-md bg-blue-500/30 animate-ping" />
          <div className="relative w-7 h-7 rounded-md bg-blue-100 dark:bg-blue-900/50 border-2 border-blue-500 flex items-center justify-center">
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" className="text-blue-600">
              <path d="M12 3v12M12 3l-4 4M12 3l4 4M5 12v6a2 2 0 002 2h10a2 2 0 002-2v-6" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"/>
            </svg>
          </div>
        </div>
        <div className="w-4 h-4 rounded-full border-2 border-gray-400" />
        <div className="w-4 h-4 rounded-full border-2 border-gray-400" />
      </div>
      {/* Arrow pointing at the share button */}
      <div className={`absolute ${compact ? 'bottom-10' : 'bottom-11'} left-1/2 -translate-x-[6px] flex flex-col items-center`}>
        <span className="text-[10px] font-black text-blue-600 dark:text-blue-400 bg-white dark:bg-gray-900 px-1.5 py-0.5 rounded-md shadow-sm mb-1 whitespace-nowrap">
          ⬇ Este botón
        </span>
        <div className="w-0 h-0 border-l-[6px] border-l-transparent border-r-[6px] border-r-transparent border-t-[8px] border-t-blue-500" />
      </div>
    </div>
  )
}
