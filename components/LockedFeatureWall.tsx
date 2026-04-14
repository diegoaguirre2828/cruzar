'use client'

import Link from 'next/link'
import { Lock } from 'lucide-react'
import { useLang } from '@/lib/LangContext'

// Reusable "feature locked" state for guest-blocked routes.
//
// Diego's 2026-04-14 decision: guests should only USE the home page,
// but they shouldn't bounce off of /port/[id], /features, /chat,
// /leaderboard, /rewards, /planner. Instead, each of those pages
// renders a rich preview explaining WHAT the user would unlock, so
// the moment of highest intent (they just tapped something) becomes
// a signup opportunity rather than a dead redirect.
//
// Usage:
//   <LockedFeatureWall
//     featureTitleEs="Detalles completos del puente"
//     featureTitleEn="Full bridge details"
//     summaryEs="Ver tiempos de espera..."
//     summaryEn="See wait times..."
//     unlocks={[
//       { es: 'Historial por hora', en: 'Hourly history' },
//       { es: 'Cámaras en vivo', en: 'Live cameras' },
//       ...
//     ]}
//     nextPath="/port/230501"
//     preview={<div>optional teaser content</div>}
//   />
//
// Never redirects. Never blocks scroll. The user stays on the URL
// they intended and sees the wall IN-PLACE so the back button
// returns them to wherever they came from.

interface BullEs { es: string; en: string }

interface Props {
  featureTitleEs: string
  featureTitleEn: string
  summaryEs: string
  summaryEn: string
  unlocks: BullEs[]
  nextPath: string
  /** Optional teaser rendered ABOVE the wall — e.g. the bridge name + wait number on /port/[id]. */
  preview?: React.ReactNode
  /** Optional override for the primary CTA text. */
  ctaEs?: string
  ctaEn?: string
}

export function LockedFeatureWall({
  featureTitleEs,
  featureTitleEn,
  summaryEs,
  summaryEn,
  unlocks,
  nextPath,
  preview,
  ctaEs,
  ctaEn,
}: Props) {
  const { lang } = useLang()
  const es = lang === 'es'
  const signupHref = `/signup?next=${encodeURIComponent(nextPath)}`
  const loginHref = `/login?next=${encodeURIComponent(nextPath)}`

  return (
    <div className="space-y-4">
      {preview && <div className="opacity-80 pointer-events-none select-none">{preview}</div>}

      <div className="relative bg-gradient-to-br from-blue-600 via-indigo-700 to-purple-800 rounded-3xl p-6 shadow-2xl text-white overflow-hidden">
        <div className="absolute -top-16 -right-16 w-48 h-48 bg-white/10 rounded-full blur-3xl pointer-events-none" />
        <div className="absolute -bottom-20 -left-10 w-56 h-56 bg-purple-400/20 rounded-full blur-3xl pointer-events-none" />

        <div className="relative">
          <div className="flex items-center gap-2 mb-3">
            <div className="flex items-center justify-center w-8 h-8 rounded-full bg-white/20 backdrop-blur-sm">
              <Lock className="w-4 h-4" />
            </div>
            <p className="text-[10px] uppercase tracking-widest font-black text-blue-100">
              {es ? 'Cuenta gratis requerida' : 'Free account required'}
            </p>
          </div>

          <h2 className="text-2xl sm:text-3xl font-black leading-tight">
            {es ? featureTitleEs : featureTitleEn}
          </h2>
          <p className="mt-2 text-sm text-blue-100 leading-snug">
            {es ? summaryEs : summaryEn}
          </p>

          {unlocks.length > 0 && (
            <ul className="mt-4 space-y-1.5">
              {unlocks.map((item, i) => (
                <li key={i} className="flex items-start gap-2 text-[13px] text-white/90 leading-snug">
                  <span className="text-green-300 mt-0.5 flex-shrink-0">✓</span>
                  <span>{es ? item.es : item.en}</span>
                </li>
              ))}
            </ul>
          )}

          <Link
            href={signupHref}
            className="mt-5 block w-full bg-white text-indigo-700 text-center font-black py-3.5 rounded-2xl shadow-lg active:scale-[0.98] transition-transform cruzar-shimmer"
          >
            {es ? (ctaEs ?? 'Crear cuenta gratis →') : (ctaEn ?? 'Create free account →')}
          </Link>
          <p className="mt-2 text-[10px] text-center text-blue-200/80">
            {es ? '10 segundos · sin tarjeta · sin spam' : '10 seconds · no card · no spam'}
          </p>

          <div className="mt-4 pt-4 border-t border-white/10 text-center">
            <Link
              href={loginHref}
              className="text-[11px] text-blue-100/80 hover:text-white underline underline-offset-2"
            >
              {es ? '¿Ya tienes cuenta? Entra' : 'Already have an account? Sign in'}
            </Link>
          </div>
        </div>
      </div>

      <div className="text-center">
        <Link
          href="/"
          className="text-[11px] text-gray-500 dark:text-gray-400 hover:text-gray-900 dark:hover:text-gray-100 underline underline-offset-2"
        >
          {es ? '← Ver tiempos de todos los puentes' : '← See all bridge wait times'}
        </Link>
      </div>
    </div>
  )
}
