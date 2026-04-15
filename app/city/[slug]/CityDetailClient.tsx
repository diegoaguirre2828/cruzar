'use client'

import { useEffect, useState } from 'react'
import Link from 'next/link'
import { ArrowLeft, MapPin, Clock } from 'lucide-react'
import { useLang } from '@/lib/LangContext'
import type { CityMeta } from '@/lib/cityMeta'
import { getPortMeta } from '@/lib/portMeta'
import { getBridgeCameras } from '@/lib/bridgeCameras'
import { PortFAQ } from '@/components/PortFAQ'
import { BottomNav } from '@/components/BottomNav'

type LivePort = {
  portId: string
  portName: string
  vehicle: number | null
  pedestrian: number | null
  isClosed: boolean
}

// City rollup page. SEO landing for "{mxCity} border crossing" queries.
// Shows every CBP port in the city with current wait times side by side,
// camera availability badges, and the city-scoped FAQ with FAQPage JSON-LD.
// Per-port pages remain the destination for detailed views + reports.

function waitColor(wait: number | null): { bg: string; text: string; dot: string } {
  if (wait == null) return { bg: 'bg-gray-100 dark:bg-gray-700', text: 'text-gray-500', dot: 'bg-gray-400' }
  if (wait <= 20) return { bg: 'bg-green-50 dark:bg-green-900/30', text: 'text-green-700 dark:text-green-300', dot: 'bg-green-500' }
  if (wait <= 45) return { bg: 'bg-amber-50 dark:bg-amber-900/30', text: 'text-amber-700 dark:text-amber-300', dot: 'bg-amber-500' }
  return { bg: 'bg-red-50 dark:bg-red-900/30', text: 'text-red-700 dark:text-red-300', dot: 'bg-red-500' }
}

