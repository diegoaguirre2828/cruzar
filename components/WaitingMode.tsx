'use client'

import { useState, useEffect, useCallback, useRef } from 'react'
import { useAuth } from '@/lib/useAuth'
import { useLang } from '@/lib/LangContext'
import { Navigation, X, MapPin, Clock } from 'lucide-react'
import { PORT_META } from '@/lib/portMeta'
import { trackEvent } from '@/lib/trackEvent'
import { useCrossingDetector, detectPlatform } from '@/lib/useCrossingDetector'

// Derived from PORT_META so geofence coverage matches the map. Adding a port
// to portMeta.ts automatically enables the "are you at X?" prompt there.
const CROSSINGS = Object.entries(PORT_META).map(([portId, meta]) => ({
  portId,
  name: meta.localName || meta.city,
  lat: meta.lat,
  lng: meta.lng,
}))

const NEARBY_KM = 3

function distanceKm(lat1: number, lng1: number, lat2: number, lng2: number) {
  const R = 6371
  const dLat = (lat2 - lat1) * Math.PI / 180
  const dLng = (lng2 - lng1) * Math.PI / 180
  const a = Math.sin(dLat/2)**2 + Math.cos(lat1*Math.PI/180) * Math.cos(lat2*Math.PI/180) * Math.sin(dLng/2)**2
  return R * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1-a))
}

interface Props {
  onNearCrossing?: (portId: string, portName: string) => void
}

type PermState = 'granted' | 'prompt' | 'denied' | 'unknown'

