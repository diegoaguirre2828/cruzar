'use client'

import { useState } from 'react'
import { CheckCircle, Copy, Check as CheckIcon } from 'lucide-react'
import { useLang } from '@/lib/LangContext'
import type { PortWaitTime } from '@/types'

interface Props {
  portId: string
  onSubmitted: () => void
  port?: PortWaitTime
}

const REPORT_TYPES = [
  // Conditions
  { value: 'delay',            emoji: '🔴', en: 'Long wait',       es: 'Espera larga',     group: 'conditions' },
  { value: 'clear',            emoji: '🟢', en: 'Moving fast',     es: 'Fluye rápido',     group: 'conditions' },
  { value: 'accident',         emoji: '💥', en: 'Accident / crash', es: 'Accidente',        group: 'conditions' },
  { value: 'inspection',       emoji: '🔵', en: 'Heavy inspection', es: 'Inspección fuerte', group: 'conditions' },
  // Weather
  { value: 'weather_fog',      emoji: '🌫️', en: 'Fog',             es: 'Neblina',          group: 'weather' },
  { value: 'weather_rain',     emoji: '🌧️', en: 'Heavy rain',      es: 'Lluvia fuerte',    group: 'weather' },
  { value: 'weather_wind',     emoji: '💨', en: 'High winds',      es: 'Viento fuerte',    group: 'weather' },
  { value: 'weather_dust',     emoji: '🟤', en: 'Dust storm',      es: 'Tolvanera',        group: 'weather' },
  // Alerts
  { value: 'officer_k9',      emoji: '🐕', en: 'K9 / Dogs out',   es: 'Perros / K9',      group: 'alerts' },
  { value: 'officer_secondary',emoji: '🚔', en: 'Extra checks',    es: 'Revisiones extra', group: 'alerts' },
  { value: 'reckless_driver',  emoji: '😤', en: 'Reckless driver', es: 'Conductor loco',   group: 'alerts' },
  { value: 'road_construction',emoji: '🚧', en: 'Construction',    es: 'Construcción',     group: 'alerts' },
  { value: 'road_hazard',      emoji: '⚠️', en: 'Road hazard',     es: 'Peligro en ruta',  group: 'alerts' },
  { value: 'other',            emoji: '💬', en: 'Other',           es: 'Otro',             group: 'alerts' },
]

const GROUPS = [
  { key: 'conditions', en: 'Conditions',  es: 'Condiciones' },
  { key: 'weather',    en: 'Weather',     es: 'Clima'       },
  { key: 'alerts',     en: 'Community alerts', es: 'Alertas comunitarias' },
]

function buildFriendlyReply(port: PortWaitTime, reportType: string, lang: string): string {
  const es = lang === 'es'
  const name = port.portName
  const fmt = (n: number | null) => n === null ? null : n === 0 ? (es ? 'menos de 1 min' : 'under 1 min') : `${n} min`

  const parts: string[] = []
  if (port.vehicle !== null) parts.push(es ? `🚗 Autos: ${fmt(port.vehicle)}` : `🚗 Car: ${fmt(port.vehicle)}`)
  if (port.pedestrian !== null) parts.push(es ? `🚶 Peatones: ${fmt(port.pedestrian)}` : `🚶 Walk: ${fmt(port.pedestrian)}`)
  if (port.sentri !== null) parts.push(`⚡ SENTRI: ${fmt(port.sentri)}`)

  const waitLine = parts.length > 0 ? parts.join(' · ') : (es ? 'sin datos ahorita' : 'no data right now')

  const openingsByType: Record<string, { es: string; en: string }> = {
    clear:             { es: `Acabo de cruzar ${name} y está fluyendo rápido 🟢`, en: `Just crossed ${name} and it's moving fast 🟢` },
    delay:             { es: `Heads up — ${name} está pesado ahorita 🔴`, en: `Heads up — ${name} is backed up right now 🔴` },
    accident:          { es: `Hay un accidente en ${name}, tengan cuidado 💥`, en: `There's an accident at ${name}, heads up 💥` },
    inspection:        { es: `Inspección fuerte en ${name} ahorita 🔵`, en: `Heavy inspection at ${name} right now 🔵` },
    officer_k9:        { es: `Perros afuera en ${name} — traigan todo en orden 🐕`, en: `K9 out at ${name} — make sure everything's in order 🐕` },
    officer_secondary: { es: `Revisiones extra en ${name} ahorita 🚔`, en: `Extra secondary checks at ${name} right now 🚔` },
    weather_fog:       { es: `Hay neblina en ${name}, mánejense con cuidado 🌫️`, en: `Foggy at ${name}, drive carefully 🌫️` },
    weather_rain:      { es: `Lluvia fuerte en ${name} 🌧️`, en: `Heavy rain at ${name} right now 🌧️` },
    weather_wind:      { es: `Viento fuerte en ${name} 💨`, en: `High winds at ${name} 💨` },
    weather_dust:      { es: `Tolvanera en ${name}, visibilidad baja 🟤`, en: `Dust storm at ${name}, low visibility 🟤` },
    road_construction: { es: `Hay construcción en ${name} 🚧`, en: `Construction at ${name} 🚧` },
    road_hazard:       { es: `Peligro en la ruta de ${name} ⚠️`, en: `Road hazard near ${name} ⚠️` },
    reckless_driver:   { es: `Conductor loco en ${name}, tengan ojo 😤`, en: `Reckless driver at ${name}, stay alert 😤` },
  }

  const opening = openingsByType[reportType]
    ? (es ? openingsByType[reportType].es : openingsByType[reportType].en)
    : (es ? `Reporte desde ${name}` : `Report from ${name}`)

  if (es) {
    return `${opening}\n\n${waitLine}\n\nActualizado en vivo 👉 cruzar.app`
  } else {
    return `${opening}\n\n${waitLine}\n\nLive updates 👉 cruzar.app`
  }
}

