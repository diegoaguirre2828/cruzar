'use client'

import { useState, useEffect } from 'react'
import { useRouter } from 'next/navigation'
import Link from 'next/link'
import { createClient } from '@/lib/auth'
import { GoogleButton } from '@/components/GoogleButton'
import { AppleButton } from '@/components/AppleButton'
import { isIOSAppClient } from '@/lib/platform'
import { PhoneAuthForm } from '@/components/PhoneAuthForm'
import { BridgeLogo } from '@/components/BridgeLogo'
import { useLang } from '@/lib/LangContext'
import { PHONE_AUTH_ENABLED } from '@/lib/featureFlags'

function friendlyLoginError(raw: string, lang: 'es' | 'en'): string {
  const msg = raw.toLowerCase()
  const es = lang === 'es'
  if (msg.includes('invalid login credentials') || msg.includes('invalid password')) {
    return es ? 'Correo o contraseña incorrectos.' : 'Email or password incorrect.'
  }
  if (msg.includes('email not confirmed')) {
    return es
      ? 'Tu correo no está confirmado. Revisa tu bandeja o usa el botón de Google.'
      : 'Your email is not confirmed. Check your inbox or use Google sign-in.'
  }
  if (msg.includes('rate limit')) {
    return es ? 'Demasiados intentos. Espera un momento.' : 'Too many attempts. Wait a moment.'
  }
  if (msg.includes('network') || msg.includes('failed to fetch')) {
    return es
      ? 'Problema de conexión. Revisa tu internet.'
      : 'Connection issue. Check your internet.'
  }
  return raw
}

