'use client'

import { useState } from 'react'
import Link from 'next/link'
import { useAuth } from '@/lib/useAuth'
import { useTier } from '@/lib/useTier'
import { useLang } from '@/lib/LangContext'
import { Check, ArrowLeft } from 'lucide-react'

export default function PricingPage() {
  const { user } = useAuth()
  const { tier: currentTier } = useTier()
  const { t } = useLang()
  const [loading, setLoading] = useState<string | null>(null)

  const PLANS = [
    {
      id: 'free',
      name: 'Free',
      price: '$0',
      period: t.freePeriod,
      color: 'border-gray-200',
      badge: null,
      desc: 'Live wait times for every crossing. No credit card. No catch.',
      features: [
        'Live wait times — all 52 crossings',
        'Interactive map with color-coded wait levels',
        'Filter by city or region',
        'Crowdsourced driver reports',
        'Save up to 3 favorite crossings',
      ],
      cta: 'Get Started Free',
      href: '/signup',
    },
    {
      id: 'pro',
      name: 'Pro',
      price: '$2.99',
      period: '/month',
      color: 'border-blue-500',
      badge: t.mostPopular,
      desc: 'Stop wasting time at the border. Get notified the moment your crossing clears up — by push, SMS, or email.',
      features: [
        'Everything in Free',
        '🔔 Push + SMS + email alerts when wait drops',
        '🔮 Historical patterns — best time to cross today',
        '🗺️ Route optimizer — fastest crossing near you right now',
        'Unlimited saved crossings',
        '7-day free trial · cancel anytime',
      ],
      cta: 'Start 7-Day Free Trial',
      tier: 'pro',
    },
    {
      id: 'business',
      name: 'Business',
      price: '$49.99',
      period: '/month',
      color: 'border-gray-900',
      badge: t.forFreight,
      desc: 'One delayed truck costs more than this plan. Keep your fleet moving with real-time commercial lane intelligence.',
      features: [
        'Everything in Pro',
        '🚛 Fleet Command Center — commercial lane focus',
        '⚠️ Heavy delay watch list across all crossings',
        '📥 Historical CSV exports (up to 90 days)',
        '🔌 API access for your TMS or dispatch system',
        '📧 Weekly border intelligence email report',
        'Priority support via email',
      ],
      cta: 'Start Free Trial',
      tier: 'business',
    },
  ]

  async function handleUpgrade(planTier: string) {
    if (!user) {
      window.location.href = '/signup'
      return
    }
    setLoading(planTier)
    const res = await fetch('/api/stripe/checkout', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ tier: planTier }),
    })
    const { url } = await res.json()
    if (url) window.location.href = url
    setLoading(null)
  }

  return (
    <main className="min-h-screen bg-gray-50">
      <div className="max-w-4xl mx-auto px-4 pb-16">
        <div className="pt-8 pb-6">
          <Link href="/" className="flex items-center gap-1 text-xs text-gray-400 hover:text-gray-700 mb-4">
            <ArrowLeft className="w-3 h-3" /> {t.backToMap}
          </Link>
          <h1 className="text-3xl font-bold text-gray-900">{t.pricingTitle}</h1>
          <p className="text-gray-500 mt-2">{t.pricingSubtitle}</p>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          {PLANS.map(plan => {
            const isCurrent = currentTier === plan.id
            return (
              <div
                key={plan.id}
                className={`bg-white rounded-2xl border-2 p-6 shadow-sm relative flex flex-col ${plan.color}`}
              >
                {plan.badge && (
                  <div className={`absolute -top-3 left-1/2 -translate-x-1/2 px-3 py-1 rounded-full text-xs font-semibold whitespace-nowrap ${
                    plan.id === 'pro' ? 'bg-blue-500 text-white' : 'bg-gray-900 text-white'
                  }`}>
                    {plan.badge}
                  </div>
                )}

                <div className="mb-4">
                  <h2 className="text-lg font-bold text-gray-900">{plan.name}</h2>
                  <div className="flex items-baseline gap-1 mt-1">
                    <span className="text-3xl font-bold text-gray-900">{plan.price}</span>
                    <span className="text-gray-400 text-sm">{plan.period}</span>
                  </div>
                  <p className="text-xs text-gray-500 mt-2 leading-relaxed">{plan.desc}</p>
                </div>

                <ul className="space-y-2 mb-6 flex-1">
                  {plan.features.map((f, i) => (
                    <li key={i} className="flex items-start gap-2 text-sm text-gray-700">
                      <Check className="w-4 h-4 text-green-500 flex-shrink-0 mt-0.5" />
                      {f}
                    </li>
                  ))}
                </ul>

                {isCurrent ? (
                  <div className="w-full text-center py-2.5 rounded-xl text-sm font-medium bg-gray-100 text-gray-500">
                    {t.currentPlanLabel}
                  </div>
                ) : plan.href ? (
                  <Link
                    href={plan.href}
                    className="w-full text-center py-2.5 rounded-xl text-sm font-medium bg-gray-900 text-white hover:bg-gray-700 transition-colors"
                  >
                    {plan.cta}
                  </Link>
                ) : (
                  <button
                    onClick={() => handleUpgrade(plan.tier!)}
                    disabled={loading === plan.tier}
                    className={`w-full py-2.5 rounded-xl text-sm font-medium transition-colors disabled:opacity-50 ${
                      plan.id === 'pro'
                        ? 'bg-blue-500 text-white hover:bg-blue-600'
                        : 'bg-gray-900 text-white hover:bg-gray-700'
                    }`}
                  >
                    {loading === plan.tier ? 'Redirecting...' : plan.cta}
                  </button>
                )}
              </div>
            )
          })}
        </div>

        {/* ROI calculator */}
        <div className="mt-8 bg-blue-50 dark:bg-blue-900/20 border border-blue-200 dark:border-blue-800 rounded-2xl p-6">
          <h3 className="font-bold text-gray-900 dark:text-gray-100 text-base mb-3">{t.roiTitle}</h3>
          <div className="space-y-2 text-sm text-gray-700 dark:text-gray-300">
            <div className="flex justify-between">
              <span>Daily commuter · 30 min wasted/day</span>
              <span className="font-semibold">~$300/mo in lost time</span>
            </div>
            <div className="flex justify-between">
              <span>Freight truck · 1 extra hour at border</span>
              <span className="font-semibold">~$75–150 per crossing</span>
            </div>
            <div className="flex justify-between">
              <span>Fleet of 5 trucks · 3 crossings/week each</span>
              <span className="font-semibold">~$4,500/mo at risk</span>
            </div>
          </div>
          <p className="text-xs text-blue-600 dark:text-blue-400 mt-3 font-medium">
            Pro pays for itself the first time it saves you 20 minutes. Business pays for itself on a single truck.
          </p>
        </div>

        {/* Business advertise CTA */}
        <div className="mt-4 bg-amber-50 dark:bg-amber-900/20 border border-amber-200 dark:border-amber-800 rounded-2xl p-6 text-center">
          <h3 className="font-bold text-gray-900 dark:text-gray-100 text-lg">{t.advertiseCTA}</h3>
          <p className="text-gray-600 dark:text-gray-400 text-sm mt-1">{t.advertiseDesc}</p>
          <Link
            href="/advertise"
            className="inline-block mt-4 bg-amber-500 text-white font-medium px-6 py-2.5 rounded-xl hover:bg-amber-600 transition-colors text-sm"
          >
            {t.advertiseBtn}
          </Link>
        </div>
      </div>
    </main>
  )
}
