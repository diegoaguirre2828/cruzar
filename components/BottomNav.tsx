'use client'

import Link from 'next/link'
import { usePathname } from 'next/navigation'
import { useState, useEffect } from 'react'
import { useLang } from '@/lib/LangContext'
import { useAuth } from '@/lib/useAuth'

// Pages where the bottom nav should not appear
const HIDDEN_PATHS = ['/login', '/signup', '/dashboard', '/account', '/business', '/advertise', '/admin', '/driver']

export function BottomNav() {
  const pathname = usePathname()
  const { lang } = useLang()
  const { user } = useAuth()
  const [points, setPoints] = useState<number>(0)

  useEffect(() => {
    if (user) {
      fetch('/api/profile').then(r => r.json()).then(d => setPoints(d.profile?.points || 0))
    }
  }, [user])

  if (HIDDEN_PATHS.some(p => pathname === p || pathname.startsWith(p + '/'))) return null

  const tabs = [
    {
      href: '/',
      label: lang === 'es' ? 'Cruces' : 'Crossings',
      icon: (active: boolean) => (
        <svg viewBox="0 0 24 24" fill="none" className="w-5 h-5" stroke="currentColor" strokeWidth={active ? 2.5 : 2}>
          <path strokeLinecap="round" strokeLinejoin="round" d="M3 7h4l2 10h6l2-10h4M3 7l9-4 9 4M12 3v4" />
        </svg>
      ),
      active: pathname === '/',
    },
    {
      href: '/negocios',
      label: 'Negocios',
      icon: (active: boolean) => (
        <svg viewBox="0 0 24 24" fill="none" className="w-5 h-5" stroke="currentColor" strokeWidth={active ? 2.5 : 2}>
          <path strokeLinecap="round" strokeLinejoin="round" d="M3 9l9-7 9 7v11a2 2 0 01-2 2H5a2 2 0 01-2-2V9z" />
          <path strokeLinecap="round" strokeLinejoin="round" d="M9 22V12h6v10" />
        </svg>
      ),
      active: pathname === '/negocios' || pathname.startsWith('/negocios'),
    },
    {
      href: '/chat',
      label: lang === 'es' ? 'Ayuda' : 'Help',
      icon: (active: boolean) => (
        <svg viewBox="0 0 24 24" fill="none" className="w-5 h-5" stroke="currentColor" strokeWidth={active ? 2.5 : 2}>
          <path strokeLinecap="round" strokeLinejoin="round" d="M8 12h.01M12 12h.01M16 12h.01M21 12c0 4.418-4.03 8-9 8a9.863 9.863 0 01-4.255-.949L3 20l1.395-3.72C3.512 15.042 3 13.574 3 12c0-4.418 4.03-8 9-8s9 3.582 9 8z" />
        </svg>
      ),
      active: pathname === '/chat',
    },
    {
      href: user ? '/dashboard' : '/signup',
      label: lang === 'es' ? 'Yo' : 'Me',
      icon: (active: boolean) => (
        <span className="relative">
          <svg viewBox="0 0 24 24" fill="none" className="w-5 h-5" stroke="currentColor" strokeWidth={active ? 2.5 : 2}>
            <path strokeLinecap="round" strokeLinejoin="round" d="M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z" />
          </svg>
          {user && points > 0 && (
            <span className="absolute -top-1.5 -right-2.5 bg-yellow-400 text-gray-900 text-[9px] font-bold leading-none px-1 py-0.5 rounded-full min-w-[16px] text-center">
              {points > 999 ? '999+' : points}
            </span>
          )}
        </span>
      ),
      active: pathname === '/dashboard' || pathname === '/account',
    },
  ]

  return (
    <nav className="md:hidden fixed bottom-0 left-0 right-0 z-50 bg-white dark:bg-gray-900 border-t border-gray-200 dark:border-gray-800"
      style={{ paddingBottom: 'env(safe-area-inset-bottom)' }}>
      <div className="flex items-stretch">
        {tabs.map(tab => (
          <Link
            key={tab.href}
            href={tab.href}
            className={`flex-1 flex flex-col items-center justify-center gap-1 py-2.5 transition-colors ${
              tab.active
                ? 'text-blue-600 dark:text-blue-400'
                : 'text-gray-400 dark:text-gray-500 hover:text-gray-600 dark:hover:text-gray-300'
            }`}
          >
            {tab.icon(tab.active)}
            <span className={`text-[10px] font-medium leading-none ${tab.active ? 'font-semibold' : ''}`}>
              {tab.label}
            </span>
          </Link>
        ))}
      </div>
    </nav>
  )
}
