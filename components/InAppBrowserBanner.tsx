'use client'

import { useEffect, useState } from 'react'
import { useLang } from '@/lib/LangContext'

// Detects Facebook/Instagram/TikTok/Messenger in-app browsers and shows a
// dismissible banner telling the user to open the page in their real
// browser. FB's in-app webview is notorious for failing on modern SPAs —
// cookies get blocked, JS breaks, pages timeout, Google sign-in doesn't
// work. Our first-impression problem is almost entirely this.
//
// Detection is user-agent based: FB/IG append FBAN/FBAV/FB_IAB/Instagram
// to the UA string of their webview.

function isInAppBrowser(): boolean {
  if (typeof navigator === 'undefined') return false
  const ua = navigator.userAgent || ''
  return /FBAN|FBAV|FB_IAB|FBIOS|Instagram|Musical_ly|Bytedance|LINE|MicroMessenger|Messenger/i.test(ua)
}

function detectPlatform(): 'ios' | 'android' | 'other' {
  if (typeof navigator === 'undefined') return 'other'
  const ua = navigator.userAgent || ''
  if (/iPhone|iPad|iPod/.test(ua)) return 'ios'
  if (/Android/.test(ua)) return 'android'
  return 'other'
}

export function InAppBrowserBanner() {
  const { lang } = useLang()
  const es = lang === 'es'
  const [show, setShow] = useState(false)
  const [dismissed, setDismissed] = useState(false)
  const [platform, setPlatform] = useState<'ios' | 'android' | 'other'>('other')

  useEffect(() => {
    if (typeof window === 'undefined') return
    try {
      if (sessionStorage.getItem('cruzar_iab_dismissed')) return
    } catch { /* ignore */ }
    if (isInAppBrowser()) {
      setShow(true)
      setPlatform(detectPlatform())
    }
  }, [])

  function dismiss() {
    setDismissed(true)
    try { sessionStorage.setItem('cruzar_iab_dismissed', '1') } catch { /* ignore */ }
    setTimeout(() => setShow(false), 200)
  }

  function openInChrome() {
    // Android: fire a chrome intent. If Chrome isn't installed, falls back
    // silently and the user stays in-app.
    if (platform === 'android') {
      const url = 'https://www.cruzar.app' + (window.location.pathname === '/' ? '' : window.location.pathname)
      window.location.href = `intent://www.cruzar.app${window.location.pathname}#Intent;scheme=https;package=com.android.chrome;end`
      // Fallback: also try to open normally after a moment
      setTimeout(() => { window.location.href = url }, 600)
    }
    // iOS: there's no programmatic way to jump out of FB's webview to Safari.
    // Just show the instructions. The user has to tap "..." → "Open in Safari".
  }

  if (!show) return null

  return (
    <div
      className={`fixed inset-0 z-[9999] flex items-end sm:items-center justify-center bg-black/60 backdrop-blur-sm transition-opacity ${dismissed ? 'opacity-0' : 'opacity-100'}`}
      role="dialog"
      aria-live="polite"
    >
      <div className="w-full max-w-sm bg-white dark:bg-gray-900 rounded-t-3xl sm:rounded-3xl shadow-2xl p-5 m-0 sm:m-4 cruzar-rise">
        <p className="text-2xl font-black text-gray-900 dark:text-gray-100 leading-tight">
          {es ? 'Abre en tu navegador' : 'Open in your browser'}
        </p>
        <p className="text-sm text-gray-600 dark:text-gray-400 mt-2 leading-relaxed">
          {es
            ? 'Facebook está abriendo Cruzar en su navegador interno, que a veces no carga bien. Para la mejor experiencia, ábrelo en Chrome o Safari.'
            : 'Facebook opens Cruzar in its in-app browser, which sometimes fails. For the best experience, open in Chrome or Safari.'}
        </p>

        {platform === 'ios' && (
          <div className="mt-4 bg-blue-50 dark:bg-blue-900/30 border border-blue-200 dark:border-blue-800 rounded-2xl p-3">
            <p className="text-xs font-bold text-blue-900 dark:text-blue-200 mb-1">
              {es ? 'Cómo abrir en Safari:' : 'How to open in Safari:'}
            </p>
            <ol className="text-xs text-blue-900 dark:text-blue-200 list-decimal ml-4 space-y-0.5">
              <li>{es ? 'Toca los 3 puntitos arriba a la derecha (⋯)' : 'Tap the three dots top-right (⋯)'}</li>
              <li>{es ? 'Escoge "Abrir en Safari"' : 'Pick "Open in Safari"'}</li>
            </ol>
          </div>
        )}

        {platform === 'android' && (
          <div className="mt-4 bg-blue-50 dark:bg-blue-900/30 border border-blue-200 dark:border-blue-800 rounded-2xl p-3">
            <p className="text-xs font-bold text-blue-900 dark:text-blue-200 mb-1">
              {es ? 'Cómo abrir en Chrome:' : 'How to open in Chrome:'}
            </p>
            <ol className="text-xs text-blue-900 dark:text-blue-200 list-decimal ml-4 space-y-0.5">
              <li>{es ? 'Toca los 3 puntitos arriba a la derecha (⋮)' : 'Tap the three dots top-right (⋮)'}</li>
              <li>{es ? 'Escoge "Abrir en navegador" o "Abrir en Chrome"' : 'Pick "Open in browser" or "Open in Chrome"'}</li>
            </ol>
          </div>
        )}

        <div className="mt-4 flex flex-col gap-2">
          {platform === 'android' && (
            <button
              onClick={openInChrome}
              className="w-full py-3 bg-blue-600 hover:bg-blue-700 text-white font-bold rounded-2xl text-sm active:scale-95 transition-all"
            >
              {es ? 'Abrir en Chrome' : 'Open in Chrome'}
            </button>
          )}
          <button
            onClick={dismiss}
            className="w-full py-3 bg-gray-100 dark:bg-gray-800 hover:bg-gray-200 dark:hover:bg-gray-700 text-gray-700 dark:text-gray-300 font-semibold rounded-2xl text-sm"
          >
            {es ? 'Continuar aquí de todas formas' : 'Continue here anyway'}
          </button>
        </div>

        <p className="text-[10px] text-gray-400 text-center mt-3">
          {es
            ? 'También puedes teclear "cruzar.app" en tu navegador'
            : 'You can also type "cruzar.app" in your browser'}
        </p>
      </div>
    </div>
  )
}
