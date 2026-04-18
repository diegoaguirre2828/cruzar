'use client'

import { useState, useEffect } from 'react'
import { useRouter } from 'next/navigation'
import Link from 'next/link'
import { createClient } from '@/lib/auth'
import { GoogleButton } from '@/components/GoogleButton'
import { PhoneAuthForm } from '@/components/PhoneAuthForm'
import { useLang } from '@/lib/LangContext'
import { PHONE_AUTH_ENABLED } from '@/lib/featureFlags'

type Mode = 'password' | 'magic' | 'phone'

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

// Lightweight funnel tracking — fire-and-forget, non-blocking.
function trackFunnel(event: string, meta?: Record<string, unknown>) {
  const sessionId = typeof window !== 'undefined'
    ? (sessionStorage.getItem('cruzar_sid') || (() => {
        const id = Math.random().toString(36).slice(2)
        sessionStorage.setItem('cruzar_sid', id)
        return id
      })())
    : null
  fetch('/api/funnel', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      event,
      page: typeof window !== 'undefined' ? window.location.pathname : null,
      referrer: typeof document !== 'undefined' ? document.referrer : null,
      sessionId,
      meta,
    }),
  }).catch(() => {})
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

  // Track page view on mount
  useState(() => { trackFunnel('signup_page_view') })

  // Capture ?ref= query param from URL (set by /r/[code] redirect)
  // and store it in localStorage for post-signup completion
  useEffect(() => {
    if (typeof window === 'undefined') return
    const ref = new URLSearchParams(window.location.search).get('ref')
    if (ref && ref.length >= 4) {
      try {
        localStorage.setItem('cruzar_referral_code', ref)
      } catch { /* ignore */ }
    }
  }, [])

  // FB / IG / WhatsApp / TikTok in-app browser check. Signup inside an
  // IAB is a dead end: cookies don't survive the escape to Safari, so
  // the user has to signup AGAIN after escaping to actually install and
  // claim Pro. Block the signup form here and point them at the real
  // browser first, so the signup they complete actually "sticks."
  const isIab = typeof navigator !== 'undefined' &&
    /FBAN|FBAV|FB_IAB|FBIOS|Instagram|Musical_ly|Bytedance|TikTok|LINE|MicroMessenger|Messenger|WhatsApp|Twitter|X-App|Snapchat|GSA\/|Pinterest|RedditMobile/i.test(navigator.userAgent || '')

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
          ? `${window.location.origin}/auth/callback?next=/welcome`
          : undefined,
      },
    })
    if (error) {
      setError(friendlyError(error.message, lang))
      setLoading(false)
      return
    }
    // Capture referral if present in localStorage (old system — user ID based)
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
    // Complete referral via new short-code system (/r/[code] links)
    const refCode = typeof window !== 'undefined' ? localStorage.getItem('cruzar_referral_code') : null
    if (refCode) {
      try {
        await fetch('/api/referral/complete', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ referral_code: refCode }),
        })
        localStorage.removeItem('cruzar_referral_code')
      } catch { /* non-critical */ }
    }
    trackFunnel('signup_complete', { method: mode })
    // Always route new signups through /welcome (install carrot + alert
    // setup). Pass through any `next` param so /welcome forwards the user
    // to their intended destination AFTER completing the install step.
    // Previously, signups with `?next=/port/X` skipped /welcome entirely
    // — they never saw the 3-month Pro install offer. That was a direct
    // cause of the "signups but 0 PWA installs" pattern Diego flagged.
    const nextParam = typeof window !== 'undefined'
      ? new URLSearchParams(window.location.search).get('next')
      : null
    const safeNext = nextParam && nextParam.startsWith('/') && nextParam !== '/welcome'
      ? nextParam
      : null
    const destination = safeNext
      ? `/welcome?next=${encodeURIComponent(safeNext)}`
      : '/welcome'
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
          ? `${window.location.origin}/auth/callback?next=/welcome`
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

  // FB / IG / TikTok / WhatsApp webview signup is a dead end: cookies
  // don't survive the escape to Safari, and the 3-month Pro grant can
  // only fire on an installed PWA. Block the form, show clear escape.
  if (isIab) {
    const href = typeof window !== 'undefined' ? window.location.href : 'https://cruzar.app/signup'
    return (
      <main className="min-h-screen bg-gradient-to-br from-amber-500 via-orange-600 to-pink-700 text-white flex items-center justify-center px-4 py-8">
        <div className="w-full max-w-sm">
          <div className="bg-white/15 backdrop-blur-sm border border-white/25 rounded-3xl p-6 text-center">
            <p className="text-4xl leading-none mb-3">⚠️</p>
            <h1 className="text-2xl font-black leading-tight">
              {es
                ? 'Abre cruzar.app en Safari primero'
                : 'Open cruzar.app in Safari first'}
            </h1>
            <p className="text-sm text-amber-100 mt-3 leading-snug">
              {es
                ? 'Estás usando el navegador de Facebook / Instagram. No puede agregar apps a tu pantalla de inicio, y los 3 meses de Pro gratis solo se activan con la app instalada.'
                : "You're in Facebook / Instagram's built-in browser. It can't add apps to your home screen, and the 3 months of free Pro only activates with the app installed."}
            </p>
            <div className="mt-5 bg-white/15 rounded-2xl p-4 text-left space-y-2 text-[13px]">
              <p className="font-bold">{es ? 'iPhone:' : 'iPhone:'}</p>
              <p className="text-amber-100 leading-snug">
                {es
                  ? 'Toca los 3 puntitos (⋯) arriba a la derecha → "Abrir en Safari"'
                  : 'Tap the 3 dots (⋯) top-right → "Open in Safari"'}
              </p>
              <p className="font-bold mt-2">{es ? 'Android:' : 'Android:'}</p>
              <p className="text-amber-100 leading-snug">
                {es
                  ? 'Toca los 3 puntitos (⋮) arriba → "Abrir en navegador" → Chrome'
                  : 'Tap the 3 dots (⋮) top → "Open in browser" → Chrome'}
              </p>
            </div>
            <button
              type="button"
              onClick={() => {
                try { navigator.clipboard.writeText(href).catch(() => {}) } catch {}
              }}
              className="mt-5 w-full bg-white text-orange-700 font-black py-3 rounded-2xl"
            >
              {es ? 'Copiar link pa\' pegar en Safari' : 'Copy link to paste in Safari'}
            </button>
            <p className="mt-3 text-[11px] text-amber-100/80 leading-snug">
              {es
                ? 'Una vez en Safari, pega el link y registrate ahí pa\' que la app funcione bien.'
                : 'Once in Safari, paste the link and sign up there so the app works properly.'}
            </p>
          </div>
        </div>
      </main>
    )
  }

  return (
    <main className="min-h-screen bg-gray-50 dark:bg-gray-950 flex items-center justify-center px-4 py-8">
      <div className="w-full max-w-sm">

        {/* Header — value-first. Funnel data 2026-04-17: 82% of /signup
            visitors never tap a method — they land cold from FB without
            knowing what Cruzar is. Hero now leads with concrete what +
            why, not generic "sign up free." */}
        <div className="text-center mb-5">
          <div className="inline-flex items-center gap-1.5 mb-3 px-3 py-1 rounded-full bg-gradient-to-r from-amber-400/20 to-orange-500/20 border border-amber-300 dark:border-amber-600/40">
            <span className="text-sm">🎁</span>
            <span className="text-[11px] font-black text-amber-700 dark:text-amber-300 uppercase tracking-wide">
              {es ? '3 meses Pro gratis al instalar' : '3 months Pro free on install'}
            </span>
          </div>
          <h1 className="text-2xl sm:text-3xl font-black text-gray-900 dark:text-gray-100 leading-[1.1]">
            {es
              ? 'Te avisamos cuando tu puente esté rápido — antes de salir.'
              : 'Get pinged when your bridge clears — before you leave.'}
          </h1>
          <p className="text-sm text-gray-600 dark:text-gray-400 mt-3 leading-snug">
            {es
              ? 'Cruzar tiene los tiempos en vivo de los 52 puentes US-México. Crea cuenta y elige el tuyo.'
              : 'Cruzar shows live wait times for all 52 US-Mexico bridges. Create an account and pick yours.'}
          </p>
          <div className="mt-3 flex items-center justify-center gap-2 flex-wrap">
            <span className="inline-flex items-center gap-1 text-[10px] font-bold text-green-700 dark:text-green-400 bg-green-50 dark:bg-green-900/30 px-2 py-0.5 rounded-full">
              ⚡ {es ? '10 segundos' : '10 seconds'}
            </span>
            <span className="inline-flex items-center gap-1 text-[10px] font-bold text-green-700 dark:text-green-400 bg-green-50 dark:bg-green-900/30 px-2 py-0.5 rounded-full">
              💳 {es ? 'sin tarjeta' : 'no card'}
            </span>
            <span className="inline-flex items-center gap-1 text-[10px] font-bold text-green-700 dark:text-green-400 bg-green-50 dark:bg-green-900/30 px-2 py-0.5 rounded-full">
              🤐 {es ? 'sin spam' : 'no spam'}
            </span>
          </div>
        </div>

        {/* Google — dominant fast path */}
        <div className="mb-4" onClick={() => trackFunnel('signup_method_click', { method: 'google' })}>
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

        {/* Mode toggle — ways to sign up. Phone tab is gated on
            PHONE_AUTH_ENABLED until Twilio 10DLC registration clears. */}
        <div className={`grid gap-1.5 mb-3 ${PHONE_AUTH_ENABLED ? 'grid-cols-3' : 'grid-cols-2'}`}>
          {PHONE_AUTH_ENABLED && (
            <button
              type="button"
              onClick={() => { setMode('phone'); setMagicSent(false); setError(''); trackFunnel('signup_method_click', { method: 'phone' }) }}
              className={`flex flex-col items-center gap-0.5 py-2 text-[11px] font-bold rounded-xl border-2 transition-all ${
                mode === 'phone'
                  ? 'bg-blue-50 dark:bg-blue-900/30 border-blue-500 text-blue-700 dark:text-blue-300'
                  : 'bg-white dark:bg-gray-800 border-gray-200 dark:border-gray-700 text-gray-500 hover:border-gray-300'
              }`}
            >
              <span className="text-base">📱</span>
              <span>{es ? 'Por SMS' : 'Text me'}</span>
            </button>
          )}
          <button
            type="button"
            onClick={() => { setMode('password'); setMagicSent(false); setError(''); trackFunnel('signup_method_click', { method: 'password' }) }}
            className={`flex flex-col items-center gap-0.5 py-2 text-[11px] font-bold rounded-xl border-2 transition-all ${
              mode === 'password'
                ? 'bg-blue-50 dark:bg-blue-900/30 border-blue-500 text-blue-700 dark:text-blue-300'
                : 'bg-white dark:bg-gray-800 border-gray-200 dark:border-gray-700 text-gray-500 hover:border-gray-300'
            }`}
          >
            <span className="text-base">🔒</span>
            <span>{es ? 'Con clave' : 'Password'}</span>
          </button>
          <button
            type="button"
            onClick={() => { setMode('magic'); setMagicSent(false); setError(''); trackFunnel('signup_method_click', { method: 'magic' }) }}
            className={`flex flex-col items-center gap-0.5 py-2 text-[11px] font-bold rounded-xl border-2 transition-all ${
              mode === 'magic'
                ? 'bg-blue-50 dark:bg-blue-900/30 border-blue-500 text-blue-700 dark:text-blue-300'
                : 'bg-white dark:bg-gray-800 border-gray-200 dark:border-gray-700 text-gray-500 hover:border-gray-300'
            }`}
          >
            <span className="text-base">✉️</span>
            <span>{es ? 'Por correo' : 'Email link'}</span>
          </button>
        </div>

        {/* Form — visible by default, no hidden <details> wrapper */}
        <div className="bg-white dark:bg-gray-800 rounded-2xl border border-gray-200 dark:border-gray-700 p-4 shadow-sm">
          {mode === 'phone' ? (
            <PhoneAuthForm
              shouldCreateUser={true}
              onComplete={(isNew) => {
                const ref = typeof window !== 'undefined' ? localStorage.getItem('cruzar_ref') : null
                if (ref && isNew) {
                  fetch('/api/referral/award', {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({ referrerId: ref, eventType: 'signup' }),
                  }).catch(() => {})
                }
                // Complete referral via new short-code system
                const refCode = typeof window !== 'undefined' ? localStorage.getItem('cruzar_referral_code') : null
                if (refCode && isNew) {
                  fetch('/api/referral/complete', {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({ referral_code: refCode }),
                  }).then(() => {
                    try { localStorage.removeItem('cruzar_referral_code') } catch {}
                  }).catch(() => {})
                }
                // Route NEW signups through /welcome (install carrot)
                // regardless of `next=` — same fix as the email/password
                // path. Existing-user sign-ins can go straight to next.
                const nextParam = typeof window !== 'undefined'
                  ? new URLSearchParams(window.location.search).get('next')
                  : null
                const safeNext = nextParam && nextParam.startsWith('/') && nextParam !== '/welcome'
                  ? nextParam
                  : null
                let destination: string
                if (isNew) {
                  destination = safeNext ? `/welcome?next=${encodeURIComponent(safeNext)}` : '/welcome'
                } else {
                  destination = safeNext || '/dashboard'
                }
                router.push(destination)
              }}
            />
          ) : magicSent ? (
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
