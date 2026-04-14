'use client'

import Link from 'next/link'
import { useLang } from '@/lib/LangContext'
import { CheckCircle2, XCircle, MinusCircle, Sparkles, Users, Database } from 'lucide-react'

// Public marketing page — why Cruzar instead of the alternatives.
// Positions Cruzar against its TWO real competitors:
//   1. Facebook groups — has community but no structure
//   2. Border Times (border-times.com) — has structure but no community
// Cruzar is the only one with both, plus Spanish-first bilingual,
// plus the sensor-network data moat.
//
// SEO target: users Googling "border wait times app", "cruzar vs
// border times", "tiempos frontera app", "best border crossing app".
//
// Every row of the feature matrix is honest — where Cruzar doesn't
// yet have something (e.g. on the app stores), we show that too.
// Credibility beats spin.

type Status = 'yes' | 'no' | 'partial'

interface Row {
  feature: { es: string; en: string }
  cruzar: Status
  fbGroups: Status
  borderTimes: Status
  note?: { es: string; en: string }
}

const ROWS: Row[] = [
  // ─── Core data ───
  {
    feature: { es: 'Tiempos de espera CBP en vivo', en: 'Live CBP wait times' },
    cruzar: 'yes',
    fbGroups: 'no',
    borderTimes: 'yes',
  },
  {
    feature: { es: 'Reportes de la comunidad', en: 'Community reports' },
    cruzar: 'yes',
    fbGroups: 'yes',
    borderTimes: 'no',
  },
  {
    feature: { es: 'Verificación GPS de reportes', en: 'GPS-verified reports' },
    cruzar: 'yes',
    fbGroups: 'no',
    borderTimes: 'no',
  },
  {
    feature: { es: 'Datos por tipo de carril (SENTRI / Ready / Commercial)', en: 'Per-lane data (SENTRI / Ready / Commercial)' },
    cruzar: 'yes',
    fbGroups: 'no',
    borderTimes: 'partial',
  },
  {
    feature: { es: 'Indicador de X-ray activo por carril', en: 'Per-lane X-ray active indicator' },
    cruzar: 'yes',
    fbGroups: 'no',
    borderTimes: 'no',
  },
  {
    feature: { es: 'Patrones históricos por hora', en: 'Historical hourly patterns' },
    cruzar: 'yes',
    fbGroups: 'no',
    borderTimes: 'no',
  },
  {
    feature: { es: 'Pronóstico hacia adelante (NOW + 4 horas)', en: 'Forward forecast (NOW + 4 hours)' },
    cruzar: 'yes',
    fbGroups: 'no',
    borderTimes: 'no',
  },
  {
    feature: { es: 'Mejor hora pa\' cruzar (basado en tus datos)', en: 'Best hour to cross (based on your data)' },
    cruzar: 'yes',
    fbGroups: 'no',
    borderTimes: 'no',
  },

  // ─── Personalization ───
  {
    feature: { es: 'Página personalizada con tu puente favorito', en: 'Personalized home with your favorite bridge' },
    cruzar: 'yes',
    fbGroups: 'no',
    borderTimes: 'no',
  },
  {
    feature: { es: 'Tu patrón de cruce (tu hora usual, tu espera)', en: 'Your crossing pattern (your usual hour, your typical wait)' },
    cruzar: 'yes',
    fbGroups: 'no',
    borderTimes: 'no',
  },

  // ─── Visual / camera ───
  {
    feature: { es: 'Cámaras en vivo del puente', en: 'Live bridge cameras' },
    cruzar: 'yes',
    fbGroups: 'no',
    borderTimes: 'no',
    note: { es: '7 cámaras públicas (Caltrans, ADOT, El Paso) más fotos comunitarias', en: '7 public DOT feeds + community photo submissions' },
  },
  {
    feature: { es: 'Fotos comunitarias de la fila', en: 'Community photos from the line' },
    cruzar: 'yes',
    fbGroups: 'partial',
    borderTimes: 'no',
    note: { es: 'Con verificación GPS y extracción AI de características', en: 'With GPS verification + AI feature extraction' },
  },

  // ─── Alerts + AI ───
  {
    feature: { es: 'Alertas push cuando baja la espera', en: 'Push alerts when waits drop' },
    cruzar: 'yes',
    fbGroups: 'no',
    borderTimes: 'no',
  },
  {
    feature: { es: 'Asistente AI (preguntas sobre la frontera)', en: 'AI assistant (border questions)' },
    cruzar: 'yes',
    fbGroups: 'no',
    borderTimes: 'no',
  },

  // ─── Language ───
  {
    feature: { es: 'Bilingüe español-inglés', en: 'Bilingual Spanish-English' },
    cruzar: 'yes',
    fbGroups: 'partial',
    borderTimes: 'no',
    note: { es: 'Diseñado en español primero — la mayoría de cruzantes lo prefieren', en: 'Designed Spanish-first — matches the primary audience' },
  },

  // ─── Services layer ───
  {
    feature: { es: 'Directorio de servicios cerca del puente', en: 'Services directory near the bridge' },
    cruzar: 'yes',
    fbGroups: 'no',
    borderTimes: 'no',
  },
  {
    feature: { es: 'Tipo de cambio USD/MXN en vivo', en: 'Live USD/MXN exchange rate' },
    cruzar: 'yes',
    fbGroups: 'no',
    borderTimes: 'no',
  },

  // ─── Community features ───
  {
    feature: { es: 'Leaderboard de guardianes del puente', en: 'Bridge Guardian leaderboard' },
    cruzar: 'yes',
    fbGroups: 'partial',
    borderTimes: 'no',
  },
  {
    feature: { es: 'Sistema de recompensas por reportar', en: 'Rewards for reporting' },
    cruzar: 'yes',
    fbGroups: 'no',
    borderTimes: 'no',
  },

  // ─── Business tier ───
  {
    feature: { es: 'Panel de flota (Business $49.99/mes)', en: 'Fleet dashboard (Business $49.99/mo)' },
    cruzar: 'yes',
    fbGroups: 'no',
    borderTimes: 'no',
  },
  {
    feature: { es: 'API pa\' datos B2B', en: 'B2B data API' },
    cruzar: 'yes',
    fbGroups: 'no',
    borderTimes: 'no',
  },

  // ─── Honest gaps ───
  {
    feature: { es: 'App en Google Play', en: 'Google Play listing' },
    cruzar: 'partial',
    fbGroups: 'yes',
    borderTimes: 'yes',
    note: { es: 'Próximamente — mientras tanto usa cruzar punto app en tu navegador', en: 'Coming soon — use cruzar punto app in your browser for now' },
  },
  {
    feature: { es: 'App en Apple App Store', en: 'Apple App Store listing' },
    cruzar: 'partial',
    fbGroups: 'yes',
    borderTimes: 'yes',
    note: { es: 'Próximamente', en: 'Coming soon' },
  },
]

