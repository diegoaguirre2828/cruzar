'use client'

import { useState, useEffect } from 'react'
import { useLang } from '@/lib/LangContext'
import { useAuth } from '@/lib/useAuth'

// PWA install prompt + Pro grant claim.
//
// When the user installs the app as a PWA (Add to Home Screen), they get
// 3 months of free Pro tier as a commitment reward. This component:
//   1. Shows the install prompt with the '3 months Pro free' offer
//   2. Detects the appinstalled event (or display-mode:standalone on
//      subsequent loads) and claims the grant server-side
//   3. Shows a celebration toast after the grant lands

const PWA_GRANT_CLAIMED_KEY = 'cruzar_pwa_grant_claimed'

async function claimPwaGrant(): Promise<{ ok: boolean; granted?: boolean; days?: number } | null> {
  try {
    const res = await fetch('/api/user/claim-pwa-pro', { method: 'POST' })
    if (!res.ok) return null
    const data = await res.json()
    return data
  } catch {
    return null
  }
}

export function InstallPrompt() {
  const { lang } = useLang()
  const { user } = useAuth()
  const es = lang === 'es'
  const [show, setShow] = useState(false)
  const [isIos, setIsIos] = useState(false)
  const [deferredPrompt, setDeferredPrompt] = useState<Event & { prompt: () => void; userChoice: Promise<{ outcome: string }> } | null>(null)
  const [celebrate, setCelebrate] = useState<{ days: number } | null>(null)

  useEffect(() => {
    if (typeof window === 'undefined') return
    const isStandalone =
      window.matchMedia('(display-mode: standalone)').matches ||
      (navigator as Navigator & { standalone?: boolean }).standalone === true

    // Already installed — attempt to claim the grant if we haven't yet
    if (isStandalone) {
      if (!user) return
      try {
        const alreadyClaimed = localStorage.getItem(PWA_GRANT_CLAIMED_KEY)
        if (alreadyClaimed) return
      } catch { /* ignore */ }
      claimPwaGrant().then((result) => {
        if (result?.ok) {
          try { localStorage.setItem(PWA_GRANT_CLAIMED_KEY, String(Date.now())) } catch { /* ignore */ }
          if (result.granted && result.days) {
            setCelebrate({ days: result.days })
            setTimeout(() => setCelebrate(null), 6000)
          }
        }
      })
      return
    }

    // Don't show if dismissed recently
    const dismissed = localStorage.getItem('install_dismissed')
    if (dismissed && Date.now() - parseInt(dismissed, 10) < 7 * 24 * 60 * 60 * 1000) return

    const ios = /iphone|ipad|ipod/i.test(navigator.userAgent) && !(navigator.userAgent.includes('CriOS'))
    setIsIos(ios)

    if (ios) {
      setTimeout(() => setShow(true), 3000)
      return
    }

    // Android / Chrome
    const handler = (e: Event) => {
      e.preventDefault()
      setDeferredPrompt(e as Event & { prompt: () => void; userChoice: Promise<{ outcome: string }> })
      setTimeout(() => setShow(true), 3000)
    }
    const installed = () => {
      setShow(false)
      if (!user) return
      claimPwaGrant().then((result) => {
        if (result?.ok) {
          try { localStorage.setItem(PWA_GRANT_CLAIMED_KEY, String(Date.now())) } catch { /* ignore */ }
          if (result.granted && result.days) {
            setCelebrate({ days: result.days })
            setTimeout(() => setCelebrate(null), 6000)
          }
        }
      })
    }
    window.addEventListener('beforeinstallprompt', handler)
    window.addEventListener('appinstalled', installed)
    return () => {
      window.removeEventListener('beforeinstallprompt', handler)
      window.removeEventListener('appinstalled', installed)
    }
  }, [user])

  function dismiss() {
    localStorage.setItem('install_dismissed', Date.now().toString())
    setShow(false)
  }

  async function install() {
    if (deferredPrompt) {
      deferredPrompt.prompt()
      const { outcome } = await deferredPrompt.userChoice
      if (outcome === 'accepted') setShow(false)
    }
    dismiss()
  }

  // Celebration toast — shown briefly after the grant lands
  if (celebrate) {
    return (
      <div className="fixed top-4 left-4 right-4 z-[100] max-w-sm mx-auto">
        <div className="cruzar-stamp bg-gradient-to-br from-green-500 to-emerald-600 rounded-2xl p-4 shadow-2xl text-white">
          <div className="flex items-start gap-3">
            <span className="text-3xl">🎉</span>
            <div className="flex-1 min-w-0">
              <p className="text-base font-black leading-tight">
                {es ? `¡Pro gratis por ${Math.round(celebrate.days / 30)} meses!` : `Free Pro for ${Math.round(celebrate.days / 30)} months!`}
              </p>
              <p className="text-xs text-green-50 mt-1 leading-snug">
                {es
                  ? 'Alertas ilimitadas, patrones históricos y optimizador de ruta — activado.'
                  : 'Unlimited alerts, historical patterns, and route optimizer — unlocked.'}
              </p>
            </div>
            <button onClick={() => setCelebrate(null)} className="text-white/70 hover:text-white text-xl leading-none">×</button>
          </div>
        </div>
      </div>
    )
  }

  if (!show) return null

  return (
    <div className="fixed bottom-20 left-4 right-4 z-50 max-w-sm mx-auto">
      <div className="bg-gradient-to-br from-gray-900 via-gray-800 to-blue-900 border border-blue-500/30 rounded-2xl p-4 shadow-2xl cruzar-shimmer">
        <div className="flex items-start justify-between mb-3">
          <div className="flex items-center gap-2.5 min-w-0">
            <span className="text-2xl flex-shrink-0">📲</span>
            <div className="min-w-0">
              <p className="text-sm font-black text-white leading-tight">
                {es ? 'Instala Cruzar → 3 meses de Pro GRATIS' : 'Install Cruzar → 3 months Pro FREE'}
              </p>
              <p className="text-[11px] text-blue-200 mt-0.5 leading-snug">
                {es
                  ? 'Alertas ilimitadas · Mejor hora pa\' cruzar · Optimizador de ruta'
                  : 'Unlimited alerts · Best time to cross · Route optimizer'}
              </p>
            </div>
          </div>
          <button onClick={dismiss} className="text-gray-500 hover:text-gray-300 text-xl leading-none ml-2 flex-shrink-0">×</button>
        </div>

        {isIos ? (
          <div className="space-y-2">
            <div className="flex items-center gap-2 text-xs text-gray-300">
              <span className="bg-gray-800 rounded-lg px-2 py-1 font-mono">1</span>
              <span>{es ? 'Toca el botón de compartir' : 'Tap the share button'} <span className="text-blue-400">⬆️</span> {es ? 'abajo en Safari' : 'at the bottom in Safari'}</span>
            </div>
            <div className="flex items-center gap-2 text-xs text-gray-300">
              <span className="bg-gray-800 rounded-lg px-2 py-1 font-mono">2</span>
              <span>{es ? 'Selecciona "Agregar a pantalla de inicio"' : 'Select "Add to Home Screen"'}</span>
            </div>
            <div className="flex items-center gap-2 text-xs text-gray-300">
              <span className="bg-gray-800 rounded-lg px-2 py-1 font-mono">3</span>
              <span>{es ? 'Toca "Agregar" arriba a la derecha' : 'Tap "Add" in the top right'}</span>
            </div>
            <button onClick={dismiss} className="w-full mt-2 text-xs text-gray-400 hover:text-gray-200 py-1">
              {es ? 'Ya lo tengo' : 'Got it'}
            </button>
          </div>
        ) : (
          <button
            onClick={install}
            className="w-full bg-blue-600 hover:bg-blue-700 text-white text-sm font-bold py-3 rounded-xl transition-colors active:scale-95"
          >
            {es ? 'Instalar app + activar Pro' : 'Install app + unlock Pro'}
          </button>
        )}
      </div>
    </div>
  )
}
