'use client'

import { useState } from 'react'

export function SubscribeForm() {
  const [email, setEmail] = useState('')
  const [state, setState] = useState<'idle' | 'submitting' | 'ok' | 'error'>('idle')
  const [error, setError] = useState('')

  async function submit(e: React.FormEvent) {
    e.preventDefault()
    if (!email) return
    setState('submitting')
    setError('')
    const res = await fetch('/api/intelligence/subscribe', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ email }),
    })
    const data = await res.json()
    if (res.ok) {
      setState('ok')
      setEmail('')
    } else {
      setState('error')
      setError(data.error || `${res.status}`)
    }
  }

  if (state === 'ok') {
    return (
      <p className="text-sm font-bold text-emerald-700 dark:text-emerald-400">
        ✓ You&apos;re in. First brief lands tomorrow at 7am CT.
      </p>
    )
  }

  return (
    <form onSubmit={submit} className="flex flex-col sm:flex-row gap-2">
      <input
        type="email"
        value={email}
        onChange={(e) => setEmail(e.target.value)}
        placeholder="you@example.com"
        required
        className="flex-1 text-sm px-3 py-2.5 rounded-xl border border-gray-300 dark:border-gray-700 bg-white dark:bg-gray-900"
      />
      <button
        type="submit"
        disabled={state === 'submitting'}
        className="px-5 py-2.5 rounded-xl bg-gray-900 dark:bg-gray-100 dark:text-gray-900 text-white text-sm font-bold disabled:opacity-50"
      >
        {state === 'submitting' ? 'Subscribing…' : 'Get the daily brief — free'}
      </button>
      {state === 'error' && <p className="text-xs text-red-500 sm:basis-full">{error}</p>}
    </form>
  )
}
