'use client'

import Link from 'next/link'
import { useState, useEffect } from 'react'
import { useAuth } from '@/lib/useAuth'
import { useLang } from '@/lib/LangContext'
import { useTheme } from '@/lib/ThemeContext'
import { Settings, Moon, Sun, Building2, MessageCircle } from 'lucide-react'

export function NavBar() {
  const { user, loading } = useAuth()
  const { lang, toggle } = useLang()
  const { theme, toggle: toggleTheme } = useTheme()
  const [tier, setTier] = useState<string>('')
  const [points, setPoints] = useState<number>(0)

  useEffect(() => {
    if (user) {
      fetch('/api/profile').then(r => r.json()).then(d => {
        setTier(d.profile?.tier || 'free')
        setPoints(d.profile?.points || 0)
      })
    }
  }, [user])

  if (loading) return null

  const isBusiness = tier === 'business'

  return (
    <div className="flex items-center gap-2 mt-1 flex-wrap justify-end">
      <button
        onClick={toggleTheme}
        className="p-1.5 rounded-lg text-gray-500 hover:text-gray-800 hover:bg-gray-100 dark:text-gray-400 dark:hover:text-gray-200 dark:hover:bg-gray-800 transition-colors"
        aria-label="Toggle dark mode"
      >
        {theme === 'dark' ? <Sun className="w-3.5 h-3.5" /> : <Moon className="w-3.5 h-3.5" />}
      </button>

      <button
        onClick={toggle}
        className="text-xs font-semibold text-gray-500 hover:text-gray-800 dark:text-gray-400 dark:hover:text-gray-200 transition-colors px-2 py-1 rounded-lg hover:bg-gray-100 dark:hover:bg-gray-800"
      >
        {lang === 'en' ? 'ES' : 'EN'}
      </button>

      <Link
        href="/chat"
        className="hidden md:flex items-center gap-1 text-xs font-semibold text-gray-600 dark:text-gray-300 hover:text-gray-900 dark:hover:text-gray-100 px-2.5 py-1.5 rounded-xl hover:bg-gray-100 dark:hover:bg-gray-800 transition-colors"
        title={lang === 'es' ? 'Asistente Fronterizo' : 'Border Assistant'}
      >
        <MessageCircle className="w-3.5 h-3.5" />
        {lang === 'es' ? 'Ayuda' : 'Help'}
      </Link>

      {isBusiness && (
        <Link
          href="/business"
          className="flex items-center gap-1 text-xs font-bold text-white bg-blue-600 hover:bg-blue-700 px-2.5 py-1.5 rounded-xl transition-colors"
          title="Business Portal"
        >
          <Building2 className="w-3 h-3" />
          <span className="hidden sm:inline">Business</span>
        </Link>
      )}

      {user ? (
        <>
          {points > 0 && (
            <Link
              href="/leaderboard"
              className="flex items-center gap-1 text-xs font-bold text-yellow-300 bg-gray-900 hover:bg-gray-700 dark:bg-gray-700 dark:hover:bg-gray-600 px-3 py-1.5 rounded-xl transition-colors"
              title="Points & Leaderboard"
            >
              🏆 {points} pts
            </Link>
          )}
          <Link
            href="/account"
            className="flex items-center p-1.5 text-white bg-gray-900 hover:bg-gray-700 dark:bg-gray-700 dark:hover:bg-gray-600 rounded-xl transition-colors"
            title="Settings"
          >
            <Settings className="w-3.5 h-3.5" />
          </Link>
        </>
      ) : (
        <Link
          href="/signup"
          className="text-xs font-medium text-white bg-gray-900 px-3 py-1.5 rounded-xl hover:bg-gray-700 dark:bg-gray-700 dark:hover:bg-gray-600 transition-colors"
        >
          {lang === 'es' ? 'Entrar' : 'Sign in'}
        </Link>
      )}
    </div>
  )
}
