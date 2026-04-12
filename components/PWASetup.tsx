'use client'

import { useEffect, useState } from 'react'
import { useLang } from '@/lib/LangContext'
import { X, Share } from 'lucide-react'

interface BeforeInstallPromptEvent extends Event {
  prompt: () => Promise<void>
  userChoice: Promise<{ outcome: 'accepted' | 'dismissed' }>
}

export function PWASetup() {
  const { lang } = useLang()
  const [installPrompt, setInstallPrompt] = useState<BeforeInstallPromptEvent | null>(null)
  const [showBanner, setShowBanner] = useState(false)
  const [isIOS, setIsIOS] = useState(false)

  useEffect(() => {
    // Register service worker silently
    if ('serviceWorker' in navigator) {
      navigator.serviceWorker.register('/sw.js', { scope: '/' }).catch(() => {})
    }

    // Never show if already running as installed PWA
    if (window.matchMedia('(display-mode: standalone)').matches) return

    // Never show if dismissed within last 14 days
    const dismissed = localStorage.getItem('pwa-dismissed-at')
    if (dismissed && Date.now() - Number(dismissed) < 14 * 24 * 60 * 60 * 1000) return

    // iOS — Safari doesn't fire beforeinstallprompt
    const ios = /iPad|iPhone|iPod/.test(navigator.userAgent) &&
      !('MSStream' in window)
    setIsIOS(ios)

    if (ios) {
      // Only show once ever on iOS (instructions don't change)
      if (localStorage.getItem('pwa-ios-shown')) return

      // Show only after user has scrolled (shows real intent)
      const onScroll = () => {
        if (window.scrollY > 200) {
          setShowBanner(true)
          window.removeEventListener('scroll', onScroll)
        }
      }
      window.addEventListener('scroll', onScroll, { passive: true })
      return () => window.removeEventListener('scroll', onScroll)
    }

    // Android/Chrome — wait for browser's own install readiness signal
    const handler = (e: Event) => {
      e.preventDefault()
      setInstallPrompt(e as BeforeInstallPromptEvent)

      // Only show after real engagement: scrolled past the fold
      const onScroll = () => {
        if (window.scrollY > 200) {
          setShowBanner(true)
          window.removeEventListener('scroll', onScroll)
        }
      }
      window.addEventListener('scroll', onScroll, { passive: true })
      return () => window.removeEventListener('scroll', onScroll)
    }

    window.addEventListener('beforeinstallprompt', handler)
    return () => window.removeEventListener('beforeinstallprompt', handler)
  }, [])

  function dismiss() {
    setShowBanner(false)
    localStorage.setItem('pwa-dismissed-at', String(Date.now()))
    if (isIOS) localStorage.setItem('pwa-ios-shown', '1')
  }

  async function install() {
    if (!installPrompt) return
    dismiss()
    await installPrompt.prompt()
    setInstallPrompt(null)
  }

  if (!showBanner) return null

  // iOS: show instructions sheet
  if (isIOS) {
    return (
      <div className="fixed bottom-20 left-3 right-3 z-50 md:hidden">
        <div className="bg-gray-800/95 backdrop-blur border border-gray-700/60 rounded-2xl px-4 py-3.5 shadow-xl">
          <div className="flex items-start gap-3">
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img src="/icons/icon-192.png" alt="" className="w-10 h-10 rounded-xl flex-shrink-0" />
            <div className="flex-1 min-w-0">
              <p className="text-sm font-semibold text-white leading-snug">
                {lang === 'es' ? 'Agrega Cruzar a tu pantalla de inicio' : 'Add Cruzar to your home screen'}
              </p>
              <p className="text-xs text-gray-400 mt-1 leading-snug flex items-center gap-1 flex-wrap">
                {lang === 'es'
                  ? <span>Toca <Share className="w-3 h-3 inline" /> luego <strong className="text-gray-300">"Agregar a inicio"</strong></span>
                  : <span>Tap <Share className="w-3 h-3 inline" /> then <strong className="text-gray-300">"Add to Home Screen"</strong></span>
                }
              </p>
              <p className="text-[10px] text-gray-600 mt-1">cruzar.app</p>
            </div>
            <button onClick={dismiss} className="text-gray-500 hover:text-gray-300 flex-shrink-0 mt-0.5">
              <X className="w-4 h-4" />
            </button>
          </div>
        </div>
      </div>
    )
  }

  // Android/Chrome: native-style prompt
  return (
    <div className="fixed bottom-20 left-3 right-3 z-50 md:hidden">
      <div className="bg-white rounded-2xl px-4 py-3.5 shadow-xl border border-gray-100 flex items-center gap-3">
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img src="/icons/icon-192.png" alt="" className="w-10 h-10 rounded-xl flex-shrink-0" />
        <div className="flex-1 min-w-0">
          <p className="text-sm font-semibold text-gray-900 leading-tight">Cruzar</p>
          <p className="text-xs text-gray-500 truncate">cruzar.app</p>
        </div>
        <button
          onClick={install}
          className="bg-blue-600 hover:bg-blue-700 text-white text-xs font-bold px-4 py-2 rounded-xl flex-shrink-0 transition-colors"
        >
          {lang === 'es' ? 'Instalar' : 'Install'}
        </button>
        <button onClick={dismiss} className="text-gray-400 hover:text-gray-600 flex-shrink-0 ml-1">
          <X className="w-4 h-4" />
        </button>
      </div>
    </div>
  )
}
