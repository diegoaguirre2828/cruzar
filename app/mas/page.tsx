'use client'

import { useEffect, useState } from 'react'
import Link from 'next/link'
import { useRouter } from 'next/navigation'
import { createClient } from '@/lib/auth'
import { useAuth } from '@/lib/useAuth'
import { useLang } from '@/lib/LangContext'
import { useTier } from '@/lib/useTier'
import { InstallGuide } from '@/components/InstallGuide'

// "Más" tab — the settings / everything-else hub. Previously these
// destinations (account, negocios, pricing, guía, etc.) were scattered
// across the top NavBar and hidden in HomeClient. Now they all live
// in one tab so the Home page can stay focused on the port list.
//
// Most important addition: if the user has NOT installed the PWA,
// the top of this page is a prominent install card. Phase 1 removed
// the landing-page install banner which killed install conversions —
// this re-surfaces it in a calm, non-modal spot the user will see
// whenever they open "Más" to get to their account / settings.

interface MenuItem {
  href: string
  emoji: string
  labelEs: string
  labelEn: string
  subEs?: string
  subEn?: string
  external?: boolean
}

const ACCOUNT_ITEMS: MenuItem[] = [
  { href: '/dashboard', emoji: '🏠', labelEs: 'Mi panel', labelEn: 'My dashboard', subEs: 'Alertas · favoritos · progreso', subEn: 'Alerts · saved · progress' },
  { href: '/account', emoji: '⚙️', labelEs: 'Cuenta', labelEn: 'Account', subEs: 'Perfil y configuración', subEn: 'Profile & settings' },
  { href: '/pricing', emoji: '⭐', labelEs: 'Planes', labelEn: 'Plans', subEs: 'Free · Pro · Business', subEn: 'Free · Pro · Business' },
]

const EXPLORE_ITEMS: MenuItem[] = [
  { href: '/negocios', emoji: '🏪', labelEs: 'Negocios locales', labelEn: 'Local businesses', subEs: 'Dental, farmacias, cambios', subEn: 'Dental, pharmacy, exchange' },
  { href: '/services', emoji: '🇲🇽', labelEs: 'Servicios en México', labelEn: 'Services in Mexico', subEs: 'Cerca de los puentes', subEn: 'Near the crossings' },
  { href: '/guide', emoji: '📖', labelEs: 'Guía del cruzante', labelEn: 'Crosser\'s guide', subEs: 'Documentos, FMM, SENTRI', subEn: 'Documents, FMM, SENTRI' },
  { href: '/chat', emoji: '💬', labelEs: 'Pregúntale a Cruz', labelEn: 'Ask Cruz', subEs: 'AI sobre aduana y frontera', subEn: 'AI on customs & border' },
]

const INFO_ITEMS: MenuItem[] = [
  { href: '/privacy', emoji: '🔒', labelEs: 'Privacidad', labelEn: 'Privacy' },
  { href: '/terms', emoji: '📄', labelEs: 'Términos', labelEn: 'Terms' },
  { href: '/data-deletion', emoji: '🗑️', labelEs: 'Eliminar mis datos', labelEn: 'Delete my data' },
]

