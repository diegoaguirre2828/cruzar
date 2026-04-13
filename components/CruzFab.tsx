'use client'

import Link from 'next/link'
import { useLang } from '@/lib/LangContext'

// Floating action button for Cruz (AI chat). Replaces the big card
// that used to eat homepage real estate. Visible on every page that
// renders HomeClient, lives bottom-right above the safe area. Tap
// navigates to /chat with a single example prompt; long-term this
// could open an inline drawer instead.
export function CruzFab() {
  const { lang } = useLang()
  const es = lang === 'es'

  return (
    <Link
      href="/chat"
      aria-label={es ? 'Preguntar a Cruz' : 'Ask Cruz'}
      className="fixed z-40 right-4 bottom-4 flex items-center gap-2 bg-gradient-to-br from-indigo-600 via-purple-700 to-pink-700 text-white rounded-full pl-3 pr-4 py-3 shadow-2xl active:scale-95 transition-transform cruzar-shimmer"
      style={{ bottom: 'calc(1rem + env(safe-area-inset-bottom))' }}
    >
      <span className="flex-shrink-0 w-8 h-8 rounded-full bg-white text-indigo-700 font-black text-lg flex items-center justify-center shadow-inner">
        C
      </span>
      <span className="text-xs font-black leading-none whitespace-nowrap">
        {es ? 'Pregúntale a Cruz' : 'Ask Cruz'}
      </span>
    </Link>
  )
}
