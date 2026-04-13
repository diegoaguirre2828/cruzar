'use client'

import { useEffect, useState, useMemo } from 'react'
import { Copy, Check, RefreshCw } from 'lucide-react'
import { getPortMeta } from '@/lib/portMeta'
import type { PortWaitTime } from '@/types'

// Hero generator for the admin panel. Produces a screenshot-ready card
// showing live wait times for a chosen region + a copy-pasteable caption
// tuned to the time of day. Diego uses this to target specific Facebook
// groups without authoring every post from scratch.

type RegionKey =
  | 'rgv'
  | 'brownsville'
  | 'laredo'
  | 'eagle_pass'
  | 'el_paso'
  | 'nogales'
  | 'san_luis'
  | 'tijuana'
  | 'mexicali'
  | 'all'

const REGIONS: { key: RegionKey; label: string; emoji: string }[] = [
  { key: 'rgv',         label: 'RGV / McAllen',           emoji: '🌵' },
  { key: 'brownsville', label: 'Matamoros / Brownsville', emoji: '🏙️' },
  { key: 'laredo',      label: 'Laredo / N. Laredo',      emoji: '🛣️' },
  { key: 'eagle_pass',  label: 'Eagle Pass / P. Negras',  emoji: '🦅' },
  { key: 'el_paso',     label: 'El Paso / Juárez',        emoji: '⛰️' },
  { key: 'nogales',     label: 'Nogales / Sonora',        emoji: '🌵' },
  { key: 'san_luis',    label: 'San Luis RC / Yuma',      emoji: '☀️' },
  { key: 'tijuana',     label: 'Tijuana / San Ysidro',    emoji: '🌊' },
  { key: 'mexicali',    label: 'Mexicali / Calexico',     emoji: '🏜️' },
  { key: 'all',         label: 'All Mega-Regions',        emoji: '🌎' },
]

// Maps the admin region keys to portMeta mega-region slugs
const REGION_TO_MEGA: Record<RegionKey, string[]> = {
  rgv:         ['rgv'],
  brownsville: ['rgv'],
  laredo:      ['laredo'],
  eagle_pass:  ['coahuila-tx'],
  el_paso:     ['el-paso'],
  nogales:     ['sonora-az'],
  san_luis:    ['sonora-az'],
  tijuana:     ['baja'],
  mexicali:    ['baja'],
  all:         [],
}

// Also allow by city-name match for fallback (portMeta has `.city`). The
// mega-region sets are too coarse to separate e.g. Tijuana from Mexicali
// (both are `baja`), so the city filter is the real disambiguator.
const REGION_CITY_MATCH: Record<RegionKey, (city: string) => boolean> = {
  rgv:         (c) => ['McAllen', 'Hidalgo', 'Pharr', 'Progreso', 'Donna', 'Rio Grande City', 'Roma'].some(s => c.includes(s)),
  brownsville: (c) => c.includes('Brownsville'),
  laredo:      (c) => c.includes('Laredo'),
  eagle_pass:  (c) => c.includes('Eagle Pass'),
  el_paso:     (c) => c.includes('El Paso'),
  nogales:     (c) => c.includes('Nogales') || c.includes('Douglas') || c.includes('Naco') || c.includes('Lukeville'),
  san_luis:    (c) => c.includes('San Luis') || c.includes('Yuma'),
  tijuana:     (c) => c.includes('San Ysidro') || c.includes('Otay Mesa') || c.includes('Tecate'),
  mexicali:    (c) => c.includes('Calexico') || c.includes('Andrade'),
  all:         () => true,
}

type TimeSlot = 'morning' | 'midday' | 'afternoon' | 'evening' | 'neutral'

function currentTimeSlot(): TimeSlot {
  const h = new Date().getHours()
  if (h >= 5 && h < 10) return 'morning'
  if (h >= 10 && h < 14) return 'midday'
  if (h >= 14 && h < 18) return 'afternoon'
  if (h >= 18 && h < 22) return 'evening'
  return 'neutral'
}

function timeSlotGreetingEs(slot: TimeSlot): string {
  switch (slot) {
    case 'morning':   return 'Buenos días'
    case 'midday':    return 'Buen mediodía'
    case 'afternoon': return 'Buenas tardes'
    case 'evening':   return 'Buenas noches'
    default:          return 'Hola'
  }
}

