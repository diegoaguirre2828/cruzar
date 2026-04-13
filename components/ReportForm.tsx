'use client'

import { useState, useEffect } from 'react'
import { Copy, Check as CheckIcon } from 'lucide-react'
import { useLang } from '@/lib/LangContext'
import { ReportSentAnimation } from './ReportSentAnimation'
import { trackShare } from '@/lib/trackShare'
import { saveMyReport } from '@/lib/myReports'
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

// Lane detail section — optional. Only shown for vehicle-related
// reports (delay / clear / inspection / other). This is the moat
// feature nobody else has: CBP publishes one number per bridge but
// locals decide which lane to pick based on how many are open and
// which have X-ray. See project_cruzar_lane_details memory for
// the FB-thread origin story.
const LANE_DETAIL_REPORT_TYPES = new Set(['delay', 'clear', 'inspection', 'other'])

const SLOW_LANE_OPTIONS = [
  { value: 'con_rayos',  es: 'Las con rayos X',  en: 'With X-ray lanes' },
  { value: 'sin_rayos',  es: 'La sin rayos X',   en: 'No-X-ray lane' },
  { value: 'sentri',     es: 'SENTRI',           en: 'SENTRI' },
  { value: 'parejo',     es: 'Todas parejas',    en: 'All similar' },
]

