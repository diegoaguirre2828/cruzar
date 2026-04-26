'use client'

import { useEffect, useState, useMemo } from 'react'
import { Copy, Check, RefreshCw, ArrowUpRight, ArrowDownRight } from 'lucide-react'
import { getPortMeta } from '@/lib/portMeta'
import type { PortWaitTime } from '@/types'

// Hero generator for the admin panel. Produces a screenshot-ready card
// showing live wait times for a chosen region + a copy-pasteable caption
// tuned to the time of day. Diego uses this to target specific Facebook
// groups without authoring every post from scratch.

type RegionKey =
  | 'rgv'
  | 'progreso'
  | 'roma'
  | 'brownsville'
  | 'laredo'
  | 'eagle_pass'
  | 'del_rio'
  | 'el_paso'
  | 'nogales'
  | 'douglas'
  | 'san_luis'
  | 'tijuana'
  | 'mexicali'
  | 'all'

type Direction = 'north' | 'south'

const REGIONS: { key: RegionKey; label: string; emoji: string }[] = [
  { key: 'rgv',         label: 'McAllen / Reynosa',       emoji: '🌵' },
  { key: 'progreso',    label: 'Progreso / N. Progreso',  emoji: '🌾' },
  { key: 'roma',        label: 'Roma / Cd. Alemán',       emoji: '🌿' },
  { key: 'brownsville', label: 'Matamoros / Brownsville', emoji: '🏙️' },
  { key: 'laredo',      label: 'Laredo / N. Laredo',      emoji: '🛣️' },
  { key: 'eagle_pass',  label: 'Eagle Pass / P. Negras',  emoji: '🦅' },
  { key: 'del_rio',     label: 'Del Rio / Cd. Acuña',     emoji: '🏞️' },
  { key: 'el_paso',     label: 'El Paso / Juárez',        emoji: '⛰️' },
  { key: 'nogales',     label: 'Nogales / Sonora',        emoji: '🌮' },
  { key: 'douglas',     label: 'Douglas / Agua Prieta',   emoji: '🏔️' },
  { key: 'san_luis',    label: 'San Luis RC / Yuma',      emoji: '☀️' },
  { key: 'tijuana',     label: 'Tijuana / San Ysidro',    emoji: '🌊' },
  { key: 'mexicali',    label: 'Mexicali / Calexico',     emoji: '🏜️' },
  { key: 'all',         label: 'All Mega-Regions',        emoji: '🌎' },
]

