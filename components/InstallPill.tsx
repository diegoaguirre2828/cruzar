'use client'

import { useEffect, useState } from 'react'
import Link from 'next/link'
import { useLang } from '@/lib/LangContext'

// Compact install CTA pill for the home header row. Shown whenever
// the app is NOT running as an installed PWA. Replaces the bottom-
// corner InstallPrompt modal we removed in Phase 1 — that was too
// easy to dismiss and most guests never signed up (so /welcome
// step 2 never fired for them), which killed install conversions.
//
// This pill is calm: single line, no modal, just a persistent
// reminder that tapping gets them the Pro bonus. Taps route to
// /mas where the full InstallGuide lives.

// How many days to hide the pill after the user explicitly dismisses
// it. Long enough that returning users aren't pestered every open,
// short enough that we catch high-intent visits (e.g. users who come
// back during a border incident). localStorage, not server — a
// dismiss on one device doesn't affect another, which is fine.
const DISMISS_DAYS = 7
const DISMISS_KEY = 'cruzar_install_pill_dismissed_at'

export function InstallPill() {
  const { lang } = useLang()
  const es = lang === 'es'
  const [show, setShow] = useState(false)

  useEffect(() => {
    if (typeof window === 'undefined') return
    const standalone =
      window.matchMedia('(display-mode: standalone)').matches ||
      (navigator as Navigator & { standalone?: boolean }).standalone === true
    if (standalone) {
      setShow(false)
      return
    }
    try {
      const dismissedAt = localStorage.getItem(DISMISS_KEY)
      if (dismissedAt) {
        const ageDays = (Date.now() - parseInt(dismissedAt, 10)) / (1000 * 60 * 60 * 24)
        if (ageDays < DISMISS_DAYS) {
          setShow(false)
          return
        }
      }
    } catch { /* ignore */ }
    setShow(true)
  }, [])

  function handleDismiss(e: React.MouseEvent) {
    e.preventDefault()
    e.stopPropagation()
    try { localStorage.setItem(DISMISS_KEY, String(Date.now())) } catch {}
    setShow(false)
  }

  if (!show) return null

  return (
    <Link
      href="/mas"
      className="inline-flex items-center gap-1.5 bg-gradient-to-r from-blue-600 to-indigo-700 text-white rounded-full pl-2 pr-1.5 py-1.5 shadow-sm active:scale-[0.97] transition-transform"
    >
      <span className="text-base leading-none">📲</span>
      <span className="text-[11px] font-black whitespace-nowrap">
        {es ? 'Agregar a inicio · 3 meses Pro' : 'Add to Home Screen · 3mo Pro'}
      </span>
      <button
        type="button"
        onClick={handleDismiss}
        aria-label={es ? 'Cerrar' : 'Dismiss'}
        className="ml-0.5 flex items-center justify-center w-4 h-4 rounded-full text-white/70 hover:text-white hover:bg-white/10 text-[13px] leading-none"
      >
        ×
      </button>
    </Link>
  )
}
