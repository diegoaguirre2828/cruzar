'use client'

import { useState, useEffect } from 'react'
import { useLang } from '@/lib/LangContext'

export function InstallPrompt() {
  const { lang } = useLang()
  const es = lang === 'es'
  const [show, setShow] = useState(false)
  const [isIos, setIsIos] = useState(false)
  const [deferredPrompt, setDeferredPrompt] = useState<Event & { prompt: () => void; userChoice: Promise<{ outcome: string }> } | null>(null)

  useEffect(() => {
    // Don't show if already installed
    if (window.matchMedia('(display-mode: standalone)').matches) return
    // Don't show if dismissed recently
    const dismissed = localStorage.getItem('install_dismissed')
    if (dismissed && Date.now() - parseInt(dismissed) < 7 * 24 * 60 * 60 * 1000) return

    const ios = /iphone|ipad|ipod/i.test(navigator.userAgent) && !(navigator.userAgent.includes('CriOS'))
    setIsIos(ios)

    if (ios) {
      // iOS doesn't fire beforeinstallprompt — show manual instructions
      setTimeout(() => setShow(true), 3000)
      return
    }

    // Android / Chrome
    const handler = (e: Event) => {
      e.preventDefault()
      setDeferredPrompt(e as Event & { prompt: () => void; userChoice: Promise<{ outcome: string }> })
      setTimeout(() => setShow(true), 3000)
    }
    window.addEventListener('beforeinstallprompt', handler)
    return () => window.removeEventListener('beforeinstallprompt', handler)
  }, [])

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

  if (!show) return null

  return (
    <div className="fixed bottom-20 left-4 right-4 z-50 max-w-sm mx-auto">
      <div className="bg-gray-900 border border-gray-700 rounded-2xl p-4 shadow-2xl">
        <div className="flex items-start justify-between mb-3">
          <div className="flex items-center gap-2.5">
            <span className="text-2xl">📲</span>
            <div>
              <p className="text-sm font-bold text-white">
                {es ? 'Agrégala a tu pantalla' : 'Add to your home screen'}
              </p>
              <p className="text-xs text-gray-400 mt-0.5">
                {es ? 'Acceso rápido sin abrir el navegador' : 'Quick access without opening the browser'}
              </p>
            </div>
          </div>
          <button onClick={dismiss} className="text-gray-500 hover:text-gray-300 text-xl leading-none ml-2">×</button>
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
            className="w-full bg-blue-600 hover:bg-blue-700 text-white text-sm font-bold py-2.5 rounded-xl transition-colors"
          >
            {es ? 'Instalar app' : 'Install app'}
          </button>
        )}
      </div>
    </div>
  )
}