export default function MasPage() {
  const { lang } = useLang()
  const { user } = useAuth()
  const { tier } = useTier()
  const router = useRouter()
  const es = lang === 'es'
  const [isStandalone, setIsStandalone] = useState(true) // default true so we don't flash the install card

  useEffect(() => {
    if (typeof window === 'undefined') return
    const standalone =
      window.matchMedia('(display-mode: standalone)').matches ||
      (navigator as Navigator & { standalone?: boolean }).standalone === true
    setIsStandalone(standalone)
  }, [])

  async function handleSignOut() {
    const supabase = createClient()
    await supabase.auth.signOut()
    router.push('/')
  }

  return (
    <main className="min-h-screen bg-gray-50 dark:bg-gray-950">
      <div className="max-w-lg mx-auto px-4 pb-24">
        <div className="pt-6 pb-4">
          <h1 className="text-xl font-black text-gray-900 dark:text-gray-100">
            {es ? 'Más' : 'More'}
          </h1>
          {user && (
            <p className="text-xs text-gray-500 dark:text-gray-400 mt-0.5">
              {user.email} · <span className="capitalize">{tier}</span>
            </p>
          )}
        </div>

        {/* Prominent install card — shown to everyone who hasn't
            installed the PWA yet. This is the compensation for
            removing the landing-page InstallPrompt in Phase 1. */}
        {!isStandalone && (
          <div className="mb-4 bg-gradient-to-br from-blue-600 via-indigo-700 to-purple-800 rounded-3xl p-5 shadow-xl text-white relative overflow-hidden">
            <div className="absolute -top-10 -right-10 w-40 h-40 bg-white/10 rounded-full blur-3xl pointer-events-none" />
            <div className="relative">
              <p className="text-2xl leading-none mb-2">📲</p>
              <p className="text-base font-black leading-tight">
                {es ? 'Instala Cruzar · 3 meses Pro GRATIS' : 'Install Cruzar · 3 months Pro FREE'}
              </p>
              <p className="text-[11px] text-blue-100 mt-1 leading-snug">
                {es
                  ? 'Alertas que de verdad llegan a tu pantalla · Un tap pa\' abrir sin escribir nada'
                  : 'Alerts that actually reach your lock screen · One tap to open, no typing'}
              </p>
              <div className="mt-4 bg-white dark:bg-gray-900 rounded-2xl p-4 text-gray-900 dark:text-gray-100">
                <InstallGuide variant="banner" />
              </div>
            </div>
          </div>
        )}

        {!user && (
          <Link
            href="/signup"
            className="mb-4 block bg-gradient-to-r from-blue-600 to-indigo-600 rounded-2xl px-4 py-4 text-white shadow-sm active:scale-[0.98] transition-transform"
          >
            <p className="text-sm font-black">
              {es ? '🔔 Crea tu cuenta gratis' : '🔔 Create a free account'}
            </p>
            <p className="text-[11px] text-blue-100 mt-0.5">
              {es ? 'Alertas, favoritos y guardián del puente' : 'Alerts, saved bridges, guardian tier'}
            </p>
          </Link>
        )}

        <Section title={es ? 'Tu cuenta' : 'Your account'}>
          {ACCOUNT_ITEMS.map((item) => (
            <MenuRow key={item.href} item={item} es={es} />
          ))}
        </Section>

        <Section title={es ? 'Explorar' : 'Explore'}>
          {EXPLORE_ITEMS.map((item) => (
            <MenuRow key={item.href} item={item} es={es} />
          ))}
        </Section>

        <Section title={es ? 'Legal' : 'Legal'}>
          {INFO_ITEMS.map((item) => (
            <MenuRow key={item.href} item={item} es={es} />
          ))}
        </Section>

        {user && (
          <button
            onClick={handleSignOut}
            className="mt-4 w-full py-3 rounded-2xl border border-red-200 dark:border-red-800 text-red-600 dark:text-red-400 text-sm font-bold hover:bg-red-50 dark:hover:bg-red-900/20 transition-colors"
          >
            {es ? 'Cerrar sesión' : 'Sign out'}
          </button>
        )}

        <p className="mt-6 text-center text-[10px] text-gray-400 dark:text-gray-500">
          Cruzar · cruzar.app
        </p>
      </div>
    </main>
  )
}

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div className="mb-4">
      <p className="text-[10px] uppercase tracking-widest font-bold text-gray-500 dark:text-gray-400 mb-2 px-1">
        {title}
      </p>
      <div className="bg-white dark:bg-gray-800 rounded-2xl border border-gray-200 dark:border-gray-700 overflow-hidden">
        {children}
      </div>
    </div>
  )
}

function MenuRow({ item, es }: { item: MenuItem; es: boolean }) {
  return (
    <Link
      href={item.href}
      className="flex items-center gap-3 px-4 py-3 border-b border-gray-100 dark:border-gray-700/50 last:border-b-0 active:bg-gray-50 dark:active:bg-gray-700/30 transition-colors"
    >
      <span className="text-xl leading-none flex-shrink-0">{item.emoji}</span>
      <div className="min-w-0 flex-1">
        <p className="text-sm font-bold text-gray-900 dark:text-gray-100 leading-tight">
          {es ? item.labelEs : item.labelEn}
        </p>
        {(item.subEs || item.subEn) && (
          <p className="text-[11px] text-gray-500 dark:text-gray-400 leading-snug mt-0.5">
            {es ? item.subEs : item.subEn}
          </p>
        )}
      </div>
      <span className="text-gray-300 dark:text-gray-600 flex-shrink-0">→</span>
    </Link>
  )
}
