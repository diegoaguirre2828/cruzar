'use client'

import { useEffect, useMemo, useState } from 'react'
import Link from 'next/link'
import { useLang } from '@/lib/LangContext'
import { getPortMeta } from '@/lib/portMeta'
import type { PortWaitTime } from '@/types'

// Horizontal "near me" swipe rail. Turns the vertical column of cards
// into something the user swipes through — every flick is an
// interaction. On mobile this is a native, expected pattern (iOS
// widgets, Play Store rails, TikTok carousels), and each card is a
// tappable deep-link into port detail.
//
// Geolocation is best-effort: if granted, shows nearest 8 by distance.
// If denied, shows the 8 RGV priority bridges as a default so the rail
// still renders.

const DEFAULT_PORT_IDS = [
  '230501', // Hidalgo
  '230502', // Pharr
  '230503', // Anzaldúas
  '230901', // Progreso
  '535504', // Brownsville Gateway
  '230401', // Laredo I
  '240201', // El Paso
  '250401', // San Ysidro
]

interface Props {
  ports: PortWaitTime[] | null
}

function haversineKm(a: { lat: number; lng: number }, b: { lat: number; lng: number }): number {
  const toRad = (d: number) => (d * Math.PI) / 180
  const dLat = toRad(b.lat - a.lat)
  const dLng = toRad(b.lng - a.lng)
  const h = Math.sin(dLat / 2) ** 2 +
    Math.cos(toRad(a.lat)) * Math.cos(toRad(b.lat)) * Math.sin(dLng / 2) ** 2
  return 2 * 6371 * Math.asin(Math.sqrt(h))
}

function waitColor(min: number | null): string {
  if (min == null) return 'bg-gray-400'
  if (min <= 20) return 'bg-green-500'
  if (min <= 45) return 'bg-amber-500'
  return 'bg-red-500'
}

function waitText(min: number | null): { value: string; unit: string } {
  if (min == null) return { value: '—', unit: 'min' }
  if (min === 0) return { value: '<1', unit: 'min' }
  if (min < 60) return { value: String(min), unit: 'min' }
  const h = Math.floor(min / 60)
  const m = min % 60
  if (m === 0) return { value: String(h), unit: 'h' }
  return { value: `${h}h${m}`, unit: 'm' }
}

export function NearMeRail({ ports }: Props) {
  const { lang } = useLang()
  const es = lang === 'es'
  const [userLoc, setUserLoc] = useState<{ lat: number; lng: number } | null>(null)

  useEffect(() => {
    if (typeof navigator === 'undefined' || !navigator.geolocation) return
    const timer = setTimeout(() => { /* just don't block */ }, 4000)
    navigator.geolocation.getCurrentPosition(
      (pos) => {
        clearTimeout(timer)
        setUserLoc({ lat: pos.coords.latitude, lng: pos.coords.longitude })
      },
      () => clearTimeout(timer),
      { maximumAge: 5 * 60 * 1000, timeout: 3500, enableHighAccuracy: false },
    )
    return () => clearTimeout(timer)
  }, [])

  const featured = useMemo(() => {
    if (!ports || ports.length === 0) return []
    const open = ports.filter((p) => !p.isClosed && p.vehicle != null)
    if (open.length === 0) return []

    if (userLoc) {
      const withDistance = open
        .map((p) => {
          const meta = getPortMeta(p.portId)
          if (!meta.lat || !meta.lng) return null
          return {
            port: p,
            dist: haversineKm(userLoc, { lat: meta.lat, lng: meta.lng }),
          }
        })
        .filter((x): x is { port: PortWaitTime; dist: number } => x !== null)
        .sort((a, b) => a.dist - b.dist)
        .slice(0, 8)
      if (withDistance.length >= 4) return withDistance.map((x) => ({ port: x.port, dist: x.dist }))
    }

    // Default pool: priority RGV/border bridges
    const priority = DEFAULT_PORT_IDS
      .map((id) => open.find((p) => p.portId === id))
      .filter((p): p is PortWaitTime => p != null)
    const filler = open.filter((p) => !DEFAULT_PORT_IDS.includes(p.portId))
    return [...priority, ...filler].slice(0, 8).map((port) => ({ port, dist: null as number | null }))
  }, [ports, userLoc])

  if (featured.length === 0) return null

  return (
    <div className="mt-3 -mx-4">
      <div className="px-4 flex items-baseline justify-between mb-2">
        <p className="text-[10px] uppercase tracking-widest font-bold text-gray-500 dark:text-gray-400">
          {userLoc ? (es ? '📍 Cerca de ti' : '📍 Near you') : (es ? '🌉 Los principales' : '🌉 Top crossings')}
        </p>
        <p className="text-[10px] text-gray-400 dark:text-gray-500">
          {es ? 'Desliza →' : 'Swipe →'}
        </p>
      </div>
      <div className="overflow-x-auto scrollbar-hide">
        <div className="flex gap-2 px-4 pb-1" style={{ scrollSnapType: 'x mandatory' }}>
          {featured.map(({ port, dist }) => {
            const meta = getPortMeta(port.portId)
            const name = port.localNameOverride || meta.localName || port.portName
            return (
              <Link
                key={port.portId}
                href={`/port/${encodeURIComponent(port.portId)}`}
                style={{ scrollSnapAlign: 'start' }}
                className="flex-shrink-0 w-[135px] bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-2xl p-3 active:scale-[0.97] transition-transform shadow-sm"
              >
                <div className="flex items-center gap-1.5 mb-1">
                  <span className={`w-2 h-2 rounded-full ${waitColor(port.vehicle ?? null)}`} />
                  <span className="text-[10px] text-gray-400 font-semibold uppercase truncate">
                    {meta.city}
                  </span>
                </div>
                <p className="text-[12px] font-bold text-gray-900 dark:text-gray-100 leading-tight truncate">
                  {name}
                </p>
                <div className="mt-1.5 flex items-baseline gap-1">
                  {(() => {
                    const w = waitText(port.vehicle ?? null)
                    return (
                      <>
                        <span className="text-2xl font-black tabular-nums text-gray-900 dark:text-gray-100 leading-none">
                          {w.value}
                        </span>
                        <span className="text-[10px] text-gray-500 dark:text-gray-400 font-bold">{w.unit}</span>
                      </>
                    )
                  })()}
                </div>
                {dist != null && (
                  <p className="text-[10px] text-gray-400 mt-1">
                    {dist < 1 ? '<1 km' : `${dist.toFixed(0)} km`}
                  </p>
                )}
              </Link>
            )
          })}
        </div>
      </div>
    </div>
  )
}
