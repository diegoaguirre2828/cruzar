'use client'

import { useEffect, useState } from 'react'
import Link from 'next/link'
import { useAuth } from '@/lib/useAuth'
import { useTier } from '@/lib/useTier'
import { useLang } from '@/lib/LangContext'
import { Check, ArrowLeft } from 'lucide-react'
import { isIOSAppClient } from '@/lib/platform'
import { IOSSubscribeButton } from '@/components/IOSSubscribeButton'

export default function PricingPage() {
  const { user } = useAuth()
  const { tier: currentTier } = useTier()
  const { t, lang } = useLang()
  const es = lang === 'es'
  const [loading, setLoading] = useState<string | null>(null)
  const [checkoutError, setCheckoutError] = useState<string | null>(null)
  const [isIOSApp, setIsIOSApp] = useState(false)
  useEffect(() => { setIsIOSApp(isIOSAppClient()) }, [])

  const PLANS = [
    {
      id: 'free',
      name: es ? 'Gratis' : 'Free',
      price: '$0',
      period: t.freePeriod,
      color: 'border-gray-200 dark:border-gray-700',
      badge: null,
      desc: es
        ? 'Tiempos en vivo para los 52 cruces. Sin tarjeta. Sin trampa.'
        : 'Live wait times for every crossing. No credit card. No catch.',
      features: es
        ? ['Tiempos en vivo — los 52 cruces', 'Mapa interactivo con colores de espera', 'Filtrar por ciudad o región', 'Reportes de cruzantes en tiempo real', '1 cruce favorito guardado', 'En español y en inglés']
        : ['Live wait times — all 52 crossings', 'Interactive map with color-coded wait levels', 'Filter by city or region', 'Crowdsourced driver reports', '1 saved favorite crossing', 'English & Spanish'],
      cta: es ? 'Empezar gratis' : 'Get Started Free',
      href: '/signup',
    },
    {
      id: 'pro',
      name: 'Pro',
      price: '$2.99',
      period: '/month',
      color: 'border-blue-500',
      badge: t.mostPopular,
      desc: es
        ? 'Deja de perder tiempo en el puente. Te avisamos cuando tu cruce se despeja — por push, SMS o email. Prueba 7 días gratis.'
        : 'Stop wasting time at the border. Get notified the moment your crossing clears up — by push, SMS, or email. Try free for 7 days.',
      features: es
        ? ['Todo lo de Gratis', '🔔 Alertas push + SMS + email cuando baja la espera', '🔮 Patrones históricos — mejor hora para cruzar hoy', '🗺️ Optimizador de ruta — cruce más rápido cerca de ti', 'Cruces favoritos ilimitados', 'Alertas en español o inglés']
        : ['Everything in Free', '🔔 Push + SMS + email alerts when wait drops', '🔮 Historical patterns — best time to cross today', '🗺️ Route optimizer — fastest crossing near you right now', 'Unlimited saved crossings', 'Alerts in English or Spanish'],
      cta: es ? 'Empezar prueba gratis 7 días' : 'Start 7-Day Free Trial',
      tier: 'pro',
    },
    {
      id: 'business',
      name: 'Business',
      price: '$19.99',
      period: '/month',
      color: 'border-gray-900 dark:border-gray-100',
      badge: t.forFreight,
      desc: es
        ? 'Un solo camión demorado 15 minutos paga un mes entero. Prueba 14 días gratis — sin tarjeta.'
        : 'A single truck delayed 15 minutes pays for a whole month. Try free for 14 days — no card required.',
      features: es
        ? [
            'Todo lo de Pro',
            '🔗 Link de seguimiento público — mándalo por WhatsApp, tu cliente ve el estatus en vivo',
            '💸 Calculadora de $ perdido — total de la semana, por puente, por chofer',
            '📧 Reporte semanal de pérdida por demora (lunes 8am)',
            '🇲🇽 Reportes comunitarios SUR (nadie más lo tiene — CBP solo es norte)',
            '🚛 Centro de control de flota — carriles comerciales en vivo',
            '👷 Rastreo de chofer con GPS del teléfono (sin hardware)',
            '📦 Gestión de envíos con timeline de replay',
            '🔌 Integración con Samsara / Motive (OAuth)',
            '📥 Exportación CSV histórica',
            'Soporte prioritario por email',
          ]
        : [
            'Everything in Pro',
            '🔗 Public tracking link — share on WhatsApp, customer sees live status',
            '💸 Delay-cost dashboard — $ lost this week, by bridge, by driver',
            '📧 Weekly delay-loss report (Monday 8am)',
            '🇲🇽 Community SOUTHBOUND reports (nobody else has this — CBP is northbound-only)',
            '🚛 Fleet Command Center — live commercial lane data',
            '👷 Phone-GPS driver tracking (no hardware needed)',
            '📦 Shipment management with trip replay timeline',
            '🔌 Samsara / Motive integration (OAuth)',
            '📥 Historical CSV exports',
            'Priority email support',
          ],
      cta: es ? 'Empezar prueba gratis 14 días' : 'Start 14-Day Free Trial',
      tier: 'business',
    },
    {
      id: 'operator',
      name: 'Operator',
      price: '$99',
      period: '/month',
      color: 'border-amber-500',
      badge: es ? 'Para 3PL pequeños' : 'For small 3PLs',
      desc: es
        ? 'IA revisa tu pedimento, factura, USMCA en menos de 60 segundos. 2 horas de prep → 3 minutos. Hasta 34% más rápido en el puente.'
        : 'AI checks your pedimento, invoice, USMCA in under 60 seconds. 2hr prep → 3min. Up to 34% faster at the border.',
      features: es
        ? [
            'Validaciones ilimitadas — pedimento, factura, USMCA, lista de empaque, BL',
            'IA marca errores que disparan inspección secundaria',
            'Sugerencias específicas de corrección por campo',
            'Historial completo de validaciones',
            'Alertas diarias de inteligencia fronteriza incluidas',
          ]
        : [
            'Unlimited validations — pedimento, invoice, USMCA, packing list, BOL',
            'AI flags issues that trigger secondary inspection',
            'Field-by-field fix suggestions',
            'Full validation history',
            'Daily border intelligence alerts included',
          ],
      cta: es ? 'Empezar prueba gratis' : 'Start free trial',
      tier: 'operator',
    },
    {
      id: 'express_cert',
      name: 'Express Cert',
      price: '$499',
      period: es ? ' una sola vez' : ' one-time',
      color: 'border-emerald-500',
      badge: es ? 'Pago único' : 'One-time',
      desc: es
        ? 'Acelera tu certificación C-TPAT (US) u OEA (México). Te ahorra $50k+/año en demoras una vez aprobado.'
        : 'AI-assisted C-TPAT (US) or OEA (Mexico) certification. Saves $50k+/yr in delays once approved.',
      features: es
        ? [
            'Cuestionario de 20 preguntas — 30 minutos',
            'IA arma tu solicitud completa lista para enviar',
            'Carriles verdes permanentes una vez aprobado',
            'PDF imprimible para firmar y entregar',
          ]
        : [
            '20-question intake — 30 minutes',
            'AI builds the complete submission-ready application',
            'Permanent green-lane status once approved',
            'Printable PDF — sign and submit',
          ],
      cta: es ? 'Empezar' : 'Get started',
      tier: 'express_cert',
    },
    {
      id: 'intelligence',
      name: 'Intelligence',
      price: '$49',
      period: '/month',
      color: 'border-purple-500',
      badge: es ? 'Brief + alertas + dataset' : 'Brief + alerts + dataset',
      desc: es
        ? 'Alertas push en tiempo real cuando algo pasa en la frontera. Brief diario sintetizado. Filtros por categoría y corredor. Acceso completo al dataset.'
        : 'Real-time push alerts when border events fire. Daily synthesized brief. Per-category + per-corridor filters. Full dataset access.',
      features: es
        ? [
            'Alertas en tiempo real (cada 15 min) por correo',
            'Filtros por categoría (cártel, bloqueo, VUCEM, etc.) y corredor',
            'Brief diario por correo — 7am CT',
            'Acceso al dataset + descarga CSV',
            'Panel de suscriptor con historial',
            'Síntesis bilingüe — fuentes en español que nadie más procesa',
          ]
        : [
            'Real-time alerts (every 15 min) by email',
            'Per-category (cartel, blockade, VUCEM, etc.) + per-corridor filters',
            'Daily brief by email — 7am CT',
            'Full dataset access + CSV export',
            'Subscriber dashboard with history',
            'Bilingual MX-source synthesis (no one else does this)',
          ],
      cta: es ? 'Empezar prueba gratis 7 días' : 'Start 7-day free trial',
      tier: 'intelligence',
    },
    {
      id: 'intelligence_enterprise',
      name: 'Intelligence Enterprise',
      price: '$499',
      period: '/month',
      color: 'border-violet-700',
      badge: es ? 'Hablamos contigo' : 'Talk to us',
      desc: es
        ? 'Para VPs de cadena de suministro, aseguradoras y gobierno. Acceso directo a analista vía Slack, reportes personalizados, SLA en latencia de alertas.'
        : 'For supply chain VPs, underwriters, and government. Direct analyst access via Slack, custom reports, alert-latency SLA.',
      features: es
        ? [
            'Todo lo de Intelligence',
            'Canal de Slack con analista directo',
            'Reportes personalizados por corredor a demanda',
            'SLA en latencia de alertas',
            'Onboarding + integración a la medida',
          ]
        : [
            'Everything in Intelligence',
            'Slack channel with direct analyst access',
            'Custom corridor reports on demand',
            'SLA on alert latency',
            'Bespoke onboarding + integration support',
          ],
      cta: es ? 'Hablar con ventas' : 'Talk to sales',
      tier: 'intelligence_enterprise',
    },
  ]

  async function handleUpgrade(planTier: string) {
    if (!user) {
      window.location.href = `/signup?next=${encodeURIComponent('/pricing')}`
      return
    }
    setLoading(planTier)
    setCheckoutError(null)
    try {
      const res = await fetch('/api/stripe/checkout', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ tier: planTier }),
      })
      const data = await res.json().catch(() => ({ error: `Server returned ${res.status} (non-JSON)` }))
      if (!res.ok || !data.url) {
        setCheckoutError(data.error || (es ? 'No pudimos iniciar el pago. Intenta de nuevo.' : 'Could not start checkout. Try again.'))
        setLoading(null)
        return
      }
      window.location.href = data.url
    } catch (err) {
      setCheckoutError(
        (es ? 'Error de red: ' : 'Network error: ') +
          (err instanceof Error ? err.message : String(err))
      )
      setLoading(null)
    }
  }

  return (
    <main className="min-h-screen bg-gray-50 dark:bg-gray-950">
      <div className="max-w-4xl mx-auto px-4 pb-16">
        <div className="pt-8 pb-6">
          <Link href="/" className="flex items-center gap-1 text-xs text-gray-400 hover:text-gray-700 dark:hover:text-gray-200 mb-4">
            <ArrowLeft className="w-3 h-3" /> {t.backToMap}
          </Link>
          <h1 className="text-3xl font-bold text-gray-900 dark:text-gray-100">{t.pricingTitle}</h1>
          <p className="text-gray-500 dark:text-gray-400 mt-2">{t.pricingSubtitle}</p>

          {/* PWA install → 3 months Pro free. This is the primary acquisition
              hook and needs to be visible above the pricing cards, not hidden
              inside the install sheet. */}
          <div className="mt-4 bg-gradient-to-br from-amber-50 to-orange-50 dark:from-amber-900/20 dark:to-orange-900/20 border-2 border-amber-300 dark:border-amber-700/50 rounded-2xl px-5 py-4">
            <div className="flex items-start gap-3">
              <span className="text-2xl leading-none">🎁</span>
              <div className="flex-1">
                <p className="text-sm font-black text-amber-900 dark:text-amber-200 leading-tight">
                  {es ? '3 meses de Pro GRATIS — sin tarjeta' : '3 months of Pro FREE — no credit card'}
                </p>
                <p className="text-xs text-amber-800 dark:text-amber-300 mt-1 leading-snug">
                  {es
                    ? 'Agrega Cruzar a tu pantalla de inicio y desbloquea Pro por 90 días. Alertas, patrones históricos y optimizador de ruta — todo gratis.'
                    : 'Add Cruzar to your home screen and unlock Pro for 90 days. Alerts, historical patterns, and route optimizer — all free.'}
                </p>
              </div>
            </div>
          </div>

          {checkoutError && (
            <div className="mt-4 bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 text-red-700 dark:text-red-300 text-sm rounded-xl px-4 py-3">
              <p className="font-semibold mb-1">
                {es ? 'No pudimos iniciar el pago' : "Couldn't start checkout"}
              </p>
              <p className="text-xs">{checkoutError}</p>
            </div>
          )}
        </div>

        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          {PLANS.map(plan => {
            const isCurrent = currentTier === plan.id
            return (
              <div
                key={plan.id}
                className={`bg-white dark:bg-gray-800 rounded-2xl border-2 p-6 shadow-sm relative flex flex-col ${plan.color}`}
              >
                {plan.badge && (
                  <div className={`absolute -top-3 left-1/2 -translate-x-1/2 px-3 py-1 rounded-full text-xs font-semibold whitespace-nowrap ${
                    plan.id === 'pro' ? 'bg-blue-500 text-white' : 'bg-gray-900 dark:bg-gray-100 text-white dark:text-gray-900'
                  }`}>
                    {plan.badge}
                  </div>
                )}

                <div className="mb-4">
                  <h2 className="text-lg font-bold text-gray-900 dark:text-gray-100">{plan.name}</h2>
                  <div className="flex items-baseline gap-1 mt-1">
                    <span className="text-3xl font-bold text-gray-900 dark:text-gray-100">{plan.price}</span>
                    <span className="text-gray-400 text-sm">{plan.period}</span>
                  </div>
                  <p className="text-xs text-gray-500 dark:text-gray-400 mt-2 leading-relaxed">{plan.desc}</p>
                </div>

                <ul className="space-y-2 mb-6 flex-1">
                  {plan.features.map((f, i) => (
                    <li key={i} className="flex items-start gap-2 text-sm text-gray-700 dark:text-gray-300">
                      <Check className="w-4 h-4 text-green-500 flex-shrink-0 mt-0.5" />
                      {f}
                    </li>
                  ))}
                </ul>

                {isCurrent ? (
                  <div className="w-full text-center py-2.5 rounded-xl text-sm font-medium bg-gray-100 dark:bg-gray-700 text-gray-500 dark:text-gray-400">
                    {t.currentPlanLabel}
                  </div>
                ) : plan.href ? (
                  <Link
                    href={plan.href}
                    className="w-full text-center py-2.5 rounded-xl text-sm font-medium bg-gray-900 dark:bg-gray-100 text-white dark:text-gray-900 hover:bg-gray-700 transition-colors"
                  >
                    {plan.cta}
                  </Link>
                ) : isIOSApp && plan.id === 'pro' ? (
                  <IOSSubscribeButton ctaOverride={plan.cta} />
                ) : isIOSApp ? (
                  <div className="w-full text-center py-2.5 rounded-xl text-xs font-medium bg-gray-100 dark:bg-gray-800 text-gray-500 dark:text-gray-400 leading-snug px-3">
                    {es ? 'Solo para flotas' : 'Fleet accounts only'}
                  </div>
                ) : (
                  <button
                    onClick={() => handleUpgrade(plan.tier!)}
                    disabled={loading === plan.tier}
                    className={`w-full py-2.5 rounded-xl text-sm font-medium transition-colors disabled:opacity-50 ${
                      plan.id === 'pro'
                        ? 'bg-blue-500 text-white hover:bg-blue-600'
                        : 'bg-gray-900 dark:bg-gray-100 text-white dark:text-gray-900 hover:bg-gray-700'
                    }`}
                  >
                    {loading === plan.tier ? (es ? 'Redirigiendo...' : 'Redirecting...') : plan.cta}
                  </button>
                )}
              </div>
            )
          })}
        </div>

        {/* Business cost impact — the killer argument */}
        <div className="mt-6 bg-gray-900 dark:bg-gray-800 rounded-2xl p-6 text-white">
          <p className="text-xs font-bold text-amber-400 uppercase tracking-widest mb-2">
            {es ? '💰 El costo real de los retrasos' : '💰 The real cost of delays'}
          </p>
          <h3 className="text-xl font-bold mb-4">
            {es
              ? 'Un camión retrasado 1 hora cuesta más que un mes de Business.'
              : 'One truck delayed 1 hour costs more than a month of Business.'}
          </h3>
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 mb-4">
            {[
              {
                label: es ? 'Cruzante diario · 30 min perdidos/día' : 'Daily commuter · 30 min wasted/day',
                value: es ? '~$300/mes en tiempo' : '~$300/mo in lost time',
                color: 'bg-white/10',
              },
              {
                label: es ? 'Camión de carga · 1 hora extra en el puente' : 'Freight truck · 1 extra hour at border',
                value: es ? '~$75–150 por cruce' : '~$75–150 per crossing',
                color: 'bg-amber-500/20 border border-amber-500/30',
              },
              {
                label: es ? 'Flota de 5 camiones · 3 cruces/semana c/u' : 'Fleet of 5 trucks · 3 crossings/week each',
                value: es ? '~$4,500/mes en riesgo' : '~$4,500/mo at risk',
                color: 'bg-red-500/20 border border-red-500/30',
              },
            ].map(row => (
              <div key={row.label} className={`${row.color} rounded-xl p-3`}>
                <p className="text-xs text-gray-300 leading-snug">{row.label}</p>
                <p className="text-sm font-bold text-white mt-1">{row.value}</p>
              </div>
            ))}
          </div>
          <p className="text-sm text-amber-300 font-semibold">
            {es
              ? 'Pro se paga solo la primera vez que te ahorra 20 minutos. Business se paga en un solo camión.'
              : 'Pro pays for itself the first time it saves you 20 minutes. Business pays for itself on a single truck.'}
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
