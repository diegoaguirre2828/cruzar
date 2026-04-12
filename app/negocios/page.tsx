'use client'

import { useState, useEffect } from 'react'
import Link from 'next/link'
import { useLang } from '@/lib/LangContext'
import { Phone, MessageCircle, Globe, Clock, CheckCircle, Plus, ChevronDown, ChevronUp, ArrowLeft } from 'lucide-react'

interface Business {
  id: string
  name: string
  description: string | null
  address: string | null
  port_ids: string[]
  category: string
  logo_emoji: string
  phone: string | null
  whatsapp: string | null
  website: string | null
  hours: string | null
  claimed: boolean
  listing_tier: string
  notes_es: string | null
  instagram: string | null
  facebook: string | null
}

const CATEGORIES = [
  { key: 'all',      labelEn: 'All',        labelEs: 'Todos',       emoji: '🗂️' },
  { key: 'exchange', labelEn: 'Exchange',   labelEs: 'Cambio',      emoji: '💱' },
  { key: 'dental',   labelEn: 'Dental',     labelEs: 'Dental',      emoji: '🦷' },
  { key: 'pharmacy', labelEn: 'Pharmacy',   labelEs: 'Farmacia',    emoji: '💊' },
  { key: 'restaurant',labelEn: 'Food',      labelEs: 'Comida',      emoji: '🌮' },
  { key: 'gas',      labelEn: 'Gas',        labelEs: 'Gasolina',    emoji: '⛽' },
  { key: 'tire',     labelEn: 'Auto',       labelEs: 'Auto',        emoji: '🔧' },
  { key: 'taxi',     labelEn: 'Taxi',       labelEs: 'Taxi',        emoji: '🚕' },
  { key: 'other',    labelEn: 'Other',      labelEs: 'Otro',        emoji: '🏪' },
]

function ClaimModal({ business, onClose, onDone }: { business: Business; onClose: () => void; onDone: () => void }) {
  const { lang } = useLang()
  const [email, setEmail] = useState('')
  const [whatsapp, setWhatsapp] = useState('')
  const [submitting, setSubmitting] = useState(false)
  const [done, setDone] = useState(false)

  async function submit() {
    if (!email.trim() && !whatsapp.trim()) return
    setSubmitting(true)
    const res = await fetch('/api/negocios/claim', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ business_id: business.id, email, whatsapp }),
    })
    setSubmitting(false)
    if (res.ok) { setDone(true); setTimeout(onDone, 1500) }
  }

  const t = {
    title: lang === 'es' ? `Reclamar: ${business.name}` : `Claim: ${business.name}`,
    desc: lang === 'es'
      ? 'Ingresa tu correo o WhatsApp para verificar que eres el dueño. Te contactamos en 24h.'
      : 'Enter your email or WhatsApp to verify ownership. We\'ll contact you within 24 hours.',
    emailPlaceholder: lang === 'es' ? 'Tu correo electrónico' : 'Your email address',
    waPlaceholder: lang === 'es' ? 'Tu WhatsApp (ej. +52 899...)' : 'Your WhatsApp (e.g. +52 899...)',
    submit: lang === 'es' ? 'Enviar solicitud' : 'Send request',
    done: lang === 'es' ? '¡Listo! Te contactamos pronto.' : 'Done! We\'ll be in touch.',
    cancel: lang === 'es' ? 'Cancelar' : 'Cancel',
  }

  return (
    <div className="fixed inset-0 z-50 flex items-end sm:items-center justify-center bg-black/60" onClick={onClose}>
      <div className="bg-white dark:bg-gray-900 rounded-t-3xl sm:rounded-2xl w-full sm:max-w-md p-6 shadow-2xl" onClick={e => e.stopPropagation()}>
        <h3 className="text-lg font-bold text-gray-900 dark:text-gray-100 mb-1">{t.title}</h3>
        <p className="text-sm text-gray-500 dark:text-gray-400 mb-4">{t.desc}</p>
        {done ? (
          <p className="text-green-600 dark:text-green-400 font-semibold text-center py-4">{t.done}</p>
        ) : (
          <>
            <input
              type="email"
              placeholder={t.emailPlaceholder}
              value={email}
              onChange={e => setEmail(e.target.value)}
              className="w-full mb-3 bg-gray-50 dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-xl px-4 py-3 text-sm text-gray-900 dark:text-gray-100 outline-none"
            />
            <input
              type="tel"
              placeholder={t.waPlaceholder}
              value={whatsapp}
              onChange={e => setWhatsapp(e.target.value)}
              className="w-full mb-4 bg-gray-50 dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-xl px-4 py-3 text-sm text-gray-900 dark:text-gray-100 outline-none"
            />
            <div className="flex gap-3">
              <button onClick={onClose} className="flex-1 py-3 rounded-xl border border-gray-200 dark:border-gray-700 text-sm font-semibold text-gray-600 dark:text-gray-300">{t.cancel}</button>
              <button
                onClick={submit}
                disabled={submitting || (!email.trim() && !whatsapp.trim())}
                className="flex-1 py-3 rounded-xl bg-blue-600 hover:bg-blue-700 disabled:bg-gray-300 dark:disabled:bg-gray-700 text-white text-sm font-semibold transition-colors"
              >
                {submitting ? '…' : t.submit}
              </button>
            </div>
          </>
        )}
      </div>
    </div>
  )
}

