'use client'

import { useEffect, useState } from 'react'
import Link from 'next/link'
import { useLang } from '@/lib/LangContext'
import { trackEvent } from '@/lib/trackEvent'

// /ios-install — dedicated iPhone PWA install landing.
//
// Why this exists: registered-cohort data (Apr 2026) shows iOS users are
// 2× Android (41 vs 20 of 204), but iOS users mostly fail to complete
// the Add-to-Home-Screen walk because Safari hides it behind the share
// sheet. Android gets beforeinstallprompt; iOS gets nothing. This page
// converts that gap by walking the 3 taps explicitly + offering two
// cross-device share paths (copy link, WhatsApp) for when the user is
// reading this on a desktop/Android and needs to hop to their iPhone.
//
// Palette intentionally mirrors the IAB warning on /signup (amber→
// orange→pink) so the "you're in the wrong place, here's the fix" tone
// is consistent across install-friction pages.

const WA_TEXT_ES = 'Checa los tiempos del puente en Cruzar: https://cruzar.app'
const WA_TEXT_EN = 'Check border wait times on Cruzar: https://cruzar.app'

export default function IosInstallPage() {
  const { lang } = useLang()
  const es = lang === 'es'
  const [copied, setCopied] = useState(false)

  // Fire page-view once on mount + redirect already-installed users.
  useEffect(() => {
    trackEvent('ios_install_page_view')
    if (typeof window === 'undefined') return
    try {
      const standalone =
        window.matchMedia('(display-mode: standalone)').matches ||
        // Legacy iOS standalone detection
        (window.navigator as Navigator & { standalone?: boolean }).standalone === true
      if (standalone) {
        window.location.replace('/dashboard')
      }
    } catch { /* ignore */ }
  }, [])

  async function onCopyLink() {
    trackEvent('ios_install_copy_link')
    try {
      await navigator.clipboard.writeText('https://cruzar.app')
      setCopied(true)
      setTimeout(() => setCopied(false), 2000)
    } catch {
      // Extremely old browsers — silently ignore. The WA button is the
      // fallback path.
    }
  }

  function onWhatsApp() {
    trackEvent('ios_install_whatsapp')
  }

  function onSkip() {
    trackEvent('ios_install_skip')
    // Set session flag so /dashboard and /welcome don't redirect us right
    // back to /ios-install. Without this, iOS users are trapped in an
    // infinite redirect loop. Clears naturally when the tab closes.
    try { sessionStorage.setItem('cruzar_ios_install_skipped', '1') } catch { /* ignore */ }
  }

  const waHref = `https://wa.me/?text=${encodeURIComponent(es ? WA_TEXT_ES : WA_TEXT_EN)}`

  return (
    <main className="min-h-screen bg-gradient-to-br from-amber-500 via-orange-600 to-pink-700 text-white px-4 py-8 flex items-start sm:items-center justify-center">
      <div className="w-full max-w-sm space-y-6">
        {/* Hero */}
        <header className="text-center space-y-3">
          <div className="inline-flex items-center gap-1.5 bg-white/15 backdrop-blur-sm border border-white/25 rounded-full px-3 py-1 text-[11px] font-bold uppercase tracking-wider">
            <span aria-hidden>🍎</span>
            <span>{es ? 'Solo iPhone' : 'iPhone only'}</span>
          </div>
          <h1 className="text-3xl sm:text-4xl font-black leading-[1.05]">
            {es
              ? '3 tactos pa\' tener Cruzar en tu iPhone'
              : '3 taps to get Cruzar on your iPhone'}
          </h1>
          <p className="text-sm text-amber-50 leading-snug">
            {es
              ? 'En Android ya tienen la app con un tap. En iPhone son 3 — te lo enseñamos. Te ganas 3 meses de Pro gratis al terminar.'
              : 'Android users already got the app with one tap. iPhone takes 3 — we\'ll walk you through it. You get 3 months of Pro free when you finish.'}
          </p>
        </header>

        {/* 3 step cards */}
        <ol className="grid grid-cols-1 sm:grid-cols-3 gap-3">
          <StepCard
            number={1}
            icon={<IconShare />}
            text={
              es
                ? 'Presiona el ícono de compartir (cuadrito con ↑) abajo en Safari.'
                : 'Tap the share icon (square with ↑) at the bottom of Safari.'
            }
          />
          <StepCard
            number={2}
            icon={<IconPlus />}
            text={
              es
                ? 'Baja un poquito y presiona "Agregar a la pantalla de inicio".'
                : 'Scroll down and tap "Add to Home Screen".'
            }
          />
          <StepCard
            number={3}
            icon={<IconCheck />}
            text={
              es
                ? 'Presiona "Agregar" en la esquina de arriba a la derecha.'
                : 'Tap "Add" in the top-right corner.'
            }
          />
        </ol>

        {/* Animated iPhone mockup */}
        <AnimatedPhoneMockup es={es} />

        {/* Share buttons */}
        <div className="space-y-2.5">
          <button
            type="button"
            onClick={onCopyLink}
            className="w-full py-3.5 bg-white text-orange-700 hover:bg-amber-50 text-sm font-black rounded-2xl active:scale-[0.98] transition-transform shadow-lg relative"
          >
            {copied
              ? es
                ? '¡Copiado! ✓'
                : 'Copied ✓'
              : es
                ? 'Copiar link pa\' pegar en Safari'
                : 'Copy link to paste in Safari'}
          </button>

          <a
            href={waHref}
            target="_blank"
            rel="noopener noreferrer"
            onClick={onWhatsApp}
            className="w-full py-3 bg-white/15 backdrop-blur-sm hover:bg-white/20 border border-white/25 text-white text-sm font-bold rounded-2xl active:scale-[0.98] transition-transform flex items-center justify-center gap-2"
          >
            <span aria-hidden className="text-base">💬</span>
            <span>{es ? 'Compartir por WhatsApp' : 'Share via WhatsApp'}</span>
          </a>
        </div>

        {/* Escape hatch */}
        <div className="text-center pt-2">
          <Link
            href="/dashboard"
            onClick={onSkip}
            className="text-[13px] text-amber-50/90 hover:text-white underline underline-offset-4"
          >
            {es ? 'Saltar por ahora →' : 'Skip for now →'}
          </Link>
        </div>
      </div>
    </main>
  )
}

