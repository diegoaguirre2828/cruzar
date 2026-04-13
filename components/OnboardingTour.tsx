'use client'

import { useState, useEffect } from 'react'
import { useLang } from '@/lib/LangContext'

const STORAGE_KEY = 'cruzar_onboarding_v2'

const STEPS = [
  {
    emoji: '🌉',
    title: { en: 'Welcome to Cruzar', es: 'Bienvenido a Cruzar' },
    body: {
      en: 'Live wait times at every US-Mexico border crossing. Updated every few minutes, totally free.',
      es: 'Tiempos de espera en vivo en todos los puentes fronterizos. Se actualiza cada pocos minutos, completamente gratis.',
    },
  },
  {
    emoji: null,
    title: { en: 'What the colors mean', es: 'Qué significan los colores' },
    body: { en: '', es: '' },
    colors: true,
  },
  {
    emoji: '📣',
    title: { en: 'Help everyone in line', es: 'Ayuda a todos en la fila' },
    body: {
      en: 'Tap any crossing and hit Report to share your real wait time. You earn points and everyone gets better info.',
      es: 'Toca cualquier puente y presiona Reportar para compartir tu tiempo de espera real. Ganas puntos y ayudas a todos.',
    },
  },
  {
    emoji: '🔔',
    title: { en: 'Get alerts when lines drop', es: 'Recibe alertas cuando baje la fila' },
    body: {
      en: 'Create a free account to get notified the moment a crossing drops below your target wait time. No more guessing.',
      es: 'Crea una cuenta gratis para recibir una notificación en cuanto un puente baje de tu tiempo ideal. Sin adivinar.',
    },
  },
  {
    emoji: null,
    title: { en: 'Everything in one app', es: 'Todo en una sola app' },
    body: { en: '', es: '' },
    features: true,
  },
]

