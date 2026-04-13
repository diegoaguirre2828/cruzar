'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import Link from 'next/link'
import { createClient } from '@/lib/auth'
import { GoogleButton } from '@/components/GoogleButton'
import { useLang } from '@/lib/LangContext'

type Mode = 'password' | 'magic'

// Translate Supabase auth error codes into friendly, non-scary text.
// The raw messages are English and technical; this maps them to the user's
// language and rewrites the worst offenders.
function friendlyError(raw: string, lang: 'es' | 'en'): string {
  const msg = raw.toLowerCase()
  const es = lang === 'es'
  if (msg.includes('rate limit') || msg.includes('email_send_rate')) {
    return es
      ? 'Demasiados registros en este momento. Usa el botón de Google arriba — es instantáneo.'
      : 'Too many signups right now. Use the Google button above — instant.'
  }
  if (msg.includes('already registered') || msg.includes('already been registered')) {
    return es
      ? 'Ya tienes una cuenta con este correo. Entra en la parte de abajo.'
      : 'You already have an account with this email. Sign in below.'
  }
  if (msg.includes('invalid email')) {
    return es ? 'Ese correo no parece válido. Revísalo.' : "That email doesn't look valid. Double check it."
  }
  if (msg.includes('password') && (msg.includes('short') || msg.includes('6'))) {
    return es ? 'La contraseña debe tener mínimo 6 caracteres.' : 'Password must be at least 6 characters.'
  }
  if (msg.includes('password')) {
    return es ? 'Revisa tu contraseña.' : 'Check your password.'
  }
  if (msg.includes('network') || msg.includes('failed to fetch')) {
    return es
      ? 'Problema de conexión. Revisa tu internet e intenta de nuevo.'
      : 'Connection issue. Check your internet and try again.'
  }
  // Fallback — surface the raw message but not the stack trace
  return raw
}

