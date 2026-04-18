'use client'

import { useEffect } from 'react'
import { capture, consume, type BIPEvent } from '@/lib/installPromptStore'

// Single global listener for the Android Chrome `beforeinstallprompt`
// event. Renders nothing — pure side-effect component. Mount once in
// the root layout and every page benefits.
//
// Previously this listener lived inside InstallGuide, which only mounts
// on /welcome, /mas, and when the FirstVisitInstallSheet is expanded.
// Cold visitors to /camaras or / never hit those mount points → the
// prompt event fired, nobody caught it, Android silently suppressed
// future attempts.
//
// With this global capture in place, the event is cached in a module
// store (see lib/installPromptStore.ts) and any consumer component
// (InstallGuide, CamarasStickyInstallCta, DashboardInstallBanner,
// FirstVisitInstallSheet) can subscribe + trigger the prompt at its
// moment of highest intent.

export function GlobalInstallPromptCapture() {
  useEffect(() => {
    if (typeof window === 'undefined') return

    const onBeforeInstallPrompt = (e: Event) => {
      // Prevent Chrome's default mini-infobar — we want to drive the
      // prompt from our own UI at higher-intent moments.
      e.preventDefault()
      capture(e as BIPEvent)
    }

    // If the user installs the app (anywhere in the funnel), flush the
    // cached prompt — it's single-use and no longer meaningful.
    const onAppInstalled = () => {
      consume()
    }

    window.addEventListener('beforeinstallprompt', onBeforeInstallPrompt)
    window.addEventListener('appinstalled', onAppInstalled)
    return () => {
      window.removeEventListener('beforeinstallprompt', onBeforeInstallPrompt)
      window.removeEventListener('appinstalled', onAppInstalled)
    }
  }, [])

  return null
}
