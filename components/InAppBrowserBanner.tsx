'use client'

import { useEffect, useState } from 'react'
import { useLang } from '@/lib/LangContext'
import { trackEvent } from '@/lib/trackEvent'

// In-app browser recovery banner. 72% of Cruzar traffic lands from
// m.facebook.com or lm.facebook.com — that's Facebook's in-app webview,
// which is notorious for breaking cookies, blocking JS, and failing
// silently on modern SPAs. Users who land there often see a broken-
// looking app and bounce, dragging up the bounce rate without ever
// knowing there's a Chrome/Safari escape hatch.
//
// Previously this was a full-screen modal that fired after 12s. Two
// problems with that:
//   1. A modal itself can cause bounces — users tap away from it
//   2. We had zero data on whether anyone actually tapped the rescue
//
// This version is a compact persistent footer pinned above the bottom
// nav, shown only to users actually inside the FB/IG webview. It's
// dismissible but not a modal, and every tap (show / dismiss / escape)
// fires a Vercel Analytics event so we can measure the rescue rate
// against the FB traffic volume in the same dashboard.

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
    if (!isInAppBrowser()) return
    const detected = detectPlatform()
    setPlatform(detected)
    // Short delay so it's not the first thing users see on first paint.
    // Long enough that the page has loaded and the user knows they're
    // in the app, short enough to catch them before they bounce.
    const timer = setTimeout(() => {
      setShow(true)
      try { trackEvent('iab_banner_shown', { platform: detected }) } catch { /* ignore */ }
    }, 4000)
    return () => clearTimeout(timer)
  }, [])

  function dismiss() {
    setDismissed(true)
    try { sessionStorage.setItem('cruzar_iab_dismissed', '1') } catch { /* ignore */ }
    try { trackEvent('iab_banner_dismissed', { platform }) } catch { /* ignore */ }
    setTimeout(() => setShow(false), 200)
  }

  function openExternal() {
    try { trackEvent('iab_banner_escape', { platform }) } catch { /* ignore */ }
    if (platform === 'android') {
      const path = window.location.pathname + window.location.search
      window.location.href = `intent://www.cruzar.app${path}#Intent;scheme=https;package=com.android.chrome;end`
      // Fallback — if Chrome intent fails, try a plain navigation.
      setTimeout(() => { window.location.href = 'https://www.cruzar.app' + path }, 600)
      return
    }
    // iOS can't programmatically escape Safari's in-app webview.
    // Copy the URL to clipboard and show instructions instead.
    try {
      navigator.clipboard.writeText(window.location.href).catch(() => {})
    } catch { /* ignore */ }
  }

  if (!show) return null

  return (
    <div
      className={`fixed left-0 right-0 z-40 md:hidden transition-transform duration-200 ${dismissed ? 'translate-y-full' : 'translate-y-0'}`}
      style={{ bottom: 'calc(3.5rem + env(safe-area-inset-bottom))' }}
      role="status"
    >
      <div className="mx-3 mb-2 bg-amber-50 dark:bg-amber-900/40 border-2 border-amber-400 dark:border-amber-600 rounded-2xl shadow-lg px-3 py-2.5">
        <div className="flex items-start gap-2.5">
          <span className="text-lg leading-none flex-shrink-0 mt-0.5">⚠️</span>
          <div className="flex-1 min-w-0">
            <p className="text-[12px] font-black text-amber-900 dark:text-amber-100 leading-tight">
              {es ? '¿Te cargó lento o raro?' : 'Loading slow or weird?'}
            </p>
            <p className="text-[11px] text-amber-800 dark:text-amber-200 leading-snug mt-0.5">
              {es
                ? 'Facebook tiene su propio navegador que a veces falla. Ábrelo en tu navegador pa\' ver todo bien.'
                : "Facebook uses its own browser that sometimes breaks. Open in your real browser to see it right."}
            </p>
            {platform === 'ios' && (
              <p className="text-[10px] text-amber-700 dark:text-amber-300 mt-1 font-semibold leading-snug">
                {es
                  ? 'iPhone: toca los 3 puntitos (⋯) arriba → "Abrir en Safari"'
                  : 'iPhone: tap the 3 dots (⋯) up top → "Open in Safari"'}
              </p>
            )}
            <div className="mt-2 flex items-center gap-2">
              {platform === 'android' && (
                <button
                  onClick={openExternal}
                  className="bg-amber-600 hover:bg-amber-700 text-white text-[11px] font-black px-3 py-1.5 rounded-full active:scale-95"
                >
                  {es ? 'Abrir en Chrome →' : 'Open in Chrome →'}
                </button>
              )}
              {platform === 'ios' && (
                <button
                  onClick={openExternal}
                  className="bg-amber-600 hover:bg-amber-700 text-white text-[11px] font-black px-3 py-1.5 rounded-full active:scale-95"
                >
                  {es ? 'Copiar link' : 'Copy link'}
                </button>
              )}
              <button
                onClick={dismiss}
                className="text-[11px] font-semibold text-amber-800/70 dark:text-amber-300/70 hover:text-amber-900 px-2 py-1.5"
              >
                {es ? 'No gracias' : 'No thanks'}
              </button>
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}
