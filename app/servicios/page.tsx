'use client'

// /servicios — the border-services hub.
//
// Cruzar's wedge is wait times. /servicios is the retention + monetization
// layer that wraps around it: Mexican insurance, eSIM, dental, money
// transfer, credit cards, VPN, travel, shopping. FB group users literally
// ask about these things every day. One page, hyperfocused, geo-scoped
// to the user's home region when we know it.
//
// All links are affiliate — outbound <a> tags carry rel="sponsored noopener"
// per Google's guidance for monetized links, and every click fires
// trackEvent('affiliate_clicked', {...}) so we can attribute conversions
// end-to-end from our own analytics.

import { useEffect, useMemo, useState } from 'react'
import Link from 'next/link'
import { ArrowLeft, ChevronRight, Briefcase, Mail } from 'lucide-react'
import { useLang } from '@/lib/LangContext'
import { trackEvent } from '@/lib/trackEvent'
import {
  AFFILIATES,
  CATEGORY_LABELS,
  CATEGORY_ORDER,
  filterByRegion,
  type Affiliate,
  type AffiliateCategory,
} from '@/lib/affiliates'
import {
  useHomeRegion,
  MEGA_REGION_LABELS,
} from '@/lib/useHomeRegion'

type CategoryFilter = 'all' | AffiliateCategory

