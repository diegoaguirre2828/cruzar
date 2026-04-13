'use client'

import { useEffect, useState, use } from 'react'
import { useRouter } from 'next/navigation'
import Link from 'next/link'
import { useAuth } from '@/lib/useAuth'
import { useLang } from '@/lib/LangContext'

// Accept-invite landing page.
//
// Flow:
//   1. User clicks an invite link shared by a circle member → lands here
//   2. If not logged in → redirect to /signup?next=/circle/join/<token>
//   3. If logged in → POST to /api/circles/accept → show success
//   4. Redirect to /dashboard after 3 seconds (or tap button to go now)

export default function CircleJoinPage({ params }: { params: Promise<{ token: string }> }) {
  const { token } = use(params)
  const { user, loading: authLoading } = useAuth()
  const router = useRouter()
  const { lang } = useLang()
  const es = lang === 'es'
  const [state, setState] = useState<'pending' | 'joining' | 'joined' | 'error'>('pending')
  const [circleName, setCircleName] = useState<string | null>(null)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    if (authLoading) return
    if (!user) {
      router.replace(`/signup?next=${encodeURIComponent(`/circle/join/${token}`)}`)
      return
    }
    if (state !== 'pending') return
    setState('joining')
    fetch('/api/circles/accept', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ token }),
    })
      .then(async (r) => {
        const data = await r.json()
        if (!r.ok) {
          setError(data.error || 'Could not join')
          setState('error')
          return
        }
        setCircleName(data.circle_name || 'Circle')
        setState('joined')
        setTimeout(() => router.push('/dashboard'), 3500)
      })
      .catch((err) => {
        setError(err instanceof Error ? err.message : String(err))
        setState('error')
      })
  }, [authLoading, user, token, router, state])

  return (
    <main className="min-h-screen flex items-center justify-center bg-gradient-to-br from-blue-600 via-indigo-700 to-purple-800 text-white px-5 py-10">
      <div className="w-full max-w-sm bg-white/10 backdrop-blur-md rounded-3xl border border-white/20 p-6 shadow-2xl text-center">
        {(authLoading || state === 'joining') && (
          <>
            <p className="text-4xl mb-3">🤝</p>
            <p className="text-lg font-bold">{es ? 'Uniéndote al grupo…' : 'Joining the circle…'}</p>
          </>
        )}

        {state === 'joined' && (
          <>
            <div className="cruzar-stamp w-16 h-16 rounded-full bg-green-500 flex items-center justify-center mx-auto mb-3">
              <svg className="w-8 h-8 text-white" fill="none" stroke="currentColor" strokeWidth={3.5} viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" />
              </svg>
            </div>
            <p className="text-xl font-black">
              {es ? `Te uniste a ${circleName}` : `You joined ${circleName}`}
            </p>
            <p className="text-sm text-blue-100 mt-2 leading-relaxed">
              {es
                ? 'Ahora recibirás notificaciones cuando un miembro del grupo cruce algún puente.'
                : 'You\'ll now get notifications when a circle member crosses a bridge.'}
            </p>
            <Link
              href="/dashboard"
              className="inline-block mt-5 px-6 py-3 bg-white text-indigo-700 font-bold rounded-2xl"
            >
              {es ? 'Ir al dashboard →' : 'Go to dashboard →'}
            </Link>
          </>
        )}

        {state === 'error' && (
          <>
            <p className="text-4xl mb-3">😩</p>
            <p className="text-lg font-bold">{es ? 'No pudimos unirte' : "Couldn't join"}</p>
            <p className="text-sm text-red-200 mt-2">{error}</p>
            <Link
              href="/dashboard"
              className="inline-block mt-5 px-6 py-3 bg-white/20 border border-white/40 text-white font-bold rounded-2xl"
            >
              {es ? 'Ir al dashboard' : 'Go to dashboard'}
            </Link>
          </>
        )}
      </div>
    </main>
  )
}
