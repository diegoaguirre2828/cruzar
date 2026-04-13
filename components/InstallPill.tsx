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

export function InstallPill() {
  const { lang } = useLang()
  const es = lang === 'es'
  const [show, setShow] = useState(false)

  useEffect(() => {
    if (typeof window === 'undefined') return
    const standalone =
      window.matchMedia('(display-mode: standalone)').matches ||
      (navigator as Navigator & { standalone?: boolean }).standalone === true
    setShow(!standalone)
  }, [])

  if (!show) return null

  return (
    <Link
      href="/mas"
      className="inline-flex items-center gap-1.5 bg-gradient-to-r from-blue-600 to-indigo-700 text-white rounded-full pl-2 pr-3 py-1.5 shadow-sm active:scale-[0.97] transition-transform"
    >
      <span className="text-base leading-none">📲</span>
      <span className="text-[11px] font-black whitespace-nowrap">
        {es ? 'Instalar · 3 meses Pro' : 'Install · 3 months Pro'}
      </span>
    </Link>
  )
}