export function ReportForm({ portId, onSubmitted, port }: Props) {
  const { lang } = useLang()
  const [selected, setSelected] = useState<string | null>(null)
  const [lineReach, setLineReach] = useState<string | null>(null)
  const [description, setDescription] = useState('')
  const [submitting, setSubmitting] = useState(false)
  const [done, setDone] = useState(false)
  const [copied, setCopied] = useState(false)
  const [impact, setImpact] = useState<{ subscribers: number; guardiansToday: number } | null>(null)
  const [lanesOpen, setLanesOpen] = useState<number | null>(null)
  const [lanesXray, setLanesXray] = useState<number | null>(null)
  const [slowLane, setSlowLane] = useState<string | null>(null)

  // Pull impact numbers the moment the submission lands — shown in the
  // "Gracias, guardián" screen so the user's contribution feels concrete
  // instead of abstract ("+5 points").
  useEffect(() => {
    if (!done) return
    fetch(`/api/reports/impact?portId=${encodeURIComponent(portId)}`)
      .then((r) => r.json())
      .then((d) => setImpact({ subscribers: d.subscribers || 0, guardiansToday: d.guardiansToday || 0 }))
      .catch(() => { /* silent — screen still works without numbers */ })
  }, [done, portId])

  async function submit() {
    if (!selected) return
    setSubmitting(true)
    try {
      // Request geolocation for anti-troll weighting. If the user denies
      // or the device can't answer quickly, submit without coords — we
      // don't block the report, we just weight it lower in the blend.
      const coords = await new Promise<{ lat: number; lng: number } | null>((resolve) => {
        if (typeof navigator === 'undefined' || !navigator.geolocation) return resolve(null)
        const timer = setTimeout(() => resolve(null), 4000)
        navigator.geolocation.getCurrentPosition(
          (pos) => { clearTimeout(timer); resolve({ lat: pos.coords.latitude, lng: pos.coords.longitude }) },
          () => { clearTimeout(timer); resolve(null) },
          { maximumAge: 60000, timeout: 3500, enableHighAccuracy: false },
        )
      })

      // Assemble optional lane detail payload — only sent if the user
      // filled at least one field. Server stores this inside source_meta
      // alongside lane_type so no schema migration is needed.
      const laneInfo =
        (lanesOpen != null || lanesXray != null || slowLane != null)
          ? { lanes_open: lanesOpen, lanes_xray: lanesXray, slow_lane: slowLane }
          : null

      await fetch('/api/reports', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          portId,
          reportType: selected,
          description,
          lineReach,
          laneInfo,
          severity: ['accident', 'reckless_driver', 'road_hazard', 'officer_k9'].includes(selected) ? 'high'
            : ['delay', 'weather_fog', 'weather_rain', 'inspection'].includes(selected) ? 'medium' : 'low',
          ref: typeof window !== 'undefined' ? localStorage.getItem('cruzar_ref') : null,
          lat: coords?.lat,
          lng: coords?.lng,
        }),
      })

      // Remember this report locally so the user sees ownership badges
      // on port cards + a pinned "tu reporte" row in the live ticker
      // as they scroll. Pure client-side — no DB query needed to check
      // "did I report this" on every port card render.
      saveMyReport(portId, selected, null)
      setDone(true)
      // Auto-dismiss extended from 8s → 14s so users have time to read the
      // impact numbers and tap the share button. The screen is the payoff,
      // not a transition — don't rush them past it.
      setTimeout(() => {
        setDone(false)
        setSelected(null)
        setDescription('')
        setCopied(false)
        setImpact(null)
        setLanesOpen(null)
        setLanesXray(null)
        setSlowLane(null)
        onSubmitted()
      }, 14000)
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
    const portName = port?.localNameOverride || port?.portName || ''
    const es = lang === 'es'

    // Emoji + label for the pinned "your report is now live" card.
    // Mirrors the LiveActivityTicker styling so the user sees their
    // own submission sitting in the feed they've been scrolling past.
    const reportTypeMeta = selected ? REPORT_TYPES.find((r) => r.value === selected) : null
    const reportLabel = reportTypeMeta ? (es ? reportTypeMeta.es : reportTypeMeta.en) : ''
    const reportEmoji = reportTypeMeta?.emoji ?? '💬'

    return (
      <div className="space-y-4">
        {/* Signature broadcast animation */}
        <ReportSentAnimation variant="broadcast" />

        <div className="text-center py-1">
          <p className="text-green-600 font-black text-xl">
            {es ? 'Gracias, guardián' : 'Thank you, guardian'}
          </p>
          <p className="text-[13px] text-gray-600 dark:text-gray-300 mt-1.5 font-medium leading-snug px-2">
            {es
              ? 'Tu reporte acaba de salir. Así se cuida a la raza del puente.'
              : 'Your report is out. This is how we look out for each other at the bridge.'}
          </p>
        </div>

        {/* "Your report is now live" — the FB-like moment where the user
            sees their own submission sitting in the community feed. This
            card mimics the LiveActivityTicker row visual so the user
            recognizes it as "the same stream I've been scrolling past."
            Creates the immediate visible-consequence loop that makes
            posting feel real instead of abstract. */}
        {reportTypeMeta && (
          <div className="bg-white dark:bg-gray-800 border-2 border-green-400 dark:border-green-600 ring-4 ring-green-100 dark:ring-green-900/30 rounded-2xl px-4 py-3 cruzar-rise">
            <div className="flex items-center gap-2 mb-1.5">
              <span className="relative flex h-2.5 w-2.5 flex-shrink-0">
                <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-green-400 opacity-75" />
                <span className="relative inline-flex rounded-full h-2.5 w-2.5 bg-green-500" />
              </span>
              <span className="text-[10px] uppercase tracking-widest font-black text-green-700 dark:text-green-400">
                {es ? 'TU REPORTE · en vivo ahorita' : 'YOUR REPORT · live now'}
              </span>
            </div>
            <div className="flex items-center gap-3">
              <span className="text-2xl leading-none flex-shrink-0">{reportEmoji}</span>
              <div className="min-w-0 flex-1">
                <p className="text-sm font-black text-gray-900 dark:text-gray-100 truncate">
                  {reportLabel}
                </p>
                <p className="text-[11px] text-gray-500 dark:text-gray-400 truncate">
                  {portName} · {es ? 'hace un momento' : 'just now'}
                </p>
              </div>
            </div>
          </div>
        )}

        {/* Impact numbers — two real counts that make the contribution feel
            concrete. Subscribers = people who asked for alerts on this port,
            guardians today = unique reporters across the network today. */}
        {impact && (impact.subscribers > 0 || impact.guardiansToday > 0) && (
          <div className="grid grid-cols-2 gap-2">
            {impact.subscribers > 0 && (
              <div className="bg-blue-50 dark:bg-blue-900/20 border border-blue-200 dark:border-blue-800 rounded-2xl px-3 py-3 text-center">
                <p className="text-2xl font-black text-blue-700 dark:text-blue-300 tabular-nums leading-none">
                  {impact.subscribers}
                </p>
                <p className="text-[10px] text-blue-900 dark:text-blue-200 font-bold uppercase tracking-wide mt-1 leading-tight">
                  {es
                    ? `esperan aviso de ${portName || 'este puente'}`
                    : `waiting on ${portName || 'this crossing'}`}
                </p>
              </div>
            )}
            {impact.guardiansToday > 0 && (
              <div className="bg-amber-50 dark:bg-amber-900/20 border border-amber-200 dark:border-amber-800 rounded-2xl px-3 py-3 text-center">
                <p className="text-2xl font-black text-amber-700 dark:text-amber-300 tabular-nums leading-none">
                  {impact.guardiansToday}
                </p>
                <p className="text-[10px] text-amber-900 dark:text-amber-200 font-bold uppercase tracking-wide mt-1 leading-tight">
                  {es ? 'guardianes hoy · tú uno de ellos' : "guardians today · you're one"}
                </p>
              </div>
            )}
          </div>
        )}

        {waUrl && (
          <div className="bg-green-50 dark:bg-green-900/20 border border-green-200 dark:border-green-800 rounded-2xl p-3 space-y-2">
            <p className="text-xs text-center text-gray-700 dark:text-gray-300 leading-snug font-medium">
              {es
                ? 'Avísale a los tuyos. La raza que cruza hoy te lo va a agradecer.'
                : "Let your people know. Anyone crossing today will thank you."}
            </p>
            <a
              href={waUrl}
              target="_blank"
              rel="noopener noreferrer"
              onClick={() => trackShare('whatsapp', 'report_form')}
              className="flex items-center justify-center gap-2 w-full py-3 rounded-2xl bg-green-600 hover:bg-green-700 text-white text-sm font-bold active:scale-95 transition-transform"
            >
              <span className="text-lg">📲</span>
              {es ? 'Avisarle a mi gente' : 'Tell my people'}
            </a>
            <button
              onClick={() => { trackShare('copy', 'report_form'); handleCopy(friendlyReply!) }}
              className="flex items-center justify-center gap-2 w-full py-2.5 rounded-2xl border border-gray-200 dark:border-gray-600 text-sm font-semibold text-gray-700 dark:text-gray-300"
            >
              {copied
                ? <><CheckIcon className="w-4 h-4 text-green-500" />{es ? 'Copiado — pégalo en tu grupo' : 'Copied — paste in your group'}</>
                : <><Copy className="w-4 h-4" />{es ? 'Copiar para Facebook' : 'Copy for Facebook'}</>
              }
            </button>
          </div>
        )}
      </div>
    )
  }

  // Reciprocity cue: if there's a recent community report on this port,
  // show it above the form so the user sees "someone helped me, I should
  // help back." The port prop includes lastReportMinAgo + reportCount if
  // set. When available, we nudge for reciprocity; otherwise a cold
  // social-proof line about the community.
  const recentReport =
    port?.lastReportMinAgo != null && port.lastReportMinAgo <= 30 ? port.lastReportMinAgo : null
  const reportTotal = port?.reportCount ?? 0

  return (
    <div className="space-y-4">
      {recentReport != null ? (
        <div className="bg-amber-50 dark:bg-amber-900/20 border border-amber-200 dark:border-amber-800 rounded-2xl px-3 py-2.5">
          <p className="text-xs font-bold text-amber-900 dark:text-amber-200">
            {lang === 'es'
              ? `🤝 Alguien reportó este puente hace ${recentReport} min para ayudarte`
              : `🤝 Someone reported this crossing ${recentReport} min ago to help you`}
          </p>
          <p className="text-[11px] text-amber-800 dark:text-amber-300 mt-0.5">
            {lang === 'es' ? 'Devuelve el favor cuando cruces.' : 'Return the favor when you cross.'}
          </p>
        </div>
      ) : reportTotal > 0 ? (
        <div className="bg-blue-50 dark:bg-blue-900/20 border border-blue-200 dark:border-blue-800 rounded-2xl px-3 py-2.5">
          <p className="text-xs font-bold text-blue-900 dark:text-blue-200">
            {lang === 'es'
              ? `🌎 ${reportTotal} cruzantes han reportado aquí en la última hora`
              : `🌎 ${reportTotal} travelers have reported here in the last hour`}
          </p>
          <p className="text-[11px] text-blue-800 dark:text-blue-300 mt-0.5">
            {lang === 'es' ? 'Sé parte del movimiento.' : 'Be part of the movement.'}
          </p>
        </div>
      ) : null}

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

      {selected && LANE_DETAIL_REPORT_TYPES.has(selected) && (
        <div className="border border-amber-200 dark:border-amber-800 bg-amber-50 dark:bg-amber-900/20 rounded-2xl p-3 space-y-3">
          <div className="flex items-center gap-2">
            <span className="text-base">🛣️</span>
            <p className="text-xs font-black text-amber-900 dark:text-amber-200 leading-tight">
              {lang === 'es' ? 'Detalles de la fila (opcional)' : 'Lane details (optional)'}
            </p>
          </div>
          <p className="text-[11px] text-amber-800 dark:text-amber-300 leading-snug -mt-1">
            {lang === 'es'
              ? 'Estos detalles son lo que CBP no dice — solo la gente en la fila los sabe.'
              : "These details are what CBP won't tell you — only people in the line know them."}
          </p>

          <div>
            <p className="text-[10px] uppercase tracking-wider font-bold text-amber-700 dark:text-amber-400 mb-1.5">
              {lang === 'es' ? '¿Cuántas filas abiertas?' : 'How many lanes open?'}
            </p>
            <div className="flex gap-1.5 flex-wrap">
              {[1, 2, 3, 4, 5, 6, 7, 8].map((n) => (
                <button
                  key={n}
                  type="button"
                  onClick={() => setLanesOpen(lanesOpen === n ? null : n)}
                  className={`w-9 h-9 rounded-xl text-xs font-black tabular-nums border transition-all active:scale-95 ${
                    lanesOpen === n
                      ? 'bg-amber-500 text-white border-amber-600 shadow-sm'
                      : 'bg-white dark:bg-gray-800 text-gray-700 dark:text-gray-300 border-gray-200 dark:border-gray-700'
                  }`}
                >
                  {n}
                </button>
              ))}
            </div>
          </div>

          {lanesOpen != null && lanesOpen > 0 && (
            <div>
              <p className="text-[10px] uppercase tracking-wider font-bold text-amber-700 dark:text-amber-400 mb-1.5">
                {lang === 'es' ? '¿Cuántas son con rayos X?' : 'How many with X-ray?'}
              </p>
              <div className="flex gap-1.5 flex-wrap">
                {Array.from({ length: lanesOpen + 1 }, (_, i) => i).map((n) => (
                  <button
                    key={n}
                    type="button"
                    onClick={() => setLanesXray(lanesXray === n ? null : n)}
                    className={`w-9 h-9 rounded-xl text-xs font-black tabular-nums border transition-all active:scale-95 ${
                      lanesXray === n
                        ? 'bg-amber-500 text-white border-amber-600 shadow-sm'
                        : 'bg-white dark:bg-gray-800 text-gray-700 dark:text-gray-300 border-gray-200 dark:border-gray-700'
                    }`}
                  >
                    {n}
                  </button>
                ))}
              </div>
            </div>
          )}

          <div>
            <p className="text-[10px] uppercase tracking-wider font-bold text-amber-700 dark:text-amber-400 mb-1.5">
              {lang === 'es' ? '¿Cuál fila está más lenta?' : 'Which lane is slowest?'}
            </p>
            <div className="grid grid-cols-2 gap-1.5">
              {SLOW_LANE_OPTIONS.map((opt) => (
                <button
                  key={opt.value}
                  type="button"
                  onClick={() => setSlowLane(slowLane === opt.value ? null : opt.value)}
                  className={`px-3 py-2 rounded-xl text-[11px] font-bold border transition-all active:scale-95 text-center ${
                    slowLane === opt.value
                      ? 'bg-amber-500 text-white border-amber-600 shadow-sm'
                      : 'bg-white dark:bg-gray-800 text-gray-700 dark:text-gray-300 border-gray-200 dark:border-gray-700'
                  }`}
                >
                  {lang === 'es' ? opt.es : opt.en}
                </button>
              ))}
            </div>
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
        {lang === 'es' ? 'Sin cuenta necesaria · Únete a los guardianes del puente' : 'No account needed · Join the bridge guardians'}
      </p>
    </div>
  )
}