const STATUS_ICON: Record<Status, React.ReactNode> = {
  yes: <CheckCircle2 className="w-4 h-4 text-green-500" />,
  no: <XCircle className="w-4 h-4 text-gray-400 dark:text-gray-600" />,
  partial: <MinusCircle className="w-4 h-4 text-amber-500" />,
}

export default function ComparePage() {
  const { lang } = useLang()
  const es = lang === 'es'

  const cruzarYes = ROWS.filter((r) => r.cruzar === 'yes').length
  const borderTimesYes = ROWS.filter((r) => r.borderTimes === 'yes').length
  const fbGroupsYes = ROWS.filter((r) => r.fbGroups === 'yes').length

  return (
    <main className="min-h-screen bg-gray-50 dark:bg-gray-950">
      <div className="max-w-4xl mx-auto px-4 pb-16">
        <div className="pt-8 pb-4">
          <Link href="/" className="text-sm text-gray-500 hover:text-gray-900 dark:hover:text-gray-100">
            ← cruzar.app
          </Link>
        </div>

        {/* Hero */}
        <section className="pt-8 pb-10 text-center">
          <p className="text-[11px] font-black uppercase tracking-widest text-blue-600 dark:text-blue-400 mb-3">
            {es ? 'Por qué Cruzar' : 'Why Cruzar'}
          </p>
          <h1 className="text-4xl sm:text-5xl font-black leading-tight text-gray-900 dark:text-gray-100">
            {es
              ? 'La única que tiene comunidad Y estructura'
              : 'The only one with community AND structure'}
          </h1>
          <p className="mt-4 text-base text-gray-600 dark:text-gray-400 max-w-2xl mx-auto leading-relaxed">
            {es
              ? 'Los grupos de Facebook tienen comunidad pero nada estructurado. Las apps existentes tienen estructura pero no tienen comunidad. Cruzar tiene ambas — y muchísimo más.'
              : 'Facebook groups have community but no structure. Existing apps have structure but no community. Cruzar has both — and a lot more.'}
          </p>
        </section>

        {/* 3 card summary */}
        <section className="grid md:grid-cols-3 gap-3 mb-10">
          <div className="bg-gradient-to-br from-blue-600 to-indigo-700 text-white rounded-3xl p-5">
            <Users className="w-6 h-6 mb-2 opacity-80" />
            <p className="text-2xl font-black">{cruzarYes}</p>
            <p className="text-[11px] font-black uppercase tracking-wider text-blue-100 mt-1">
              {es ? 'Funciones en Cruzar' : 'Cruzar features'}
            </p>
          </div>
          <div className="bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-3xl p-5">
            <p className="text-2xl font-black text-gray-900 dark:text-gray-100">{fbGroupsYes}</p>
            <p className="text-[11px] font-black uppercase tracking-wider text-gray-500 mt-1">
              {es ? 'En grupos de Facebook' : 'In Facebook groups'}
            </p>
          </div>
          <div className="bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-3xl p-5">
            <p className="text-2xl font-black text-gray-900 dark:text-gray-100">{borderTimesYes}</p>
            <p className="text-[11px] font-black uppercase tracking-wider text-gray-500 mt-1">
              Border Times
            </p>
          </div>
        </section>

        {/* Feature matrix */}
        <section className="bg-white dark:bg-gray-900 rounded-3xl border border-gray-200 dark:border-gray-800 overflow-hidden mb-10">
          <div className="px-5 py-4 border-b border-gray-100 dark:border-gray-800">
            <h2 className="text-lg font-black text-gray-900 dark:text-gray-100">
              {es ? 'Comparación de funciones' : 'Feature comparison'}
            </h2>
            <p className="text-[11px] text-gray-500 dark:text-gray-400 mt-1">
              {es
                ? 'Honesto — incluyendo lo que todavía no tenemos en Cruzar.'
                : 'Honest — including what Cruzar doesn\'t have yet.'}
            </p>
          </div>

          {/* Header row */}
          <div className="grid grid-cols-[1fr,60px,60px,60px] md:grid-cols-[1fr,100px,100px,100px] gap-2 px-4 py-2 bg-gray-50 dark:bg-gray-800/60 border-b border-gray-100 dark:border-gray-800">
            <div></div>
            <div className="text-[10px] font-black uppercase tracking-widest text-blue-700 dark:text-blue-400 text-center">
              Cruzar
            </div>
            <div className="text-[10px] font-black uppercase tracking-widest text-gray-500 dark:text-gray-400 text-center">
              FB
            </div>
            <div className="text-[10px] font-black uppercase tracking-widest text-gray-500 dark:text-gray-400 text-center">
              B.Times
            </div>
          </div>

          {ROWS.map((row, i) => (
            <div
              key={i}
              className="grid grid-cols-[1fr,60px,60px,60px] md:grid-cols-[1fr,100px,100px,100px] gap-2 px-4 py-3 border-b border-gray-100 dark:border-gray-800 last:border-b-0 items-start"
            >
              <div className="min-w-0">
                <p className="text-[13px] font-semibold text-gray-900 dark:text-gray-100 leading-snug">
                  {es ? row.feature.es : row.feature.en}
                </p>
                {row.note && (
                  <p className="text-[11px] text-gray-500 dark:text-gray-400 mt-0.5 leading-snug">
                    {es ? row.note.es : row.note.en}
                  </p>
                )}
              </div>
              <div className="flex justify-center pt-0.5">{STATUS_ICON[row.cruzar]}</div>
              <div className="flex justify-center pt-0.5">{STATUS_ICON[row.fbGroups]}</div>
              <div className="flex justify-center pt-0.5">{STATUS_ICON[row.borderTimes]}</div>
            </div>
          ))}
        </section>

        {/* Why Cruzar wins */}
        <section className="grid md:grid-cols-3 gap-4 mb-10">
          <div className="bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-3xl p-5">
            <Users className="w-6 h-6 text-blue-600 dark:text-blue-400 mb-3" />
            <h3 className="text-base font-black text-gray-900 dark:text-gray-100 mb-1">
              {es ? 'Comunidad real' : 'Real community'}
            </h3>
            <p className="text-[13px] text-gray-600 dark:text-gray-400 leading-relaxed">
              {es
                ? 'Cada reporte tiene verificación GPS. Nada de rumores de grupos ni posts viejos sin contexto.'
                : 'Every report has GPS verification. No group rumors, no stale posts without context.'}
            </p>
          </div>
          <div className="bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-3xl p-5">
            <Sparkles className="w-6 h-6 text-indigo-600 dark:text-indigo-400 mb-3" />
            <h3 className="text-base font-black text-gray-900 dark:text-gray-100 mb-1">
              {es ? 'Hecho en español' : 'Spanish-first'}
            </h3>
            <p className="text-[13px] text-gray-600 dark:text-gray-400 leading-relaxed">
              {es
                ? 'Diseñado para la raza que cruza todos los días — no un producto gringo traducido a medias.'
                : 'Designed for the people who cross every day — not an American product half-translated.'}
            </p>
          </div>
          <div className="bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-3xl p-5">
            <Database className="w-6 h-6 text-purple-600 dark:text-purple-400 mb-3" />
            <h3 className="text-base font-black text-gray-900 dark:text-gray-100 mb-1">
              {es ? 'Red de sensores' : 'Sensor network'}
            </h3>
            <p className="text-[13px] text-gray-600 dark:text-gray-400 leading-relaxed">
              {es
                ? 'Datos a nivel de carril que ni CBP publica — X-ray activo, inspección secundaria, patrones reales por hora.'
                : 'Lane-level data CBP doesn\'t publish — X-ray active, secondary inspection, real hourly patterns.'}
            </p>
          </div>
        </section>

        {/* CTA */}
        <section className="bg-gradient-to-br from-blue-600 via-indigo-700 to-purple-800 text-white rounded-3xl p-6 text-center shadow-xl">
          <h2 className="text-2xl font-black leading-tight">
            {es ? 'Cruza con confianza, no adivinando' : 'Cross with confidence, not guessing'}
          </h2>
          <p className="mt-2 text-sm text-blue-100 max-w-xl mx-auto leading-relaxed">
            {es
              ? 'Deja de perder tu vida en la fila buscando respuestas en grupos. Cruzar te dice exactamente cómo está cada puente en vivo.'
              : 'Stop wasting your life in line searching for answers in groups. Cruzar shows you exactly how every bridge is right now.'}
          </p>
          <div className="mt-5 flex flex-col sm:flex-row gap-3 justify-center">
            <Link
              href="/"
              className="bg-white text-indigo-700 font-black px-6 py-3 rounded-2xl shadow-lg active:scale-[0.98] transition-transform"
            >
              {es ? 'Ver tiempos en vivo →' : 'See live times →'}
            </Link>
            <Link
              href="/signup"
              className="bg-white/15 backdrop-blur-sm border border-white/20 text-white font-black px-6 py-3 rounded-2xl active:scale-[0.98] transition-transform"
            >
              {es ? 'Crear cuenta gratis' : 'Create free account'}
            </Link>
          </div>
          <p className="mt-4 text-[10px] text-blue-200/80">
            {es
              ? 'Gratis · sin tarjeta · 10 segundos · agrega a pantalla de inicio = 3 meses de Pro gratis'
              : 'Free · no card · 10 seconds · add to home screen = 3 months Pro free'}
          </p>
        </section>

        <footer className="mt-12 text-center text-[11px] text-gray-400 dark:text-gray-500">
          Cruzar · <Link href="/features" className="hover:text-gray-700 dark:hover:text-gray-200 underline underline-offset-2">{es ? 'Ver todas las funciones' : 'See all features'}</Link> · <Link href="/data" className="hover:text-gray-700 dark:hover:text-gray-200 underline underline-offset-2">{es ? 'Datos para empresas' : 'B2B data'}</Link>
        </footer>
      </div>
    </main>
  )
}
