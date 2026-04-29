'use client'

import { useMemo, useState } from 'react'
import Link from 'next/link'
import { ChevronDown, Check } from 'lucide-react'
import { useLang } from '@/lib/LangContext'
import { usePorts } from '@/lib/usePorts'
import { getPortMeta } from '@/lib/portMeta'
import { MEGA_REGION_LABELS } from '@/lib/useHomeRegion'
import type { MegaRegion } from '@/lib/portMeta'
import type { PortWaitTime, WaitLevel } from '@/types'
import { BridgeLogo } from '@/components/BridgeLogo'

type RegionFilter = MegaRegion | 'all'

const REGION_ORDER: MegaRegion[] = ['rgv', 'laredo', 'coahuila-tx', 'el-paso', 'sonora-az', 'baja', 'other']

// "All bridges" tab — replaces the old Leaflet-based border map.
//
// Background (2026-04-14 late): the Leaflet map was taking ~30s to
// cold-start inside the PWA on Diego's phone. Removed per his
// directive: "if the border map feature is causing the app to take
// too long to load then remove it, I don't really see the purpose
// of it."
//
// This replacement is intentionally lightweight:
//   - READ ONLY. No report button, no save, no alert setup. Stops
//     cross-region trolls who'd never cross those bridges anyway.
//   - Every port on the US-MX border, grouped by mega region, with
//     live wait times and a color dot.
//   - No map tiles, no Leaflet, no geocoding. Zero heavy imports.
//
// For users who want to INTERACT with a bridge (save, report, set
// alert), the home page shows THEIR region's bridges with full
// interactivity. This page is for curiosity, not action.

interface Section {
  key: string
  region: string
  regionEn: string
  ports: Array<{ port: PortWaitTime; name: string; city: string; level: WaitLevel }>
}

function waitLevel(minutes: number | null, isClosed: boolean): WaitLevel {
  if (isClosed) return 'closed'
  if (minutes == null) return 'unknown'
  if (minutes <= 20) return 'low'
  if (minutes <= 45) return 'medium'
  return 'high'
}

const LEVEL_DOT: Record<WaitLevel, string> = {
  low:     'bg-green-500',
  medium:  'bg-yellow-500',
  high:    'bg-red-500',
  closed:  'bg-gray-400',
  unknown: 'bg-gray-300 dark:bg-gray-600',
}

const LEVEL_TEXT: Record<WaitLevel, string> = {
  low:     'text-green-700 dark:text-green-400',
  medium:  'text-yellow-700 dark:text-yellow-400',
  high:    'text-red-700 dark:text-red-400',
  closed:  'text-gray-500 dark:text-gray-400',
  unknown: 'text-gray-400 dark:text-gray-500',
}

