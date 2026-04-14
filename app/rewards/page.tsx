'use client'

import { useState, useEffect } from 'react'
import Link from 'next/link'
import { useAuth } from '@/lib/useAuth'
import { useLang } from '@/lib/LangContext'
import { ArrowLeft, Gift, MapPin, Star, Lock, ChevronRight, CheckCircle, X } from 'lucide-react'
import { LockedFeatureWall } from '@/components/LockedFeatureWall'

interface Business {
  id: string
  name: string
  description: string
  address: string
  category: string
  logo_emoji: string
  port_ids: string[]
}

interface Deal {
  id: string
  business_id: string
  title: string
  description: string
  points_required: number
  deal_code: string | null
  expires_at: string | null
  redemptions_count: number
}

const CATEGORY_LABEL: Record<string, string> = {
  restaurant: '🍽️ Restaurant', cafe: '☕ Café', gas: '⛽ Gas Station',
  pharmacy: '💊 Pharmacy', tire: '🔧 Auto / Tires', exchange: '💱 Money Exchange',
  other: '🏪 Business',
}

const ALL_PORTS_LABEL: Record<string, string> = {
  '230501': 'McAllen / Hidalgo', '230502': 'Pharr–Reynosa', '230503': 'Anzaldúas',
  '230401': 'Laredo I', '230402': 'Laredo II', '230403': 'Colombia', '230404': 'Laredo IV',
  '535501': 'Brownsville Gateway', '535502': 'Brownsville Veterans', '535503': 'Los Tomates',
  '230301': 'Eagle Pass I', '230302': 'Eagle Pass II', '230701': 'Rio Grande City',
  '231001': 'Roma', '240201': 'El Paso', '250401': 'San Ysidro', '250601': 'Otay Mesa',
}

