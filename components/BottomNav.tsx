'use client'

import Link from 'next/link'
import { usePathname } from 'next/navigation'
import { useLang } from '@/lib/LangContext'

// Phase 2 bottom nav. Five fixed tabs: Home / Mapa / Datos (Pro) /
// Guardián / Más. Previously was Crossings / Negocios / Help / Me
// which stacked everything on the home page and had no dedicated
// home for the map, analytics, or community leaderboard.

// Only hidden on tight flows where the user needs to commit to a
// step — login, signup, welcome, driver check-in, admin — and on
// /chat, where the fixed input at the bottom of the screen was
// getting covered by the nav bar.
const HIDDEN_PATHS = [
  '/login',
  '/signup',
  '/welcome',
  '/reset-password',
  '/driver',
  '/checkin',
  '/admin',
  '/chat',
  '/ios-install',
]

export function BottomNav() {
  const pathname = usePathname()
  const { lang } = useLang()
  const es = lang === 'es'

  if (HIDDEN_PATHS.some(p => pathname === p || pathname.startsWith(p + '/'))) return null

  const isActive = (href: string, exact = false) =>
    exact ? pathname === href : pathname === href || pathname.startsWith(href + '/')

  const tabs = [
    {
      href: '/',
      label: es ? 'Inicio' : 'Home',
      active: isActive('/', true),
      icon: (active: boolean) => (
        <svg viewBox="0 0 24 24" fill="none" className="w-5 h-5" stroke="currentColor" strokeWidth={active ? 2.5 : 2}>
          <path strokeLinecap="round" strokeLinejoin="round" d="M3 12l9-9 9 9M5 10v10a1 1 0 001 1h4v-6h4v6h4a1 1 0 001-1V10" />
        </svg>
      ),
    },
    {
      href: '/mapa',
      label: es ? 'Todos' : 'All bridges',
      active: isActive('/mapa'),
      icon: (active: boolean) => (
        <svg viewBox="0 0 24 24" fill="none" className="w-5 h-5" stroke="currentColor" strokeWidth={active ? 2.5 : 2}>
          <path strokeLinecap="round" strokeLinejoin="round" d="M4 6h16M4 12h16M4 18h16" />
        </svg>
      ),
    },
    {
      href: '/camaras',
      label: es ? 'Pro' : 'Pro',
      active: isActive('/camaras') || isActive('/datos'),
      icon: (active: boolean) => (
        <svg viewBox="0 0 24 24" fill="none" className="w-5 h-5" stroke="currentColor" strokeWidth={active ? 2.5 : 2}>
          <path strokeLinecap="round" strokeLinejoin="round" d="M15 10l4.553-2.276A1 1 0 0121 8.618v6.764a1 1 0 01-1.447.894L15 14M5 18h8a2 2 0 002-2V8a2 2 0 00-2-2H5a2 2 0 00-2 2v8a2 2 0 002 2z" />
        </svg>
      ),
      proBadge: true,
    },
    {
      href: '/leaderboard',
      label: es ? 'Guardián' : 'Guardian',
      active: isActive('/leaderboard') || isActive('/guardian'),
      icon: (active: boolean) => (
        <svg viewBox="0 0 24 24" fill="none" className="w-5 h-5" stroke="currentColor" strokeWidth={active ? 2.5 : 2}>
          <path strokeLinecap="round" strokeLinejoin="round" d="M12 2l3 6 6 1-4.5 4.5 1 6.5-5.5-3-5.5 3 1-6.5L3 9l6-1 3-6z" />
        </svg>
      ),
    },
    {
      href: '/mas',
      label: es ? 'Más' : 'More',
      active: isActive('/mas') || isActive('/account') || isActive('/dashboard') || isActive('/negocios'),
      icon: (active: boolean) => (
        <svg viewBox="0 0 24 24" fill="none" className="w-5 h-5" stroke="currentColor" strokeWidth={active ? 2.5 : 2}>
          <circle cx="5" cy="12" r="1.5" fill="currentColor" />
          <circle cx="12" cy="12" r="1.5" fill="currentColor" />
          <circle cx="19" cy="12" r="1.5" fill="currentColor" />
        </svg>
      ),
    },
  ]

  return (
    <nav
      className="md:hidden fixed bottom-0 left-0 right-0 z-50 bg-white/95 dark:bg-gray-900/95 backdrop-blur-md border-t border-gray-200 dark:border-gray-800"
      style={{ paddingBottom: 'env(safe-area-inset-bottom)' }}
    >
      <div className="flex items-stretch">
        {tabs.map(tab => (
          <Link
            key={tab.href}
            href={tab.href}
            className={`flex-1 flex flex-col items-center justify-center gap-1 py-2.5 transition-colors relative ${
              tab.active
                ? 'text-blue-600 dark:text-blue-400'
                : 'text-gray-400 dark:text-gray-500 hover:text-gray-600 dark:hover:text-gray-300'
            }`}
          >
            {tab.icon(tab.active)}
            <span className={`text-[10px] leading-none ${tab.active ? 'font-black' : 'font-semibold'}`}>
              {tab.label}
            </span>
            {tab.proBadge && (
              <span className="absolute top-1 right-1/2 translate-x-5 bg-gradient-to-br from-amber-400 to-orange-500 text-white text-[8px] font-black px-1 py-0.5 rounded-full leading-none">
                PRO
              </span>
            )}
          </Link>
        ))}
      </div>
    </nav>
  )
}
