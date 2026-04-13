'use client'

import { useEffect } from 'react'
import { trackEvent } from '@/lib/trackEvent'

// Global PWA plumbing. Renders no UI — the install-prompt UI now lives
// in InstallPill (home header) and the /mas install card. This file's
// job is the invisible stuff:
//
//   1. Register the service worker
//   2. Listen for the appinstalled browser event and claim the 3-month
//      Pro grant for the signed-in user
//   3. On every page load, if the app is running as a standalone PWA
//      and the grant hasn't been claimed yet, claim it
//
// Previously this file was a legacy scroll-triggered install banner
// that conflicted with the Phase 2 InstallPill, AND the Pro grant
// claim only lived in the retired InstallPrompt component which was
// removed from render in Phase 1. Result: every install between
// Phase 1 and now silently failed to grant Pro. This fixes that.

const PWA_GRANT_CLAIMED_KEY = 'cruzar_pwa_grant_claimed'

async function tryClaimGrant() {
  try {
    const alreadyClaimed = localStorage.getItem(PWA_GRANT_CLAIMED_KEY)
    if (alreadyClaimed) return
  } catch { /* ignore */ }

  try {
    const res = await fetch('/api/user/claim-pwa-pro', { method: 'POST' })
    if (!res.ok) return
    const data = await res.json()
    if (data?.ok) {
      try { localStorage.setItem(PWA_GRANT_CLAIMED_KEY, String(Date.now())) } catch { /* ignore */ }
      trackEvent('pwa_grant_claimed', {
        granted: data.granted || false,
        days: data.days || null,
      })
      // Fire a window event so UI components (celebration toast, etc.)
      // can react to the grant landing if they want to.
      if (data.granted && data.days) {
        window.dispatchEvent(
          new CustomEvent('cruzar:pwa-grant-claimed', { detail: { days: data.days } }),
        )
      }
    }
  } catch { /* silent — endpoint requires auth, fine to fail for guests */ }
}

export function PWASetup() {
  useEffect(() => {
    if (typeof window === 'undefined') return

    // Service worker registration — unchanged. The SW handles push
    // notifications, offline caching, and SWR for /api/ports and
    // /api/reports/recent.
    if ('serviceWorker' in navigator) {
      navigator.serviceWorker.register('/sw.js', { scope: '/' }).catch(() => {})
    }

    // If we're running as an installed PWA right now, try to claim
    // the grant immediately. Idempotent server-side, and localStorage
    // dedupe prevents repeated fetches.
    const isStandalone =
      window.matchMedia('(display-mode: standalone)').matches ||
      (navigator as Navigator & { standalone?: boolean }).standalone === true
    if (isStandalone) {
      tryClaimGrant()
    }

    // Listen for the actual install event so users installing NOW get
    // the grant without needing to reload.
    const onInstalled = () => tryClaimGrant()
    window.addEventListener('appinstalled', onInstalled)
    return () => window.removeEventListener('appinstalled', onInstalled)
  }, [])

  return null
}
