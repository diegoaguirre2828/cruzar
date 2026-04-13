'use client'

import { useEffect, useState } from 'react'
import Link from 'next/link'
import { useRouter } from 'next/navigation'
import { useLang } from '@/lib/LangContext'
import { BorderMap } from '@/components/BorderMap'
import { useHomeRegion, MEGA_REGION_LABELS } from '@/lib/useHomeRegion'
import { useTier } from '@/lib/useTier'
import { getPortMeta } from '@/lib/portMeta'
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
  const { homeRegion } = useHomeRegion()
  const { tier } = useTier()
  const isBusiness = tier === 'business'
  const [ports, setPorts] = useState<PortWaitTime[]>([])
  const [loading, setLoading] = useState(true)
  const [scopeBypass, setScopeBypass] = useState(false)

  useEffect(() => {
    fetch('/api/ports', { cache: 'no-store' })
      .then((r) => r.json())
      .then((d) => {
        setPorts(d.ports || [])
        setLoading(false)
      })
      .catch(() => setLoading(false))
  }, [])

  // Scope map pins to the home region for non-business users when a
  // region is set and the user hasn't explicitly bypassed the scope.
  const scopeActive = !isBusiness && homeRegion != null && !scopeBypass
  const visiblePorts = scopeActive
    ? ports.filter((p) => getPortMeta(p.portId).megaRegion === homeRegion)
    : ports

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
          <>
            {scopeActive && homeRegion && (
              <div className="mb-3 flex items-center justify-between gap-2 bg-blue-50 dark:bg-blue-900/20 border border-blue-200 dark:border-blue-800 rounded-xl px-3 py-2">
                <p className="text-[11px] font-bold text-blue-900 dark:text-blue-200 leading-tight">
                  📍 {es
                    ? `Mostrando ${MEGA_REGION_LABELS[homeRegion].es}`
                    : `Showing ${MEGA_REGION_LABELS[homeRegion].en}`}
                </p>
                <button
                  onClick={() => setScopeBypass(true)}
                  className="text-[10px] font-bold text-blue-700 dark:text-blue-300 underline underline-offset-2"
                >
                  {es ? 'Ver todos →' : 'See all →'}
                </button>
              </div>
            )}
            <div className="h-[calc(100vh-200px)] rounded-2xl overflow-hidden">
              <BorderMap
                ports={visiblePorts}
                selectedRegion="all"
                fillParent
                onPortClick={(portId) => router.push(`/port/${encodeURIComponent(portId)}`)}
              />
            </div>
          </>
        )}
      </div>
    </main>
  )
}
