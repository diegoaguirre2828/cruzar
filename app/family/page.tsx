'use client'

import { useEffect, useState } from 'react'
import Link from 'next/link'
import { useLang } from '@/lib/LangContext'
import { ArrowLeft, RadioTower, Clock } from 'lucide-react'

interface Ping {
  id: string
  user_id: string
  circle_id: string
  port_id: string | null
  predicted_arrival_at: string
  actual_arrival_at: string | null
  dest_label: string | null
  status: string
  message_es: string | null
  message_en: string | null
  created_at: string
}

interface Circle { id: string; name: string }

export default function FamilyPage() {
  const { lang } = useLang()
  const [circles, setCircles] = useState<Circle[]>([])
  const [pings, setPings] = useState<Ping[]>([])
  const [circleId, setCircleId] = useState('')
  const [destLabel, setDestLabel] = useState('')
  const [arrivalIso, setArrivalIso] = useState('')
  const [message, setMessage] = useState('')
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const t = {
    title: lang === 'es' ? '👨‍👩‍👧 Familia' : '👨‍👩‍👧 Family',
    subtitle: lang === 'es' ? 'Avísale a tu gente cuándo llegas.' : 'Let your people know when you arrive.',
    broadcastTo: lang === 'es' ? 'Avisar a este círculo' : 'Notify this circle',
    pickCircle: lang === 'es' ? 'Selecciona un círculo' : 'Pick a circle',
    where: lang === 'es' ? 'A dónde vas (opcional)' : 'Where to (optional)',
    when: lang === 'es' ? 'Llegada estimada' : 'Estimated arrival',
    msg: lang === 'es' ? 'Mensaje (opcional)' : 'Message (optional)',
    send: lang === 'es' ? 'Avisar' : 'Broadcast',
    recent: lang === 'es' ? 'ETAs recientes en tu círculo' : 'Recent ETAs in your circle',
    none: lang === 'es' ? 'Sin actividad reciente.' : 'No recent activity.',
    inTransit: lang === 'es' ? 'En camino' : 'In transit',
    arrived: lang === 'es' ? 'Llegó' : 'Arrived',
    back: lang === 'es' ? 'Inicio' : 'Home',
  }

  async function loadAll() {
    const [c, p] = await Promise.all([
      fetch('/api/circles').then((r) => r.json()).catch(() => ({ circles: [] })),
      fetch('/api/family/eta').then((r) => r.json()).catch(() => ({ pings: [] })),
    ])
    setCircles(c.circles ?? [])
    setPings(p.pings ?? [])
  }
  useEffect(() => { loadAll() }, [])

  async function broadcast() {
    if (!circleId || !arrivalIso) return
    setBusy(true); setError(null)
    try {
      const arrival = new Date(arrivalIso).toISOString()
      const res = await fetch('/api/family/eta', {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({
          circle_id: circleId,
          predicted_arrival_at: arrival,
          dest_label: destLabel || undefined,
          message_es: message || undefined,
          message_en: message || undefined,
        }),
      })
      const j = await res.json()
      if (!res.ok) throw new Error(j.error || 'failed')
      setDestLabel(''); setArrivalIso(''); setMessage('')
      await loadAll()
    } catch (e) {
      setError((e as Error).message)
    } finally {
      setBusy(false)
    }
  }

  return (
    <main className="min-h-screen bg-gray-50 dark:bg-gray-950">
      <div className="max-w-lg mx-auto px-4 pb-16 pt-6">
        <Link href="/" className="flex items-center gap-1 text-xs text-gray-400 mb-3"><ArrowLeft className="w-3 h-3" /> {t.back}</Link>
        <h1 className="text-2xl font-bold text-gray-900 dark:text-gray-100">{t.title}</h1>
        <p className="text-sm text-gray-500 dark:text-gray-400 mt-1 mb-5">{t.subtitle}</p>

        <section className="bg-white dark:bg-gray-900 rounded-2xl border border-gray-200 dark:border-gray-800 p-5 shadow-sm mb-6">
          <h2 className="text-sm font-semibold mb-3 flex items-center gap-2"><RadioTower className="w-4 h-4" /> {t.broadcastTo}</h2>
          <div className="space-y-2">
            <select value={circleId} onChange={(e) => setCircleId(e.target.value)} className="w-full text-sm rounded-lg bg-gray-100 dark:bg-gray-800 border border-gray-200 dark:border-gray-700 px-3 py-2">
              <option value="">{t.pickCircle}</option>
              {circles.map((c) => <option key={c.id} value={c.id}>{c.name}</option>)}
            </select>
            <input placeholder={t.where} value={destLabel} onChange={(e) => setDestLabel(e.target.value)} className="w-full text-sm rounded-lg bg-gray-100 dark:bg-gray-800 border border-gray-200 dark:border-gray-700 px-3 py-2" />
            <input
              type="datetime-local"
              value={arrivalIso}
              onChange={(e) => setArrivalIso(e.target.value)}
              className="w-full text-sm rounded-lg bg-gray-100 dark:bg-gray-800 border border-gray-200 dark:border-gray-700 px-3 py-2"
            />
            <textarea placeholder={t.msg} value={message} onChange={(e) => setMessage(e.target.value)} rows={2} className="w-full text-sm rounded-lg bg-gray-100 dark:bg-gray-800 border border-gray-200 dark:border-gray-700 px-3 py-2" />
            <button onClick={broadcast} disabled={busy || !circleId || !arrivalIso} className="w-full bg-blue-600 hover:bg-blue-700 text-white text-sm font-semibold py-2.5 rounded-lg disabled:opacity-50">
              {busy ? '…' : t.send}
            </button>
            {error && <p className="text-xs text-red-500">{error}</p>}
          </div>
        </section>

        <section>
          <h2 className="text-sm font-semibold mb-3">{t.recent}</h2>
          {pings.length === 0 ? (
            <p className="text-sm text-gray-500">{t.none}</p>
          ) : (
            <ul className="space-y-2">
              {pings.map((p) => (
                <li key={p.id} className="bg-white dark:bg-gray-900 rounded-xl border border-gray-200 dark:border-gray-800 p-3 text-sm">
                  <div className="flex items-center justify-between">
                    <span className="font-medium">{lang === 'es' ? (p.message_es || 'ETA familiar') : (p.message_en || 'Family ETA')}</span>
                    <span className={`text-xs font-medium ${p.status === 'arrived' ? 'text-green-600' : 'text-blue-600'}`}>
                      {p.status === 'arrived' ? t.arrived : t.inTransit}
                    </span>
                  </div>
                  <div className="text-xs text-gray-500 mt-1 flex items-center gap-1">
                    <Clock className="w-3 h-3" />
                    {new Date(p.predicted_arrival_at).toLocaleString()}
                    {p.dest_label && <span> · {p.dest_label}</span>}
                  </div>
                </li>
              ))}
            </ul>
          )}
        </section>
      </div>
    </main>
  )
}
