'use client'

import { useState, useEffect, useCallback } from 'react'
import { useAuth } from '@/lib/useAuth'
import { useLang } from '@/lib/LangContext'
import { Navigation, X, Zap } from 'lucide-react'

// Approximate coordinates for each crossing (center of bridge)
const CROSSINGS = [
  { portId: '230501', name: 'McAllen / Hidalgo',  lat: 26.1080, lng: -98.2708 },
  { portId: '230502', name: 'Pharr–Reynosa',       lat: 26.1764, lng: -98.1836 },
  { portId: '230503', name: 'Anzaldúas',           lat: 26.0432, lng: -98.3647 },
  { portId: '230901', name: 'Progreso',            lat: 26.0905, lng: -97.9736 },
  { portId: '230902', name: 'Donna',               lat: 26.1649, lng: -98.0492 },
  { portId: '230701', name: 'Rio Grande City',     lat: 26.3795, lng: -98.8219 },
  { portId: '231001', name: 'Roma',                lat: 26.4079, lng: -99.0195 },
  { portId: '535501', name: 'Brownsville Gateway', lat: 25.9007, lng: -97.4935 },
  { portId: '535502', name: 'Brownsville Veterans',lat: 25.8726, lng: -97.4866 },
  { portId: '535503', name: 'Los Tomates',         lat: 26.0416, lng: -97.7367 },
  { portId: '230401', name: 'Laredo I',            lat: 27.4994, lng: -99.5076 },
  { portId: '230402', name: 'Laredo II',           lat: 27.5628, lng: -99.5019 },
  { portId: '230403', name: 'Colombia',            lat: 27.6505, lng: -99.5539 },
  { portId: '230404', name: 'Laredo IV',           lat: 27.5533, lng: -99.4786 },
  { portId: '230301', name: 'Eagle Pass I',        lat: 28.7091, lng: -100.4995 },
  { portId: '230302', name: 'Eagle Pass II',       lat: 28.7150, lng: -100.5010 },
  { portId: '240201', name: 'El Paso',             lat: 31.7619, lng: -106.4850 },
  { portId: '250401', name: 'San Ysidro',          lat: 32.5432, lng: -117.0281 },
  { portId: '250601', name: 'Otay Mesa',           lat: 32.5526, lng: -116.9734 },
]

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

export function WaitingMode({ onNearCrossing }: Props) {
  const { user } = useAuth()
  const { lang } = useLang()
  const [nearCrossing, setNearCrossing] = useState<{ portId: string; name: string; distKm: number } | null>(null)
  const [dismissed, setDismissed] = useState(false)
  const [submitting, setSubmitting] = useState(false)
  const [submitted, setSubmitted] = useState(false)
  const [condition, setCondition] = useState('')

  const check = useCallback((pos: GeolocationPosition) => {
    const { latitude, longitude } = pos.coords
    let closest: typeof nearCrossing = null
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

  useEffect(() => {
    if (!navigator.geolocation) return
    const key = `waiting_dismissed_${new Date().toDateString()}`
    if (sessionStorage.getItem(key)) { setDismissed(true); return }

    // Only auto-watch if permission was already granted — no silent prompt
    if (navigator.permissions) {
      navigator.permissions.query({ name: 'geolocation' }).then(result => {
        if (result.state === 'granted') {
          const id = navigator.geolocation.watchPosition(check, () => {}, { enableHighAccuracy: false, maximumAge: 60000 })
          result.onchange = () => { if (result.state !== 'granted') navigator.geolocation.clearWatch(id) }
        }
        // If 'prompt' or 'denied', we do nothing — no browser dialog on load
      })
    }
  }, [check])

  async function quickReport(cond: string) {
    if (!nearCrossing) return

    // Spam limit: max 1 report per bridge per 30 min
    const spamKey = `report_${nearCrossing.portId}`
    const lastReport = localStorage.getItem(spamKey)
    if (lastReport && Date.now() - parseInt(lastReport) < 30 * 60 * 1000) {
      dismiss()
      return
    }

    setCondition(cond)
    setSubmitting(true)
    await fetch('/api/reports', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        portId: nearCrossing.portId,
        condition: cond,
        waitingMode: true,
        ref: typeof window !== 'undefined' ? localStorage.getItem('cruzar_ref') : null,
      }),
    })
    localStorage.setItem(spamKey, Date.now().toString())
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

  if (dismissed || !nearCrossing) return null

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
    </div>
  )
}