// ---------------------------------------------------------------------
// Step card

function StepCard({
  number,
  icon,
  text,
}: {
  number: number
  icon: React.ReactNode
  text: string
}) {
  return (
    <li className="bg-white/15 backdrop-blur-sm border border-white/25 rounded-2xl p-4 flex sm:flex-col items-start sm:items-center gap-3 sm:gap-2 sm:text-center">
      <div className="flex-shrink-0 flex items-center gap-2 sm:flex-col">
        <span className="w-7 h-7 rounded-full bg-white text-orange-700 text-sm font-black flex items-center justify-center">
          {number}
        </span>
        <span className="w-10 h-10 rounded-xl bg-white/20 border border-white/30 flex items-center justify-center text-white">
          {icon}
        </span>
      </div>
      <p className="text-[13px] leading-snug text-amber-50 font-medium">{text}</p>
    </li>
  )
}

// ---------------------------------------------------------------------
// Icons — inline SVG so we stay dependency-free

function IconShare() {
  return (
    <svg width="20" height="20" viewBox="0 0 24 24" fill="none" aria-hidden>
      <path
        d="M12 3v12M12 3l-4 4M12 3l4 4M5 12v6a2 2 0 002 2h10a2 2 0 002-2v-6"
        stroke="currentColor"
        strokeWidth="2.2"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  )
}

function IconPlus() {
  return (
    <svg width="20" height="20" viewBox="0 0 24 24" fill="none" aria-hidden>
      <rect x="3" y="3" width="18" height="18" rx="4" stroke="currentColor" strokeWidth="2.2" />
      <path d="M12 8v8M8 12h8" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" />
    </svg>
  )
}

function IconCheck() {
  return (
    <svg width="20" height="20" viewBox="0 0 24 24" fill="none" aria-hidden>
      <path
        d="M5 12.5l4.5 4.5L19 7"
        stroke="currentColor"
        strokeWidth="2.6"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  )
}

// ---------------------------------------------------------------------
// Animated phone mockup — pure CSS, 5s loop, 3 scenes
//
// Scene 1 (0–33%):  Safari bar with share button pulsing
// Scene 2 (33–66%): Share sheet slides up, "Add to Home Screen" highlighted
// Scene 3 (66–100%):Home screen appears with Cruzar icon dropping in
//
// Everything is Tailwind v4 + inline <style> for the @keyframes. No
// framer-motion dependency (verified not in package.json).