export default function RewardsPage() {
  const { user } = useAuth()
  const { lang } = useLang()
  const [businesses, setBusinesses] = useState<Business[]>([])
  const [deals, setDeals] = useState<Deal[]>([])
  const [userPoints, setUserPoints] = useState(0)
  const [loading, setLoading] = useState(true)
  const [redeeming, setRedeeming] = useState<string | null>(null)
  const [redeemResult, setRedeemResult] = useState<{ dealId: string; code: string; points: number } | null>(null)
  const [error, setError] = useState('')
  const [showSignup, setShowSignup] = useState(false)
  const [signupForm, setSignupForm] = useState({ name: '', email: '', description: '', address: '', phone: '', website: '', category: 'restaurant' })
  const [signupSent, setSignupSent] = useState(false)

  useEffect(() => {
    fetch('/api/rewards').then(r => r.json()).then(d => {
      setBusinesses(d.businesses || [])
      setDeals(d.deals || [])
    }).finally(() => setLoading(false))

    if (user) {
      fetch('/api/profile').then(r => r.json()).then(d => setUserPoints(d.profile?.points || 0))
    }
  }, [user])

  async function redeem(deal: Deal) {
    if (!user) return
    setRedeeming(deal.id)
    setError('')
    const res = await fetch('/api/rewards/redeem', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ dealId: deal.id }),
    })
    const data = await res.json()
    if (!res.ok) {
      setError(data.error || 'Could not redeem')
    } else {
      setRedeemResult({ dealId: deal.id, code: data.dealCode, points: data.pointsSpent })
      setUserPoints(data.remainingPoints)
    }
    setRedeeming(null)
  }

  async function submitSignup() {
    await fetch('/api/rewards', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ ...signupForm, portIds: [] }),
    })
    setSignupSent(true)
  }

  const dealsForBusiness = (bizId: string) => deals.filter(d => d.business_id === bizId)

  return (
    <main className="min-h-screen bg-gray-50 dark:bg-gray-950">
      <div className="max-w-lg mx-auto px-4 pb-16">
        <div className="pt-6 pb-4 flex items-center gap-3">
          <Link href="/" className="p-2 rounded-xl bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 text-gray-600 dark:text-gray-400">
            <ArrowLeft className="w-4 h-4" />
          </Link>
          <div className="flex-1">
            <div className="flex items-center gap-2">
              <h1 className="text-xl font-bold text-gray-900 dark:text-gray-100">
                {lang === 'es' ? '🎁 Recompensas' : '🎁 Rewards'}
              </h1>
              <span className="text-xs font-bold text-purple-600 dark:text-purple-400 bg-purple-50 dark:bg-purple-900/30 border border-purple-200 dark:border-purple-800 px-2 py-0.5 rounded-full">
                {lang === 'es' ? 'Próximamente' : 'Coming Soon'}
              </span>
            </div>
            <p className="text-xs text-gray-500 dark:text-gray-400">
              {lang === 'es' ? 'Acumula puntos ahora — canjéalos cuando lleguen los negocios' : 'Earn points now — redeem when businesses go live'}
            </p>
          </div>
          {user && (
            <div className="bg-purple-50 dark:bg-purple-900/20 border border-purple-200 dark:border-purple-800 rounded-xl px-3 py-1.5 text-center">
              <p className="text-lg font-bold text-purple-700 dark:text-purple-300">{userPoints}</p>
              <p className="text-xs text-purple-500">{lang === 'es' ? 'pts' : 'pts'}</p>
            </div>
          )}
        </div>

        {/* Guest preview lock — per Diego's 2026-04-14 direction:
            preview accessible, heavy signup recommendation. Guests
            see the rewards system as a teaser with a prominent
            signup CTA at the top. */}
        {!user && (
          <div className="mb-5">
            <LockedFeatureWall
              nextPath="/rewards"
              featureTitleEs={lang === 'es' ? 'Acumula puntos canjeables' : 'Earn redeemable points'}
              featureTitleEn="Earn redeemable points"
              summaryEs="Cada reporte de tiempo de espera suma puntos. Canjéalos por descuentos en negocios cerca de los puentes — restaurantes, farmacias, casas de cambio, llanteras."
              summaryEn="Every wait-time report earns points. Redeem them for discounts at businesses near the crossings — restaurants, pharmacies, exchange houses, tire shops."
              unlocks={[
                { es: '+5 a +15 puntos por cada reporte', en: '+5 to +15 points per report' },
                { es: 'Bonus por primer reporte del día', en: 'Bonus for first report of the day' },
                { es: 'Descuentos reales en negocios locales', en: 'Real discounts at local businesses' },
                { es: 'Acumula desde hoy — canjea cuando lleguen', en: 'Earn starting today — redeem when businesses go live' },
              ]}
            />
          </div>
        )}

        {/* How it works */}
        <div className="bg-gradient-to-r from-purple-600 to-blue-600 rounded-2xl p-5 mb-5 text-white">
          <p className="font-bold text-base mb-2">
            {lang === 'es' ? 'Reporta → Gana → Canjea' : 'Report → Earn → Redeem'}
          </p>
          <div className="grid grid-cols-3 gap-2 text-center">
            {[
              { icon: '📢', label: lang === 'es' ? 'Reporta condiciones' : 'Report conditions', sub: lang === 'es' ? '+5 a +15 pts' : '+5 to +15 pts' },
              { icon: '⭐', label: lang === 'es' ? 'Acumula puntos' : 'Earn points', sub: lang === 'es' ? 'Por cada reporte' : 'Per report' },
              { icon: '🎁', label: lang === 'es' ? 'Canjea aquí' : 'Redeem here', sub: lang === 'es' ? 'Descuentos reales' : 'Real discounts' },
            ].map(s => (
              <div key={s.icon} className="bg-white/10 rounded-xl p-2">
                <p className="text-xl mb-1">{s.icon}</p>
                <p className="text-xs font-semibold leading-tight">{s.label}</p>
                <p className="text-xs opacity-70 mt-0.5">{s.sub}</p>
              </div>
            ))}
          </div>
        </div>

        {!user && (
          <div className="bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-2xl p-4 mb-4 flex items-center gap-3">
            <Lock className="w-5 h-5 text-gray-400 flex-shrink-0" />
            <div className="flex-1">
              <p className="text-sm font-semibold text-gray-700 dark:text-gray-300">
                {lang === 'es' ? 'Inicia sesión para canjear' : 'Sign in to redeem deals'}
              </p>
              <p className="text-xs text-gray-400">{lang === 'es' ? 'Gratis, sin tarjeta' : 'Free, no card needed'}</p>
            </div>
            <Link href="/login" className="text-xs font-semibold text-white bg-gray-900 dark:bg-gray-100 dark:text-gray-900 px-3 py-2 rounded-xl">
              {lang === 'es' ? 'Entrar' : 'Sign in'}
            </Link>
          </div>
        )}

        {/* Redeem success modal */}
        {redeemResult && (
          <div className="fixed inset-0 bg-black/60 flex items-center justify-center z-50 px-6">
            <div className="bg-white dark:bg-gray-800 rounded-3xl p-6 w-full max-w-sm text-center shadow-2xl">
              <p className="text-4xl mb-3">🎉</p>
              <p className="text-lg font-bold text-gray-900 dark:text-gray-100 mb-1">
                {lang === 'es' ? '¡Canjeado!' : 'Redeemed!'}
              </p>
              <p className="text-sm text-gray-500 dark:text-gray-400 mb-4">
                {lang === 'es' ? 'Muestra este código al negocio:' : 'Show this code at the business:'}
              </p>
              <div className="bg-gray-900 dark:bg-gray-100 text-white dark:text-gray-900 rounded-2xl py-4 px-6 mb-4">
                <p className="text-2xl font-black tracking-widest">{redeemResult.code}</p>
              </div>
              <p className="text-xs text-gray-400 mb-4">-{redeemResult.points} pts · {userPoints} pts remaining</p>
              <button
                onClick={() => setRedeemResult(null)}
                className="w-full bg-gray-900 dark:bg-gray-100 dark:text-gray-900 text-white font-semibold py-3 rounded-2xl"
              >
                {lang === 'es' ? 'Cerrar' : 'Done'}
              </button>
            </div>
          </div>
        )}

        {error && (
          <div className="bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 rounded-xl p-3 mb-4 flex items-center gap-2">
            <X className="w-4 h-4 text-red-500 flex-shrink-0" />
            <p className="text-xs text-red-700 dark:text-red-400">{error}</p>
          </div>
        )}

        {/* Deals */}
        {loading ? (
          <div className="space-y-3">
            {[1,2,3].map(i => <div key={i} className="h-28 bg-gray-100 dark:bg-gray-800 rounded-2xl animate-pulse" />)}
          </div>
        ) : businesses.length === 0 ? (
          <div className="space-y-4">
            {/* Coming soon banner */}
            <div className="bg-gradient-to-r from-purple-600 to-indigo-600 rounded-2xl p-5 text-white text-center">
              <p className="text-2xl mb-2">🎁</p>
              <p className="text-base font-bold mb-1">
                {lang === 'es' ? 'Descuentos llegando pronto' : 'Deals coming soon'}
              </p>
              <p className="text-xs opacity-80 mb-3">
                {lang === 'es'
                  ? 'Estamos incorporando negocios cerca de los cruces. Tus puntos ya están acumulándose.'
                  : "We're onboarding businesses near your crossings. Your points are already stacking up."}
              </p>
              {user && userPoints > 0 && (
                <div className="bg-white/20 rounded-xl px-4 py-2 inline-block">
                  <p className="text-sm font-bold">
                    {lang === 'es' ? `Ya tienes ${userPoints} pts listos para canjear` : `You already have ${userPoints} pts ready to redeem`}
                  </p>
                </div>
              )}
            </div>

            {/* Preview categories */}
            <div className="bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-2xl p-4">
              <p className="text-xs font-semibold text-gray-500 dark:text-gray-400 uppercase tracking-wide mb-3">
                {lang === 'es' ? 'Tipos de negocios que se unirán' : 'Types of businesses joining'}
              </p>
              <div className="grid grid-cols-3 gap-2">
                {[
                  { emoji: '🍽️', label: lang === 'es' ? 'Restaurantes' : 'Restaurants' },
                  { emoji: '⛽', label: lang === 'es' ? 'Gasolineras' : 'Gas Stations' },
                  { emoji: '💱', label: lang === 'es' ? 'Cambio' : 'Money Exchange' },
                  { emoji: '🔧', label: lang === 'es' ? 'Talleres' : 'Auto / Tires' },
                  { emoji: '☕', label: lang === 'es' ? 'Cafés' : 'Cafés' },
                  { emoji: '🛡️', label: lang === 'es' ? 'Seguros' : 'Insurance' },
                ].map(c => (
                  <div key={c.emoji} className="flex flex-col items-center gap-1 p-3 bg-gray-50 dark:bg-gray-700 rounded-xl opacity-60">
                    <span className="text-xl">{c.emoji}</span>
                    <span className="text-xs text-gray-500 dark:text-gray-400 text-center leading-tight">{c.label}</span>
                  </div>
                ))}
              </div>
            </div>
          </div>
        ) : (
          <div className="space-y-3">
            {businesses.map(biz => {
              const bizDeals = dealsForBusiness(biz.id)
              return (
                <div key={biz.id} className="bg-white dark:bg-gray-800 rounded-2xl border border-gray-200 dark:border-gray-700 shadow-sm overflow-hidden">
                  <div className="p-4 border-b border-gray-100 dark:border-gray-700">
                    <div className="flex items-start gap-3">
                      <span className="text-3xl">{biz.logo_emoji}</span>
                      <div className="flex-1">
                        <p className="font-bold text-gray-900 dark:text-gray-100">{biz.name}</p>
                        <p className="text-xs text-gray-500 dark:text-gray-400">{CATEGORY_LABEL[biz.category] || CATEGORY_LABEL.other}</p>
                        {biz.address && <p className="text-xs text-gray-400 mt-0.5 flex items-center gap-1"><MapPin className="w-3 h-3" />{biz.address}</p>}
                        {biz.description && <p className="text-xs text-gray-500 dark:text-gray-400 mt-1">{biz.description}</p>}
                        {biz.port_ids?.length > 0 && (
                          <div className="flex flex-wrap gap-1 mt-1.5">
                            {biz.port_ids.map(pid => (
                              <span key={pid} className="text-xs bg-blue-50 dark:bg-blue-900/20 text-blue-600 dark:text-blue-400 px-1.5 py-0.5 rounded-full">
                                {ALL_PORTS_LABEL[pid] || pid}
                              </span>
                            ))}
                          </div>
                        )}
                      </div>
                    </div>
                  </div>

                  {bizDeals.length === 0 ? (
                    <div className="p-3 text-center text-xs text-gray-400">No active deals right now</div>
                  ) : (
                    <div className="divide-y divide-gray-100 dark:divide-gray-700">
                      {bizDeals.map(deal => {
                        const canAfford = userPoints >= deal.points_required
                        const isRedeeming = redeeming === deal.id
                        return (
                          <div key={deal.id} className="p-4 flex items-center gap-3">
                            <div className="flex-1 min-w-0">
                              <p className="text-sm font-semibold text-gray-900 dark:text-gray-100">{deal.title}</p>
                              {deal.description && <p className="text-xs text-gray-500 dark:text-gray-400 mt-0.5">{deal.description}</p>}
                              <div className="flex items-center gap-2 mt-1">
                                <span className="text-xs font-bold text-purple-600 dark:text-purple-400 flex items-center gap-0.5">
                                  <Star className="w-3 h-3" />{deal.points_required} {lang === 'es' ? 'puntos' : 'pts'}
                                </span>
                                {deal.expires_at && (
                                  <span className="text-xs text-gray-400">
                                    {lang === 'es' ? 'Vence' : 'Expires'} {new Date(deal.expires_at).toLocaleDateString()}
                                  </span>
                                )}
                              </div>
                            </div>
                            {user ? (
                              <button
                                onClick={() => redeem(deal)}
                                disabled={!canAfford || isRedeeming}
                                className={`flex-shrink-0 text-xs font-semibold px-3 py-2 rounded-xl transition-colors ${
                                  canAfford
                                    ? 'bg-purple-600 text-white hover:bg-purple-700'
                                    : 'bg-gray-100 dark:bg-gray-700 text-gray-400 cursor-not-allowed'
                                }`}
                              >
                                {isRedeeming ? '...' : canAfford ? (lang === 'es' ? 'Canjear' : 'Redeem') : `Need ${deal.points_required - userPoints} more pts`}
                              </button>
                            ) : (
                              <Link href="/login" className="flex-shrink-0 text-xs font-semibold px-3 py-2 rounded-xl bg-gray-100 dark:bg-gray-700 text-gray-500">
                                {lang === 'es' ? 'Entrar' : 'Sign in'}
                              </Link>
                            )}
                          </div>
                        )
                      })}
                    </div>
                  )}
                </div>
              )
            })}
          </div>
        )}

        {/* Business signup */}
        <div className="mt-6 bg-gradient-to-r from-amber-50 to-orange-50 dark:from-amber-900/20 dark:to-orange-900/20 border border-amber-200 dark:border-amber-800 rounded-2xl p-5">
          <p className="text-sm font-bold text-amber-800 dark:text-amber-300 mb-1">
            {lang === 'es' ? '🏪 ¿Tienes un negocio cerca del puente?' : '🏪 Own a business near the crossing?'}
          </p>
          <p className="text-xs text-amber-700 dark:text-amber-400 mb-3">
            {lang === 'es'
              ? 'Ofrece descuentos a cruzantes y recibe clientes mientras esperan en la fila. Completamente gratis para empezar.'
              : 'Offer deals to crossers waiting in line. Reach customers who are literally stopped outside your area. Free to get started.'}
          </p>
          {!showSignup ? (
            <button
              onClick={() => setShowSignup(true)}
              className="text-xs font-semibold text-white bg-amber-600 px-5 py-2.5 rounded-xl hover:bg-amber-700 transition-colors"
            >
              {lang === 'es' ? 'Registrar mi negocio gratis →' : 'List my business free →'}
            </button>
          ) : signupSent ? (
            <div className="flex items-center gap-2 text-green-700 dark:text-green-400">
              <CheckCircle className="w-4 h-4" />
              <p className="text-sm font-semibold">
                {lang === 'es' ? '¡Solicitud enviada! Te contactaremos pronto.' : 'Submitted! We\'ll be in touch soon.'}
              </p>
            </div>
          ) : (
            <div className="space-y-2.5">
              {[
                { key: 'name',        placeholder: lang === 'es' ? 'Nombre del negocio *' : 'Business name *' },
                { key: 'email',       placeholder: lang === 'es' ? 'Tu email *' : 'Your email *' },
                { key: 'address',     placeholder: lang === 'es' ? 'Dirección' : 'Address' },
                { key: 'phone',       placeholder: lang === 'es' ? 'Teléfono' : 'Phone' },
                { key: 'description', placeholder: lang === 'es' ? 'Describe tu negocio' : 'Describe your business' },
              ].map(f => (
                <input
                  key={f.key}
                  value={signupForm[f.key as keyof typeof signupForm]}
                  onChange={e => setSignupForm(s => ({ ...s, [f.key]: e.target.value }))}
                  placeholder={f.placeholder}
                  className="w-full border border-amber-200 dark:border-amber-700 dark:bg-gray-800 dark:text-gray-100 rounded-xl px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-amber-400"
                />
              ))}
              <div className="flex gap-2">
                <button
                  onClick={submitSignup}
                  disabled={!signupForm.name || !signupForm.email}
                  className="flex-1 bg-amber-600 text-white text-sm font-semibold py-2.5 rounded-xl hover:bg-amber-700 disabled:opacity-40"
                >
                  {lang === 'es' ? 'Enviar solicitud' : 'Submit'}
                </button>
                <button onClick={() => setShowSignup(false)} className="px-4 py-2.5 bg-white dark:bg-gray-700 text-gray-500 text-sm rounded-xl border border-amber-200 dark:border-amber-700">
                  {lang === 'es' ? 'Cancelar' : 'Cancel'}
                </button>
              </div>
            </div>
          )}
        </div>
      </div>
    </main>
  )
}