export default function SignupPage() {
  const router = useRouter()
  const { lang } = useLang()
  const es = lang === 'es'
  const [mode, setMode] = useState<Mode>('password')
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [error, setError] = useState('')
  const [loading, setLoading] = useState(false)
  const [magicSent, setMagicSent] = useState(false)

  async function handleSignup(e: React.FormEvent) {
    e.preventDefault()
    setLoading(true)
    setError('')
    const supabase = createClient()
    const { error } = await supabase.auth.signUp({
      email,
      password,
      options: {
        emailRedirectTo: typeof window !== 'undefined'
          ? `${window.location.origin}/auth/callback?next=/dashboard`
          : undefined,
      },
    })
    if (error) {
      setError(friendlyError(error.message, lang))
      setLoading(false)
      return
    }
    // Capture referral if present in localStorage
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
    // New users land on /welcome for the mandatory activation step (pick a
    // bridge + set an alert), not straight to the dashboard. This fixes the
    // 49% signup→dashboard leak — every new account now has at least one
    // saved crossing + one alert before they see the full app.
    const nextParam = typeof window !== 'undefined'
      ? new URLSearchParams(window.location.search).get('next')
      : null
    const destination = nextParam && nextParam.startsWith('/') ? nextParam : '/welcome'
    router.push(destination)
  }

  async function handleMagicLink(e: React.FormEvent) {
    e.preventDefault()
    setLoading(true)
    setError('')
    const supabase = createClient()
    const { error } = await supabase.auth.signInWithOtp({
      email,
      options: {
        shouldCreateUser: true,
        emailRedirectTo: typeof window !== 'undefined'
          ? `${window.location.origin}/auth/callback?next=/dashboard`
          : undefined,
      },
    })
    if (error) {
      setError(friendlyError(error.message, lang))
      setLoading(false)
      return
    }
    setMagicSent(true)
    setLoading(false)
  }

  return (
    <main className="min-h-screen bg-gray-50 dark:bg-gray-950 flex items-center justify-center px-4 py-8">
      <div className="w-full max-w-sm">

        {/* Header — tight, free-first, clear value prop */}
        <div className="text-center mb-5">
          <h1 className="text-3xl font-black text-gray-900 dark:text-gray-100 leading-tight">
            {es ? 'Entra gratis' : 'Sign up free'}
          </h1>
          <p className="text-sm text-gray-600 dark:text-gray-400 mt-2">
            {es
              ? 'Te avisamos cuando tu puente baje de 30 min'
              : "We'll ping you when your bridge drops below 30 min"}
          </p>
          <div className="mt-3 inline-flex items-center gap-2 text-[11px] font-bold text-green-700 dark:text-green-400 bg-green-50 dark:bg-green-900/30 px-3 py-1 rounded-full">
            ⚡ {es ? '10 segundos · sin tarjeta · sin spam' : '10 seconds · no card · no spam'}
          </div>
        </div>

        {/* Google — dominant fast path */}
        <div className="mb-4">
          <GoogleButton label={es ? 'Continuar con Google' : 'Continue with Google'} />
        </div>

        {/* OR divider */}
        <div className="flex items-center gap-3 my-4">
          <div className="flex-1 h-px bg-gray-200 dark:bg-gray-700" />
          <span className="text-[10px] uppercase tracking-wider text-gray-400 font-bold">
            {es ? 'o con correo' : 'or with email'}
          </span>
          <div className="flex-1 h-px bg-gray-200 dark:bg-gray-700" />
        </div>

        {/* Mode toggle */}
        <div className="flex bg-gray-100 dark:bg-gray-800 rounded-xl p-1 mb-3">
          <button
            type="button"
            onClick={() => { setMode('password'); setMagicSent(false); setError('') }}
            className={`flex-1 py-1.5 text-xs font-bold rounded-lg transition-colors ${
              mode === 'password' ? 'bg-white dark:bg-gray-700 text-gray-900 dark:text-gray-100 shadow-sm' : 'text-gray-500'
            }`}
          >
            {es ? 'Contraseña' : 'Password'}
          </button>
          <button
            type="button"
            onClick={() => { setMode('magic'); setMagicSent(false); setError('') }}
            className={`flex-1 py-1.5 text-xs font-bold rounded-lg transition-colors ${
              mode === 'magic' ? 'bg-white dark:bg-gray-700 text-gray-900 dark:text-gray-100 shadow-sm' : 'text-gray-500'
            }`}
          >
            ✉️ {es ? 'Link por correo' : 'Email link'}
          </button>
        </div>

        {/* Form — visible by default, no hidden <details> wrapper */}
        <div className="bg-white dark:bg-gray-800 rounded-2xl border border-gray-200 dark:border-gray-700 p-4 shadow-sm">
          {magicSent ? (
            <div className="text-center py-3">
              <p className="text-2xl mb-2">📬</p>
              <p className="text-sm font-bold text-gray-900 dark:text-gray-100">
                {es ? 'Link enviado a' : 'Link sent to'}
              </p>
              <p className="text-sm text-blue-600 dark:text-blue-400 break-all">{email}</p>
              <p className="text-xs text-gray-500 mt-2">
                {es ? 'Ábrelo desde el mismo dispositivo.' : 'Open it from the same device.'}
              </p>
            </div>
          ) : (
            <form onSubmit={mode === 'magic' ? handleMagicLink : handleSignup} className="space-y-3">
              {error && (
                <div className="bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 text-red-700 dark:text-red-300 text-xs rounded-xl px-3 py-2">
                  {error}
                </div>
              )}

              <input
                type="email"
                value={email}
                onChange={e => setEmail(e.target.value)}
                required
                autoFocus
                autoComplete="email"
                inputMode="email"
                className="w-full border border-gray-200 dark:border-gray-600 dark:bg-gray-700 dark:text-gray-100 rounded-xl px-3 py-3 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                placeholder={es ? 'tu correo' : 'your email'}
              />

              {mode === 'password' && (
                <input
                  type="password"
                  value={password}
                  onChange={e => setPassword(e.target.value)}
                  required
                  minLength={6}
                  autoComplete="new-password"
                  className="w-full border border-gray-200 dark:border-gray-600 dark:bg-gray-700 dark:text-gray-100 rounded-xl px-3 py-3 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                  placeholder={es ? 'contraseña (mín. 6 caracteres)' : 'password (min. 6 chars)'}
                />
              )}

              <button
                type="submit"
                disabled={loading}
                className="w-full bg-blue-600 hover:bg-blue-700 text-white text-sm font-bold py-3.5 rounded-xl transition-colors disabled:opacity-50"
              >
                {loading
                  ? (es ? 'Enviando…' : 'Sending…')
                  : mode === 'magic'
                    ? (es ? '✉️ Enviarme link' : '✉️ Send me a link')
                    : (es ? 'Crear cuenta →' : 'Create account →')}
              </button>
            </form>
          )}
        </div>

        <p className="text-center text-sm text-gray-500 dark:text-gray-400 mt-4">
          {es ? '¿Ya tienes cuenta?' : 'Already have an account?'}{' '}
          <Link href="/login" className="text-blue-600 font-medium hover:underline">
            {es ? 'Entrar' : 'Sign in'}
          </Link>
        </p>
        <p className="text-center mt-2">
          <Link href="/" className="text-[11px] text-gray-400 hover:underline">
            {es ? '← Volver al mapa' : '← Back to map'}
          </Link>
        </p>
      </div>
    </main>
  )
}
