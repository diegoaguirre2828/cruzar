'use client'

import { createContext, useContext, useState, useEffect } from 'react'
import { translations, type Lang, type T } from './lang'

interface LangCtx { lang: Lang; t: T; toggle: () => void }

const Ctx = createContext<LangCtx>({ lang: 'en', t: translations.en, toggle: () => {} })

export function LangProvider({ children }: { children: React.ReactNode }) {
  const [lang, setLang] = useState<Lang>('es')

  useEffect(() => {
    const saved = localStorage.getItem('cruzar_lang') as Lang | null
    if (saved === 'es' || saved === 'en') {
      setLang(saved)
    } else {
      // Default to Spanish — primary audience is border crossers who speak Spanish
      // Only switch to English if browser is explicitly set to English (not Spanish or anything else)
      const browserLang = navigator.language || (navigator.languages?.[0] ?? 'es')
      if (browserLang.toLowerCase().startsWith('en')) {
        setLang('en')
      } else {
        setLang('es')
      }
    }
  }, [])

  function toggle() {
    const next: Lang = lang === 'en' ? 'es' : 'en'
    setLang(next)
    localStorage.setItem('cruzar_lang', next)
  }

  return <Ctx.Provider value={{ lang, t: translations[lang], toggle }}>{children}</Ctx.Provider>
}

export function useLang() {
  return useContext(Ctx)
}
