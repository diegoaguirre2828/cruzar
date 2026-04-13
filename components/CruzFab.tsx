'use client'

import Link from 'next/link'
import { usePathname } from 'next/navigation'
import { useLang } from '@/lib/LangContext'

// Floating action button for Cruz (AI chat). Rendered globally in
// app/layout.tsx so it floats on every tab — Home, Mapa, Datos,
// Guardián, Más. Sits above the bottom nav with extra bottom
// offset so it doesn't collide with the tab bar.

// Hide on entry flows + on /chat itself (where it'd be redundant).
const HIDDEN_PATHS = ['/login', '/signup', '/welcome', '/chat', '/driver', '/checkin', '/admin', '/business']

export function CruzFab() {
  const { lang } = useLang()
  const pathname = usePathname()
  const es = lang === 'es'

  if (HIDDEN_PATHS.some(p => pathname === p || pathname.startsWith(p + '/'))) return null

  return (
    <Link
      href="/chat"
      aria-label={es ? 'Preguntar a Cruz' : 'Ask Cruz'}
      className="fixed z-40 right-4 flex items-center gap-2 bg-gradient-to-br from-indigo-600 via-purple-700 to-pink-700 text-white rounded-full pl-3 pr-4 py-3 shadow-2xl active:scale-95 transition-transform cruzar-shimmer md:hidden"
      style={{ bottom: 'calc(4.5rem + env(safe-area-inset-bottom))' }}
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