export function OnboardingTour() {
  const { lang } = useLang()
  const [visible, setVisible] = useState(false)
  const [step, setStep] = useState(0)

  // Auto-show on first visit is disabled — it was firing a full-screen 5-step
  // modal on every FB-sourced visitor before they could see the data, killing
  // retention. The tour is now only shown when explicitly triggered via
  // `window.dispatchEvent(new Event('cruzar:show-onboarding'))` (e.g. from a
  // help button in NavBar, not added yet).
  useEffect(() => {
    if (typeof window === 'undefined') return
    const handler = () => setVisible(true)
    window.addEventListener('cruzar:show-onboarding', handler)
    return () => window.removeEventListener('cruzar:show-onboarding', handler)
  }, [])

  // Default to Spanish for border region users
  const displayLang = lang === 'en' ? 'en' : 'es'

  function dismiss() {
    localStorage.setItem(STORAGE_KEY, '1')
    setVisible(false)
  }

  function next() {
    if (step < STEPS.length - 1) {
      setStep(s => s + 1)
    } else {
      dismiss()
    }
  }

  if (!visible) return null

  const current = STEPS[step]
  const isLast = step === STEPS.length - 1

  return (
    <div className="fixed inset-0 z-50 flex items-end justify-center sm:items-center">
      {/* Backdrop */}
      <div className="absolute inset-0 bg-black/60" onClick={dismiss} />

      {/* Card */}
      <div className="relative w-full max-w-md bg-white dark:bg-gray-900 rounded-t-3xl sm:rounded-3xl shadow-2xl px-6 pt-6 pb-8"
        style={{ paddingBottom: 'calc(2rem + env(safe-area-inset-bottom))' }}>

        {/* Progress dots */}
        <div className="flex justify-center gap-1.5 mb-5">
          {STEPS.map((_, i) => (
            <span key={i} className={`h-1.5 rounded-full transition-all duration-300 ${
              i === step ? 'w-6 bg-blue-500' : i < step ? 'w-1.5 bg-blue-300' : 'w-1.5 bg-gray-200 dark:bg-gray-700'
            }`} />
          ))}
        </div>

        {/* Content */}
        {current.features ? (
          <div>
            <h2 className="text-2xl font-bold text-gray-900 dark:text-gray-100 text-center mb-5">
              {displayLang === 'es' ? 'Todo en una sola app' : 'Everything in one app'}
            </h2>
            <div className="space-y-3">
              {[
                { emoji: '🤖', es: 'Pregúntale al asistente — dudas sobre la frontera y aduana', en: 'Ask the AI — questions about the border & customs' },
                { emoji: '🇲🇽', es: 'Servicios en México — dental, farmacias, taxis y más', en: 'Services in Mexico — dental, pharmacy, taxis & more' },
                { emoji: '🔔', es: 'Alertas — avísame cuando baje la fila', en: 'Alerts — notify me when the line drops' },
                { emoji: '⭐', es: 'Guarda tus puentes favoritos', en: 'Save your favorite crossings' },
                { emoji: '🏆', es: 'Gana puntos reportando tiempos reales', en: 'Earn points by reporting real wait times' },
              ].map((f, i) => (
                <div key={i} className="flex items-center gap-3 bg-gray-50 dark:bg-gray-800 rounded-2xl px-4 py-3">
                  <span className="text-2xl flex-shrink-0">{f.emoji}</span>
                  <p className="text-sm font-medium text-gray-700 dark:text-gray-200">
                    {displayLang === 'es' ? f.es : f.en}
                  </p>
                </div>
              ))}
            </div>
          </div>
        ) : current.colors ? (
          <div>
            <h2 className="text-2xl font-bold text-gray-900 dark:text-gray-100 text-center mb-6">
              {displayLang === 'es' ? current.title.es : current.title.en}
            </h2>
            <div className="space-y-4 mb-2">
              <div className="flex items-center gap-4 bg-green-50 dark:bg-green-900/20 rounded-2xl px-5 py-4">
                <span className="w-5 h-5 rounded-full bg-green-500 flex-shrink-0" />
                <div>
                  <p className="text-base font-bold text-green-700 dark:text-green-300">
                    {displayLang === 'es' ? 'Verde — Sin espera o espera baja' : 'Green — No wait or low traffic'}
                  </p>
                  <p className="text-sm text-green-600 dark:text-green-400">
                    {displayLang === 'es' ? 'Menos de 20 minutos' : 'Under 20 minutes'}
                  </p>
                </div>
              </div>
              <div className="flex items-center gap-4 bg-yellow-50 dark:bg-yellow-900/20 rounded-2xl px-5 py-4">
                <span className="w-5 h-5 rounded-full bg-yellow-400 flex-shrink-0" />
                <div>
                  <p className="text-base font-bold text-yellow-700 dark:text-yellow-300">
                    {displayLang === 'es' ? 'Amarillo — Espera moderada' : 'Yellow — Moderate wait'}
                  </p>
                  <p className="text-sm text-yellow-600 dark:text-yellow-400">20–45 {displayLang === 'es' ? 'minutos' : 'minutes'}</p>
                </div>
              </div>
              <div className="flex items-center gap-4 bg-red-50 dark:bg-red-900/20 rounded-2xl px-5 py-4">
                <span className="w-5 h-5 rounded-full bg-red-500 flex-shrink-0" />
                <div>
                  <p className="text-base font-bold text-red-700 dark:text-red-300">
                    {displayLang === 'es' ? 'Rojo — Espera larga' : 'Red — Long wait'}
                  </p>
                  <p className="text-sm text-red-600 dark:text-red-400">
                    {displayLang === 'es' ? '45+ minutos — planifica con tiempo' : '45+ minutes — plan ahead'}
                  </p>
                </div>
              </div>
            </div>
          </div>
        ) : !current.features ? (
          <div className="text-center">
            {current.emoji && (
              <div className="text-6xl mb-4">{current.emoji}</div>
            )}
            <h2 className="text-2xl font-bold text-gray-900 dark:text-gray-100 mb-3">
              {displayLang === 'es' ? current.title.es : current.title.en}
            </h2>
            <p className="text-base text-gray-600 dark:text-gray-300 leading-relaxed">
              {displayLang === 'es' ? current.body.es : current.body.en}
            </p>
          </div>
        ) : null}

        {/* Buttons */}
        <div className="mt-7 flex gap-3">
          <button
            onClick={dismiss}
            className="flex-1 py-3.5 rounded-2xl border border-gray-200 dark:border-gray-700 text-gray-500 dark:text-gray-400 text-base font-semibold"
          >
            {displayLang === 'es' ? 'Saltar' : 'Skip'}
          </button>
          <button
            onClick={next}
            className="flex-[2] py-3.5 rounded-2xl bg-blue-600 text-white text-base font-bold"
          >
            {isLast
              ? (displayLang === 'es' ? '¡Empezar!' : 'Get Started!')
              : (displayLang === 'es' ? 'Siguiente →' : 'Next →')}
          </button>
        </div>
      </div>
    </div>
  )
}