function AddBusinessModal({ onClose, onDone }: { onClose: () => void; onDone: () => void }) {
  const { lang } = useLang()
  const [form, setForm] = useState({ name: '', description: '', address: '', category: 'other', phone: '', whatsapp: '', hours: '', submitted_by_email: '' })
  const [submitting, setSubmitting] = useState(false)
  const [done, setDone] = useState(false)

  function update(k: string, v: string) { setForm(f => ({ ...f, [k]: v })) }

  async function submit() {
    if (!form.name.trim()) return
    setSubmitting(true)
    const res = await fetch('/api/negocios', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(form),
    })
    setSubmitting(false)
    if (res.ok) { setDone(true); setTimeout(onDone, 2000) }
  }

  const t = {
    title: lang === 'es' ? 'Agregar tu negocio gratis' : 'Add your business free',
    desc: lang === 'es'
      ? 'Tu negocio aparece de inmediato. Sin costo, sin cuenta necesaria.'
      : 'Your business goes live immediately. Free, no account needed.',
    name: lang === 'es' ? 'Nombre del negocio *' : 'Business name *',
    desc2: lang === 'es' ? 'Descripción breve' : 'Short description',
    address: lang === 'es' ? 'Dirección' : 'Address',
    category: lang === 'es' ? 'Categoría *' : 'Category *',
    phone: lang === 'es' ? 'Teléfono' : 'Phone',
    whatsapp: lang === 'es' ? 'WhatsApp' : 'WhatsApp',
    hours: lang === 'es' ? 'Horario' : 'Hours',
    email: lang === 'es' ? 'Tu correo (para actualizar el listado)' : 'Your email (to update your listing)',
    submit: lang === 'es' ? 'Publicar Negocio Gratis' : 'Publish Free Listing',
    done: lang === 'es' ? '¡Tu negocio ya está en Cruzar! 🎉' : 'Your business is live on Cruzar! 🎉',
    cancel: lang === 'es' ? 'Cancelar' : 'Cancel',
  }

  return (
    <div className="fixed inset-0 z-50 flex items-end sm:items-center justify-center bg-black/60 overflow-y-auto" onClick={onClose}>
      <div className="bg-white dark:bg-gray-900 rounded-t-3xl sm:rounded-2xl w-full sm:max-w-md p-6 shadow-2xl my-auto" onClick={e => e.stopPropagation()}>
        <h3 className="text-lg font-bold text-gray-900 dark:text-gray-100 mb-1">{t.title}</h3>
        <p className="text-sm text-gray-500 dark:text-gray-400 mb-4">{t.desc}</p>
        {done ? (
          <p className="text-green-600 dark:text-green-400 font-bold text-center py-6 text-base">{t.done}</p>
        ) : (
          <>
            <div className="flex flex-col gap-3">
              <input placeholder={t.name} value={form.name} onChange={e => update('name', e.target.value)}
                className="w-full bg-gray-50 dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-xl px-4 py-3 text-sm text-gray-900 dark:text-gray-100 outline-none" />
              <textarea placeholder={t.desc2} value={form.description} onChange={e => update('description', e.target.value)} rows={2}
                className="w-full bg-gray-50 dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-xl px-4 py-2 text-sm text-gray-900 dark:text-gray-100 outline-none resize-none" />
              <select value={form.category} onChange={e => update('category', e.target.value)}
                className="w-full bg-gray-50 dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-xl px-4 py-3 text-sm text-gray-900 dark:text-gray-100 outline-none">
                {CATEGORIES.filter(c => c.key !== 'all').map(c => (
                  <option key={c.key} value={c.key}>{c.emoji} {lang === 'es' ? c.labelEs : c.labelEn}</option>
                ))}
              </select>
              <input placeholder={t.address} value={form.address} onChange={e => update('address', e.target.value)}
                className="w-full bg-gray-50 dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-xl px-4 py-3 text-sm text-gray-900 dark:text-gray-100 outline-none" />
              <input placeholder={t.phone} value={form.phone} onChange={e => update('phone', e.target.value)}
                className="w-full bg-gray-50 dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-xl px-4 py-3 text-sm text-gray-900 dark:text-gray-100 outline-none" />
              <input placeholder={t.whatsapp} value={form.whatsapp} onChange={e => update('whatsapp', e.target.value)}
                className="w-full bg-gray-50 dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-xl px-4 py-3 text-sm text-gray-900 dark:text-gray-100 outline-none" />
              <input placeholder={t.hours} value={form.hours} onChange={e => update('hours', e.target.value)}
                className="w-full bg-gray-50 dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-xl px-4 py-3 text-sm text-gray-900 dark:text-gray-100 outline-none" />
              <input placeholder={t.email} value={form.submitted_by_email} onChange={e => update('submitted_by_email', e.target.value)}
                className="w-full bg-gray-50 dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-xl px-4 py-3 text-sm text-gray-900 dark:text-gray-100 outline-none" />
            </div>
            <div className="flex gap-3 mt-4">
              <button onClick={onClose} className="flex-1 py-3 rounded-xl border border-gray-200 dark:border-gray-700 text-sm font-semibold text-gray-600 dark:text-gray-300">{t.cancel}</button>
              <button
                onClick={submit}
                disabled={submitting || !form.name.trim()}
                className="flex-1 py-3 rounded-xl bg-green-600 hover:bg-green-700 disabled:bg-gray-300 dark:disabled:bg-gray-700 text-white text-sm font-semibold transition-colors"
              >
                {submitting ? '…' : t.submit}
              </button>
            </div>
          </>
        )}
      </div>
    </div>
  )
}