function AnimatedPhoneMockup({ es }: { es: boolean }) {
  return (
    <div className="relative mx-auto w-[220px]">
      {/* local keyframes — scoped via unique classnames */}
      <style jsx>{`
        @keyframes ios-scene {
          0%, 28% { opacity: 1; }
          33%, 100% { opacity: 0; }
        }
        @keyframes ios-scene-2 {
          0%, 28% { opacity: 0; transform: translateY(100%); }
          33%, 61% { opacity: 1; transform: translateY(0); }
          66%, 100% { opacity: 0; transform: translateY(100%); }
        }
        @keyframes ios-scene-3 {
          0%, 61% { opacity: 0; }
          66%, 100% { opacity: 1; }
        }
        @keyframes ios-share-pulse {
          0%, 28% { transform: scale(1); box-shadow: 0 0 0 0 rgba(59,130,246,0.7); }
          14% { transform: scale(1.08); box-shadow: 0 0 0 8px rgba(59,130,246,0); }
          33%, 100% { transform: scale(1); box-shadow: none; }
        }
        @keyframes ios-row-glow {
          0%, 33% { background-color: transparent; }
          42%, 58% { background-color: rgba(59,130,246,0.22); }
          66%, 100% { background-color: transparent; }
        }
        @keyframes ios-icon-drop {
          0%, 66% { opacity: 0; transform: translateY(-24px) scale(0.6); }
          78% { opacity: 1; transform: translateY(6px) scale(1.05); }
          84%, 100% { opacity: 1; transform: translateY(0) scale(1); }
        }
        .ios-anim-scene-1 { animation: ios-scene 5s ease-in-out infinite; }
        .ios-anim-scene-2 { animation: ios-scene-2 5s ease-in-out infinite; }
        .ios-anim-scene-3 { animation: ios-scene-3 5s ease-in-out infinite; }
        .ios-anim-share  { animation: ios-share-pulse 5s ease-in-out infinite; }
        .ios-anim-row    { animation: ios-row-glow 5s ease-in-out infinite; }
        .ios-anim-drop   { animation: ios-icon-drop 5s ease-in-out infinite; }
      `}</style>

      {/* Phone frame */}
      <div className="relative aspect-[9/18] rounded-[36px] bg-gray-900 border-[6px] border-gray-800 shadow-2xl overflow-hidden">
        {/* Notch */}
        <div className="absolute top-0 left-1/2 -translate-x-1/2 w-20 h-5 bg-gray-900 rounded-b-2xl z-30" />

        {/* Screen content */}
        <div className="absolute inset-0 bg-white overflow-hidden">
          {/* Scene 1 — Safari with share button */}
          <div className="ios-anim-scene-1 absolute inset-0 flex flex-col">
            {/* URL bar */}
            <div className="h-6 bg-gray-100 border-b border-gray-200 flex items-center justify-center mt-5">
              <div className="h-3 w-28 rounded-md bg-gray-300 text-[7px] text-gray-700 flex items-center justify-center font-bold">
                cruzar.app
              </div>
            </div>
            {/* Fake page */}
            <div className="flex-1 bg-gradient-to-br from-amber-500 via-orange-600 to-pink-700 p-2 space-y-1">
              <div className="h-2 w-16 bg-white/80 rounded" />
              <div className="h-1.5 w-20 bg-white/60 rounded" />
              <div className="h-6 w-full bg-white/20 rounded mt-2" />
              <div className="h-6 w-full bg-white/20 rounded" />
            </div>
            {/* Safari bottom bar */}
            <div className="h-10 bg-gray-100 border-t border-gray-200 flex items-center justify-around px-2">
              <div className="w-3.5 h-3.5 rounded-full border-2 border-gray-400" />
              <div className="w-3.5 h-3.5 rounded-full border-2 border-gray-400" />
              <div className="ios-anim-share relative w-7 h-7 rounded-md bg-blue-100 border-2 border-blue-500 flex items-center justify-center">
                <svg width="12" height="12" viewBox="0 0 24 24" fill="none" className="text-blue-600">
                  <path
                    d="M12 3v12M12 3l-4 4M12 3l4 4M5 12v6a2 2 0 002 2h10a2 2 0 002-2v-6"
                    stroke="currentColor"
                    strokeWidth="2.5"
                    strokeLinecap="round"
                    strokeLinejoin="round"
                  />
                </svg>
              </div>
              <div className="w-3.5 h-3.5 rounded-full border-2 border-gray-400" />
              <div className="w-3.5 h-3.5 rounded-full border-2 border-gray-400" />
            </div>
          </div>

          {/* Scene 2 — Share sheet */}
          <div className="ios-anim-scene-2 absolute inset-x-0 bottom-0 top-16 bg-gray-50 rounded-t-2xl border-t border-gray-200 px-2 pt-2 flex flex-col gap-1.5 z-20">
            <div className="h-1 w-8 bg-gray-300 rounded mx-auto" />
            {/* App row */}
            <div className="flex items-center gap-1.5 bg-white rounded-lg px-2 py-1 mt-1">
              <div className="w-5 h-5 rounded-md bg-gradient-to-br from-amber-500 to-pink-700" />
              <div className="flex-1">
                <div className="h-1 w-12 bg-gray-700 rounded" />
                <div className="h-1 w-8 bg-gray-400 rounded mt-0.5" />
              </div>
            </div>
            {/* Share targets row */}
            <div className="flex gap-1.5 overflow-hidden">
              <div className="w-8 h-8 rounded-lg bg-green-500 flex-shrink-0" />
              <div className="w-8 h-8 rounded-lg bg-blue-500 flex-shrink-0" />
              <div className="w-8 h-8 rounded-lg bg-sky-400 flex-shrink-0" />
              <div className="w-8 h-8 rounded-lg bg-gray-300 flex-shrink-0" />
            </div>
            {/* Action list */}
            <div className="bg-white rounded-lg overflow-hidden mt-1">
              <div className="flex items-center justify-between px-2 py-1.5 border-b border-gray-100">
                <div className="h-1.5 w-14 bg-gray-500 rounded" />
                <div className="w-3 h-3 rounded border border-gray-400" />
              </div>
              {/* Highlighted "Add to Home Screen" row */}
              <div className="ios-anim-row flex items-center justify-between px-2 py-1.5 border-b border-gray-100">
                <div className="flex items-center gap-1.5">
                  <div className="h-1.5 w-[70px] bg-gray-800 rounded" />
                </div>
                <div className="w-3 h-3 rounded-sm border-2 border-blue-500 flex items-center justify-center">
                  <svg width="7" height="7" viewBox="0 0 24 24" fill="none">
                    <path d="M12 5v14M5 12h14" stroke="#2563eb" strokeWidth="3" strokeLinecap="round" />
                  </svg>
                </div>
              </div>
              <div className="flex items-center justify-between px-2 py-1.5">
                <div className="h-1.5 w-10 bg-gray-500 rounded" />
                <div className="w-3 h-3 rounded border border-gray-400" />
              </div>
            </div>
          </div>

          {/* Scene 3 — home screen */}
          <div className="ios-anim-scene-3 absolute inset-0 bg-gradient-to-b from-indigo-900 via-purple-900 to-pink-900">
            <div className="pt-8 px-3 grid grid-cols-4 gap-2">
              {/* Row 1 — existing apps */}
              <AppIcon color="bg-green-500" />
              <AppIcon color="bg-blue-500" />
              <AppIcon color="bg-red-500" />
              <AppIcon color="bg-yellow-400" />
              {/* Row 2 */}
              <AppIcon color="bg-sky-400" />
              <AppIcon color="bg-orange-500" />
              <AppIcon color="bg-purple-500" />
              <AppIcon color="bg-pink-500" />
              {/* Row 3 — new Cruzar icon drops in */}
              <div className="ios-anim-drop w-8 h-8 rounded-lg bg-gradient-to-br from-amber-500 to-pink-700 flex items-center justify-center text-[8px] font-black text-white shadow-lg">
                C
              </div>
              <AppIcon color="bg-gray-500" />
              <AppIcon color="bg-teal-500" />
              <AppIcon color="bg-rose-500" />
            </div>
          </div>
        </div>
      </div>

      {/* Caption under phone */}
      <p className="text-center text-[11px] text-amber-50/80 mt-2">
        {es ? 'Así se ve en tu iPhone' : 'What it looks like on your iPhone'}
      </p>
    </div>
  )
}

function AppIcon({ color }: { color: string }) {
  return <div className={`w-8 h-8 rounded-lg ${color} opacity-80`} />
}