export default function MapaPage() {
  const { lang } = useLang()
  const es = lang === 'es'
  const { ports, loading } = usePorts()
  // Region filter — single dropdown instead of a long stacked list of
  // every region. Shareable + screenshot-friendly: pick a region, get a
  // clean per-region card. Default 'all' preserves the previous behavior
  // for users who want the full-border view.
  const [region, setRegion] = useState<RegionFilter>('all')
  const [pickerOpen, setPickerOpen] = useState(false)

  // Group by mega region for a scannable read-only view.
  const sections = useMemo<Section[]>(() => {
    const byRegion = new Map<string, Section>()
    for (const port of ports) {
      const meta = getPortMeta(port.portId)
      const region = MEGA_REGION_LABELS[meta.megaRegion]?.es || 'Otros'
      const regionEn = MEGA_REGION_LABELS[meta.megaRegion]?.en || 'Other'
      const name = port.localNameOverride || meta.localName || port.crossingName || port.portName
      if (!byRegion.has(meta.megaRegion)) {
        byRegion.set(meta.megaRegion, { key: meta.megaRegion, region, regionEn, ports: [] })
      }
      byRegion.get(meta.megaRegion)!.ports.push({
        port,
        name,
        city: meta.city,
        level: waitLevel(port.vehicle, port.isClosed),
      })
    }
    // Sort inside each section: closed last, unknown second-last,
    // live bridges first sorted by wait ascending.
    for (const section of byRegion.values()) {
      section.ports.sort((a, b) => {
        const rank = (l: WaitLevel) =>
          l === 'closed' ? 4 : l === 'unknown' ? 3 : 0
        const rankDiff = rank(a.level) - rank(b.level)
        if (rankDiff !== 0) return rankDiff
        const av = a.port.vehicle ?? 999
        const bv = b.port.vehicle ?? 999
        return av - bv
      })
    }
    // Standard display order for the sections themselves. The
    // megaRegion key was stashed on each Section above so the filter
    // dropdown can match by key.
    const out: Section[] = []
    for (const key of REGION_ORDER) {
      const s = byRegion.get(key)
      if (s && s.ports.length > 0) out.push(s)
    }
    return out
  }, [ports])

  // Apply the region filter — 'all' shows every section.
  const visibleSections = region === 'all'
    ? sections
    : sections.filter((s) => s.key === region)

  // Per-region counts for the dropdown menu — only show regions that
  // actually have ports (no Sonora row if there's nothing in Sonora).
  const regionsWithCounts = sections.map((s) => ({
    key: s.key as MegaRegion,
    label: es ? s.region : s.regionEn,
    count: s.ports.length,
  }))
  const totalCount = sections.reduce((acc, s) => acc + s.ports.length, 0)
  const currentLabel = region === 'all'
    ? (es ? 'Toda la frontera' : 'All border')
    : (es ? MEGA_REGION_LABELS[region]?.es : MEGA_REGION_LABELS[region]?.en)

  return (
    <main className="min-h-screen bg-gray-50 dark:bg-gray-950">
      <div className="max-w-lg mx-auto px-4 pb-24">
        {/* Header row: title + region dropdown on the left, app-name
            wordmark on the right. Wordmark is always visible so it
            shows up in screenshots people share — turns each share
            into a name-recognition surface ('what app is this?'). */}
        <div className="pt-6 pb-3 flex items-start justify-between gap-3">
          <div className="min-w-0 flex-1">
            <h1 className="text-xl font-black text-gray-900 dark:text-gray-100 inline-flex items-center gap-2">
              <BridgeLogo size={28} />
              {es ? 'Todos los puentes' : 'All bridges'}
            </h1>
            <p className="text-xs text-gray-500 dark:text-gray-400 mt-1 leading-snug">
              {es
                ? 'Solo lectura · para reportar usa tu zona en el inicio'
                : 'Read-only · to report use your zone on home'}
            </p>
          </div>
          <Link
            href="/"
            aria-label="cruzar.app"
            className="shrink-0 inline-flex items-center gap-2 px-4 py-2.5 rounded-full bg-blue-600 text-white text-sm font-black tracking-tight shadow-md hover:bg-blue-700 transition-colors"
          >
            <BridgeLogo size={22} className="bg-white/0" />
            <span className="leading-none">cruzar.app</span>
          </Link>
        </div>

        {/* Region dropdown — single source of truth for the filter.
            Replaces the long stacked-section view with one region at
            a time, which reads cleaner on a screenshot. 'All border'
            preserves the original whole-frontier view. */}
        <div className="relative mb-4">
          <button
            type="button"
            onClick={() => setPickerOpen((o) => !o)}
            aria-expanded={pickerOpen}
            aria-haspopup="listbox"
            className="w-full flex items-center justify-between gap-2 px-4 py-3 rounded-2xl bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 shadow-sm hover:bg-gray-50 dark:hover:bg-gray-750 transition-colors"
          >
            <div className="flex items-center gap-2 min-w-0">
              <span className="text-lg leading-none">📍</span>
              <span className="text-sm font-bold text-gray-900 dark:text-gray-100 truncate">
                {currentLabel}
              </span>
              <span className="text-[11px] font-bold text-gray-400 dark:text-gray-500 tabular-nums">
                · {region === 'all' ? totalCount : (regionsWithCounts.find((r) => r.key === region)?.count ?? 0)}
              </span>
            </div>
            <ChevronDown className={`w-4 h-4 text-gray-400 transition-transform ${pickerOpen ? 'rotate-180' : ''}`} />
          </button>
          {pickerOpen && (
            <>
              {/* Click-outside backdrop. Closes the menu without
                  navigating away, which a Link-based blur wouldn't. */}
              <button
                type="button"
                aria-hidden="true"
                tabIndex={-1}
                onClick={() => setPickerOpen(false)}
                className="fixed inset-0 z-30 cursor-default"
              />
              <ul
                role="listbox"
                className="absolute z-40 mt-1 w-full max-h-80 overflow-y-auto rounded-2xl bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 shadow-xl py-1"
              >
                <li>
                  <button
                    type="button"
                    role="option"
                    aria-selected={region === 'all'}
                    onClick={() => { setRegion('all'); setPickerOpen(false) }}
                    className={`w-full flex items-center justify-between gap-2 px-4 py-2.5 text-left transition-colors ${
                      region === 'all'
                        ? 'bg-blue-50 dark:bg-blue-900/30 text-blue-700 dark:text-blue-300'
                        : 'text-gray-900 dark:text-gray-100 hover:bg-gray-50 dark:hover:bg-gray-700'
                    }`}
                  >
                    <span className="flex items-center gap-2">
                      <span>🌎</span>
                      <span className="text-sm font-bold">{es ? 'Toda la frontera' : 'All border'}</span>
                      <span className="text-[11px] text-gray-400 tabular-nums">· {totalCount}</span>
                    </span>
                    {region === 'all' && <Check className="w-4 h-4" />}
                  </button>
                </li>
                {regionsWithCounts.map((r) => (
                  <li key={r.key}>
                    <button
                      type="button"
                      role="option"
                      aria-selected={region === r.key}
                      onClick={() => { setRegion(r.key); setPickerOpen(false) }}
                      className={`w-full flex items-center justify-between gap-2 px-4 py-2.5 text-left transition-colors ${
                        region === r.key
                          ? 'bg-blue-50 dark:bg-blue-900/30 text-blue-700 dark:text-blue-300'
                          : 'text-gray-900 dark:text-gray-100 hover:bg-gray-50 dark:hover:bg-gray-700'
                      }`}
                    >
                      <span className="flex items-center gap-2">
                        <span className="text-sm font-bold">{r.label}</span>
                        <span className="text-[11px] text-gray-400 tabular-nums">· {r.count}</span>
                      </span>
                      {region === r.key && <Check className="w-4 h-4" />}
                    </button>
                  </li>
                ))}
              </ul>
            </>
          )}
        </div>

        {loading ? (
          <div className="py-12 text-center">
            <p className="text-sm text-gray-400">{es ? 'Cargando puentes…' : 'Loading bridges…'}</p>
          </div>
        ) : visibleSections.length === 0 ? (
          <div className="py-12 text-center">
            <p className="text-sm text-gray-500 dark:text-gray-400">
              {sections.length === 0
                ? (es ? 'No pudimos cargar los puentes.' : "Couldn't load bridges.")
                : (es ? 'No hay puentes en esta zona.' : 'No bridges in this region.')}
            </p>
            <Link href="/" className="mt-2 inline-block text-xs text-blue-600 hover:underline">
              {es ? '← Volver al inicio' : '← Back to home'}
            </Link>
          </div>
        ) : (
          visibleSections.map((section) => (
            <div key={section.region} className="mb-5">
              <h2 className="text-[10px] uppercase tracking-widest font-black text-gray-600 dark:text-gray-400 mb-2 px-1">
                {es ? section.region : section.regionEn}{' '}
                <span className="text-gray-400 dark:text-gray-500 font-semibold">
                  · {section.ports.length}
                </span>
              </h2>
              <div className="bg-white dark:bg-gray-800 rounded-2xl border border-gray-200 dark:border-gray-700 overflow-hidden">
                {section.ports.map(({ port, name, city, level }, i) => {
                  const waitLabel =
                    level === 'closed' ? (es ? 'Cerrado' : 'Closed') :
                    level === 'unknown' ? (es ? 'Sin datos' : 'No data') :
                    port.vehicle === 0 ? '<1 min' :
                    `${port.vehicle} min`
                  return (
                    <div
                      key={port.portId}
                      className={`flex items-center justify-between gap-3 px-4 py-3 ${
                        i < section.ports.length - 1 ? 'border-b border-gray-100 dark:border-gray-700' : ''
                      }`}
                    >
                      <div className="flex items-center gap-3 min-w-0 flex-1">
                        <span className={`w-2 h-2 rounded-full flex-shrink-0 ${LEVEL_DOT[level]}`} />
                        <div className="min-w-0 flex-1">
                          <p className="text-sm font-bold text-gray-900 dark:text-gray-100 truncate">
                            {name}
                          </p>
                          <p className="text-[11px] text-gray-500 dark:text-gray-400 truncate">
                            {city}
                          </p>
                        </div>
                      </div>
                      <span className={`text-sm font-black tabular-nums flex-shrink-0 ${LEVEL_TEXT[level]}`}>
                        {waitLabel}
                      </span>
                    </div>
                  )
                })}
              </div>
            </div>
          ))
        )}

        {/* Signup CTA for guests */}
        <Link
          href="/signup?next=/mapa"
          className="mt-6 block bg-gradient-to-br from-blue-600 to-indigo-700 rounded-2xl p-4 text-center active:scale-[0.98] transition-transform"
        >
          <p className="text-sm font-black text-white">
            {es ? '¿Quieres alerta cuando baje la fila?' : 'Want an alert when the line drops?'}
          </p>
          <p className="text-[11px] text-blue-100 mt-1">
            {es
              ? 'Crea cuenta gratis · te avisamos cuando tu puente baje del tiempo que tú elijas'
              : 'Create a free account · we\'ll notify you when your bridge drops below your threshold'}
          </p>
          <span className="inline-block mt-2 text-xs font-black text-white bg-white/20 rounded-full px-4 py-1.5">
            {es ? 'Crear cuenta gratis →' : 'Create free account →'}
          </span>
        </Link>
      </div>
    </main>
  )
}
