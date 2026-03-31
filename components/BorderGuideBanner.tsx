'use client'

import Link from 'next/link'
import { useLang } from '@/lib/LangContext'

export function BorderGuideBanner() {
  const { lang } = useLang()

  const t = {
    title:    lang === 'es' ? '🌉 Guía Fronteriza'               : '🌉 Border Guide',
    subtitle: lang === 'es' ? 'Cruza con confianza — sin sorpresas.' : 'Cross with confidence — no surprises.',
    checklist: lang === 'es' ? '✅ Lista de cruce'  : '✅ Checklist',
    insurance: lang === 'es' ? '🛡️ Seguro MX'      : '🛡️ MX Insurance',
    services:  lang === 'es' ? '🔧 Servicios en MX' : '🔧 MX Services',
    all:       lang === 'es' ? 'Ver todo →'          : 'See all →',
  }

  return (
    <div className="bg-gradient-to-r from-teal-500 to-cyan-600 dark:from-teal-700 dark:to-cyan-800 rounded-2xl p-4 mb-4 shadow-md">
      {/* Header row */}
      <div className="flex items-center justify-between mb-3">
        <div>
          <p className="text-sm font-bold text-white">{t.title}</p>
          <p className="text-xs text-teal-100">{t.subtitle}</p>
        </div>
        <Link href="/guide" className="text-xs font-semibold text-white bg-white/20 hover:bg-white/30 px-2.5 py-1 rounded-lg transition-colors flex-shrink-0 ml-3">
          {t.all}
        </Link>
      </div>

      {/* Quick-access buttons */}
      <div className="grid grid-cols-3 gap-2">
        <Link href="/customs" className="flex flex-col items-center bg-white/15 hover:bg-white/25 rounded-xl py-2.5 px-1 transition-colors">
          <span className="text-lg mb-0.5">✅</span>
          <span className="text-xs font-semibold text-white text-center leading-tight">
            {lang === 'es' ? 'Lista de cruce' : 'Checklist'}
          </span>
        </Link>
        <Link href="/insurance" className="flex flex-col items-center bg-white/15 hover:bg-white/25 rounded-xl py-2.5 px-1 transition-colors">
          <span className="text-lg mb-0.5">🛡️</span>
          <span className="text-xs font-semibold text-white text-center leading-tight">
            {lang === 'es' ? 'Seguro MX' : 'MX Insurance'}
          </span>
        </Link>
        <Link href="/services" className="flex flex-col items-center bg-white/15 hover:bg-white/25 rounded-xl py-2.5 px-1 transition-colors">
          <span className="text-lg mb-0.5">🔧</span>
          <span className="text-xs font-semibold text-white text-center leading-tight">
            {lang === 'es' ? 'Servicios MX' : 'MX Services'}
          </span>
        </Link>
      </div>
    </div>
  )
}