export default function ServiciosPage() {
  const { lang } = useLang()
  const es = lang === 'es'
  const { homeRegion } = useHomeRegion()

  const [activeCategory, setActiveCategory] = useState<CategoryFilter>('all')
  // When a user has a home region, default to that view. They can toggle
  // the "Ver todas las regiones" chip to see the full catalog.
  const [showAllRegions, setShowAllRegions] = useState(false)

  // Single page-view event on mount.
  useEffect(() => {
    trackEvent('servicios_page_view', {
      region: homeRegion ?? null,
    })
    // Only fire once per mount — changing homeRegion later would double-count.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  // Region label for the banner row.
  const regionLabel = homeRegion
    ? (es
        ? MEGA_REGION_LABELS[homeRegion]?.es ?? 'Tu región'
        : MEGA_REGION_LABELS[homeRegion]?.en ?? 'Your region')
    : null

  // Apply region filter unless the user opted into the full catalog.
  const regionFiltered = useMemo(() => {
    if (showAllRegions || !homeRegion) return AFFILIATES
    return filterByRegion(AFFILIATES, homeRegion)
  }, [homeRegion, showAllRegions])

  // Then apply category filter.
  const visible = useMemo(() => {
    if (activeCategory === 'all') return regionFiltered
    return regionFiltered.filter((a) => a.category === activeCategory)
  }, [regionFiltered, activeCategory])

  // Group by category (stable order via CATEGORY_ORDER) and rank by priority.
  const sections = useMemo(() => {
    const byCat = new Map<AffiliateCategory, Affiliate[]>()
    for (const a of visible) {
      if (!byCat.has(a.category)) byCat.set(a.category, [])
      byCat.get(a.category)!.push(a)
    }
    for (const list of byCat.values()) {
      list.sort((a, b) => b.priority - a.priority)
    }
    return CATEGORY_ORDER
      .filter((cat) => byCat.has(cat))
      .map((cat) => ({ cat, items: byCat.get(cat)! }))
  }, [visible])

  function onAffiliateClick(a: Affiliate) {
    trackEvent('affiliate_clicked', {
      id: a.id,
      category: a.category,
      region: homeRegion ?? null,
      source: 'servicios',
    })
  }

  const mailtoHref = es
    ? 'mailto:hello@cruzar.app?subject=' + encodeURIComponent('Falta un servicio en /servicios') +
      '&body=' + encodeURIComponent('Hola Cruzar, me falta el siguiente servicio en /servicios:\n\n— ')
    : 'mailto:hello@cruzar.app?subject=' + encodeURIComponent('Missing service on /servicios') +
      '&body=' + encodeURIComponent('Hi Cruzar team, the following service is missing from /servicios:\n\n— ')

  const categoryChips: { id: CategoryFilter; es: string; en: string }[] = [
    { id: 'all', es: 'Todos', en: 'All' },
    ...CATEGORY_ORDER.map((cat) => ({
      id: cat as CategoryFilter,
      es: CATEGORY_LABELS[cat].es,
      en: CATEGORY_LABELS[cat].en,
    })),
  ]

  return (
    <main className="min-h-screen bg-gray-50 dark:bg-gray-950">
      {/* Gradient hero */}
      <div className="relative overflow-hidden bg-gradient-to-br from-indigo-600 via-blue-700 to-purple-800 text-white">
        <div className="absolute -top-24 -right-24 w-96 h-96 bg-white/10 rounded-full blur-3xl pointer-events-none" />
        <div className="absolute -bottom-24 -left-24 w-96 h-96 bg-white/5 rounded-full blur-3xl pointer-events-none" />
        <div className="relative max-w-4xl mx-auto px-4 pt-6 pb-8">
          <Link
            href="/mas"
            className="inline-flex items-center gap-1 text-xs text-blue-100 hover:text-white mb-4 transition-colors"
          >
            <ArrowLeft className="w-3 h-3" />
            {es ? 'Más' : 'More'}
          </Link>
          <div className="flex items-center gap-3 mb-2">
            <div className="w-10 h-10 rounded-xl bg-white/15 backdrop-blur-sm flex items-center justify-center">
              <Briefcase className="w-5 h-5 text-white" />
            </div>
            <h1 className="text-2xl sm:text-3xl font-black tracking-tight">
              {es ? 'Servicios de frontera' : 'Border services'}
            </h1>
          </div>
          <p className="text-sm sm:text-base text-blue-100 font-semibold max-w-2xl leading-relaxed">
            {es
              ? 'Todo lo que necesitas pa\' cruzar bien.'
              : "Everything you need to cross smart."}
          </p>
        </div>
      </div>

      <div className="max-w-4xl mx-auto px-4 pb-32">
        {/* Vision intro */}
        <div className="mt-5 mb-5 bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-2xl p-4 sm:p-5 shadow-sm">
          <p className="text-sm text-gray-700 dark:text-gray-300 leading-relaxed">
            {es ? (
              <>
                {'Cruzar es tu app pa\' los '}
                <span className="font-bold text-gray-900 dark:text-gray-100">tiempos del puente</span>
                {' — y pa\' todo lo demás que necesitas cruzando. Seguro mexicano, eSIM pa\' que tu celular funcione, dentistas, envío de dinero. Todo en un solo lugar.'}
              </>
            ) : (
              <>
                {'Cruzar is your app for the '}
                <span className="font-bold text-gray-900 dark:text-gray-100">bridge wait times</span>
                {' — and for everything else you need when you\'re crossing. Mexican insurance, eSIM so your phone works, dentists, money transfer. All in one spot.'}
              </>
            )}
          </p>
        </div>

        {/* Region filter row — only shown when we know the user's home region */}
        {homeRegion && regionLabel && (
          <div className="mb-3 flex flex-wrap items-center gap-2">
            <span className="text-[11px] uppercase tracking-widest font-bold text-gray-500 dark:text-gray-400">
              {es ? 'Tu región' : 'Your region'}
            </span>
            <button
              onClick={() => setShowAllRegions(false)}
              className={`text-xs font-bold px-3 py-1.5 rounded-full border transition-colors ${
                !showAllRegions
                  ? 'bg-indigo-600 border-indigo-600 text-white'
                  : 'bg-white dark:bg-gray-800 border-gray-200 dark:border-gray-700 text-gray-700 dark:text-gray-300'
              }`}
            >
              {regionLabel}
            </button>
            <button
              onClick={() => setShowAllRegions(true)}
              className={`text-xs font-bold px-3 py-1.5 rounded-full border transition-colors ${
                showAllRegions
                  ? 'bg-indigo-600 border-indigo-600 text-white'
                  : 'bg-white dark:bg-gray-800 border-gray-200 dark:border-gray-700 text-gray-700 dark:text-gray-300'
              }`}
            >
              {es ? 'Ver todas las regiones' : 'See all regions'}
            </button>
          </div>
        )}

        {/* Category filter chips */}
        <div className="mb-6 -mx-4 px-4 overflow-x-auto scrollbar-hide">
          <div className="flex items-center gap-2 min-w-max pb-1">
            {categoryChips.map((chip) => {
              const active = activeCategory === chip.id
              return (
                <button
                  key={chip.id}
                  onClick={() => setActiveCategory(chip.id)}
                  className={`text-xs font-bold px-3 py-1.5 rounded-full border whitespace-nowrap transition-colors ${
                    active
                      ? 'bg-gray-900 dark:bg-gray-100 border-gray-900 dark:border-gray-100 text-white dark:text-gray-900'
                      : 'bg-white dark:bg-gray-800 border-gray-200 dark:border-gray-700 text-gray-700 dark:text-gray-300 hover:bg-gray-50 dark:hover:bg-gray-700'
                  }`}
                >
                  {es ? chip.es : chip.en}
                </button>
              )
            })}
          </div>
        </div>

        {/* Empty state */}
        {sections.length === 0 && (
          <div className="bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-2xl p-8 text-center">
            <p className="text-sm font-bold text-gray-900 dark:text-gray-100 mb-1">
              {es ? 'Nada por ahora' : 'Nothing to show'}
            </p>
            <p className="text-xs text-gray-500 dark:text-gray-400">
              {es
                ? 'Cambia el filtro o elige otra categoría.'
                : 'Change the filter or pick another category.'}
            </p>
          </div>
        )}

        {/* Sections */}
        <div className="space-y-8">
          {sections.map(({ cat, items }) => (
            <section key={cat}>
              <h2 className="text-[11px] uppercase tracking-widest font-black text-gray-500 dark:text-gray-400 mb-3 px-1">
                {es ? CATEGORY_LABELS[cat].es : CATEGORY_LABELS[cat].en}
              </h2>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                {items.map((a) => (
                  <AffiliateCard
                    key={a.id}
                    affiliate={a}
                    es={es}
                    onClick={() => onAffiliateClick(a)}
                  />
                ))}
              </div>
            </section>
          ))}
        </div>

        {/* Disclosure */}
        <div className="mt-10 text-center">
          <p className="text-[11px] text-gray-500 dark:text-gray-400 leading-relaxed max-w-2xl mx-auto">
            {es
              ? 'Cruzar gana una comisión cuando usas estos links · no afecta tu precio.'
              : 'Cruzar earns a commission when you use these links · doesn\'t affect your price.'}
          </p>
        </div>

        {/* Feedback row */}
        <div className="mt-6">
          <a
            href={mailtoHref}
            className="flex items-center gap-3 bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-2xl px-4 py-3 hover:bg-gray-50 dark:hover:bg-gray-700/50 transition-colors"
          >
            <div className="w-9 h-9 rounded-xl bg-indigo-100 dark:bg-indigo-900/40 flex items-center justify-center flex-shrink-0">
              <Mail className="w-4 h-4 text-indigo-600 dark:text-indigo-300" />
            </div>
            <div className="flex-1 min-w-0">
              <p className="text-sm font-bold text-gray-900 dark:text-gray-100 leading-snug">
                {es ? '¿Te falta un servicio? Dinos' : 'Missing a service? Tell us'}
              </p>
              <p className="text-[11px] text-gray-500 dark:text-gray-400 leading-snug mt-0.5">
                {es ? 'Lo agregamos pa\' que todos lo vean' : 'We\'ll add it so everyone can see'}
              </p>
            </div>
            <ChevronRight className="w-4 h-4 text-gray-300 dark:text-gray-600 flex-shrink-0" />
          </a>
        </div>
      </div>

      {/* Sticky bottom CTA */}
      <div className="fixed bottom-4 inset-x-0 z-30 px-4 pointer-events-none">
        <div className="max-w-4xl mx-auto">
          <a
            href={mailtoHref}
            className="pointer-events-auto flex items-center justify-center gap-2 bg-gray-900 dark:bg-gray-100 text-white dark:text-gray-900 text-sm font-bold px-4 py-3 rounded-2xl shadow-lg hover:opacity-95 active:scale-[0.98] transition-all"
          >
            <Mail className="w-4 h-4" />
            {es ? '¿Te falta un servicio? Dinos' : 'Missing a service? Tell us'}
          </a>
        </div>
      </div>
    </main>
  )
}

// Affiliate card — emoji, name, tagline (bold), blurb, CTA button.
// Whole card is a link so the tap target is the full area.
function AffiliateCard({
  affiliate,
  es,
  onClick,
}: {
  affiliate: Affiliate
  es: boolean
  onClick: () => void
}) {
  return (
    <a
      href={affiliate.href}
      target="_blank"
      rel="sponsored noopener"
      onClick={onClick}
      className="group relative bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-2xl p-4 shadow-sm hover:shadow-md hover:border-indigo-300 dark:hover:border-indigo-700 active:scale-[0.99] transition-all flex flex-col"
    >
      <div className="flex items-start gap-3">
        <span className="text-2xl flex-shrink-0" aria-hidden>
          {affiliate.icon ?? '🔗'}
        </span>
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2 flex-wrap">
            <p className="text-sm font-black text-gray-900 dark:text-gray-100 leading-tight">
              {affiliate.name}
            </p>
            {!affiliate.approved && (
              <span className="text-[9px] uppercase tracking-wider font-bold bg-amber-50 dark:bg-amber-900/20 text-amber-700 dark:text-amber-300 px-1.5 py-0.5 rounded-full border border-amber-200 dark:border-amber-800">
                {es ? 'Pendiente' : 'Pending'}
              </span>
            )}
          </div>
          <p className="text-xs font-bold text-gray-800 dark:text-gray-200 mt-1 leading-snug">
            {es ? affiliate.tagline.es : affiliate.tagline.en}
          </p>
          <p className="text-[11px] text-gray-500 dark:text-gray-400 mt-1.5 leading-relaxed">
            {es ? affiliate.blurb.es : affiliate.blurb.en}
          </p>
        </div>
      </div>
      <div className="mt-3 flex items-center justify-between">
        <span className="text-[10px] uppercase tracking-wider font-bold text-gray-400 dark:text-gray-500">
          {es ? 'Patrocinado' : 'Sponsored'}
        </span>
        <span className="text-xs font-bold text-white bg-indigo-600 group-hover:bg-indigo-700 px-3 py-1.5 rounded-xl whitespace-nowrap transition-colors">
          {es ? affiliate.cta.es : affiliate.cta.en}
        </span>
      </div>
    </a>
  )
}