const LINE_REACH = [
  { value: 'fluido',   es: 'Fluido',           en: 'No line',        emoji: '🟢' },
  { value: 'puente',   es: 'En el puente',      en: 'On the bridge',  emoji: '🌉' },
  { value: 'rayos_x',  es: 'En los rayos X',    en: 'At X-ray',       emoji: '🔵' },
  { value: 'reten',    es: 'Retén del Ejército', en: 'Army checkpoint',emoji: '🪖' },
]

export function ReportForm({ portId, onSubmitted, port }: Props) {
  const { lang } = useLang()
  const [selected, setSelected] = useState<string | null>(null)
  const [lineReach, setLineReach] = useState<string | null>(null)
  const [description, setDescription] = useState('')
  const [submitting, setSubmitting] = useState(false)
  const [done, setDone] = useState(false)
  const [copied, setCopied] = useState(false)

  async function submit() {
    if (!selected) return
    setSubmitting(true)
    try {
      await fetch('/api/reports', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          portId,
          reportType: selected,
          description,
          lineReach,
          severity: ['accident', 'reckless_driver', 'road_hazard', 'officer_k9'].includes(selected) ? 'high'
            : ['delay', 'weather_fog', 'weather_rain', 'inspection'].includes(selected) ? 'medium' : 'low',
          ref: typeof window !== 'undefined' ? localStorage.getItem('cruzar_ref') : null,
        }),
      })
      setDone(true)
      setTimeout(() => {
        setDone(false)
        setSelected(null)
        setDescription('')
        setCopied(false)
        onSubmitted()
      }, 8000)
    } finally {
      setSubmitting(false)
    }
  }

  function handleCopy(text: string) {
    navigator.clipboard.writeText(text).catch(() => {})
    setCopied(true)
    setTimeout(() => setCopied(false), 3000)
  }

  if (done) {
    const friendlyReply = port && selected ? buildFriendlyReply(port, selected, lang) : null
    const waUrl = friendlyReply ? `https://wa.me/?text=${encodeURIComponent(friendlyReply)}` : null

    return (
      <div className="space-y-4">
        <div className="flex items-center justify-center gap-2 py-3 text-green-600 font-semibold text-base">
          <CheckCircle className="w-5 h-5" />
          {lang === 'es' ? '¡Gracias por reportar!' : 'Thanks for reporting!'}
        </div>

        {waUrl && (
          <div className="space-y-2">
            <p className="text-xs text-center text-gray-500 dark:text-gray-400">
              {lang === 'es' ? 'Avísale a tu grupo' : 'Let your group know'}
            </p>
            <a
              href={waUrl}
              target="_blank"
              rel="noopener noreferrer"
              className="flex items-center justify-center gap-2 w-full py-3 rounded-2xl bg-green-600 text-white text-sm font-bold active:scale-95 transition-transform"
            >
              <span>📲</span>
              {lang === 'es' ? 'Compartir por WhatsApp' : 'Share on WhatsApp'}
            </a>
            <button
              onClick={() => handleCopy(friendlyReply!)}
              className="flex items-center justify-center gap-2 w-full py-2.5 rounded-2xl border border-gray-200 dark:border-gray-600 text-sm font-semibold text-gray-600 dark:text-gray-300"
            >
              {copied
                ? <><CheckIcon className="w-4 h-4 text-green-500" />{lang === 'es' ? '¡Copiado!' : 'Copied!'}</>
                : <><Copy className="w-4 h-4" />{lang === 'es' ? 'Copiar para Facebook' : 'Copy for Facebook'}</>
              }
            </button>
          </div>
        )}
      </div>
    )
  }

  return (
    <div className="space-y-4">
      <p className="text-sm text-gray-500 dark:text-gray-400">
        {lang === 'es' ? '¿Qué está pasando en este puente?' : "What's happening at this crossing?"}
      </p>

      {GROUPS.map(group => (
        <div key={group.key}>
          <p className="text-xs font-bold text-gray-400 dark:text-gray-500 uppercase tracking-wider mb-2">
            {lang === 'es' ? group.es : group.en}
          </p>
          <div className="grid grid-cols-4 gap-2">
            {REPORT_TYPES.filter(r => r.group === group.key).map(rt => (
              <button
                key={rt.value}
                onClick={() => setSelected(rt.value === selected ? null : rt.value)}
                className={`flex flex-col items-center gap-1 p-2.5 rounded-2xl border transition-all active:scale-95 ${
                  selected === rt.value
                    ? 'border-blue-500 bg-blue-50 dark:bg-blue-900/30 ring-2 ring-blue-400'
                    : 'border-gray-200 dark:border-gray-600 bg-white dark:bg-gray-800'
                }`}
              >
                <span className="text-2xl leading-none">{rt.emoji}</span>
                <span className={`text-[10px] font-semibold text-center leading-tight ${
                  selected === rt.value ? 'text-blue-600 dark:text-blue-400' : 'text-gray-500 dark:text-gray-400'
                }`}>
                  {lang === 'es' ? rt.es : rt.en}
                </span>
              </button>
            ))}
          </div>
        </div>
      ))}

      {selected && (
        <div>
          <p className="text-xs font-bold text-gray-400 dark:text-gray-500 uppercase tracking-wider mb-2">
            {lang === 'es' ? '¿Hasta dónde llega la fila?' : 'How far back is the line?'}
          </p>
          <div className="grid grid-cols-2 gap-2">
            {LINE_REACH.map(lr => (
              <button
                key={lr.value}
                onClick={() => setLineReach(lr.value === lineReach ? null : lr.value)}
                className={`flex items-center gap-2 px-3 py-2.5 rounded-2xl border text-sm font-medium transition-all active:scale-95 ${
                  lineReach === lr.value
                    ? 'border-blue-500 bg-blue-50 dark:bg-blue-900/30 text-blue-600 dark:text-blue-400 ring-2 ring-blue-400'
                    : 'border-gray-200 dark:border-gray-600 bg-white dark:bg-gray-800 text-gray-600 dark:text-gray-300'
                }`}
              >
                <span>{lr.emoji}</span>
                <span>{lang === 'es' ? lr.es : lr.en}</span>
              </button>
            ))}
          </div>
        </div>
      )}

      {selected && (
        <textarea
          value={description}
          onChange={e => setDescription(e.target.value)}
          placeholder={lang === 'es' ? 'Detalles opcionales...' : 'Optional details...'}
          className="w-full text-sm border border-gray-200 dark:border-gray-600 dark:bg-gray-700 dark:text-gray-100 rounded-xl p-3 resize-none focus:outline-none focus:ring-2 focus:ring-blue-500"
          rows={2}
          maxLength={500}
        />
      )}

      <button
        onClick={submit}
        disabled={!selected || submitting}
        className="w-full bg-gray-900 dark:bg-gray-100 dark:text-gray-900 text-white text-base font-bold py-3.5 rounded-2xl disabled:opacity-40 transition-colors"
      >
        {submitting
          ? (lang === 'es' ? 'Enviando...' : 'Sending...')
          : (lang === 'es' ? 'Enviar reporte' : 'Submit report')}
      </button>
      <p className="text-center text-xs text-gray-400">
        {lang === 'es' ? 'Sin cuenta necesaria · Gana puntos si tienes cuenta' : 'No account needed · Earn points with an account'}
      </p>
    </div>
  )
}
