'use client'

import { useEffect, useState, useCallback } from 'react'
import Link from 'next/link'
import { useSearchParams, useRouter } from 'next/navigation'
import { loadStripe, Stripe as StripeJs } from '@stripe/stripe-js'
import { EmbeddedCheckoutProvider, EmbeddedCheckout } from '@stripe/react-stripe-js'
import { useAuth } from '@/lib/useAuth'
import { useLang } from '@/lib/LangContext'
import { ArrowLeft } from 'lucide-react'
import { LangToggle } from '@/components/LangToggle'

// /checkout?tier=operator
//
// Embedded Stripe Checkout. Customer never leaves cruzar.app.
// Mounts the official Stripe iframe via @stripe/react-stripe-js
// EmbeddedCheckoutProvider. Falls back to a redirect if the
// embedded session can't be created.

let stripePromise: Promise<StripeJs | null> | null = null
function getStripeJs() {
  if (!stripePromise) {
    const pk = process.env.NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY
    if (!pk) return null
    stripePromise = loadStripe(pk)
  }
  return stripePromise
}

const VALID_TIERS = new Set(['pro', 'business', 'operator', 'express_cert', 'intelligence'])

export default function CheckoutPage() {
  const { user, loading: authLoading } = useAuth()
  const router = useRouter()
  const params = useSearchParams()
  const { lang } = useLang()
  const tier = params.get('tier')
  const [clientSecret, setClientSecret] = useState<string | null>(null)
  const [error, setError] = useState('')
  const [stripeReady, setStripeReady] = useState(false)

  useEffect(() => { setStripeReady(getStripeJs() != null) }, [])
  useEffect(() => {
    if (!authLoading && !user) router.push(`/login?next=${encodeURIComponent(`/checkout?tier=${tier || ''}`)}`)
  }, [user, authLoading, router, tier])

  const fetchSecret = useCallback(async () => {
    if (!tier || !VALID_TIERS.has(tier)) { setError(lang === 'es' ? 'Plan inválido' : 'Invalid plan'); return null }
    const res = await fetch('/api/stripe/embedded-session', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ tier }),
    })
    const data = await res.json()
    if (!res.ok || !data.client_secret) {
      setError(data.error || `${res.status}`)
      return null
    }
    return data.client_secret as string
  }, [tier, lang])

  useEffect(() => {
    if (!user) return
    fetchSecret().then((cs) => { if (cs) setClientSecret(cs) })
  }, [user, fetchSecret])

  if (authLoading || !user) {
    return <main className="min-h-screen bg-gray-50 dark:bg-gray-950 flex items-center justify-center"><div className="w-8 h-8 border-2 border-gray-300 border-t-gray-900 rounded-full animate-spin" /></main>
  }

  return (
    <main className="min-h-screen bg-gray-50 dark:bg-gray-950">
      <div className="max-w-2xl mx-auto px-4 pb-16">
        <div className="pt-6 pb-4 flex items-center justify-between gap-3">
          <Link href="/pricing" className="p-2 rounded-xl bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700"><ArrowLeft className="w-4 h-4 text-gray-600 dark:text-gray-300" /></Link>
          <LangToggle />
        </div>
        <div className="bg-white dark:bg-gray-800 rounded-2xl border border-gray-200 dark:border-gray-700 p-4 shadow-sm">
          {error ? (
            <div className="p-6 text-center">
              <p className="text-sm font-bold text-red-600 dark:text-red-400 mb-2">{lang === 'es' ? 'No pudimos iniciar el pago' : "Couldn't start checkout"}</p>
              <p className="text-xs text-gray-700 dark:text-gray-300 mb-4">{error}</p>
              <Link href="/pricing" className="text-sm font-semibold text-blue-600 dark:text-blue-400">{lang === 'es' ? '← Volver a precios' : '← Back to pricing'}</Link>
            </div>
          ) : !clientSecret || !stripeReady ? (
            <div className="p-12 flex items-center justify-center">
              <div className="w-6 h-6 border-2 border-gray-300 border-t-gray-900 rounded-full animate-spin" />
            </div>
          ) : (
            <EmbeddedCheckoutProvider stripe={getStripeJs()} options={{ clientSecret }}>
              <EmbeddedCheckout />
            </EmbeddedCheckoutProvider>
          )}
        </div>
      </div>
    </main>
  )
}
