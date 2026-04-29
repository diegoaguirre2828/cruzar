'use client'

import Link from 'next/link'
import { ArrowLeft } from 'lucide-react'
import { useLang } from '@/lib/LangContext'
import { BridgeLogo } from '@/components/BridgeLogo'

const GUIDES = [
  {
    href: 'https://ttp.cbp.dhs.gov/',
    emoji: '⚡',
    title: { en: 'Get SENTRI — Skip the Line', es: 'Obtén SENTRI — Cruza Más Rápido' },
    desc: { en: 'Trusted Traveler Program for frequent US-Mexico crossers. Save 30–90 min on average. One-time $122.25 fee, valid 5 years.', es: 'Programa para cruzadores frecuentes. Ahorra 30–90 min en promedio. Cuota única de $122.25, válida 5 años.' },
    color: 'bg-amber-50 dark:bg-amber-900/20 border-amber-200 dark:border-amber-800',
    badge: { en: 'Save up to 2 hrs', es: 'Ahorra hasta 2 hrs' },
    badgeColor: 'bg-amber-100 dark:bg-amber-900/40 text-amber-700 dark:text-amber-300',
    external: true,
  },
  {
    href: '/customs',
    emoji: '✅',
    title: { en: 'Crossing Checklist', es: 'Lista de Cruce' },
    desc: { en: 'Interactive checklist for entering the US or Mexico. Know what to bring, what to declare, and what to avoid.', es: 'Lista interactiva para entrar a EE.UU. o México. Qué llevar, qué declarar y qué evitar.' },
    color: 'bg-green-50 dark:bg-green-900/20 border-green-200 dark:border-green-800',
    badge: { en: 'Most useful', es: 'Más útil' },
    badgeColor: 'bg-green-100 dark:bg-green-900/40 text-green-700 dark:text-green-300',
  },
  {
    href: '/insurance',
    emoji: '🛡️',
    title: { en: 'Mexico Auto Insurance', es: 'Seguro de Auto para México' },
    desc: { en: 'Required by law. Compare providers, understand coverage, and get a quote before you cross.', es: 'Obligatorio por ley. Compara proveedores, entiende la cobertura y cotiza antes de cruzar.' },
    color: 'bg-indigo-50 dark:bg-indigo-900/20 border-indigo-200 dark:border-indigo-800',
    badge: { en: 'Required', es: 'Obligatorio' },
    badgeColor: 'bg-red-100 dark:bg-red-900/40 text-red-700 dark:text-red-300',
  },
  {
    href: '/predict',
    emoji: '🔮',
    title: { en: 'Smart Crossing Planner', es: 'Planificador Inteligente' },
    desc: { en: 'Find the best time and day to cross any port. Skip the long waits with data-driven predictions.', es: 'Encuentra el mejor horario y día para cruzar. Evita las esperas largas con predicciones basadas en datos.' },
    color: 'bg-purple-50 dark:bg-purple-900/20 border-purple-200 dark:border-purple-800',
    badge: null,
    badgeColor: '',
  },
]

const QUICK_FACTS = {
  en: [
    { label: 'US duty-free limit', value: '$800 per person' },
    { label: 'MX duty-free limit', value: '$500 USD per person' },
    { label: 'Cash declaration threshold', value: '$10,000 USD' },
    { label: 'Alcohol duty-free (US entry)', value: '1 liter' },
    { label: 'Mexico insurance required', value: 'Yes, always' },
    { label: 'SENTRI enrollment savings', value: '30–90 min avg.' },
  ],
  es: [
    { label: 'Límite libre de impuestos EE.UU.', value: '$800 por persona' },
    { label: 'Límite libre de impuestos México', value: '$500 USD por persona' },
    { label: 'Declaración de efectivo', value: '$10,000 USD' },
    { label: 'Alcohol libre (entrando a EE.UU.)', value: '1 litro' },
    { label: 'Seguro en México', value: 'Sí, siempre' },
    { label: 'Ahorro con SENTRI', value: '30–90 min aprox.' },
  ],
}