function BusinessCard({ biz, lang, onClaim }: { biz: Business; lang: string; onClaim: (b: Business) => void }) {
  const [expanded, setExpanded] = useState(false)

  const categoryLabel = CATEGORIES.find(c => c.key === biz.category)
  const note = lang === 'es' ? (biz.notes_es || biz.description) : biz.description

  return (
    <div className="bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-2xl p-4 shadow-sm">
      <div className="flex items-start gap-3">
        <span className="text-2xl flex-shrink-0 mt-0.5">{biz.logo_emoji}</span>
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2 flex-wrap">
            <h3 className="text-sm font-bold text-gray-900 dark:text-gray-100">{biz.name}</h3>
            {biz.listing_tier === 'featured' && (
              <span className="text-[10px] font-bold bg-yellow-100 dark:bg-yellow-900/30 text-yellow-700 dark:text-yellow-400 px-1.5 py-0.5 rounded-full">
                {lang === 'es' ? 'Destacado' : 'Featured'}
              </span>
            )}
            {biz.claimed ? (
              <span className="flex items-center gap-0.5 text-[10px] font-semibold text-green-600 dark:text-green-400">
                <CheckCircle className="w-3 h-3" />
                {lang === 'es' ? 'Verificado' : 'Verified'}
              </span>
            ) : (
              <span className="text-[10px] text-gray-400 dark:text-gray-500">
                {lang === 'es' ? 'Sin reclamar' : 'Unclaimed'}
              </span>
            )}
          </div>
          {categoryLabel && (
            <span className="text-[10px] text-gray-500 dark:text-gray-400">
              {lang === 'es' ? categoryLabel.labelEs : categoryLabel.labelEn}
            </span>
          )}
          {note && <p className="text-xs text-gray-600 dark:text-gray-400 mt-1 leading-relaxed">{note}</p>}
          {biz.address && <p className="text-xs text-gray-500 dark:text-gray-500 mt-1">📍 {biz.address}</p>}
          {biz.hours && (
            <p className="flex items-center gap-1 text-xs text-gray-500 dark:text-gray-500 mt-0.5">
              <Clock className="w-3 h-3" /> {biz.hours}
            </p>
          )}
        </div>
        <button
          onClick={() => setExpanded(v => !v)}
          className="text-gray-400 dark:text-gray-500 flex-shrink-0 p-1"
        >
          {expanded ? <ChevronUp className="w-4 h-4" /> : <ChevronDown className="w-4 h-4" />}
        </button>
      </div>

      {expanded && (
        <div className="mt-3 pt-3 border-t border-gray-100 dark:border-gray-700 flex flex-wrap gap-2">
          {biz.phone && (
            <a href={`tel:${biz.phone}`} className="flex items-center gap-1.5 bg-gray-100 dark:bg-gray-700 hover:bg-gray-200 dark:hover:bg-gray-600 text-gray-700 dark:text-gray-300 text-xs font-medium px-3 py-2 rounded-xl transition-colors">
              <Phone className="w-3.5 h-3.5" />
              {lang === 'es' ? 'Llamar' : 'Call'}
            </a>
          )}
          {biz.whatsapp && (
            <a
              href={`https://wa.me/${biz.whatsapp.replace(/\D/g, '')}`}
              target="_blank"
              rel="noopener noreferrer"
              className="flex items-center gap-1.5 bg-green-100 dark:bg-green-900/30 hover:bg-green-200 dark:hover:bg-green-900/50 text-green-700 dark:text-green-400 text-xs font-medium px-3 py-2 rounded-xl transition-colors"
            >
              <MessageCircle className="w-3.5 h-3.5" />
              WhatsApp
            </a>
          )}
          {biz.website && (
            <a href={biz.website} target="_blank" rel="noopener noreferrer"
              className="flex items-center gap-1.5 bg-blue-100 dark:bg-blue-900/30 hover:bg-blue-200 dark:hover:bg-blue-900/50 text-blue-700 dark:text-blue-400 text-xs font-medium px-3 py-2 rounded-xl transition-colors">
              <Globe className="w-3.5 h-3.5" />
              {lang === 'es' ? 'Sitio web' : 'Website'}
            </a>
          )}
          {!biz.claimed && (
            <button
              onClick={() => onClaim(biz)}
              className="flex items-center gap-1.5 bg-blue-600 hover:bg-blue-700 text-white text-xs font-semibold px-3 py-2 rounded-xl transition-colors ml-auto"
            >
              {lang === 'es' ? '¿Es tu negocio? Recláimalo' : 'Is this yours? Claim it'}
            </button>
          )}
        </div>
      )}
    </div>
  )
}

