'use client'

import { useEffect, useState } from 'react'
import { usePathname, useRouter } from 'next/navigation'
import { Download, Smartphone, X } from 'lucide-react'
import { useLang } from '@/lib/LangContext'
import { trackEvent } from '@/lib/trackEvent'
import { subscribe, consume, getPrompt, type BIPEvent } from '@/lib/installPromptStore'
import { isIosSafari, isPwaInstalled } from '@/lib/iosDetect'

// Sticky install pill on /camaras. Targets the funnel's biggest leak:
// high-intent camera-scrollers on Android + iOS Safari never see an
// install path, so 8.3% of 204 registered users actually installed.
// This pill surfaces it at the moment of highest engagement (the camera
// grid). Works in tandem with StickyCamarasCta — this one pushes
// install (best retention), that one pushes signup (minimum account).
//
// Rules:
//   - /camaras only (pathname gated)
//   - Hidden if already installed as PWA
//   - Android Chrome with captured beforeinstallprompt → native prompt
//   - iOS Safari → route to /ios-install walkthrough
//   - Desktop or other platforms → don't render
//   - Dismiss = 3 days localStorage cooldown (NOT 14 — repeat camera
//     visitors are warm and we want to re-surface quickly)

const DISMISS_KEY = 'cruzar_camaras_install_cta_dismissed_at'
const DISMISS_DAYS = 3
type Platform = 'android-native' | 'ios-safari' | 'none'

export function CamarasStickyInstallCta() {
  const { lang } = useLang()
  const router = useRouter()
  const pathname = usePathname()
  const es = lang === 'es'

  const [platform, setPlatform] = useState<Platform>('none')
  const [deferredPrompt, setDeferredPrompt] = useState<BIPEvent | null>(null)
  const [show, setShow] = useState(false)
  const [shownTracked, setShownTracked] = useState(false)

  useEffect(() => {
    if (typeof window === 'undefined') return
    if (pathname !== '/camaras') return
    if (isPwaInstalled()) return

    // 3-day dismiss cooldown.
    try {
      const dismissedAt = localStorage.getItem(DISMISS_KEY)
      if (dismissedAt) {
        const ageMs = Date.now() - parseInt(dismissedAt, 10)
        const cooldownMs = DISMISS_DAYS * 24 * 60 * 60 * 1000
        if (Number.isFinite(ageMs) && ageMs < cooldownMs) return
      }
    } catch { /* ignore */ }

    // Prime from existing cached prompt (fired earlier on this page or
    // on a prior route navigated SPA-style).
    const cached = getPrompt()
    if (cached) {
      setDeferredPrompt(cached)
      setPlatform('android-native')
      setShow(true)
    } else if (isIosSafari()) {
      setPlatform('ios-safari')
      setShow(true)
    }

    // Subscribe so Android users whose prompt fires AFTER render still
    // see the pill.
    const unsub = subscribe((e) => {
      if (e) {
        setDeferredPrompt(e)
        setPlatform('android-native')
        setShow(true)
      } else {
        setDeferredPrompt(null)
      }
    })
    return () => unsub()
  }, [pathname])

  // Fire telemetry once on first visible render per mount.
  useEffect(() => {
    if (!show || shownTracked) return
    trackEvent('camaras_install_cta_shown', { platform })
    setShownTracked(true)
  }, [show, shownTracked, platform])

  function dismiss() {
    try { localStorage.setItem(DISMISS_KEY, String(Date.now())) } catch { /* ignore */ }
    trackEvent('camaras_install_cta_dismissed', { platform })
    setShow(false)
  }

  async function onClick() {
    trackEvent('camaras_install_cta_clicked', { platform })
    if (platform === 'android-native') {
      const event = consume()
      if (!event) {
        // Prompt got consumed elsewhere — soft fallback to the /welcome
        // install walkthrough so the tap still goes somewhere useful.
        router.push('/welcome')
        return
      }
      setDeferredPrompt(null)
      event.prompt()
      try {
        const { outcome } = await event.userChoice
        trackEvent('camaras_install_cta_choice', { platform, outcome })
        if (outcome === 'accepted') setShow(false)
      } catch { /* user dismissed */ }
    } else if (platform === 'ios-safari') {
      router.push('/ios-install?next=/camaras')
    }
  }

  if (!show || platform === 'none' || pathname !== '/camaras') return null

  const title = platform === 'android-native'
    ? (es ? 'Instalar Cruzar — 3 meses Pro gratis' : 'Install Cruzar — 3 months Pro free')
    : (es ? '📱 Agregar a pantalla de inicio — 3 meses Pro gratis' : '📱 Add to Home Screen — 3 months Pro free')

  return (
    <div
      className="fixed right-3 z-40 pointer-events-none"
      style={{ bottom: 'calc(8rem + env(safe-area-inset-bottom))' }}
    >
      <div className="pointer-events-auto">
        <div className="relative bg-gradient-to-r from-emerald-500 to-green-600 rounded-full shadow-2xl border border-emerald-400/60 overflow-hidden">
          <button
            type="button"
            onClick={dismiss}
            aria-label={es ? 'Cerrar' : 'Dismiss'}
            className="absolute top-1/2 -translate-y-1/2 right-1.5 w-6 h-6 flex items-center justify-center text-white/70 hover:text-white rounded-full hover:bg-white/10 z-10"
          >
            <X className="w-3.5 h-3.5" />
          </button>
          <button
            type="button"
            onClick={onClick}
            className="pl-4 pr-10 py-2.5 flex items-center gap-2 active:scale-[0.98] transition-transform"
          >
            <div className="flex-shrink-0 w-7 h-7 rounded-full bg-white/20 flex items-center justify-center">
              {platform === 'android-native'
                ? <Download className="w-3.5 h-3.5 text-white" />
                : <Smartphone className="w-3.5 h-3.5 text-white" />}
            </div>
            <span className="text-[12px] font-black text-white leading-tight text-left max-w-[200px]">
              {title}
            </span>
          </button>
        </div>
      </div>
    </div>
  )
}
