'use client'

import { useEffect, useState } from 'react'
import Link from 'next/link'
import { useRouter } from 'next/navigation'
import { useLang } from '@/lib/LangContext'
import { BorderMap } from '@/components/BorderMap'
import type { PortWaitTime } from '@/types'

// Full-screen map tab. Loads Leaflet on-demand (heavy dependency)
// but only when the user explicitly navigates here — keeps the
// home page lean for spotty-connection users, while giving the
// "all crossings visually" view for people who want to see the
// whole border at once.

export default function MapaPage() {
  const { lang } = useLang()
  const router = useRouter()
  const es = lang === 'es'
  const [ports, setPorts] = useState<PortWaitTime[]>([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    fetch('/api/ports', { cache: 'no-store' })
      .then((r) => r.json())
      .then((d) => {
        setPorts(d.ports || [])
        setLoading(false)
      })
      .catch(() => setLoading(false))
  }, [])

  return (
    <main className="min-h-screen bg-gray-50 dark:bg-gray-950 flex flex-col">
      <div className="px-4 pt-6 pb-3">
        <h1 className="text-xl font-black text-gray-900 dark:text-gray-100">
          🗺️ {es ? 'Mapa de la frontera' : 'Border map'}
        </h1>
        <p className="text-xs text-gray-500 dark:text-gray-400 mt-0.5">
          {es
            ? 'Todos los puentes en vivo. Toca uno pa\' ver detalles.'
            : 'Every crossing live. Tap one for details.'}
        </p>
      </div>

      <div className="flex-1 px-3 pb-24">
        {loading ? (
          <div className="h-[60vh] flex items-center justify-center bg-white dark:bg-gray-900 rounded-2xl border border-gray-200 dark:border-gray-800">
            <p className="text-sm text-gray-500 dark:text-gray-400">
              {es ? 'Cargando mapa…' : 'Loading map…'}
            </p>
          </div>
        ) : ports.length === 0 ? (
          <div className="h-[60vh] flex flex-col items-center justify-center bg-white dark:bg-gray-900 rounded-2xl border border-gray-200 dark:border-gray-800">
            <p className="text-sm text-gray-600 dark:text-gray-300">
              {es ? 'No pudimos cargar los puentes.' : "Couldn't load crossings."}
            </p>
            <Link href="/" className="mt-3 text-xs text-blue-600 hover:underline">
              {es ? '← Volver al inicio' : '← Back to home'}
            </Link>
          </div>
        ) : (
          <div className="h-[calc(100vh-160px)] rounded-2xl overflow-hidden border border-gray-200 dark:border-gray-800 shadow-sm">
            <BorderMap
              ports={ports}
              selectedRegion="all"
              onPortClick={(portId) => router.push(`/port/${encodeURIComponent(portId)}`)}
            />
          </div>
        )}
      </div>
    </main>
  )
}