export default function NegociosPage() {
  const { lang } = useLang()
  const [businesses, setBusinesses] = useState<Business[]>([])
  const [loading, setLoading] = useState(true)
  const [category, setCategory] = useState('all')
  const [claimTarget, setClaimTarget] = useState<Business | null>(null)
  const [showAddForm, setShowAddForm] = useState(false)

  function loadBusinesses(cat: string) {
    setLoading(true)
    const params = cat !== 'all' ? `?category=${cat}` : ''
    fetch(`/api/negocios${params}`)
      .then(r => r.json())
      .then(d => { setBusinesses(d.businesses || []); setLoading(false) })
      .catch(() => setLoading(false))
  }

  useEffect(() => { loadBusinesses(category) }, [category])

  const t = {
    title: 'Negocios',
    subtitle: lang === 'es'
      ? 'Negocios cerca de los puentes fronterizos'
      : 'Businesses near border crossings',
    addBusiness: lang === 'es' ? '+ Agregar negocio gratis' : '+ Add business free',
    empty: lang === 'es' ? 'Sin resultados en esta categoría.' : 'No businesses in this category yet.',
    servicesTitle: lang === 'es' ? 'Servicios del lado mexicano' : 'Mexico-side services',
    servicesDesc: lang === 'es'
      ? 'Dental, farmacias, taxis, mecánicos y más'
      : 'Dental, pharmacies, taxis, mechanics and more',
    servicesBtn: lang === 'es' ? 'Ver servicios →' : 'View services →',
    claimedNote: lang === 'es'
      ? 'Los dueños pueden reclamar su listado gratis'
      : 'Business owners can claim their listing for free',
  }

  return (
    <main className="min-h-screen bg-gray-50 dark:bg-gray-950">
      {/* Header */}
      <div className="bg-white dark:bg-gray-900 border-b border-gray-200 dark:border-gray-800 px-4 pt-4 pb-3">
        <div className="max-w-2xl mx-auto">
          <div className="flex items-center justify-between mb-1">
            <div>
              <h1 className="text-xl font-bold text-gray-900 dark:text-gray-100">{t.title}</h1>
              <p className="text-xs text-gray-500 dark:text-gray-400">{t.subtitle}</p>
            </div>
            <button
              onClick={() => setShowAddForm(true)}
              className="flex items-center gap-1.5 bg-green-600 hover:bg-green-700 text-white text-xs font-semibold px-3 py-2 rounded-xl transition-colors"
            >
              <Plus className="w-3.5 h-3.5" />
              {lang === 'es' ? 'Agregar' : 'Add'}
            </button>
          </div>
          <p className="text-[10px] text-gray-400 dark:text-gray-500 mt-1">{t.claimedNote}</p>
        </div>
      </div>

      {/* Category pills */}
      <div className="sticky top-0 z-10 bg-white dark:bg-gray-900 border-b border-gray-200 dark:border-gray-800 px-4 py-2.5 overflow-x-auto">
        <div className="flex gap-2 max-w-2xl mx-auto min-w-max">
          {CATEGORIES.map(c => (
            <button
              key={c.key}
              onClick={() => setCategory(c.key)}
              className={`flex items-center gap-1.5 px-3 py-1.5 rounded-full text-xs font-semibold whitespace-nowrap transition-colors ${
                category === c.key
                  ? 'bg-blue-600 text-white'
                  : 'bg-gray-100 dark:bg-gray-800 text-gray-600 dark:text-gray-400 hover:bg-gray-200 dark:hover:bg-gray-700'
              }`}
            >
              <span>{c.emoji}</span>
              {lang === 'es' ? c.labelEs : c.labelEn}
            </button>
          ))}
        </div>
      </div>

      <div className="max-w-2xl mx-auto px-4 py-4 space-y-3">
        {loading ? (
          <div className="text-center py-12 text-gray-400 dark:text-gray-600 text-sm">
            {lang === 'es' ? 'Cargando...' : 'Loading...'}
          </div>
        ) : businesses.length === 0 ? (
          <div className="text-center py-12">
            <p className="text-gray-500 dark:text-gray-400 text-sm mb-4">{t.empty}</p>
            <button
              onClick={() => setShowAddForm(true)}
              className="bg-green-600 hover:bg-green-700 text-white text-sm font-semibold px-6 py-3 rounded-xl transition-colors"
            >
              {t.addBusiness}
            </button>
          </div>
        ) : (
          businesses.map(biz => (
            <BusinessCard key={biz.id} biz={biz} lang={lang} onClaim={setClaimTarget} />
          ))
        )}

        {/* Mexico-side services banner */}
        <div className="bg-blue-50 dark:bg-blue-900/20 border border-blue-200 dark:border-blue-800 rounded-2xl p-4 mt-2">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm font-bold text-blue-800 dark:text-blue-300">🇲🇽 {t.servicesTitle}</p>
              <p className="text-xs text-blue-600 dark:text-blue-400 mt-0.5">{t.servicesDesc}</p>
            </div>
            <Link href="/services" className="text-xs font-bold text-blue-600 dark:text-blue-400 hover:underline whitespace-nowrap ml-4">
              {t.servicesBtn}
            </Link>
          </div>
        </div>

        {/* Add business CTA */}
        <button
          onClick={() => setShowAddForm(true)}
          className="w-full py-4 rounded-2xl border-2 border-dashed border-gray-300 dark:border-gray-700 text-sm font-semibold text-gray-500 dark:text-gray-400 hover:border-green-500 hover:text-green-600 dark:hover:text-green-400 transition-colors flex items-center justify-center gap-2"
        >
          <Plus className="w-4 h-4" />
          {t.addBusiness}
        </button>

        {/* Advertise CTA */}
        <Link href="/advertise" className="block">
          <div className="bg-gradient-to-r from-yellow-500 to-orange-500 rounded-2xl p-4 flex items-center justify-between">
            <div>
              <p className="text-sm font-bold text-white">
                {lang === 'es' ? '📣 ¿Tienes un negocio cerca del puente?' : '📣 Do you have a business near the bridge?'}
              </p>
              <p className="text-xs text-yellow-100 mt-0.5">
                {lang === 'es' ? 'Llega a miles de personas que cruzan diario' : 'Reach thousands of daily border crossers'}
              </p>
            </div>
            <span className="text-white text-sm font-bold flex-shrink-0 ml-3">
              {lang === 'es' ? 'Ver →' : 'See →'}
            </span>
          </div>
        </Link>
      </div>

      {claimTarget && (
        <ClaimModal
          business={claimTarget}
          onClose={() => setClaimTarget(null)}
          onDone={() => { setClaimTarget(null); loadBusinesses(category) }}
        />
      )}
      {showAddForm && (
        <AddBusinessModal
          onClose={() => setShowAddForm(false)}
          onDone={() => { setShowAddForm(false); loadBusinesses(category) }}
        />
      )}
    </main>
  )
}
