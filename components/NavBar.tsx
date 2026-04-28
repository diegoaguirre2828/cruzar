'use client'

import Link from 'next/link'
import { useState, useEffect } from 'react'
import { useAuth } from '@/lib/useAuth'
import { useLang } from '@/lib/LangContext'
import { useTheme } from '@/lib/ThemeContext'
import { fetchWithTimeout } from '@/lib/fetchWithTimeout'
import { getTitle, getTitleColor } from '@/lib/titles'
import { LayoutDashboard, Moon, Sun, Building2, MessageCircle } from 'lucide-react'

export function NavBar() {
  const { user, loading } = useAuth()
  const { lang, toggle } = useLang()
  const { theme, toggle: toggleTheme } = useTheme()
  const [tier, setTier] = useState<string>('')
  const [reportsCount, setReportsCount] = useState<number>(0)
  const [sharesCount, setSharesCount] = useState<number>(0)

  useEffect(() => {
    if (user) {
      fetchWithTimeout('/api/profile', {}, 5000)
        .then(r => r.json())
        .then(d => {
          setTier(d.profile?.tier || 'free')
          setReportsCount(d.profile?.reports_count || 0)
          setSharesCount(d.profile?.share_count || 0)
        })
        .catch(() => { /* silent — profile chip just won't render */ })
    }
  }, [user])

  if (loading) return null

  const isBusiness = tier === 'business'

  return (
    <div className="flex items-center gap-2 mt-1 flex-wrap justify-end">
      <button
        onClick={toggleTheme}
        className="cruzar-press-sm p-2 rounded-lg text-gray-500 bg-gray-100 hover:text-gray-800 dark:text-gray-300 dark:bg-gray-800 dark:hover:text-gray-100"
        aria-label="Toggle dark mode"
      >
        {theme === 'dark' ? <Sun className="w-3.5 h-3.5" /> : <Moon className="w-3.5 h-3.5" />}
      </button>

      <button
        onClick={toggle}
        className="cruzar-press-sm text-xs font-bold text-gray-600 bg-gray-100 hover:text-gray-900 dark:text-gray-300 dark:bg-gray-800 dark:hover:text-gray-100 px-2.5 py-1.5 rounded-lg"
      >
        {lang === 'en' ? 'ES' : 'EN'}
      </button>

      <Link
        href="/guide"
        className="hidden md:flex items-center gap-1 text-xs font-semibold text-gray-600 dark:text-gray-300 hover:text-gray-900 dark:hover:text-gray-100 px-2.5 py-1.5 rounded-xl hover:bg-gray-100 dark:hover:bg-gray-800 transition-colors"
        title={lang === 'es' ? 'Guía del cruzante' : 'Crosser\'s guide'}
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
          {(() => {
            if (reportsCount === 0 && sharesCount === 0) return null
            const title = getTitle(reportsCount, sharesCount)
            const titleLabel = title ? (lang === 'es' ? title.es : title.en) : null
            const titleColor = getTitleColor(title)
            return (
              <Link
                href="/dashboard"
                className="flex items-center gap-2 text-[11px] font-semibold text-gray-700 dark:text-gray-200 bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 hover:border-gray-400 px-2.5 py-1.5 rounded-xl transition-colors"
                title={lang === 'es' ? 'Tu actividad en Cruzar' : 'Your Cruzar activity'}
              >
                {titleLabel && (
                  <>
                    <span className={`font-bold ${titleColor}`}>{titleLabel}</span>
                    <span className="w-px h-3 bg-gray-300 dark:bg-gray-600" aria-hidden />
                  </>
                )}
                <span className="flex items-center gap-1">
                  <span className="text-gray-400">{lang === 'es' ? 'Reportes' : 'Reports'}</span>
                  <span className="font-bold text-gray-900 dark:text-gray-100 tabular-nums">{reportsCount}</span>
                </span>
                <span className="w-px h-3 bg-gray-300 dark:bg-gray-600" aria-hidden />
                <span className="flex items-center gap-1">
                  <span className="text-gray-400">{lang === 'es' ? 'Compartidos' : 'Shares'}</span>
                  <span className="font-bold text-gray-900 dark:text-gray-100 tabular-nums">{sharesCount}</span>
                </span>
              </Link>
            )
          })()}
          <Link
            href="/dashboard"
            className="cruzar-press-sm flex items-center p-2 text-white bg-gray-900 hover:bg-gray-700 dark:bg-gray-700 dark:hover:bg-gray-600 rounded-xl"
            title={lang === 'es' ? 'Mi panel' : 'My dashboard'}
            aria-label={lang === 'es' ? 'Mi panel' : 'My dashboard'}
          >
            <LayoutDashboard className="w-3.5 h-3.5" />
          </Link>
        </>
      ) : (
        <Link
          href="/signup"
          className="cruzar-press-sm text-xs font-medium text-white bg-gray-900 px-3 py-1.5 rounded-xl hover:bg-gray-700 dark:bg-gray-700 dark:hover:bg-gray-600"
        >
          {lang === 'es' ? 'Entrar' : 'Sign in'}
        </Link>
      )}
    </div>
  )
}