export default function LoginPage() {
  const router = useRouter()
  const { t, lang } = useLang()
  const es = lang === 'es'
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [error, setError] = useState('')
  const [loading, setLoading] = useState(false)
  const [mode, setMode] = useState<'password' | 'magic' | 'phone'>('password')
  const [magicSent, setMagicSent] = useState(false)

  function getNextPath() {
    if (typeof window === 'undefined') return '/'
    const next = new URLSearchParams(window.location.search).get('next')
    return next && next.startsWith('/') ? next : '/'
  }

  useEffect(() => {
    const supabase = createClient()
    supabase.auth.getUser().then(({ data }) => {
      if (data.user) router.replace(getNextPath())
    })
    // Show error banner if callback bounced us here with a reason
    if (typeof window !== 'undefined') {
      const cbError = new URLSearchParams(window.location.search).get('error')
      if (cbError) setError(friendlyLoginError(cbError, lang))
    }
  }, [router, lang])

  async function handleLogin(e: React.FormEvent) {
    e.preventDefault()
    setLoading(true)
    setError('')
    const supabase = createClient()
    const { error } = await supabase.auth.signInWithPassword({ email, password })
    if (error) {
      setError(friendlyLoginError(error.message, lang))
      setLoading(false)
    } else {
      router.push(getNextPath())
    }
  }

  async function handleMagicLink(e: React.FormEvent) {
    e.preventDefault()
    setLoading(true)
    setError('')
    const supabase = createClient()
    const { error } = await supabase.auth.signInWithOtp({
      email,
      options: {
        shouldCreateUser: false,
        emailRedirectTo: typeof window !== 'undefined'
          ? `${window.location.origin}/auth/callback?next=${encodeURIComponent(getNextPath())}`
          : undefined,
      },
    })
    if (error) {
      setError(friendlyLoginError(error.message, lang))
      setLoading(false)
      return
    }
    setMagicSent(true)
    setLoading(false)
  }

  return (
    <main className="min-h-screen bg-gray-50 flex items-center justify-center px-4">
      <div className="w-full max-w-sm">
        <div className="text-center mb-8">
          <h1 className="text-2xl font-bold text-gray-900 inline-flex items-center gap-2"><BridgeLogo size={28} /> Cruzar</h1>
          <p className="text-sm text-gray-500 mt-1">{t.loginSubtitle}</p>
        </div>

        <div className="bg-white rounded-2xl border border-gray-200 p-6 shadow-sm space-y-4">
          {/* Apple Sign-In: iOS-app only (Apple guideline 4.8). Web users
              keep the Google-first flow that funnel data favors. */}
          {isIOSAppClient() && <AppleButton label={es ? 'Continuar con Apple' : 'Continue with Apple'} />}
          <GoogleButton label={t.continueWithGoogle} />

          <div className="flex items-center gap-3">
            <div className="flex-1 h-px bg-gray-200" />
            <span className="text-xs text-gray-400">{es ? 'o' : 'or'}</span>
            <div className="flex-1 h-px bg-gray-200" />
          </div>

          {/* Mode toggle: phone / password / magic link. Phone tab gated
              on PHONE_AUTH_ENABLED until Twilio 10DLC registration clears. */}
          <div className={`grid gap-1.5 ${PHONE_AUTH_ENABLED ? 'grid-cols-3' : 'grid-cols-2'}`}>
            {PHONE_AUTH_ENABLED && (
              <button
                type="button"
                onClick={() => { setMode('phone'); setError(''); setMagicSent(false) }}
                className={`flex flex-col items-center gap-0.5 py-2 text-[11px] font-bold rounded-xl border-2 transition-all ${
                  mode === 'phone'
                    ? 'bg-blue-50 border-blue-500 text-blue-700'
                    : 'bg-white border-gray-200 text-gray-500 hover:border-gray-300'
                }`}
              >
                <span className="text-base">📱</span>
                <span>{es ? 'Por SMS' : 'Text me'}</span>
              </button>
            )}
            <button
              type="button"
              onClick={() => { setMode('password'); setError(''); setMagicSent(false) }}
              className={`flex flex-col items-center gap-0.5 py-2 text-[11px] font-bold rounded-xl border-2 transition-all ${
                mode === 'password'
                  ? 'bg-blue-50 border-blue-500 text-blue-700'
                  : 'bg-white border-gray-200 text-gray-500 hover:border-gray-300'
              }`}
            >
              <span className="text-base">🔒</span>
              <span>{es ? 'Con clave' : 'Password'}</span>
            </button>
            <button
              type="button"
              onClick={() => { setMode('magic'); setError(''); setMagicSent(false) }}
              className={`flex flex-col items-center gap-0.5 py-2 text-[11px] font-bold rounded-xl border-2 transition-all ${
                mode === 'magic'
                  ? 'bg-blue-50 border-blue-500 text-blue-700'
                  : 'bg-white border-gray-200 text-gray-500 hover:border-gray-300'
              }`}
            >
              <span className="text-base">✉️</span>
              <span>{es ? 'Por correo' : 'Email link'}</span>
            </button>
          </div>

          {mode === 'phone' ? (
            <PhoneAuthForm
              shouldCreateUser={false}
              onComplete={() => router.push(getNextPath())}
            />
          ) : magicSent ? (
            <div className="text-center py-3">
              <p className="text-2xl mb-1">📬</p>
              <p className="text-sm font-bold text-gray-900">{es ? 'Link enviado a' : 'Link sent to'}</p>
              <p className="text-sm text-blue-600 break-all">{email}</p>
              <p className="text-xs text-gray-500 mt-2">
                {es ? 'Ábrelo desde el mismo dispositivo.' : 'Open it from the same device.'}
              </p>
            </div>
          ) : (
            <form onSubmit={mode === 'magic' ? handleMagicLink : handleLogin} className="space-y-4">
              {error && (
                <div className="bg-red-50 border border-red-200 text-red-700 text-xs rounded-xl px-3 py-2">
                  {error}
                </div>
              )}
              <div>
                <label className="block text-xs font-medium text-gray-700 mb-1">{t.emailLabel}</label>
                <input
                  type="email"
                  value={email}
                  onChange={e => setEmail(e.target.value)}
                  required
                  autoFocus
                  autoComplete="email"
                  inputMode="email"
                  className="w-full border border-gray-200 rounded-xl px-3 py-3 text-sm text-gray-900 focus:outline-none focus:ring-2 focus:ring-blue-500"
                  placeholder="you@email.com"
                />
              </div>
              {mode === 'password' && (
                <div>
                  <div className="flex items-center justify-between mb-1">
                    <label className="block text-xs font-medium text-gray-700">{t.passwordLabel}</label>
                    <Link href="/reset-password" className="text-xs text-blue-600 hover:underline">
                      {t.forgotPassword}
                    </Link>
                  </div>
                  <input
                    type="password"
                    value={password}
                    onChange={e => setPassword(e.target.value)}
                    required
                    autoComplete="current-password"
                    className="w-full border border-gray-200 rounded-xl px-3 py-3 text-sm text-gray-900 focus:outline-none focus:ring-2 focus:ring-blue-500"
                    placeholder="••••••••"
                  />
                </div>
              )}
              <button
                type="submit"
                disabled={loading}
                className="w-full bg-gray-900 text-white text-sm font-bold py-3 rounded-xl hover:bg-gray-700 transition-colors disabled:opacity-50"
              >
                {loading
                  ? (es ? 'Enviando…' : 'Sending…')
                  : mode === 'magic'
                    ? (es ? '✉️ Enviarme link' : '✉️ Send me a link')
                    : t.signInBtn}
              </button>
            </form>
          )}
        </div>

        <p className="text-center text-sm text-gray-500 mt-4">
          {t.noAccount}{' '}
          <Link href="/signup" className="text-blue-600 font-medium hover:underline">
            {t.signUpFreeLink}
          </Link>
        </p>
        <p className="text-center mt-2">
          <Link href="/" className="text-xs text-gray-400 hover:underline">{t.backToMap}</Link>
        </p>
      </div>
    </main>
  )
}
