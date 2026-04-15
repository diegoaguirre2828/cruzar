'use client'

import Link from 'next/link'
import { ArrowLeft } from 'lucide-react'
import { useLang } from '@/lib/LangContext'

// Canonical feature index. Every meaningful surface in the app should
// be listed here with a one-line pitch and a direct link. This is the
// answer to Diego's "even as the developer, it was pretty inconvenient
// to know about and find" complaint — the More tab scattered features
// across three sections without context, the CruzFab sheet only showed
// 6 tiles, and nothing told a user what the app can actually do.
//
// Linked from:
//   - /mas (More tab, top section)
//   - CruzHelperSheet (the CruzFab action)
//
// Content organization principle: group by USER INTENT, not by
// internal structure. People don't think "I want analytics," they
// think "I want to save time." The sections below use intent verbs.

interface Feature {
  href: string
  emoji: string
  titleEs: string
  titleEn: string
  lineEs: string
  lineEn: string
  badge?: 'free' | 'pro' | 'business' | 'new'
}

interface Section {
  titleEs: string
  titleEn: string
  subtitleEs: string
  subtitleEn: string
  features: Feature[]
}

const SECTIONS: Section[] = [
  {
    titleEs: 'Ahorrar tiempo en el puente',
    titleEn: 'Save time at the bridge',
    subtitleEs: 'Llega cuando la fila esté corta, no cuando ya te pasó',
    subtitleEn: "Arrive when the line is short, not when you've already missed it",
    features: [
      {
        href: '/dashboard',
        emoji: '🔔',
        titleEs: 'Alertas de espera',
        titleEn: 'Wait-time alerts',
        lineEs: 'Te avisamos cuando tu puente baje de 30 min — push al teléfono',
        lineEn: 'We ping you when your bridge drops below 30 min — push to your phone',
        badge: 'free',
      },
      {
        href: '/datos',
        emoji: '📊',
        titleEs: 'Patrón por hora',
        titleEn: 'Hourly patterns',
        lineEs: 'Mira a qué hora baja tu puente basado en los últimos 30 días',
        lineEn: 'See what hour your bridge clears based on the last 30 days',
        badge: 'pro',
      },
      {
        href: '/planner',
        emoji: '🗺️',
        titleEs: 'Planifica tu cruce',
        titleEn: 'Plan your crossing',
        lineEs: 'Cuándo salir de casa y qué puente agarrar pa\' llegar más rápido',
        lineEn: 'When to leave and which bridge to pick for the fastest crossing',
        badge: 'free',
      },
    ],
  },
  {
    titleEs: 'Con tu gente',
    titleEn: 'With your people',
    subtitleEs: 'Que tu familia sepa cuando cruzas — sin mandar mensajes',
    subtitleEn: "Let your family know when you cross — without texting",
    features: [
      {
        href: '/dashboard?tab=circle',
        emoji: '👥',
        titleEs: 'Mi Gente (círculos)',
        titleEn: 'My People (circles)',
        lineEs: 'Invita a tu mamá, esposa, hijos — les llega alerta cuando cruzas',
        lineEn: 'Invite mom, spouse, kids — they get an alert when you cross',
        badge: 'free',
      },
      {
        href: '/dashboard?tab=circle',
        emoji: '📍',
        titleEs: 'Avisa que estás en el puente',
        titleEn: 'Ping that you\'re at the bridge',
        lineEs: 'Un botón en el puente → tu gente sabe que ya llegaste',
        lineEn: 'One tap at the bridge → your people know you made it',
        badge: 'free',
      },
      {
        href: '/rewards',
        emoji: '🎁',
        titleEs: 'Recompensas',
        titleEn: 'Rewards',
        lineEs: 'Canjea tus puntos por descuentos en negocios del lado mexicano',
        lineEn: 'Redeem your points for deals at businesses on the Mexican side',
        badge: 'free',
      },
    ],
  },
  {
    titleEs: 'Mientras esperas en la fila',
    titleEn: 'While you wait in line',
    subtitleEs: 'Tu espera vuelve data pa\' el próximo cruzante',
    subtitleEn: 'Your wait becomes data for the next person crossing',
    features: [
      {
        href: '/',
        emoji: '📣',
        titleEs: 'Reportar la espera',
        titleEn: 'Report the wait',
        lineEs: 'Suma puntos pa\' tu comunidad y el badge de Guardián del puente',
        lineEn: 'Earn points for your community and the Bridge Guardian badge',
        badge: 'free',
      },
      {
        href: '/leaderboard',
        emoji: '🏆',
        titleEs: 'Tabla de Guardianes',
        titleEn: 'Guardian leaderboard',
        lineEs: 'Los mejores reportantes de tu región — gana rango con cada reporte',
        lineEn: 'Top reporters in your region — rank up with every report',
        badge: 'free',
      },
      {
        href: '/chat',
        emoji: '💬',
        titleEs: 'Pregúntale a Cruz',
        titleEn: 'Ask Cruz',
        lineEs: 'AI que sabe de aduana, SENTRI, FMM, documentos, y más',
        lineEn: 'AI that knows customs, SENTRI, FMM, documents, and more',
        badge: 'free',
      },
    ],
  },
  {
    titleEs: 'Antes de salir de casa',
    titleEn: 'Before you leave home',
    subtitleEs: 'Evita sorpresas — incidentes, clima, y días pesados',
    subtitleEn: 'No surprises — incidents, weather, and heavy days',
    features: [
      {
        href: '/',
        emoji: '⚠️',
        titleEs: 'Reportes en vivo',
        titleEn: 'Live community reports',
        lineEs: 'Accidentes, inspecciones y retrasos reportados por la gente en la fila',
        lineEn: 'Accidents, inspections, and delays reported by people in line',
        badge: 'free',
      },
      {
        href: '/guide',
        emoji: '📖',
        titleEs: 'Guía del cruzante',
        titleEn: "Crosser's guide",
        lineEs: 'Documentos, SENTRI, FMM, y lo que necesitas saber pa\' cruzar',
        lineEn: 'Documents, SENTRI, FMM, and everything you need to know',
        badge: 'free',
      },
      {
        href: '/insurance',
        emoji: '🛡️',
        titleEs: 'Seguro pa\' México',
        titleEn: 'Mexico auto insurance',
        lineEs: 'Obligatorio por ley — desde $7/día · Compara aseguradoras',
        lineEn: 'Required by law — from $7/day · Compare insurers',
        badge: 'free',
      },
    ],
  },
  {
    titleEs: 'Alrededor del puente',
    titleEn: 'Around the bridge',
    subtitleEs: 'Lo que necesitas del lado mexicano',
    subtitleEn: 'What you need on the Mexican side',
    features: [
      {
        href: '/services',
        emoji: '🇲🇽',
        titleEs: 'Servicios en México',
        titleEn: 'Services in Mexico',
        lineEs: 'Dental, farmacias, taxis, y más — todo cerca del puente',
        lineEn: 'Dental, pharmacy, taxis, and more — near the bridge',
        badge: 'free',
      },
      {
        href: '/negocios',
        emoji: '🏪',
        titleEs: 'Negocios locales',
        titleEn: 'Local businesses',
        lineEs: 'Casas de cambio, comida, hoteles — con reviews de la comunidad',
        lineEn: 'Exchange houses, food, hotels — with community reviews',
        badge: 'free',
      },
    ],
  },
  {
    titleEs: 'Para flotas y camioneros',
    titleEn: 'For fleets and truckers',
    subtitleEs: 'Herramientas de negocio pa\' quien cruza todos los días',
    subtitleEn: 'Business tools for the people who cross every day',
    features: [
      {
        href: '/for-fleets',
        emoji: '🚛',
        titleEs: 'Panel de flota',
        titleEn: 'Fleet dashboard',
        lineEs: 'Tracking de choferes, envíos, costos por retraso — todo en un lugar',
        lineEn: 'Driver tracking, shipments, delay costs — all in one place',
        badge: 'business',
      },
    ],
  },
]

