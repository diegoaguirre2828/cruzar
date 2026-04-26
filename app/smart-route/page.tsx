'use client'

import { useState } from 'react'
import Link from 'next/link'
import { useLang } from '@/lib/LangContext'
import { ArrowLeft, Navigation, Zap, Clock, Bell, Bookmark, TrendingUp, Lock } from 'lucide-react'
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
              {es ? 'Próximamente: integración con tráfico en vivo.' : 'Coming soon: live traffic integration.'}
            </p>
          </div>
        )}

        {/* Pro upsell — what becomes available with Pro */}
        <div className="mt-6 bg-gradient-to-br from-blue-50 to-indigo-50 dark:from-blue-900/20 dark:to-indigo-900/20 border border-blue-200 dark:border-blue-800 rounded-2xl p-5">
          <div className="flex items-center gap-2 mb-1">
            <Zap className="w-4 h-4 text-blue-600 dark:text-blue-400" />
            <p className="text-[10px] uppercase tracking-[0.18em] font-bold text-blue-700 dark:text-blue-400">
              {es ? 'Smart route en automático · Pro $2.99/mes' : 'Smart route on autopilot · Pro $2.99/mo'}
            </p>
          </div>
          <h2 className="text-lg font-bold text-gray-900 dark:text-gray-100 mb-3">
            {es ? 'Esto solo te dice el puente AHORITA. Pro hace el resto.' : "This only tells you the bridge RIGHT NOW. Pro does the rest."}
          </h2>
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 mb-4">
            <div className="bg-white dark:bg-gray-800 rounded-xl p-3 border border-blue-100 dark:border-blue-900">
              <div className="flex items-center gap-1.5 mb-1">
                <Bell className="w-3.5 h-3.5 text-blue-600" />
                <p className="text-xs font-bold text-gray-900 dark:text-gray-100">{es ? 'Smart route alerts' : 'Smart route alerts'}</p>
                <Lock className="w-3 h-3 text-gray-400 ml-auto" />
              </div>
              <p className="text-[11px] text-gray-600 dark:text-gray-400">{es ? 'Te avisamos cuando un puente más rápido se abre.' : "Pinged the moment a faster bridge opens."}</p>
            </div>
            <div className="bg-white dark:bg-gray-800 rounded-xl p-3 border border-blue-100 dark:border-blue-900">
              <div className="flex items-center gap-1.5 mb-1">
                <Bookmark className="w-3.5 h-3.5 text-blue-600" />
                <p className="text-xs font-bold text-gray-900 dark:text-gray-100">{es ? 'Rutas guardadas' : 'Saved routes'}</p>
                <Lock className="w-3 h-3 text-gray-400 ml-auto" />
              </div>
              <p className="text-[11px] text-gray-600 dark:text-gray-400">{es ? 'Tu trayecto diario se rastrea solo.' : "Your daily commute auto-tracked."}</p>
            </div>
            <div className="bg-white dark:bg-gray-800 rounded-xl p-3 border border-blue-100 dark:border-blue-900">
              <div className="flex items-center gap-1.5 mb-1">
                <TrendingUp className="w-3.5 h-3.5 text-blue-600" />
                <p className="text-xs font-bold text-gray-900 dark:text-gray-100">{es ? 'Predicción 6 hrs' : '6h-ahead forecast'}</p>
                <Lock className="w-3 h-3 text-gray-400 ml-auto" />
              </div>
              <p className="text-[11px] text-gray-600 dark:text-gray-400">{es ? 'No solo ahorita — sabes la espera 6 horas adelante.' : "Not just right now — wait 6 hours ahead."}</p>
            </div>
          </div>
          <Link href="/pricing#pro" className="block w-full text-center py-2.5 px-4 rounded-xl bg-blue-600 text-white text-sm font-bold hover:bg-blue-700">
            {es ? 'Empezar 7 días gratis · $2.99/mes' : 'Start 7-day free trial · $2.99/mo'}
          </Link>
        </div>
      </div>
    </main>
  )
}
