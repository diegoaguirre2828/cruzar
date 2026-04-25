'use client'

import { useState, useEffect } from 'react'
import Link from 'next/link'
import { useRouter } from 'next/navigation'
import { useAuth } from '@/lib/useAuth'
import { useLang } from '@/lib/LangContext'
import { ArrowLeft, Bell, Filter, Download } from 'lucide-react'
import { LangToggle } from '@/components/LangToggle'

interface Preferences {
  impacts: string[]
  corridors: string[]
  min_score: number
  quiet_hour_start: number | null
  quiet_hour_end: number | null
}

interface Event {
  id: string
  source: string
  source_url: string | null
  headline: string
  body: string | null
  language: string
  impact_tag: string | null
  corridor: string | null
  occurred_at: string | null
  ingested_at: string
  alert_score: number | null
}

const IMPACT_LABELS: Record<string, { es: string; en: string; color: string }> = {
  cartel:       { es: 'Cártel / seguridad', en: 'Cartel / security', color: 'bg-red-500' },
  protest:      { es: 'Bloqueo / protesta', en: 'Blockade / protest', color: 'bg-orange-500' },
  vucem:        { es: 'VUCEM / SAT',        en: 'VUCEM / SAT',        color: 'bg-purple-500' },
  tariff:       { es: 'Aranceles / T-MEC',  en: 'Tariff / USMCA',     color: 'bg-amber-500' },
  weather:      { es: 'Clima',              en: 'Weather',            color: 'bg-cyan-500' },
  infra:        { es: 'Infraestructura',    en: 'Infrastructure',     color: 'bg-blue-500' },
  policy:       { es: 'Política comercial', en: 'Trade policy',       color: 'bg-indigo-500' },
  other:        { es: 'Otros',              en: 'Other',              color: 'bg-gray-500' },
}