const BADGE_STYLES: Record<NonNullable<Feature['badge']>, string> = {
  free:     'bg-green-100 dark:bg-green-900/30 text-green-700 dark:text-green-400',
  pro:      'bg-purple-100 dark:bg-purple-900/30 text-purple-700 dark:text-purple-400',
  business: 'bg-amber-100 dark:bg-amber-900/30 text-amber-700 dark:text-amber-400',
  new:      'bg-blue-100 dark:bg-blue-900/30 text-blue-700 dark:text-blue-400',
}

const BADGE_LABELS: Record<NonNullable<Feature['badge']>, { es: string; en: string }> = {
  free:     { es: 'Gratis',   en: 'Free'     },
  pro:      { es: 'Pro',      en: 'Pro'      },
  business: { es: 'Business', en: 'Business' },
  new:      { es: 'Nuevo',    en: 'New'      },
}

export default function FeaturesPage() {
  const { lang } = useLang()
  const es = lang === 'es'

  return (
    <main className="min-h-screen bg-gray-50 dark:bg-gray-950">
      <div className="max-w-lg mx-auto px-4 pb-24">
        <div className="pt-6 pb-4">
          <Link href="/" className="flex items-center gap-1 text-sm text-gray-500 dark:text-gray-400 hover:text-gray-900 dark:hover:text-gray-100 mb-4">
            <ArrowLeft className="w-4 h-4" /> {es ? 'Volver al mapa' : 'Back to map'}
          </Link>
          <h1 className="text-2xl font-black text-gray-900 dark:text-gray-100 leading-tight">
            {es ? 'Todo lo que hace Cruzar' : 'Everything Cruzar does'}
          </h1>
          <p className="text-sm text-gray-500 dark:text-gray-400 mt-1.5 leading-snug">
            {es
              ? 'Una lista completa — porque nadie puede usar lo que no sabe que existe.'
              : "Everything in one place — because no one can use what they don't know exists."}
          </p>
        </div>

        {SECTIONS.map((section) => (
          <div key={section.titleEn} className="mb-6">
            <div className="px-1 mb-2">
              <h2 className="text-sm font-black text-gray-900 dark:text-gray-100">
                {es ? section.titleEs : section.titleEn}
              </h2>
              <p className="text-[11px] text-gray-500 dark:text-gray-400 mt-0.5 leading-snug">
                {es ? section.subtitleEs : section.subtitleEn}
              </p>
            </div>
            <div className="bg-white dark:bg-gray-800 rounded-2xl border border-gray-200 dark:border-gray-700 overflow-hidden">
              {section.features.map((feature, i) => (
                <Link
                  key={feature.href + feature.titleEn}
                  href={feature.href}
                  className={`flex items-start gap-3 px-4 py-3.5 active:bg-gray-50 dark:active:bg-gray-700/40 transition-colors ${
                    i < section.features.length - 1 ? 'border-b border-gray-100 dark:border-gray-700' : ''
                  }`}
                >
                  <span className="text-2xl leading-none flex-shrink-0 mt-0.5">{feature.emoji}</span>
                  <div className="min-w-0 flex-1">
                    <div className="flex items-center gap-2">
                      <p className="text-sm font-bold text-gray-900 dark:text-gray-100">
                        {es ? feature.titleEs : feature.titleEn}
                      </p>
                      {feature.badge && (
                        <span className={`text-[9px] font-black uppercase tracking-wide px-1.5 py-0.5 rounded-full ${BADGE_STYLES[feature.badge]}`}>
                          {es ? BADGE_LABELS[feature.badge].es : BADGE_LABELS[feature.badge].en}
                        </span>
                      )}
                    </div>
                    <p className="text-[11px] text-gray-500 dark:text-gray-400 mt-0.5 leading-snug">
                      {es ? feature.lineEs : feature.lineEn}
                    </p>
                  </div>
                  <span className="text-gray-300 dark:text-gray-600 flex-shrink-0 mt-1">→</span>
                </Link>
              ))}
            </div>
          </div>
        ))}

        <div className="mt-8 text-center text-[11px] text-gray-400 dark:text-gray-500">
          {es ? '¿Falta algo?' : 'Missing something?'}{' '}
          <Link href="/chat" className="underline underline-offset-2">
            {es ? 'Pregúntale a Cruz' : 'Ask Cruz'}
          </Link>
        </div>
      </div>
    </main>
  )
}
