'use client'

import Link from 'next/link'
import { useState, useEffect } from 'react'
import { useAuth } from '@/lib/useAuth'
import { useLang } from '@/lib/LangContext'
import { useTheme } from '@/lib/ThemeContext'
import { User, Moon, Sun, Trophy, Gift, Building2 } from 'lucide-react'

export function NavBar() {
  const { user, loading } = useAuth()
  const { lang, t, toggle } = useLang()
  const { theme, toggle: toggleTheme } = useTheme()
  const [tier, setTier] = useState<string>('')

  useEffect(() => {
    if (user) {
      fetch('/api/profile').then(r => r.json()).then(d => setTier(d.profile?.tier || 'free'))
    }
  }, [user])

  if (loading) return null

  const isBusiness = tier === 'business'
  const isPro = tier === 'pro' || isBusiness

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

      <Link href="/leaderboard" className="p-1.5 rounded-lg text-gray-500 hover:text-gray-800 hover:bg-gray-100 dark:text-gray-400 dark:hover:text-gray-200 dark:hover:bg-gray-800 transition-colors" title="Leaderboard">
        <Trophy className="w-3.5 h-3.5" />
      </Link>

      <Link href="/rewards" className="p-1.5 rounded-lg text-purple-500 hover:text-purple-700 hover:bg-purple-50 dark:text-purple-400 dark:hover:bg-purple-900/20 transition-colors" title={lang === 'es' ? 'Recompensas' : 'Rewards'}>
        <Gift className="w-3.5 h-3.5" />
      </Link>

      {/* Business shortcut — very visible */}
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

      {!isBusiness && (
        <Link href="/advertise" className="text-xs font-medium text-amber-600 hover:text-amber-700 dark:text-amber-400 dark:hover:text-amber-300 transition-colors">
          {t.localBusiness}
        </Link>
      )}

      {user ? (
        <Link
          href={isBusiness ? '/business' : '/dashboard'}
          className={`flex items-center gap-1 text-xs font-medium text-white px-3 py-1.5 rounded-xl transition-colors ${
            isBusiness
              ? 'bg-blue-600 hover:bg-blue-700'
              : isPro
              ? 'bg-purple-600 hover:bg-purple-700'
              : 'bg-gray-900 hover:bg-gray-700 dark:bg-gray-700 dark:hover:bg-gray-600'
          }`}
        >
          <User className="w-3 h-3" />
          {isBusiness ? (lang === 'es' ? 'Empresa' : 'Business') : isPro ? 'Pro' : t.me}
        </Link>
      ) : (
        <Link
          href="/signup"
          className="text-xs font-medium text-white bg-gray-900 px-3 py-1.5 rounded-xl hover:bg-gray-700 dark:bg-gray-700 dark:hover:bg-gray-600 transition-colors"
        >
          {t.signUpFree}
        </Link>
      )}
    </div>
  )
}
