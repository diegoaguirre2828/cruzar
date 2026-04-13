'use client'

import Link from 'next/link'
import { usePathname } from 'next/navigation'
import { useLang } from '@/lib/LangContext'

// Phase 2 bottom nav. Five fixed tabs: Home / Mapa / Datos (Pro) /
// Guardián / Más. Previously was Crossings / Negocios / Help / Me
// which stacked everything on the home page and had no dedicated
// home for the map, analytics, or community leaderboard.

// Only hidden on tight flows where the user needs to commit to a
// step — login, signup, welcome, driver check-in, admin.
const HIDDEN_PATHS = [
  '/login',
  '/signup',
  '/welcome',
  '/reset-password',
  '/driver',
  '/checkin',
  '/admin',
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
      label: es ? 'Mapa' : 'Map',
      active: isActive('/mapa'),
      icon: (active: boolean) => (
        <svg viewBox="0 0 24 24" fill="none" className="w-5 h-5" stroke="currentColor" strokeWidth={active ? 2.5 : 2}>
          <path strokeLinecap="round" strokeLinejoin="round" d="M9 20l-5.447-2.724A1 1 0 013 16.382V5.618a1 1 0 011.447-.894L9 7m0 13l6-3m-6 3V7m6 10l4.553 2.276A1 1 0 0021 18.382V7.618a1 1 0 00-.553-.894L15 4m0 13V4m0 0L9 7" />
        </svg>
      ),
    },
    {
      href: '/datos',
      label: es ? 'Datos' : 'Insights',
      active: isActive('/datos'),
      icon: (active: boolean) => (
        <svg viewBox="0 0 24 24" fill="none" className="w-5 h-5" stroke="currentColor" strokeWidth={active ? 2.5 : 2}>
          <path strokeLinecap="round" strokeLinejoin="round" d="M9 19V9m0 10l6-4m-6 4l-6-4m6-6l6 4m-6-4L3 9m6 0v10m6-6V5m0 8l6 4m-6-4L9 13" />
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
