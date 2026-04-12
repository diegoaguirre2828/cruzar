'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import Link from 'next/link'
import { createClient } from '@/lib/auth'
import { GoogleButton } from '@/components/GoogleButton'
import { PhoneButton } from '@/components/PhoneButton'
import { useLang } from '@/lib/LangContext'

const BENEFITS_ES = [
  { emoji: '🔔', text: 'Te avisamos cuando tu puente baje de 30 min' },
  { emoji: '⭐', text: 'Guarda tus puentes favoritos para verlos primero' },
  { emoji: '⚡', text: 'Toma 10 segundos — sin tarjeta, sin spam' },
]

const BENEFITS_EN = [
  { emoji: '🔔', text: 'We ping you when your bridge drops below 30 min' },
  { emoji: '⭐', text: 'Save your favorite crossings to see them first' },
  { emoji: '⚡', text: 'Takes 10 seconds — no card, no spam' },
]

export default function SignupPage() {
  const router = useRouter()
  const { lang } = useLang()
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [error, setError] = useState('')
  const [loading, setLoading] = useState(false)

  const benefits = lang === 'es' ? BENEFITS_ES : BENEFITS_EN

  async function handleSignup(e: React.FormEvent) {
    e.preventDefault()
    setLoading(true)
    setError('')
    const supabase = createClient()
    const { error } = await supabase.auth.signUp({ email, password })
    if (error) {
      setError(error.message)
      setLoading(false)
    } else {
      const ref = typeof window !== 'undefined' ? localStorage.getItem('cruzar_ref') : null
      if (ref) {
        try {
          await fetch('/api/referral/award', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ referrerId: ref, eventType: 'signup' }),
          })
        } catch { /* non-critical */ }
      }
      const nextParam =
        typeof window !== 'undefined'
          ? new URLSearchParams(window.location.search).get('next')
          : null
      router.push(nextParam && nextParam.startsWith('/') ? nextParam : '/dashboard')
    }
  }

  return (
    <main className="min-h-screen bg-gray-50 dark:bg-gray-950 flex items-center justify-center px-4 py-8">
      <div className="w-full max-w-sm">

        {/* Header */}
        <div className="text-center mb-5">
          <div className="text-4xl mb-3">🔔</div>
          <h1 className="text-2xl font-black text-gray-900 dark:text-gray-100">
            {lang === 'es' ? 'Avísame cuando baje mi puente' : 'Ping me when my bridge drops'}
          </h1>
          <p className="text-sm text-gray-500 dark:text-gray-400 mt-2">
            {lang === 'es'
              ? 'Activa tu primera alerta gratis — toma 10 segundos'
              : 'Turn on your first free alert — takes 10 seconds'}
          </p>
        </div>

        {/* Fast paths — lead with phone (RGV/WhatsApp audience) and Google */}
        <div className="space-y-3 mb-5">
          <PhoneButton label={lang === 'es' ? '📱 Continuar con mi teléfono' : '📱 Continue with my phone'} />
          <GoogleButton label={lang === 'es' ? 'Continuar con Google' : 'Continue with Google'} />
        </div>

        {/* Benefits — moved below the fast paths so they don't push the buttons offscreen */}
        <div className="space-y-2 mb-5">
          {benefits.map((b, i) => (
            <div key={i} className="flex items-center gap-3 bg-white dark:bg-gray-800 rounded-2xl px-4 py-2.5 border border-gray-100 dark:border-gray-700">
              <span className="text-lg flex-shrink-0">{b.emoji}</span>
              <p className="text-sm font-medium text-gray-700 dark:text-gray-200">{b.text}</p>
            </div>
          ))}
        </div>

        {/* Email fallback — collapsed by default, only for users who insist */}
        <details className="bg-white dark:bg-gray-800 rounded-2xl border border-gray-200 dark:border-gray-700 p-4 shadow-sm">
          <summary className="text-sm font-medium text-gray-600 dark:text-gray-300 cursor-pointer text-center">
            {lang === 'es' ? 'O usar correo y contraseña' : 'Or use email & password'}
          </summary>
          <form onSubmit={handleSignup} className="space-y-3 mt-4">
            {error && (
              <div className="bg-red-50 border border-red-200 text-red-600 text-sm rounded-xl px-4 py-3">
                {error}
              </div>
            )}

            <input
              type="email"
              value={email}
              onChange={e => setEmail(e.target.value)}
              required
              className="w-full border border-gray-200 dark:border-gray-600 dark:bg-gray-700 dark:text-gray-100 rounded-xl px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
              placeholder={lang === 'es' ? 'tu correo' : 'your email'}
            />

            <input
              type="password"
              value={password}
              onChange={e => setPassword(e.target.value)}
              required
              minLength={6}
              className="w-full border border-gray-200 dark:border-gray-600 dark:bg-gray-700 dark:text-gray-100 rounded-xl px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
              placeholder={lang === 'es' ? 'contraseña (mín. 6 caracteres)' : 'password (min. 6 chars)'}
            />

            <button
              type="submit"
              disabled={loading}
              className="w-full bg-blue-600 hover:bg-blue-700 text-white text-sm font-bold py-3.5 rounded-xl transition-colors disabled:opacity-50"
            >
              {loading
                ? (lang === 'es' ? 'Creando cuenta...' : 'Creating account...')
                : (lang === 'es' ? 'Activar mis alertas gratis →' : 'Activate my free alerts →')}
            </button>
          </form>
        </details>

        {/* Trust signals */}
        <p className="text-center text-xs text-gray-400 dark:text-gray-500 mt-4">
          {lang === 'es'
            ? 'Sin spam. Sin tarjeta de crédito. Cancela cuando quieras.'
            : 'No spam. No credit card. Cancel anytime.'}
        </p>

        <p className="text-center text-sm text-gray-500 dark:text-gray-400 mt-3">
          {lang === 'es' ? '¿Ya tienes cuenta?' : 'Already have an account?'}{' '}
          <Link href="/login" className="text-blue-600 font-medium hover:underline">
            {lang === 'es' ? 'Entrar' : 'Sign in'}
          </Link>
        </p>
      </div>
    </main>
  )
}
