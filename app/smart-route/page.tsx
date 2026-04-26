'use client'

import { useState } from 'react'
import Link from 'next/link'
import { useLang } from '@/lib/LangContext'
import { ArrowLeft, Navigation, Zap, Clock } from 'lucide-react'
import { LangToggle } from '@/components/LangToggle'

interface Route {
  port_id: string
  name: string
  city: string
  distKm: number
  driveMin: number
  waitMin: number | null
  totalMin: number
  confidence: 'live' | 'no-data'
}

export default function SmartRoutePage() {
  const { lang } = useLang()
  const es = lang === 'es'
  const [origin, setOrigin] = useState('')
  const [routes, setRoutes] = useState<Route[]>([])
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')

  async function useGPS() {
    if (!navigator.geolocation) { setError('GPS not available'); return }
    setLoading(true); setError('')
    navigator.geolocation.getCurrentPosition(
      async (pos) => {
        await fetchRoutes(pos.coords.latitude, pos.coords.longitude)
      },
      (e) => { setLoading(false); setError(es ? `No se pudo obtener tu ubicación: ${e.message}` : `Couldn't get location: ${e.message}`) },
      { enableHighAccuracy: true, timeout: 10_000 },
    )
  }

  async function geocode(text: string): Promise<{ lat: number; lng: number } | null> {
    // v1: hardcoded common RGV/Tex-MX origins. Future: HERE Maps geocode API.
    const t = text.trim().toLowerCase()
    const map: Record<string, { lat: number; lng: number }> = {
      'mcallen': { lat: 26.2034, lng: -98.2300 },
      'pharr': { lat: 26.1948, lng: -98.1836 },
      'edinburg': { lat: 26.3017, lng: -98.1633 },
      'brownsville': { lat: 25.9017, lng: -97.4975 },
      'harlingen': { lat: 26.1906, lng: -97.6961 },
      'mission': { lat: 26.2159, lng: -98.3253 },
      'weslaco': { lat: 26.1595, lng: -97.9908 },
      'reynosa': { lat: 26.0891, lng: -98.2772 },
      'matamoros': { lat: 25.8693, lng: -97.5028 },
      'laredo': { lat: 27.5036, lng: -99.5076 },
      'eagle pass': { lat: 28.7091, lng: -100.4995 },
      'el paso': { lat: 31.7619, lng: -106.4850 },
      'houston': { lat: 29.7604, lng: -95.3698 },
      'san antonio': { lat: 29.4241, lng: -98.4936 },
      'dallas': { lat: 32.7767, lng: -96.7970 },
      'monterrey': { lat: 25.6866, lng: -100.3161 },
    }
    return map[t] || null
  }

  async function fetchRoutes(lat: number, lng: number) {
    setLoading(true); setError('')
    const res = await fetch(`/api/smart-route?lat=${lat}&lng=${lng}&limit=5`)
    const data = await res.json()
    setLoading(false)
    if (!res.ok) { setError(data.error || `${res.status}`); return }
    setRoutes(data.routes || [])
  }

  async function search() {
    const coords = await geocode(origin)
    if (!coords) {
      setError(es ? 'Ciudad no reconocida. Prueba: McAllen, Pharr, Brownsville, Laredo, El Paso, Houston…' : 'City not recognized. Try: McAllen, Pharr, Brownsville, Laredo, El Paso, Houston…')
      return
    }
    fetchRoutes(coords.lat, coords.lng)
  }

  return (
    <main className="min-h-screen bg-gray-50 dark:bg-gray-950">
      <div className="max-w-2xl mx-auto px-4 pb-16">
        <div className="pt-6 pb-4 flex items-center justify-between gap-3">
          <div className="flex items-center gap-3">
            <Link href="/" className="p-2 rounded-xl bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700"><ArrowLeft className="w-4 h-4 text-gray-600 dark:text-gray-300" /></Link>
            <h1 className="text-xl font-bold text-gray-900 dark:text-gray-100 flex items-center gap-2">
              <Navigation className="w-5 h-5" />
              {es ? 'Ruta inteligente' : 'Smart route'}
            </h1>
          </div>
          <LangToggle />
        </div>

        <div className="bg-white dark:bg-gray-800 rounded-2xl border border-gray-200 dark:border-gray-700 p-5 shadow-sm mb-4">
          <p className="text-sm text-gray-700 dark:text-gray-300 mb-3">
            {es ? 'Te decimos qué puente cruzar AHORITA para llegar más rápido. Espera + manejo combinados.' : 'Which bridge to cross RIGHT NOW for fastest total trip. Wait time + drive time combined.'}
          </p>
          <div className="flex flex-col sm:flex-row gap-2">
            <input
              type="text"
              value={origin}
              onChange={(e) => setOrigin(e.target.value)}
              onKeyDown={(e) => e.key === 'Enter' && search()}
              placeholder={es ? 'Tu ciudad (ej. McAllen)' : 'Your city (e.g. McAllen)'}
              className="flex-1 text-sm px-3 py-2.5 rounded-xl border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-900 text-gray-900 dark:text-gray-100"
            />
            <button onClick={search} disabled={loading || !origin.trim()} className="px-4 py-2.5 rounded-xl bg-blue-600 text-white text-sm font-bold disabled:opacity-50">
              {es ? 'Buscar' : 'Find'}
            </button>
            <button onClick={useGPS} disabled={loading} className="px-4 py-2.5 rounded-xl bg-gray-100 dark:bg-gray-700 text-gray-700 dark:text-gray-200 text-sm font-bold disabled:opacity-50">
              📍 GPS
            </button>
          </div>
          {error && <p className="text-xs text-red-500 mt-2">{error}</p>}
        </div>

        {routes.length > 0 && (
          <div className="space-y-2">
            {routes.map((r, i) => (
              <Link
                key={r.port_id}
                href={`/port/${encodeURIComponent(r.port_id)}`}
                className={`block rounded-2xl border p-4 transition-colors ${
                  i === 0
                    ? 'bg-emerald-50 dark:bg-emerald-900/20 border-emerald-300 dark:border-emerald-700'
                    : 'bg-white dark:bg-gray-800 border-gray-200 dark:border-gray-700 hover:bg-gray-50 dark:hover:bg-gray-700'
                }`}
              >
                <div className="flex items-center justify-between gap-3">
                  <div className="min-w-0">
                    <div className="flex items-center gap-2 mb-1">
                      {i === 0 && <Zap className="w-4 h-4 text-emerald-600 dark:text-emerald-400" />}
                      <p className="text-sm font-bold text-gray-900 dark:text-gray-100 truncate">{r.name}</p>
                    </div>
                    <p className="text-xs text-gray-500 dark:text-gray-400">
                      {r.city} · {r.distKm} km · {r.driveMin} min {es ? 'manejando' : 'driving'}
                    </p>
                    {r.confidence === 'no-data' && (
                      <p className="text-[10px] text-amber-600 dark:text-amber-400 mt-0.5">{es ? '⚠️ Sin datos en vivo — espera estimada' : '⚠️ No live data — wait estimated'}</p>
                    )}
                  </div>
                  <div className="text-right flex-shrink-0">
                    <p className={`text-2xl font-black tabular-nums leading-none ${
                      i === 0 ? 'text-emerald-700 dark:text-emerald-400' : 'text-gray-900 dark:text-gray-100'
                    }`}>{r.totalMin}</p>
                    <p className="text-[10px] uppercase tracking-wider font-semibold text-gray-500 mt-1 flex items-center justify-end gap-0.5">
                      <Clock className="w-3 h-3" /> total
                    </p>
                    {r.waitMin != null && <p className="text-[10px] text-gray-500 mt-0.5">{r.waitMin}m wait</p>}
                  </div>
                </div>
              </Link>
            ))}
            <p className="text-[11px] text-gray-500 text-center mt-3">
              {es ? 'Próximamente: integración con tráfico en vivo y predicción 6 hrs adelante.' : 'Coming soon: live traffic integration and 6hr-ahead forecasts.'}
            </p>
          </div>
        )}
      </div>
    </main>
  )
}