export default function DashboardPage() {
  const { user, loading: authLoading } = useAuth()
  const router = useRouter()
  const { lang } = useLang()
  const es = lang === 'es'
  const [subscribed, setSubscribed] = useState<boolean | null>(null)
  const [tier, setTier] = useState<string>('free')
  const [prefs, setPrefs] = useState<Preferences | null>(null)
  const [events, setEvents] = useState<Event[]>([])
  const [filter, setFilter] = useState<string>('')
  const [saving, setSaving] = useState(false)

  useEffect(() => {
    if (!authLoading && !user) router.push('/login?next=/intelligence/dashboard')
  }, [user, authLoading, router])

  useEffect(() => {
    if (!user) return
    fetch('/api/intelligence/preferences')
      .then((r) => r.json())
      .then((d) => {
        setSubscribed(!!d.subscribed)
        setTier(d.tier || 'free')
        setPrefs(d.preferences || null)
      })
    refreshEvents('')
  }, [user])

  function refreshEvents(impact: string) {
    const q = impact ? `?impact=${impact}&limit=50` : '?limit=50'
    fetch(`/api/intelligence/events${q}`)
      .then((r) => r.json())
      .then((d) => setEvents(d.events || []))
  }

  async function savePrefs() {
    if (!prefs) return
    setSaving(true)
    await fetch('/api/intelligence/preferences', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(prefs),
    })
    setSaving(false)
  }

  function toggleImpact(impact: string) {
    if (!prefs) return
    const next = prefs.impacts.includes(impact)
      ? prefs.impacts.filter((i) => i !== impact)
      : [...prefs.impacts, impact]
    setPrefs({ ...prefs, impacts: next })
  }

  if (authLoading || !user || subscribed === null) {
    return <div className="min-h-screen bg-gray-50 dark:bg-gray-950 flex items-center justify-center"><div className="w-8 h-8 border-2 border-gray-300 border-t-gray-900 rounded-full animate-spin" /></div>
  }

  const isPaid = tier === 'pro' || tier === 'enterprise'

  return (
    <main className="min-h-screen bg-gray-50 dark:bg-gray-950">
      <div className="max-w-3xl mx-auto px-4 pb-16">
        <div className="pt-6 pb-4 flex items-center justify-between gap-3">
          <div className="flex items-center gap-3">
            <Link href="/intelligence" className="p-2 rounded-xl bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 text-gray-600 dark:text-gray-300">
              <ArrowLeft className="w-4 h-4" />
            </Link>
            <h1 className="text-xl font-bold text-gray-900 dark:text-gray-100">
              {es ? 'Mi panel de inteligencia' : 'My intelligence dashboard'}
            </h1>
          </div>
          <LangToggle />
        </div>

        {!subscribed && (
          <div className="bg-amber-50 dark:bg-amber-900/20 border border-amber-200 dark:border-amber-800 rounded-2xl p-5 mb-4">
            <p className="text-sm font-bold text-amber-800 dark:text-amber-300">
              {es ? 'Aún no estás suscrito' : 'Not subscribed yet'}
            </p>
            <p className="text-xs text-gray-700 dark:text-gray-300 mt-1 mb-3">
              {es ? 'Suscríbete al brief diario gratis o sube a Intelligence ($49/mes) para alertas en tiempo real.' : 'Sign up for the free daily brief or upgrade to Intelligence ($49/mo) for real-time alerts.'}
            </p>
            <Link href="/intelligence" className="inline-block px-4 py-2 rounded-xl bg-amber-600 text-white text-sm font-bold">
              {es ? 'Ver opciones' : 'See options'}
            </Link>
          </div>
        )}

        {subscribed && !isPaid && (
          <div className="bg-blue-50 dark:bg-blue-900/20 border border-blue-200 dark:border-blue-800 rounded-2xl p-5 mb-4">
            <p className="text-sm font-bold text-blue-800 dark:text-blue-300">
              {es ? 'Brief gratis activo' : 'Free Brief active'}
            </p>
            <p className="text-xs text-gray-700 dark:text-gray-300 mt-1 mb-3">
              {es ? 'Recibes el brief diario por correo. Para alertas en tiempo real + filtros + descarga CSV, sube a Intelligence ($49/mes).' : 'You get the daily brief by email. For real-time alerts + filters + CSV download, upgrade to Intelligence ($49/mo).'}
            </p>
            <Link href="/pricing#intelligence" className="inline-block px-4 py-2 rounded-xl bg-blue-600 text-white text-sm font-bold">
              {es ? 'Subir a $49/mes' : 'Upgrade to $49/mo'}
            </Link>
          </div>
        )}

        {/* Alert preferences */}
        {prefs && isPaid && (
          <div className="bg-white dark:bg-gray-800 rounded-2xl border border-gray-200 dark:border-gray-700 p-5 shadow-sm mb-4">
            <h2 className="text-sm font-bold text-gray-900 dark:text-gray-100 mb-1 flex items-center gap-2">
              <Bell className="w-4 h-4" />
              {es ? 'Mis alertas en tiempo real' : 'My real-time alerts'}
            </h2>
            <p className="text-xs text-gray-500 dark:text-gray-400 mb-3">
              {es ? 'Activa las categorías de eventos que te importan. Recibes correo cuando un evento supera tu umbral.' : 'Toggle which event categories you want pushed. You get an email when an event clears your score threshold.'}
            </p>
            <div className="flex flex-wrap gap-1.5 mb-3">
              {Object.entries(IMPACT_LABELS).map(([id, meta]) => (
                <button
                  key={id}
                  onClick={() => toggleImpact(id)}
                  className={`text-xs font-semibold px-3 py-1.5 rounded-full transition-colors ${prefs.impacts.includes(id) ? `${meta.color} text-white` : 'bg-gray-100 dark:bg-gray-700 text-gray-700 dark:text-gray-300'}`}
                >
                  {es ? meta.es : meta.en}
                </button>
              ))}
            </div>
            <div className="flex items-center gap-3 text-xs text-gray-700 dark:text-gray-300 mb-3">
              <label className="flex items-center gap-2">
                <span>{es ? 'Umbral mínimo' : 'Min score'}:</span>
                <input
                  type="number"
                  min={0}
                  max={100}
                  value={prefs.min_score}
                  onChange={(e) => setPrefs({ ...prefs, min_score: Number(e.target.value) || 0 })}
                  className="w-16 px-2 py-1 rounded-lg border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-900 tabular-nums"
                />
              </label>
              <span className="text-[11px] text-gray-500">{es ? '60 = balanced default' : '60 = balanced default'}</span>
            </div>
            <button
              onClick={savePrefs}
              disabled={saving}
              className="px-4 py-2 rounded-xl bg-gray-900 dark:bg-gray-100 dark:text-gray-900 text-white text-sm font-bold disabled:opacity-50"
            >
              {saving ? (es ? 'Guardando…' : 'Saving…') : (es ? 'Guardar' : 'Save')}
            </button>
          </div>
        )}

        {/* Filter + events */}
        <div className="bg-white dark:bg-gray-800 rounded-2xl border border-gray-200 dark:border-gray-700 p-5 shadow-sm mb-4">
          <div className="flex items-center justify-between mb-3">
            <h2 className="text-sm font-bold text-gray-900 dark:text-gray-100 flex items-center gap-2">
              <Filter className="w-4 h-4" />
              {es ? 'Eventos recientes' : 'Recent events'}
            </h2>
            {isPaid && (
              <a
                href="/api/intelligence/events?format=csv&limit=5000"
                className="text-xs font-semibold text-blue-600 dark:text-blue-400 hover:underline flex items-center gap-1"
              >
                <Download className="w-3 h-3" />
                CSV
              </a>
            )}
          </div>
          <div className="flex flex-wrap gap-1.5 mb-3">
            <button
              onClick={() => { setFilter(''); refreshEvents('') }}
              className={`text-xs px-2.5 py-1 rounded-full ${filter === '' ? 'bg-gray-900 dark:bg-gray-100 dark:text-gray-900 text-white' : 'bg-gray-100 dark:bg-gray-700 text-gray-700 dark:text-gray-300'}`}
            >
              {es ? 'Todos' : 'All'}
            </button>
            {Object.entries(IMPACT_LABELS).map(([id, meta]) => (
              <button
                key={id}
                onClick={() => { setFilter(id); refreshEvents(id) }}
                className={`text-xs px-2.5 py-1 rounded-full ${filter === id ? `${meta.color} text-white` : 'bg-gray-100 dark:bg-gray-700 text-gray-700 dark:text-gray-300'}`}
              >
                {es ? meta.es : meta.en}
              </button>
            ))}
          </div>

          <div className="space-y-2">
            {events.length === 0 ? (
              <p className="text-xs text-gray-400 italic">
                {es ? 'Sin eventos en el filtro actual.' : 'No events in current filter.'}
              </p>
            ) : events.map((e) => {
              const tag = e.impact_tag || 'other'
              const meta = IMPACT_LABELS[tag] || IMPACT_LABELS.other
              return (
                <div key={e.id} className="border-l-2 pl-3 py-1" style={{ borderColor: meta.color.replace('bg-', '') }}>
                  <div className="flex items-start justify-between gap-2 mb-0.5">
                    <span className={`text-[10px] uppercase font-bold px-1.5 py-0.5 rounded ${meta.color} text-white`}>{tag}</span>
                    <span className="text-[10px] text-gray-400 tabular-nums">{e.alert_score != null ? `score ${e.alert_score}` : ''} · {new Date(e.ingested_at).toISOString().slice(5,16).replace('T',' ')}</span>
                  </div>
                  <p className="text-sm font-semibold text-gray-900 dark:text-gray-100 leading-tight">{e.headline}</p>
                  {e.source_url && (
                    <a href={e.source_url} target="_blank" rel="noopener" className="text-[11px] text-blue-600 dark:text-blue-400 hover:underline">
                      {e.source} →
                    </a>
                  )}
                </div>
              )
            })}
          </div>
        </div>
      </div>
    </main>
  )
}