// City-name matchers — see PortList.tsx for canonical mapping. Mega-region
// alone is too coarse (Tijuana + Mexicali both `baja`).
const REGION_CITY_MATCH: Record<RegionKey, (city: string) => boolean> = {
  rgv:         (c) => ['McAllen', 'Hidalgo', 'Pharr'].some(s => c.includes(s)),
  progreso:    (c) => c.includes('Progreso') || c.includes('Donna'),
  roma:        (c) => c.includes('Roma') || c.includes('Rio Grande City'),
  brownsville: (c) => c.includes('Brownsville'),
  laredo:      (c) => c.includes('Laredo'),
  eagle_pass:  (c) => c.includes('Eagle Pass'),
  del_rio:     (c) => c.includes('Del Rio'),
  el_paso:     (c) => c.includes('El Paso'),
  nogales:     (c) => c.includes('Nogales') || c.includes('Lukeville'),
  douglas:     (c) => c.includes('Douglas') || c.includes('Naco'),
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

function minutesAgo(iso: string | null): number | null {
  if (!iso) return null
  const t = new Date(iso).getTime()
  if (isNaN(t)) return null
  return Math.max(0, Math.round((Date.now() - t) / 60000))
}

function freshnessLabel(min: number | null): string {
  if (min == null) return 'sin marca de tiempo'
  if (min < 1) return 'ahorita mismo'
  if (min === 1) return 'hace 1 min'
  if (min < 60) return `hace ${min} min`
  const h = Math.floor(min / 60)
  return `hace ${h}h`
}

interface SouthboundReport {
  port_id: string
  wait_minutes: number | null
  created_at: string
  direction: string | null
}

// Aggregate southbound community reports into a per-port shape the card can
// render with the same code path as the CBP-driven northbound view.
function aggregateSouthbound(reports: SouthboundReport[]): Map<string, { vehicle: number; n: number; latestAt: string }> {
  const byPort = new Map<string, SouthboundReport[]>()
  for (const r of reports) {
    if (r.wait_minutes == null) continue
    const arr = byPort.get(r.port_id) ?? []
    arr.push(r)
    byPort.set(r.port_id, arr)
  }
  const out = new Map<string, { vehicle: number; n: number; latestAt: string }>()
  for (const [portId, arr] of byPort) {
    // Median is more robust than mean for sparse community reports
    const sorted = arr.map(r => r.wait_minutes!).sort((a, b) => a - b)
    const median = sorted[Math.floor(sorted.length / 2)]
    const latestAt = arr.reduce((acc, r) => (r.created_at > acc ? r.created_at : acc), arr[0].created_at)
    out.set(portId, { vehicle: median, n: arr.length, latestAt })
  }
  return out
}

export function HeroGenerator() {
  const [ports, setPorts] = useState<PortWaitTime[]>([])
  const [southbound, setSouthbound] = useState<Map<string, { vehicle: number; n: number; latestAt: string }>>(new Map())
  const [loading, setLoading] = useState(true)
  const [region, setRegion] = useState<RegionKey>('rgv')
  const [direction, setDirection] = useState<Direction>('north')
  const [slot, setSlot] = useState<TimeSlot>(currentTimeSlot())
  const [captionIdx, setCaptionIdx] = useState(0)
  const [copied, setCopied] = useState<'caption' | null>(null)
  const [now, setNow] = useState(new Date())

  useEffect(() => {
    loadAll()
  }, [])

  async function loadAll() {
    setLoading(true)
    try {
      const [portsRes, southRes] = await Promise.all([
        fetch('/api/ports', { cache: 'no-store' }),
        fetch('/api/reports/recent?direction=southbound&limit=100', { cache: 'no-store' }),
      ])
      const portsData = await portsRes.json()
      const southData = await southRes.json()
      setPorts(portsData.ports || [])
      setSouthbound(aggregateSouthbound(southData.reports || []))
    } finally {
      setLoading(false)
      setNow(new Date())
    }
  }

  // Filter ports to the selected region. For southbound view we still
  // anchor on /api/ports (so port metadata is consistent), but overlay
  // wait minutes from the southbound community aggregate.
  const featured = useMemo(() => {
    const match = REGION_CITY_MATCH[region]
    const inRegion = ports.filter((p) => {
      if (!match) return true
      const meta = getPortMeta(p.portId)
      if (!meta) return false
      return match(meta.city)
    })

    if (direction === 'north') {
      const withData = inRegion.filter((p) => p.vehicle != null && !p.isClosed)
      return withData
        .sort((a, b) => (a.vehicle ?? 9999) - (b.vehicle ?? 9999))
        .slice(0, 4)
    }

    // Southbound: rebuild PortWaitTime-shaped objects with community data.
    // Skip ports with no recent southbound reports.
    const overlaid: PortWaitTime[] = inRegion.flatMap((p) => {
      const sb = southbound.get(p.portId)
      if (!sb) return []
      const out: PortWaitTime = {
        ...p,
        vehicle: sb.vehicle,
        sentri: null,
        pedestrian: null,
        commercial: null,
        isClosed: false,
        source: 'community',
        recordedAt: sb.latestAt,
        reportCount: sb.n,
        // Suppress historicalVehicle for southbound — it's based on
        // northbound CBP readings and isn't comparable.
        historicalVehicle: null,
      }
      return [out]
    })

    return overlaid
      .sort((a, b) => (a.vehicle ?? 9999) - (b.vehicle ?? 9999))
      .slice(0, 4)
  }, [ports, southbound, region, direction])

  const fastest = featured[0]
  const slowest = featured[featured.length - 1]
  const savings = fastest && slowest && featured.length >= 2
    ? Math.max(0, (slowest.vehicle ?? 0) - (fastest.vehicle ?? 0))
    : 0

  // Median CBP staleness across featured ports — used for top-right freshness label
  const medianStaleMin = useMemo(() => {
    const ages = featured
      .map((p) => minutesAgo(p.recordedAt))
      .filter((m): m is number => m != null)
      .sort((a, b) => a - b)
    if (ages.length === 0) return null
    return ages[Math.floor(ages.length / 2)]
  }, [featured])

  const captions = useMemo(() => {
    const greeting = timeSlotGreetingEs(slot)
    const dirLabel = direction === 'north' ? 'pa\' Estados Unidos' : 'pa\' México'
    if (featured.length === 0) {
      return direction === 'north'
        ? ['Sin datos disponibles pa\' esta región ahorita.']
        : ['Aún pocos reportes pa\' México por este lado. Si vas cruzando, sube el dato en cruzar.app — ayudas a la raza.']
    }

    const fastWait = fastest?.vehicle ?? 0
    const slowWait = slowest?.vehicle ?? 0
    const fastMeta = fastest ? getPortMeta(fastest.portId) : null
    const slowMeta = slowest ? getPortMeta(slowest.portId) : null
    const fastName = fastMeta?.localName || fastest?.portName || ''
    const slowName = slowMeta?.localName || slowest?.portName || ''

    const sourceTag = direction === 'north'
      ? 'Datos en vivo de CBP'
      : `Datos de la raza (${featured.reduce((s, p) => s + (p.reportCount ?? 0), 0)} reportes)`

    return [
      // Variant 1 — full info dump with lanes
      `${greeting}. Así están los puentes ${dirLabel} ahorita:\n\n${featured
        .map((p) => {
          const m = getPortMeta(p.portId)
          const name = m?.localName || p.portName
          const lanes = p.vehicleLanesOpen != null && direction === 'north' ? ` · ${p.vehicleLanesOpen} carril${p.vehicleLanesOpen === 1 ? '' : 'es'}` : ''
          return `• ${name} — ${waitLabel(p.vehicle)}${lanes}`
        })
        .join('\n')}\n\n${sourceTag} · cruzar.app`,

      // Variant 2 — savings hook
      savings >= 15
        ? `${greeting}. Ahorra ${savings} min cruzando por ${fastName} (${fastWait} min) en vez de ${slowName} (${slowWait} min). ${dirLabel}.\n\nTiempos en vivo en cruzar.app`
        : `${greeting}. Los puentes ${dirLabel} están parejos hoy:\n\n${featured
            .map((p) => {
              const m = getPortMeta(p.portId)
              const name = m?.localName || p.portName
              return `${name}: ${waitLabel(p.vehicle)}`
            })
            .join('\n')}\n\nVean en vivo: cruzar.app`,

      // Variant 3 — short CTA
      `${greeting}. Antes de salir pa'l puente ${dirLabel}, chéquenlo en cruzar.app — ahí salen los tiempos en vivo de ${featured
        .map((p) => {
          const m = getPortMeta(p.portId)
          return m?.localName?.split(' / ')[0] || p.portName
        })
        .slice(0, 3)
        .join(', ')} y más. Ahorita el más rápido es ${fastName} en ${fastWait} min.`,

      // Variant 4 — vs usual angle (only when we have historical context)
      (() => {
        const withHist = featured.filter((p) => p.historicalVehicle != null && p.vehicle != null)
        if (withHist.length === 0 || direction === 'south') {
          return `${greeting}. Cruzar ${dirLabel}: el más rápido ahorita es ${fastName} en ${fastWait} min. Más en cruzar.app.`
        }
        const better = withHist.filter((p) => (p.vehicle ?? 0) < (p.historicalVehicle ?? 999) - 5)
        const worse  = withHist.filter((p) => (p.vehicle ?? 0) > (p.historicalVehicle ?? 0) + 10)
        if (better.length > 0) {
          const b = better[0]
          const m = getPortMeta(b.portId)
          const name = m?.localName || b.portName
          return `${greeting}. ${name} está fluyendo: ${b.vehicle} min vs los ~${b.historicalVehicle} min normales pa' esta hora. Aprovecha. cruzar.app`
        }
        if (worse.length > 0) {
          const w = worse[0]
          const m = getPortMeta(w.portId)
          const name = m?.localName || w.portName
          return `${greeting}. Aguas con ${name} — está en ${w.vehicle} min, normalmente a esta hora son ~${w.historicalVehicle}. Si pueden, vayan por ${fastName} (${fastWait} min). cruzar.app`
        }
        return `${greeting}. Los puentes están como siempre a esta hora. Más rápido: ${fastName} en ${fastWait} min. cruzar.app`
      })(),
    ]
  }, [featured, slot, fastest, slowest, savings, direction])

  const caption = captions[captionIdx % captions.length]

  function copy(text: string, key: 'caption') {
    navigator.clipboard.writeText(text).catch(() => {})
    setCopied(key)
    setTimeout(() => setCopied(null), 2000)
  }

  const timestamp = now.toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit', hour12: true })
  const dateLabel = now.toLocaleDateString('es-MX', { weekday: 'short', day: 'numeric', month: 'short' })

  return (
    <div className="space-y-5">
      <div>
        <p className="text-sm font-semibold text-gray-900">Hero Generator</p>
        <p className="text-xs text-gray-500 mt-0.5">Pick region + direction, screenshot the card, copy the caption.</p>
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
          <p className="text-[11px] font-bold text-gray-500 uppercase tracking-wider mb-2">Direction</p>
          <div className="flex gap-1.5">
            {(['north', 'south'] as Direction[]).map((d) => (
              <button
                key={d}
                onClick={() => setDirection(d)}
                className={`px-3 py-1.5 rounded-full text-xs font-semibold border transition-colors ${
                  direction === d
                    ? 'bg-gray-900 text-white border-gray-900'
                    : 'bg-white text-gray-600 border-gray-200 hover:border-gray-400'
                }`}
              >
                {d === 'north' ? '🇺🇸 Norte (CBP)' : '🇲🇽 Sur (raza)'}
              </button>
            ))}
          </div>
          <p className="text-[10px] text-gray-400 mt-1">
            Norte = CBP en vivo. Sur = mediana de reportes comunitarios (últimas 48h).
          </p>
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
          onClick={loadAll}
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
          <div className="flex items-start justify-between mb-4">
            <div>
              <p className="text-3xl font-black leading-none tracking-tight">
                Cruzar<span className="text-blue-300">.app</span>
              </p>
              <p className="text-[11px] text-blue-200 font-semibold mt-0.5">
                {direction === 'north' ? 'Tiempos pa\' Estados Unidos · en vivo' : 'Tiempos pa\' México · reportes de la raza'}
              </p>
            </div>
            <div className="text-right">
              <p className="text-[10px] text-blue-200 uppercase tracking-wider">{dateLabel}</p>
              <p className="text-sm font-bold tabular-nums leading-tight">{timestamp}</p>
              <p className="text-[10px] text-blue-200 mt-0.5">{freshnessLabel(medianStaleMin)}</p>
            </div>
          </div>

          {/* Region tag + savings callout */}
          <div className="flex items-center justify-between gap-2 mb-4 flex-wrap">
            <div className="inline-flex items-center gap-1.5 bg-white/15 backdrop-blur-sm rounded-full px-3 py-1 border border-white/20">
              <span className="text-xs">{REGIONS.find((r) => r.key === region)?.emoji}</span>
              <span className="text-[11px] font-bold uppercase tracking-wider">
                {REGIONS.find((r) => r.key === region)?.label}
              </span>
              <span className="text-[10px] text-blue-200 ml-1">
                · {direction === 'north' ? '🇺🇸 norte' : '🇲🇽 sur'}
              </span>
            </div>
            {savings >= 10 && (
              <div className="inline-flex items-center gap-1.5 bg-green-400/20 border border-green-300/40 rounded-full px-3 py-1">
                <span className="text-[10px] font-bold text-green-200 uppercase tracking-wider">Ahorra</span>
                <span className="text-sm font-black text-green-100 tabular-nums">{savings} min</span>
              </div>
            )}
          </div>

          {/* Bridges list */}
          {loading ? (
            <div className="h-40 bg-white/5 rounded-2xl animate-pulse" />
          ) : featured.length === 0 ? (
            <div className="bg-white/10 rounded-2xl p-6 text-center">
              <p className="text-sm font-medium">
                {direction === 'north'
                  ? 'Sin datos pa\' esta región ahorita'
                  : 'Pocos reportes pa\' México por este lado — sé el primero en cruzar.app'}
              </p>
            </div>
          ) : (
            <div className="space-y-2">
              {featured.map((p, i) => {
                const meta = getPortMeta(p.portId)
                const displayName = meta?.localName || p.portName
                const cityLabel = meta?.city || ''
                const wait = p.vehicle
                const color = waitColor(wait)
                const portStaleMin = minutesAgo(p.recordedAt)
                const isStale = direction === 'north' && portStaleMin != null && portStaleMin > 30
                const hist = direction === 'north' ? p.historicalVehicle : null
                const histDelta = hist != null && wait != null ? wait - hist : null
                const histTrendIcon = histDelta != null
                  ? (histDelta <= -5 ? <ArrowDownRight className="w-3 h-3 inline" /> : histDelta >= 10 ? <ArrowUpRight className="w-3 h-3 inline" /> : null)
                  : null
                const histColor = histDelta == null ? 'text-blue-200'
                  : histDelta <= -5 ? 'text-green-300'
                  : histDelta >= 10 ? 'text-red-300'
                  : 'text-blue-200'

                // Lanes available only for northbound (CBP-driven)
                const lanesOpen = direction === 'north' ? p.vehicleLanesOpen : null
                const sentri = direction === 'north' ? p.sentri : null
                const ped = direction === 'north' ? p.pedestrian : null

                return (
                  <div
                    key={p.portId}
                    className={`px-4 py-3 rounded-2xl ${
                      i === 0 ? 'bg-white/20 border-2 border-white/40' : 'bg-white/10 border border-white/15'
                    }`}
                  >
                    <div className="flex items-center justify-between gap-3">
                      <div className="flex-1 min-w-0">
                        <p className="text-sm font-black truncate leading-tight">
                          {displayName}
                          {i === 0 && (
                            <span className="ml-2 inline-block align-middle bg-green-400 text-green-900 text-[9px] font-black px-1.5 py-0.5 rounded-full uppercase tracking-wide">
                              + rápido
                            </span>
                          )}
                          {isStale && (
                            <span className="ml-1.5 inline-block align-middle bg-amber-400/30 text-amber-200 text-[9px] font-bold px-1.5 py-0.5 rounded-full uppercase tracking-wide border border-amber-300/40">
                              viejo
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

                    {/* Sub-info row: lanes + history delta + south report count */}
                    <div className="mt-2 flex items-center gap-3 flex-wrap text-[10px]">
                      {lanesOpen != null && (
                        <span className="text-blue-100">
                          🛣 {lanesOpen} carril{lanesOpen === 1 ? '' : 'es'}
                        </span>
                      )}
                      {sentri != null && (
                        <span className="text-blue-100">SENTRI {waitLabel(sentri)}</span>
                      )}
                      {ped != null && (
                        <span className="text-blue-100">A pie {waitLabel(ped)}</span>
                      )}
                      {hist != null && histDelta != null && (
                        <span className={histColor}>
                          {histTrendIcon}
                          {' '}vs normal ~{hist}m
                          {histDelta > 0 ? ` (+${histDelta})` : histDelta < 0 ? ` (${histDelta})` : ''}
                        </span>
                      )}
                      {direction === 'south' && p.reportCount != null && (
                        <span className="text-blue-100">
                          📣 {p.reportCount} reporte{p.reportCount === 1 ? '' : 's'}
                        </span>
                      )}
                    </div>
                  </div>
                )
              })}
            </div>
          )}

          {/* Footer CTA */}
          <div className="mt-5 pt-4 border-t border-white/20 text-center">
            <p className="text-xs text-blue-100">
              {direction === 'north'
                ? 'Datos CBP en vivo · Alertas gratis · cruzar.app'
                : 'Reportes de la raza · Sube el tuyo · cruzar.app'}
            </p>
          </div>
        </div>
      </div>

      {/* Caption picker */}
      <div className="bg-white rounded-2xl border border-gray-200 p-4 space-y-3">
        <div className="flex items-center justify-between">
          <div>
            <p className="text-sm font-semibold text-gray-900">Caption {captionIdx + 1} of {captions.length}</p>
            <p className="text-[11px] text-gray-500">Rotate variants so the same copy-paste doesn&apos;t spam the group</p>
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
          <li>Pick a region + direction (Norte for US-bound groups, Sur for MX-bound)</li>
          <li>Screenshot the hero card above — that&apos;s the visual</li>
          <li>Cycle captions and pick the one that matches the angle (savings, vs-usual, info)</li>
          <li>Paste into the FB group along with the screenshot</li>
          <li>Post during peak hours: 5:30am · 11:30am · 3:30pm · 7:00pm</li>
        </ol>
      </div>
    </div>
  )
}