export function CityDetailClient({ city }: { city: CityMeta }) {
  const { lang } = useLang()
  const es = lang === 'es'
  const [ports, setPorts] = useState<LivePort[]>([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    let cancelled = false
    const load = async () => {
      try {
        const res = await fetch('/api/ports', { cache: 'no-store' })
        const json = await res.json()
        if (cancelled) return
        const all: LivePort[] = json?.ports ?? []
        const filtered = city.ports
          .map((id) => all.find((p) => p.portId === id))
          .filter((p): p is LivePort => !!p)
        setPorts(filtered)
      } catch {
        // silent — empty state handles it
      } finally {
        if (!cancelled) setLoading(false)
      }
    }
    load()
    const interval = setInterval(load, 60_000)
    return () => {
      cancelled = true
      clearInterval(interval)
    }
  }, [city.ports])

  return (
    <div className="min-h-screen bg-gray-50 dark:bg-gray-900 pb-24">
      <div className="max-w-screen-md mx-auto px-4 py-4 space-y-4">
        {/* Back to home */}
        <Link
          href="/"
          className="inline-flex items-center gap-1 text-xs font-semibold text-gray-600 dark:text-gray-300 hover:text-gray-900 dark:hover:text-white"
        >
          <ArrowLeft className="w-4 h-4" />
          {es ? 'Volver al inicio' : 'Back to home'}
        </Link>

        {/* City hero */}
        <header className="bg-gradient-to-br from-blue-600 via-indigo-600 to-purple-700 text-white rounded-2xl p-5 shadow-sm">
          <div className="flex items-center gap-2 text-[11px] uppercase tracking-wider font-bold text-blue-100 mb-1">
            <MapPin className="w-3.5 h-3.5" />
            {es ? 'Cruces internacionales' : 'International crossings'}
          </div>
          <h1 className="text-2xl font-black leading-tight">
            {es ? city.displayName.es : city.displayName.en}
          </h1>
          <p className="text-sm text-blue-100 mt-2 leading-snug">
            {es ? city.blurb.es : city.blurb.en}
          </p>
          <div className="flex items-center gap-1.5 mt-3 text-[11px] font-semibold text-blue-50">
            <Clock className="w-3.5 h-3.5" />
            {es ? 'Actualizado cada minuto' : 'Updated every minute'}
          </div>
        </header>

        {/* Live crossings list — ordered by city prominence */}
        <section className="bg-white dark:bg-gray-800 rounded-2xl border border-gray-200 dark:border-gray-700 p-4 shadow-sm">
          <div className="flex items-center justify-between mb-3">
            <h2 className="text-base font-bold text-gray-900 dark:text-white">
              {es ? 'Tiempos en vivo' : 'Live wait times'}
            </h2>
            <span className="text-[10px] font-semibold uppercase tracking-wider text-gray-500 dark:text-gray-400">
              {city.ports.length} {es ? 'cruces' : 'crossings'}
            </span>
          </div>

          {loading && (
            <div className="space-y-2">
              {city.ports.map((id) => (
                <div
                  key={id}
                  className="h-14 bg-gray-100 dark:bg-gray-700 rounded-xl animate-pulse"
                />
              ))}
            </div>
          )}

          {!loading && ports.length === 0 && (
            <p className="text-sm text-gray-500 dark:text-gray-400 py-4 text-center">
              {es
                ? 'CBP no está reportando datos en vivo ahorita. Vuelve en unos minutos.'
                : 'CBP is not reporting live data right now. Check back in a few minutes.'}
            </p>
          )}

          {!loading && ports.length > 0 && (
            <div className="space-y-2">
              {ports.map((port) => {
                const meta = getPortMeta(port.portId)
                const camCount = getBridgeCameras(port.portId).length
                const wait = port.vehicle
                const colors = waitColor(wait)
                const displayName = meta.localName || port.portName
                return (
                  <Link
                    key={port.portId}
                    href={`/port/${port.portId}`}
                    className={`flex items-center justify-between gap-3 rounded-xl px-4 py-3 border border-gray-200 dark:border-gray-700 ${colors.bg} transition-colors active:scale-[0.99]`}
                  >
                    <div className="flex items-center gap-3 min-w-0 flex-1">
                      <div className={`w-2 h-2 rounded-full ${colors.dot} flex-shrink-0`} />
                      <div className="min-w-0 flex-1">
                        <div className="text-sm font-bold text-gray-900 dark:text-white truncate">
                          {displayName}
                        </div>
                        <div className="text-[11px] text-gray-500 dark:text-gray-400">
                          {camCount > 0 && (
                            <span className="inline-flex items-center gap-1 mr-2">
                              📹 {camCount} {es ? 'cámara' : 'camera'}{camCount > 1 ? 's' : ''}
                            </span>
                          )}
                          <span>{meta.city}</span>
                        </div>
                      </div>
                    </div>
                    <div className={`text-right ${colors.text} flex-shrink-0`}>
                      {port.isClosed ? (
                        <span className="text-xs font-bold">{es ? 'Cerrado' : 'Closed'}</span>
                      ) : wait == null ? (
                        <span className="text-xs font-semibold">
                          {es ? 'Sin datos' : 'No data'}
                        </span>
                      ) : (
                        <>
                          <div className="text-xl font-black leading-none">
                            {wait === 0 ? '<1' : wait}
                          </div>
                          <div className="text-[10px] font-semibold uppercase tracking-wider">
                            min
                          </div>
                        </>
                      )}
                    </div>
                  </Link>
                )
              })}
            </div>
          )}
        </section>

        {/* Full FAQ with city-specific questions + shared set, with FAQPage JSON-LD */}
        <PortFAQ citySlug={city.slug} />

        {/* Signup CTA */}
        <div className="bg-gradient-to-r from-blue-600 to-indigo-600 rounded-2xl p-5 text-center shadow-sm">
          <p className="text-base font-bold text-white">
            {es
              ? `Activa alertas para los puentes de ${city.mxName}`
              : `Turn on alerts for ${city.mxName} crossings`}
          </p>
          <p className="text-xs text-blue-100 mt-1">
            {es
              ? 'Cruzar te avisa cuando baja la fila · sin spam · gratis'
              : 'Cruzar alerts you when the line drops · no spam · free'}
          </p>
          <Link
            href="/signup"
            className="inline-block mt-3 bg-white text-blue-700 text-sm font-bold px-6 py-2.5 rounded-full hover:bg-blue-50 transition-colors"
          >
            {es ? 'Activar mis alertas →' : 'Turn on my alerts →'}
          </Link>
        </div>
      </div>

      <BottomNav />
    </div>
  )
}