export function WaitingMode({ onNearCrossing }: Props) {
  const { user } = useAuth()
  const { lang } = useLang()
  const [nearCrossing, setNearCrossing] = useState<{ portId: string; name: string; distKm: number } | null>(null)
  const [dismissed, setDismissed] = useState(false)
  const [submitting, setSubmitting] = useState(false)
  const [submitted, setSubmitted] = useState(false)
  const [condition, setCondition] = useState('')
  const [permState, setPermState] = useState<PermState>('unknown')
  const [permPromptDismissed, setPermPromptDismissed] = useState(false)
  const [optedIn, setOptedIn] = useState(false)
  const [confirming, setConfirming] = useState(false)
  const [confirmLane, setConfirmLane] = useState<'general' | 'sentri' | 'commercial' | 'pedestrian'>('general')
  const [confirmReason, setConfirmReason] = useState<'docs' | 'inspection' | 'construction' | 'protest' | 'other' | null>(null)
  const lastPosRef = useRef<{ lat: number; lng: number } | null>(null)

  const { inLine, elapsedMin, crossed, startInLine, cancelInLine, dismissCrossed } =
    useCrossingDetector(optedIn)

  // Pull the opt-in flag once auth resolves. Anonymous users stay opted out.
  useEffect(() => {
    if (!user) { setOptedIn(false); return }
    fetch('/api/profile')
      .then((r) => r.json())
      .then((d) => setOptedIn(!!d?.profile?.auto_geofence_opt_in))
      .catch(() => setOptedIn(false))
  }, [user])

  const check = useCallback((pos: GeolocationPosition) => {
    const { latitude, longitude } = pos.coords
    lastPosRef.current = { lat: latitude, lng: longitude }
    let closest: { portId: string; name: string; distKm: number } | null = null
    let minDist = NEARBY_KM
    for (const c of CROSSINGS) {
      const d = distanceKm(latitude, longitude, c.lat, c.lng)
      if (d < minDist) { minDist = d; closest = { portId: c.portId, name: c.name, distKm: d } }
    }
    if (closest) {
      setNearCrossing(closest)
      onNearCrossing?.(closest.portId, closest.name)
    }
  }, [onNearCrossing])

  // Mount: read current permission state without triggering a prompt.
  // Per-day dismiss flags persist via sessionStorage so a closed banner
  // stays closed for the rest of the day.
  useEffect(() => {
    if (typeof window === 'undefined' || !navigator.geolocation) return
    const dayKey = `waiting_dismissed_${new Date().toDateString()}`
    if (sessionStorage.getItem(dayKey)) { setDismissed(true); return }
    const promptKey = `waiting_perm_dismissed_${new Date().toDateString()}`
    if (sessionStorage.getItem(promptKey)) setPermPromptDismissed(true)

    if (!navigator.permissions) {
      // Older Safari has no Permissions API for geolocation — assume prompt
      // so the CTA renders and the user can opt in explicitly.
      setPermState('prompt')
      return
    }
    navigator.permissions.query({ name: 'geolocation' as PermissionName })
      .then((result) => {
        setPermState(result.state as PermState)
        result.onchange = () => setPermState(result.state as PermState)
      })
      .catch(() => setPermState('prompt'))
  }, [])

  // When permission is granted (now or later), start the geofence watch.
  // Tears down on unmount or permission revoke.
  useEffect(() => {
    if (permState !== 'granted' || typeof window === 'undefined' || !navigator.geolocation) return
    const id = navigator.geolocation.watchPosition(
      check,
      () => {},
      { enableHighAccuracy: false, maximumAge: 60_000 },
    )
    return () => navigator.geolocation.clearWatch(id)
  }, [permState, check])

  function requestPermission() {
    if (typeof window === 'undefined' || !navigator.geolocation) return
    navigator.geolocation.getCurrentPosition(
      (pos) => { setPermState('granted'); check(pos) },
      (err) => {
        if (err.code === err.PERMISSION_DENIED) setPermState('denied')
      },
      { enableHighAccuracy: false, maximumAge: 60_000, timeout: 10_000 },
    )
  }

  function dismissPermPrompt() {
    sessionStorage.setItem(`waiting_perm_dismissed_${new Date().toDateString()}`, '1')
    setPermPromptDismissed(true)
  }

  async function quickReport(cond: string) {
    if (!nearCrossing) return
    setCondition(cond)
    setSubmitting(true)

    // Capture a fresh fix so the server can mark verified_by_geofence.
    // Falls back to the last watched position if the live read times out.
    const pos = await new Promise<GeolocationPosition | null>((resolve) => {
      if (typeof window === 'undefined' || !navigator.geolocation) return resolve(null)
      navigator.geolocation.getCurrentPosition(
        (p) => resolve(p),
        () => resolve(null),
        { enableHighAccuracy: true, maximumAge: 60_000, timeout: 6_000 },
      )
    })
    const lat = pos?.coords.latitude ?? lastPosRef.current?.lat ?? null
    const lng = pos?.coords.longitude ?? lastPosRef.current?.lng ?? null

    await fetch('/api/reports', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        portId: nearCrossing.portId,
        condition: cond,
        waitingMode: true,
        ...(lat != null && lng != null ? { lat, lng } : {}),
        ref: typeof window !== 'undefined' ? localStorage.getItem('cruzar_ref') : null,
      }),
    })
    trackEvent('report_submitted', {
      port_id: nearCrossing.portId,
      source: 'waiting_mode',
      condition: cond,
      verified: lat != null && lng != null ? '1' : '0',
    })
    setSubmitting(false)
    setSubmitted(true)
    sessionStorage.setItem(`waiting_dismissed_${new Date().toDateString()}`, '1')
    setTimeout(() => { setNearCrossing(null); setSubmitted(false) }, 6000)
  }

  function dismiss() {
    sessionStorage.setItem(`waiting_dismissed_${new Date().toDateString()}`, 'dismissed')
    setDismissed(true)
    setNearCrossing(null)
  }

  function startTracking() {
    if (!nearCrossing || !lastPosRef.current) return
    startInLine(nearCrossing.portId, nearCrossing.name, lastPosRef.current.lat, lastPosRef.current.lng)
    trackEvent('auto_crossing_started', {
      port_id: nearCrossing.portId,
      source: 'waiting_mode',
    })
  }

  async function confirmCrossed() {
    if (!crossed) return
    setConfirming(true)
    try {
      await fetch('/api/auto-crossings', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          port_id: crossed.portId,
          side_in: crossed.sideIn,
          side_out: crossed.sideOut,
          dt_minutes: crossed.dtMinutes,
          lane_guess: confirmLane,
          reason_tag: confirmReason,
          platform: detectPlatform(),
        }),
      })
      trackEvent('auto_crossing_confirmed', {
        port_id: crossed.portId,
        dt_minutes: String(crossed.dtMinutes),
        lane: confirmLane,
        reason: confirmReason || 'none',
      })
    } finally {
      setConfirming(false)
      setConfirmLane('general')
      setConfirmReason(null)
      dismissCrossed()
    }
  }

  function rejectCrossed() {
    if (crossed) {
      trackEvent('auto_crossing_rejected', { port_id: crossed.portId })
    }
    setConfirmLane('general')
    setConfirmReason(null)
    dismissCrossed()
  }

  // ─── Render ─────────────────────────────────────────────────────────

  if (dismissed) return null

  // Highest-priority banner: a confirmed crossing waiting for the user
  // to acknowledge. Render even if the bridge geofence isn't currently
  // matching anything, since the user is now well past the bridge.
  // The lane + reason chips here are the data-quality layer — without
  // them every auto-crossing is a "general lane, no reason" row, which
  // makes the dataset noisy for the Phase 3 intelligence layer.
  if (crossed) {
    const laneOptions: { id: 'general' | 'sentri' | 'commercial' | 'pedestrian'; labelEs: string; labelEn: string }[] = [
      { id: 'general',     labelEs: 'General',    labelEn: 'General' },
      { id: 'sentri',      labelEs: 'SENTRI',     labelEn: 'SENTRI' },
      { id: 'commercial',  labelEs: 'Comercial',  labelEn: 'Commercial' },
      { id: 'pedestrian',  labelEs: 'A pie',      labelEn: 'Pedestrian' },
    ]
    const reasonOptions: { id: 'docs' | 'inspection' | 'construction' | 'protest' | 'other'; labelEs: string; labelEn: string }[] = [
      { id: 'docs',         labelEs: 'Papeleo',     labelEn: 'Docs' },
      { id: 'inspection',   labelEs: 'Inspección',  labelEn: 'Inspection' },
      { id: 'construction', labelEs: 'Obra',        labelEn: 'Construction' },
      { id: 'protest',      labelEs: 'Bloqueo',     labelEn: 'Blockade' },
      { id: 'other',        labelEs: 'Otro',        labelEn: 'Other' },
    ]
    return (
      <div className="mb-4 bg-emerald-50 dark:bg-emerald-900/20 border border-emerald-200 dark:border-emerald-800 rounded-2xl p-4">
        <div className="flex items-start gap-2 mb-3">
          <Clock className="w-4 h-4 text-emerald-600 dark:text-emerald-400 mt-0.5 flex-shrink-0" />
          <div>
            <p className="text-sm font-bold text-emerald-800 dark:text-emerald-300">
              {lang === 'es'
                ? `Detectamos que cruzaste por ${crossed.portName} en ${crossed.dtMinutes} min`
                : `We detected you crossed ${crossed.portName} in ${crossed.dtMinutes} min`}
            </p>
            <p className="text-xs text-emerald-700 dark:text-emerald-400 mt-0.5">
              {lang === 'es'
                ? '¿Correcto? Confirma para ayudar a otros y ganar 10 puntos.'
                : 'Correct? Confirm to help others and earn 10 points.'}
            </p>
          </div>
        </div>

        <p className="text-[11px] uppercase tracking-wide font-semibold text-emerald-700 dark:text-emerald-400 mb-1.5">
          {lang === 'es' ? 'Carril' : 'Lane'}
        </p>
        <div className="grid grid-cols-4 gap-1.5 mb-3">
          {laneOptions.map((opt) => (
            <button
              key={opt.id}
              onClick={() => setConfirmLane(opt.id)}
              disabled={confirming}
              className={`py-2 px-1 rounded-lg text-xs font-semibold transition-colors ${
                confirmLane === opt.id
                  ? 'bg-emerald-600 text-white'
                  : 'bg-white dark:bg-gray-800 border border-emerald-200 dark:border-emerald-800 text-emerald-800 dark:text-emerald-300'
              }`}
            >
              {lang === 'es' ? opt.labelEs : opt.labelEn}
            </button>
          ))}
        </div>

        <p className="text-[11px] uppercase tracking-wide font-semibold text-emerald-700 dark:text-emerald-400 mb-1.5">
          {lang === 'es' ? '¿Qué te demoró? (opcional)' : 'What slowed you? (optional)'}
        </p>
        <div className="flex flex-wrap gap-1.5 mb-3">
          {reasonOptions.map((opt) => (
            <button
              key={opt.id}
              onClick={() => setConfirmReason((prev) => (prev === opt.id ? null : opt.id))}
              disabled={confirming}
              className={`py-1.5 px-2.5 rounded-full text-xs font-medium transition-colors ${
                confirmReason === opt.id
                  ? 'bg-emerald-600 text-white'
                  : 'bg-white dark:bg-gray-800 border border-emerald-200 dark:border-emerald-800 text-emerald-800 dark:text-emerald-300'
              }`}
            >
              {lang === 'es' ? opt.labelEs : opt.labelEn}
            </button>
          ))}
        </div>

        <div className="grid grid-cols-2 gap-2">
          <button
            onClick={confirmCrossed}
            disabled={confirming}
            className="py-2.5 rounded-xl bg-emerald-600 text-white text-sm font-bold active:scale-95 transition-transform disabled:opacity-50"
          >
            {confirming ? (lang === 'es' ? 'Enviando…' : 'Sending…') : lang === 'es' ? 'Sí, confirmar' : 'Yes, confirm'}
          </button>
          <button
            onClick={rejectCrossed}
            disabled={confirming}
            className="py-2.5 rounded-xl bg-white dark:bg-gray-800 border border-emerald-300 dark:border-emerald-700 text-emerald-800 dark:text-emerald-300 text-sm font-bold active:scale-95 transition-transform disabled:opacity-50"
          >
            {lang === 'es' ? 'No, descartar' : 'No, discard'}
          </button>
        </div>
      </div>
    )
  }

  // Active in-line session: show the live timer.
  if (inLine) {
    return (
      <div className="mb-4 bg-amber-50 dark:bg-amber-900/20 border border-amber-200 dark:border-amber-800 rounded-2xl p-4">
        <div className="flex items-start justify-between mb-3">
          <div className="flex items-start gap-2">
            <Clock className="w-4 h-4 text-amber-600 dark:text-amber-400 mt-0.5 flex-shrink-0" />
            <div>
              <p className="text-sm font-bold text-amber-800 dark:text-amber-300">
                {lang === 'es' ? `En la fila — ${inLine.portName}` : `In line — ${inLine.portName}`}
              </p>
              <p className="text-xs text-amber-700 dark:text-amber-400 mt-0.5">
                {lang === 'es'
                  ? 'Te avisamos automáticamente cuando cruces.'
                  : 'We\'ll auto-detect when you cross.'}
              </p>
            </div>
          </div>
          <button
            onClick={cancelInLine}
            aria-label={lang === 'es' ? 'Cancelar' : 'Cancel'}
            className="text-amber-400 hover:text-amber-600 ml-2"
          >
            <X className="w-4 h-4" />
          </button>
        </div>
        <div className="text-center py-2">
          <p className="text-3xl font-bold text-amber-700 dark:text-amber-300 tabular-nums">
            {elapsedMin} <span className="text-base font-medium">min</span>
          </p>
        </div>
      </div>
    )
  }

  // No bridge nearby yet — show the permission CTA when the browser is
  // in the 'prompt' state. Without this, users with un-granted location
  // never see WaitingMode at all (the geofence watch can't start) and
  // the verified-at-bridge data path stays empty.
  if (!nearCrossing) {
    if (permState === 'prompt' && !permPromptDismissed) {
      return (
        <div className="mb-4 bg-blue-50 dark:bg-blue-900/20 border border-blue-200 dark:border-blue-800 rounded-2xl p-4">
          <div className="flex items-start justify-between mb-3">
            <div className="flex items-start gap-2">
              <MapPin className="w-4 h-4 text-blue-600 dark:text-blue-400 mt-0.5 flex-shrink-0" />
              <div>
                <p className="text-sm font-bold text-blue-800 dark:text-blue-300">
                  {lang === 'es' ? 'Reporta desde el puente con un toque' : 'Report from the bridge in one tap'}
                </p>
                <p className="text-xs text-blue-600 dark:text-blue-400 mt-0.5">
                  {lang === 'es'
                    ? 'Activa tu ubicación. Te avisamos cuando llegues y ganas puntos extra por reportes verificados.'
                    : 'Turn on location — we ping you when you arrive and you earn bonus points for verified reports.'}
                </p>
              </div>
            </div>
            <button
              onClick={dismissPermPrompt}
              aria-label={lang === 'es' ? 'Cerrar' : 'Dismiss'}
              className="text-blue-300 hover:text-blue-500 ml-2"
            >
              <X className="w-4 h-4" />
            </button>
          </div>
          <button
            onClick={requestPermission}
            className="w-full py-2.5 rounded-xl bg-blue-600 text-white text-sm font-bold active:scale-95 transition-transform"
          >
            {lang === 'es' ? 'Activar ubicación' : 'Enable location'}
          </button>
        </div>
      )
    }
    return null
  }

  if (submitted) {
    const shareText = lang === 'es'
      ? `${nearCrossing?.name} está ${condition === 'fast' ? 'rápido 🟢' : condition === 'slow' ? 'lento 🔴' : 'normal 🟡'} ahorita. checen cruzar.app pa ver todos los puentes en vivo`
      : `${nearCrossing?.name} is ${condition === 'fast' ? 'moving fast 🟢' : condition === 'slow' ? 'slow 🔴' : 'normal 🟡'} right now. check cruzar.app for all live wait times`
    const waUrl = `https://wa.me/?text=${encodeURIComponent(shareText)}`

    return (
      <div className="mb-4 bg-green-50 dark:bg-green-900/20 border border-green-200 dark:border-green-800 rounded-2xl p-4">
        <p className="text-sm font-bold text-green-700 dark:text-green-400 text-center mb-1">
          ⚡ {lang === 'es' ? '¡Gracias por reportar!' : 'Thanks for reporting!'}
        </p>
        <p className="text-xs text-green-600 dark:text-green-500 text-center mb-3">
          {lang === 'es' ? 'Avísale a tu familia y amigos' : 'Let your family and friends know'}
        </p>
        <a
          href={waUrl}
          target="_blank"
          rel="noopener noreferrer"
          className="flex items-center justify-center gap-2 w-full py-2.5 rounded-xl bg-green-600 text-white text-sm font-bold active:scale-95 transition-transform"
        >
          <span>📲</span>
          {lang === 'es' ? 'Compartir por WhatsApp' : 'Share on WhatsApp'}
        </a>
      </div>
    )
  }

  return (
    <div className="mb-4 bg-blue-50 dark:bg-blue-900/20 border border-blue-200 dark:border-blue-800 rounded-2xl p-4">
      <div className="flex items-start justify-between mb-3">
        <div className="flex items-start gap-2">
          <Navigation className="w-4 h-4 text-blue-600 dark:text-blue-400 mt-0.5 flex-shrink-0" />
          <div>
            <p className="text-sm font-bold text-blue-800 dark:text-blue-300">
              {lang === 'es' ? `¿Estás en ${nearCrossing.name}?` : `Are you at ${nearCrossing.name}?`}
            </p>
            <p className="text-xs text-blue-600 dark:text-blue-400 mt-0.5">
              {lang === 'es' ? 'Ayuda a todos en la fila reportando' : 'Help others in line by reporting'}
            </p>
          </div>
        </div>
        <button onClick={dismiss} className="text-blue-300 hover:text-blue-500 ml-2">
          <X className="w-4 h-4" />
        </button>
      </div>
      <div className="grid grid-cols-3 gap-2">
        {[
          { cond: 'fast',   emoji: '🟢', label: lang === 'es' ? 'Rápido' : 'Fast' },
          { cond: 'normal', emoji: '🟡', label: lang === 'es' ? 'Normal' : 'Normal' },
          { cond: 'slow',   emoji: '🔴', label: lang === 'es' ? 'Lento' : 'Slow' },
        ].map(({ cond, emoji, label }) => (
          <button
            key={cond}
            onClick={() => quickReport(cond)}
            disabled={submitting}
            className="flex flex-col items-center gap-1 py-3.5 rounded-xl bg-white dark:bg-gray-800 border border-blue-200 dark:border-blue-700 hover:bg-blue-50 dark:hover:bg-blue-900/30 transition-colors disabled:opacity-40 active:scale-95"
          >
            <span className="text-lg">{emoji}</span>
            <span className="text-xs font-semibold text-blue-800 dark:text-blue-300">{label}</span>
          </button>
        ))}
      </div>
      {optedIn && (
        <button
          onClick={startTracking}
          className="mt-3 w-full flex items-center justify-center gap-2 py-2.5 rounded-xl bg-blue-600 text-white text-sm font-bold active:scale-95 transition-transform"
        >
          <Clock className="w-4 h-4" />
          {lang === 'es' ? 'Estoy en la fila — rastrear mi cruce' : 'I\'m in line — track my crossing'}
        </button>
      )}
    </div>
  )
}