export default function GuidePage() {
  const { lang } = useLang()

  const t = {
    title: lang === 'es' ? 'Guía Fronteriza' : 'Border Guide',
    subtitle: lang === 'es'
      ? 'Todo lo que necesitas saber para cruzar con confianza.'
      : 'Everything you need to know to cross with confidence.',
    quickFacts: lang === 'es' ? 'Datos rápidos' : 'Quick facts',
    back: lang === 'es' ? 'Inicio' : 'Home',
  }

  return (
    <main className="min-h-screen bg-gray-50 dark:bg-gray-950">
      <div className="max-w-lg mx-auto px-4 pb-16">

        {/* Header */}
        <div className="pt-6 pb-4">
          <Link href="/" className="flex items-center gap-1 text-xs text-gray-400 hover:text-gray-600 dark:hover:text-gray-300 mb-3 transition-colors">
            <ArrowLeft className="w-3 h-3" /> {t.back}
          </Link>
          <h1 className="text-2xl font-bold text-gray-900 dark:text-gray-100 inline-flex items-center gap-2"><BridgeLogo size={28} /> {t.title}</h1>
          <p className="text-sm text-gray-500 dark:text-gray-400 mt-1">{t.subtitle}</p>
        </div>

        {/* How to Use Cruzar */}
        <div className="bg-white dark:bg-gray-800 rounded-2xl border border-gray-200 dark:border-gray-700 shadow-sm p-5 mb-5">
          <h2 className="text-base font-bold text-gray-900 dark:text-gray-100 mb-4">
            {lang === 'es' ? '📱 Cómo usar Cruzar' : '📱 How to Use Cruzar'}
          </h2>

          {/* Color legend */}
          <p className="text-sm font-semibold text-gray-500 dark:text-gray-400 uppercase tracking-wide mb-3">
            {lang === 'es' ? 'Colores de espera' : 'Wait colors'}
          </p>
          <div className="space-y-2 mb-5">
            <div className="flex items-center gap-3">
              <span className="w-4 h-4 rounded-full bg-green-500 flex-shrink-0" />
              <span className="text-base font-semibold text-gray-800 dark:text-gray-200">
                {lang === 'es' ? 'Verde — Sin espera o menos de 20 min' : 'Green — No wait or under 20 min'}
              </span>
            </div>
            <div className="flex items-center gap-3">
              <span className="w-4 h-4 rounded-full bg-yellow-400 flex-shrink-0" />
              <span className="text-base font-semibold text-gray-800 dark:text-gray-200">
                {lang === 'es' ? 'Amarillo — Espera moderada (20–45 min)' : 'Yellow — Moderate wait (20–45 min)'}
              </span>
            </div>
            <div className="flex items-center gap-3">
              <span className="w-4 h-4 rounded-full bg-red-500 flex-shrink-0" />
              <span className="text-base font-semibold text-gray-800 dark:text-gray-200">
                {lang === 'es' ? 'Rojo — Espera larga (más de 45 min)' : 'Red — Long wait (over 45 min)'}
              </span>
            </div>
            <div className="flex items-center gap-3">
              <span className="w-4 h-4 rounded-full bg-gray-400 flex-shrink-0" />
              <span className="text-base font-semibold text-gray-800 dark:text-gray-200">
                {lang === 'es' ? 'Gris — Cerrado o sin datos' : 'Gray — Closed or no data'}
              </span>
            </div>
          </div>

          {/* Lane types */}
          <p className="text-sm font-semibold text-gray-500 dark:text-gray-400 uppercase tracking-wide mb-3">
            {lang === 'es' ? 'Tipos de carril' : 'Lane types'}
          </p>
          <div className="space-y-2 mb-5">
            {[
              { icon: '🚗', en: 'Car — Standard vehicle lane', es: 'Auto — Carril estándar para vehículos' },
              { icon: '🚶', en: 'Walk — Pedestrian lane', es: 'Caminando — Carril peatonal' },
              { icon: '⚡', en: 'SENTRI — Trusted Traveler fast lane', es: 'SENTRI — Carril rápido para viajeros de confianza' },
              { icon: '🚛', en: 'Truck — Commercial vehicle lane', es: 'Camión — Carril para vehículos comerciales' },
            ].map(lane => (
              <div key={lane.en} className="flex items-center gap-3">
                <span className="text-xl flex-shrink-0">{lane.icon}</span>
                <span className="text-base text-gray-700 dark:text-gray-300">{lang === 'es' ? lane.es : lane.en}</span>
              </div>
            ))}
          </div>

          {/* Quick tips */}
          <p className="text-sm font-semibold text-gray-500 dark:text-gray-400 uppercase tracking-wide mb-3">
            {lang === 'es' ? 'Consejos rápidos' : 'Quick tips'}
          </p>
          <div className="space-y-2">
            {[
              {
                en: '📍  Your home region\u2019s bridges show up automatically on the main screen.',
                es: '📍  Los puentes de tu zona aparecen solos en la pantalla principal.',
              },
              {
                en: '📣  Tap any crossing → Report to share your real wait time and earn points.',
                es: '📣  Toca un cruce → Reportar para compartir tu espera y ganar puntos.',
              },
              {
                en: '🔔  Upgrade to Pro to get alerts when a crossing drops below your target wait.',
                es: '🔔  Sube a Pro para recibir alertas cuando la espera baje de tu límite.',
              },
              {
                en: '🔄  Data refreshes automatically every 5 minutes.',
                es: '🔄  Los datos se actualizan automáticamente cada 5 minutos.',
              },
            ].map((tip, i) => (
              <p key={i} className="text-base text-gray-700 dark:text-gray-300 leading-relaxed">{lang === 'es' ? tip.es : tip.en}</p>
            ))}
          </div>
        </div>

        {/* Guide cards */}
        <div className="space-y-3 mb-6">
          {GUIDES.map(guide => (
            <Link key={guide.href} href={guide.href} target={guide.external ? '_blank' : undefined} rel={guide.external ? 'noopener noreferrer' : undefined}>
              <div className={`rounded-2xl border p-4 hover:shadow-md transition-all active:scale-[0.98] ${guide.color}`}>
                <div className="flex items-start gap-3">
                  <span className="text-2xl flex-shrink-0">{guide.emoji}</span>
                  <div className="flex-1">
                    <div className="flex items-center gap-2 mb-0.5">
                      <h2 className="text-sm font-bold text-gray-900 dark:text-gray-100">
                        {lang === 'es' ? guide.title.es : guide.title.en}
                      </h2>
                      {guide.badge && (
                        <span className={`text-xs font-semibold px-2 py-0.5 rounded-full ${guide.badgeColor}`}>
                          {lang === 'es' ? guide.badge.es : guide.badge.en}
                        </span>
                      )}
                    </div>
                    <p className="text-xs text-gray-600 dark:text-gray-400 leading-relaxed">
                      {lang === 'es' ? guide.desc.es : guide.desc.en}
                    </p>
                  </div>
                  <span className="text-gray-400 dark:text-gray-500 text-sm flex-shrink-0">→</span>
                </div>
              </div>
            </Link>
          ))}
        </div>

        {/* Quick facts table */}
        <div className="bg-white dark:bg-gray-800 rounded-2xl border border-gray-200 dark:border-gray-700 shadow-sm overflow-hidden">
          <div className="px-4 py-3 border-b border-gray-100 dark:border-gray-700">
            <h2 className="text-sm font-semibold text-gray-900 dark:text-gray-100">{t.quickFacts}</h2>
          </div>
          <div className="divide-y divide-gray-100 dark:divide-gray-700">
            {QUICK_FACTS[lang].map((fact, i) => (
              <div key={i} className="flex items-center justify-between px-4 py-2.5">
                <p className="text-xs text-gray-600 dark:text-gray-400">{fact.label}</p>
                <p className="text-xs font-semibold text-gray-900 dark:text-gray-100">{fact.value}</p>
              </div>
            ))}
          </div>
        </div>
      </div>
    </main>
  )
}