function waitColor(min: number | null): string {
  if (min == null) return '#6b7280'
  if (min <= 20) return '#22c55e'
  if (min <= 45) return '#f59e0b'
  return '#ef4444'
}

function waitLabel(min: number | null): string {
  if (min == null) return '—'
  if (min === 0) return '<1 min'
  return `${min} min`
}

export function HeroGenerator() {
  const [ports, setPorts] = useState<PortWaitTime[]>([])
  const [loading, setLoading] = useState(true)
  const [region, setRegion] = useState<RegionKey>('rgv')
  const [slot, setSlot] = useState<TimeSlot>(currentTimeSlot())
  const [captionIdx, setCaptionIdx] = useState(0)
  const [copied, setCopied] = useState<'caption' | null>(null)
  const [now, setNow] = useState(new Date())

  useEffect(() => {
    loadPorts()
  }, [])

  async function loadPorts() {
    setLoading(true)
    try {
      const res = await fetch('/api/ports', { cache: 'no-store' })
      const data = await res.json()
      setPorts(data.ports || [])
    } finally {
      setLoading(false)
      setNow(new Date())
    }
  }

  // Filter ports to the selected region and pick the 4 with valid data
  const featured = useMemo(() => {
    const match = REGION_CITY_MATCH[region]
    const filtered = ports.filter((p) => {
      if (!match) return true
      const meta = getPortMeta(p.portId)
      if (!meta) return false
      return match(meta.city)
    })
    const withData = filtered.filter((p) => p.vehicle != null && !p.isClosed)
    // Sort by vehicle wait ascending so the fastest is shown first
    return withData
      .sort((a, b) => (a.vehicle ?? 9999) - (b.vehicle ?? 9999))
      .slice(0, 4)
  }, [ports, region])

  // Find the fastest and slowest in the region to call out
  const fastest = featured[0]
  const slowest = featured[featured.length - 1]

  // Build the caption variants. Depth-biased for ES because that's the
  // primary posting language.
  const captions = useMemo(() => {
    const greeting = timeSlotGreetingEs(slot)
    if (featured.length === 0) return ['Sin datos disponibles pa\' esta región.']

    const fastWait = fastest?.vehicle ?? 0
    const slowWait = slowest?.vehicle ?? 0
    const fastMeta = fastest ? getPortMeta(fastest.portId) : null
    const slowMeta = slowest ? getPortMeta(slowest.portId) : null
    const fastName = fastMeta?.localName || fastest?.portName || ''
    const slowName = slowMeta?.localName || slowest?.portName || ''

    return [
      // Variant 1 — straight info
      `${greeting}. Así están los puentes ahorita:\n\n${featured
        .map((p) => {
          const m = getPortMeta(p.portId)
          const name = m?.localName || p.portName
          return `• ${name} — ${waitLabel(p.vehicle)}`
        })
        .join('\n')}\n\nPa' ver en vivo y con alertas: cruzar.app`,

      // Variant 2 — highlights the contrast
      featured.length >= 2 && slowWait - fastWait >= 15
        ? `${greeting}. Ojo: ${fastName} va en ${fastWait} min pero ${slowName} ${slowWait} min. Si pueden, jálenle al que está fluyendo.\n\nTiempos actualizados cada rato en cruzar.app`
        : `${greeting}. Los puentes ahorita están así:\n\n${featured
            .map((p) => {
              const m = getPortMeta(p.portId)
              const name = m?.localName || p.portName
              return `${name}: ${waitLabel(p.vehicle)}`
            })
            .join('\n')}\n\nVean en vivo: cruzar.app`,

      // Variant 3 — short, call to action
      `${greeting}. Antes de salir pa'l puente, chéquenlo en cruzar.app — ahí salen los tiempos en vivo de ${featured
        .map((p) => {
          const m = getPortMeta(p.portId)
          return m?.localName?.split(' / ')[0] || p.portName
        })
        .slice(0, 3)
        .join(', ')} y más. Ahorita el que va más rápido es ${fastName} en ${fastWait} min.`,
    ]
  }, [featured, slot, fastest, slowest])

  const caption = captions[captionIdx % captions.length]

  function copy(text: string, key: 'caption') {
    navigator.clipboard.writeText(text).catch(() => {})
    setCopied(key)
    setTimeout(() => setCopied(null), 2000)
  }

  const timestamp = now.toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit', hour12: true })

  return (
    <div className="space-y-5">
      <div>
        <p className="text-sm font-semibold text-gray-900">Hero Generator</p>
        <p className="text-xs text-gray-500 mt-0.5">Pick a region, screenshot the card, copy the caption. Target specific Facebook groups.</p>
      </div>

      {/* Controls */}
      <div className="bg-white rounded-2xl border border-gray-200 p-4 space-y-3">
        <div>
          <p className="text-[11px] font-bold text-gray-500 uppercase tracking-wider mb-2">Region</p>
          <div className="flex flex-wrap gap-1.5">
            {REGIONS.map((r) => (
              <button
                key={r.key}
                onClick={() => setRegion(r.key)}
                className={`px-3 py-1.5 rounded-full text-xs font-semibold border transition-colors ${
                  region === r.key
                    ? 'bg-gray-900 text-white border-gray-900'
                    : 'bg-white text-gray-600 border-gray-200 hover:border-gray-400'
                }`}
              >
                {r.emoji} {r.label}
              </button>
            ))}
          </div>
        </div>

        <div>
          <p className="text-[11px] font-bold text-gray-500 uppercase tracking-wider mb-2">Time slot (greeting)</p>
          <div className="flex flex-wrap gap-1.5">
            {(['morning', 'midday', 'afternoon', 'evening', 'neutral'] as TimeSlot[]).map((s) => (
              <button
                key={s}
                onClick={() => setSlot(s)}
                className={`px-3 py-1.5 rounded-full text-xs font-semibold border transition-colors ${
                  slot === s
                    ? 'bg-gray-900 text-white border-gray-900'
                    : 'bg-white text-gray-600 border-gray-200 hover:border-gray-400'
                }`}
              >
                {s === 'morning'   ? '🌅 Morning' :
                 s === 'midday'    ? '☀️ Midday' :
                 s === 'afternoon' ? '🌆 Afternoon' :
                 s === 'evening'   ? '🌙 Evening' :
                 '· Neutral'}
              </button>
            ))}
          </div>
        </div>

        <button
          onClick={loadPorts}
          disabled={loading}
          className="flex items-center gap-1.5 text-xs font-semibold text-gray-600 hover:text-gray-900 disabled:opacity-50"
        >
          <RefreshCw className={`w-3 h-3 ${loading ? 'animate-spin' : ''}`} />
          Refresh live data
        </button>
      </div>

      {/* THE HERO CARD — this is what Diego screenshots */}
      <div>
        <p className="text-[11px] font-bold text-gray-500 uppercase tracking-wider mb-2">
          Preview card — screenshot this 📸
        </p>
        <div
          id="hero-card"
          className="relative overflow-hidden rounded-3xl p-6 text-white shadow-2xl"
          style={{
            background: 'linear-gradient(135deg, #1e40af 0%, #4338ca 45%, #6b21a8 100%)',
          }}
        >
          {/* Brand row */}
          <div className="flex items-start justify-between mb-5">
            <div>
              <p className="text-3xl font-black leading-none tracking-tight">Cruzar</p>
              <p className="text-[11px] text-blue-200 font-semibold mt-0.5">Tiempos de espera en vivo</p>
            </div>
            <div className="text-right">
              <p className="text-[10px] text-blue-200 uppercase tracking-wider">Actualizado</p>
              <p className="text-sm font-bold tabular-nums">{timestamp}</p>
            </div>
          </div>

          {/* Region tag */}
          <div className="inline-flex items-center gap-1.5 bg-white/15 backdrop-blur-sm rounded-full px-3 py-1 mb-4 border border-white/20">
            <span className="text-xs">{REGIONS.find((r) => r.key === region)?.emoji}</span>
            <span className="text-[11px] font-bold uppercase tracking-wider">
              {REGIONS.find((r) => r.key === region)?.label}
            </span>
          </div>

          {/* Bridges list */}
          {loading ? (
            <div className="h-40 bg-white/5 rounded-2xl animate-pulse" />
          ) : featured.length === 0 ? (
            <div className="bg-white/10 rounded-2xl p-6 text-center">
              <p className="text-sm font-medium">Sin datos pa' esta región ahorita</p>
            </div>
          ) : (
            <div className="space-y-2">
              {featured.map((p, i) => {
                const meta = getPortMeta(p.portId)
                const displayName = meta?.localName || p.portName
                const cityLabel = meta?.city || ''
                const wait = p.vehicle
                const color = waitColor(wait)
                return (
                  <div
                    key={p.portId}
                    className={`flex items-center justify-between gap-3 px-4 py-3 rounded-2xl ${
                      i === 0 ? 'bg-white/20 border-2 border-white/40' : 'bg-white/10 border border-white/15'
                    }`}
                  >
                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-black truncate leading-tight">
                        {displayName}
                        {i === 0 && (
                          <span className="ml-2 inline-block align-middle bg-green-400 text-green-900 text-[9px] font-black px-1.5 py-0.5 rounded-full uppercase tracking-wide">
                            + rápido
                          </span>
                        )}
                      </p>
                      <p className="text-[10px] text-blue-200 truncate">{cityLabel}</p>
                    </div>
                    <div className="flex items-center gap-2 flex-shrink-0">
                      <span className="w-2 h-2 rounded-full" style={{ backgroundColor: color }} />
                      <span className="text-2xl font-black tabular-nums">{waitLabel(wait)}</span>
                    </div>
                  </div>
                )
              })}
            </div>
          )}

          {/* Footer CTA */}
          <div className="mt-5 pt-4 border-t border-white/20 text-center">
            <p className="text-xs text-blue-100">Tiempos en vivo · Alertas gratis · cruzar.app</p>
          </div>
        </div>
      </div>

      {/* Caption picker */}
      <div className="bg-white rounded-2xl border border-gray-200 p-4 space-y-3">
        <div className="flex items-center justify-between">
          <div>
            <p className="text-sm font-semibold text-gray-900">Caption {captionIdx + 1} of {captions.length}</p>
            <p className="text-[11px] text-gray-500">Rotate variants so the same copy-paste doesn't spam the group</p>
          </div>
          <div className="flex gap-1">
            <button
              onClick={() => setCaptionIdx((i) => (i - 1 + captions.length) % captions.length)}
              className="px-3 py-1.5 text-xs font-bold border border-gray-200 rounded-lg hover:bg-gray-50"
            >
              ←
            </button>
            <button
              onClick={() => setCaptionIdx((i) => (i + 1) % captions.length)}
              className="px-3 py-1.5 text-xs font-bold border border-gray-200 rounded-lg hover:bg-gray-50"
            >
              →
            </button>
          </div>
        </div>

        <div className="bg-gray-50 border border-gray-200 rounded-xl p-3">
          <pre className="whitespace-pre-wrap text-sm text-gray-800 font-sans leading-relaxed">{caption}</pre>
        </div>

        <button
          onClick={() => copy(caption, 'caption')}
          className="w-full flex items-center justify-center gap-2 bg-gray-900 hover:bg-gray-700 text-white text-sm font-bold py-3 rounded-xl transition-colors"
        >
          {copied === 'caption' ? (
            <>
              <Check className="w-4 h-4" /> Copied!
            </>
          ) : (
            <>
              <Copy className="w-4 h-4" /> Copy caption
            </>
          )}
        </button>
      </div>

      {/* How-to note */}
      <div className="bg-amber-50 border border-amber-200 rounded-xl p-4">
        <p className="text-xs font-bold text-amber-800 mb-1">📌 How to use this</p>
        <ol className="text-xs text-amber-700 space-y-1 list-decimal list-inside">
          <li>Pick a region (matches the Facebook groups you're targeting)</li>
          <li>Screenshot the hero card above — that's the visual</li>
          <li>Copy the caption — paste it into the Facebook group along with your screenshot</li>
          <li>Rotate through the caption variants so repeat viewers don't see the same text</li>
          <li>Post it during peak hours: 5:30am · 11:30am · 3:30pm · 7:00pm</li>
        </ol>
      </div>
    </div>
  )
}
