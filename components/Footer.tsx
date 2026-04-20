'use client'

import Link from 'next/link'
import { useLang } from '@/lib/LangContext'

// Footer renders on every page via app/layout.tsx. It was previously
// English-only; since every other top-level chrome element (BottomNav,
// NavBar, hero copy) switches on useLang, the English footer stuck out
// on a phone set to Spanish. Retrofitted to bilingual.

export function Footer() {
  const { lang } = useLang()
  const es = lang === 'es'

  return (
    <footer className="hidden sm:block border-t border-gray-200 dark:border-gray-800 bg-white dark:bg-gray-950 mt-auto">
      <div className="max-w-5xl mx-auto px-4 py-6 flex flex-col sm:flex-row items-center justify-between gap-4 text-xs text-gray-400 dark:text-gray-500">
        <div className="flex items-center gap-1">
          <span>🌉</span>
          <span className="font-medium text-gray-600 dark:text-gray-300">Cruzar</span>
          <span className="ml-1">
            {es
              ? '— Tiempos de espera en vivo US-México'
              : '— Live US-Mexico border wait times'}
          </span>
        </div>
        <div className="flex items-center gap-4 flex-wrap justify-center">
          <Link href="/camaras" className="hover:text-gray-700 dark:hover:text-gray-300 transition-colors">
            {es ? 'Cámaras' : 'Cameras'}
          </Link>
          <Link href="/terms" className="hover:text-gray-700 dark:hover:text-gray-300 transition-colors">
            {es ? 'Términos' : 'Terms'}
          </Link>
          <Link href="/privacy" className="hover:text-gray-700 dark:hover:text-gray-300 transition-colors">
            {es ? 'Privacidad' : 'Privacy'}
          </Link>
          <Link href="/advertise" className="hover:text-gray-700 dark:hover:text-gray-300 transition-colors">
            {es ? 'Anunciar' : 'Advertise'}
          </Link>
          <Link href="/widget" className="hover:text-gray-700 dark:hover:text-gray-300 transition-colors">
            Widget
          </Link>
          <Link href="/pricing" className="hover:text-gray-700 dark:hover:text-gray-300 transition-colors">
            {es ? 'Precios' : 'Pricing'}
          </Link>
          <a href="mailto:hello@cruzar.app" className="hover:text-gray-700 dark:hover:text-gray-300 transition-colors">
            {es ? 'Contacto' : 'Contact'}
          </a>
        </div>
        <p>
          © {new Date().getFullYear()} Cruzar.{' '}
          {es
            ? 'No afiliado con CBP.'
            : 'Not affiliated with CBP.'}
        </p>
      </div>
    </footer>
  )
}
