'use client'

import { useState, useEffect } from 'react'
import Link from 'next/link'
import { useSearchParams, useRouter } from 'next/navigation'
import { useAuth } from '@/lib/useAuth'
import { useLang } from '@/lib/LangContext'
import { ArrowLeft, MessageCircle, CheckCircle2 } from 'lucide-react'
import { LangToggle } from '@/components/LangToggle'

// /bot/bind?channel=telegram&chat_id=12345
//
// Landing page when a bot user clicks the bind link from their first
// /start interaction. Once authed, posts to /api/bot/bind which writes
// the row to operator_bot_bindings linking chat_id → user.id.

export default function BotBindPage() {
  const { user, loading: authLoading } = useAuth()
  const router = useRouter()
  const params = useSearchParams()
  const { lang } = useLang()
  const channel = params.get('channel')
  const externalId = params.get('chat_id') || params.get('external_id')
  const [state, setState] = useState<'idle' | 'binding' | 'ok' | 'err'>('idle')
  const [error, setError] = useState('')

  useEffect(() => {
    if (!authLoading && !user) {
      const next = `/bot/bind?channel=${channel}&chat_id=${externalId}`
      router.push(`/login?next=${encodeURIComponent(next)}`)
    }
  }, [user, authLoading, router, channel, externalId])

  async function bind() {
    setState('binding')
    setError('')
    const res = await fetch('/api/bot/bind', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ channel, external_id: externalId }),
    })
    const data = await res.json()
    if (!res.ok) { setState('err'); setError(data.error || `${res.status}`); return }
    setState('ok')
  }

  if (authLoading || !user) {
    return <div className="min-h-screen bg-gray-50 dark:bg-gray-950 flex items-center justify-center"><div className="w-8 h-8 border-2 border-gray-300 border-t-gray-900 rounded-full animate-spin" /></div>
  }

  if (!channel || !externalId) {
    return (
      <main className="min-h-screen bg-gray-50 dark:bg-gray-950 flex items-center justify-center px-4">
        <div className="max-w-md text-center">
          <p className="text-sm text-gray-700 dark:text-gray-300">{lang === 'es' ? 'Link de vinculación inválido.' : 'Invalid bind link.'}</p>
          <Link href="/" className="text-blue-600 hover:underline text-sm mt-2 inline-block">← {lang === 'es' ? 'Inicio' : 'Home'}</Link>
        </div>
      </main>
    )
  }

  return (
    <main className="min-h-screen bg-gray-50 dark:bg-gray-950">
      <div className="max-w-md mx-auto px-4 pb-16">
        <div className="pt-6 pb-4 flex items-center justify-between gap-3">
          <Link href="/dashboard" className="p-2 rounded-xl bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700"><ArrowLeft className="w-4 h-4 text-gray-600 dark:text-gray-300" /></Link>
          <LangToggle />
        </div>
        <div className="bg-white dark:bg-gray-800 rounded-2xl border border-gray-200 dark:border-gray-700 p-6 shadow-sm">
          <div className="flex items-center gap-2 mb-2">
            <MessageCircle className="w-5 h-5 text-blue-600" />
            <h1 className="text-lg font-bold text-gray-900 dark:text-gray-100">
              {lang === 'es' ? 'Vincular bot' : 'Bind bot'}
            </h1>
          </div>
          <p className="text-sm text-gray-700 dark:text-gray-300 mb-2">
            {lang === 'es'
              ? `Vamos a conectar tu cuenta de Cruzar con tu ${channel === 'telegram' ? 'chat de Telegram' : channel}.`
              : `Connecting your Cruzar account to your ${channel === 'telegram' ? 'Telegram chat' : channel}.`}
          </p>
          <p className="text-xs text-gray-500 dark:text-gray-400 mb-5 font-mono">
            {channel} · {externalId.slice(0, 14)}…
          </p>

          {state === 'ok' ? (
            <div className="bg-emerald-50 dark:bg-emerald-900/20 border border-emerald-200 dark:border-emerald-800 rounded-xl p-4 mb-3">
              <p className="text-sm font-bold text-emerald-800 dark:text-emerald-300 flex items-center gap-1">
                <CheckCircle2 className="w-4 h-4" /> {lang === 'es' ? '¡Vinculado!' : 'Bound!'}
              </p>
              <p className="text-xs text-emerald-700 dark:text-emerald-400 mt-1">
                {lang === 'es' ? `Vuelve a ${channel === 'telegram' ? 'Telegram' : channel} y envía tu primer pedimento.` : `Go back to ${channel === 'telegram' ? 'Telegram' : channel} and send your first pedimento.`}
              </p>
            </div>
          ) : (
            <button
              onClick={bind}
              disabled={state === 'binding'}
              className="w-full py-2.5 rounded-xl bg-blue-600 text-white text-sm font-bold hover:bg-blue-700 disabled:opacity-50"
            >
              {state === 'binding' ? (lang === 'es' ? 'Vinculando…' : 'Binding…') : (lang === 'es' ? 'Vincular ahora' : 'Bind now')}
            </button>
          )}
          {state === 'err' && <p className="text-xs text-red-500 mt-2">{error}</p>}
        </div>
      </div>
    </main>
  )
}
