'use client'

import { useMemo, useState } from 'react'
import Link from 'next/link'
import { Camera, Lock } from 'lucide-react'
import { useLang } from '@/lib/LangContext'
import { useAuth } from '@/lib/useAuth'
import { useTier } from '@/lib/useTier'
import { usePorts } from '@/lib/usePorts'
import { getPortMeta } from '@/lib/portMeta'
import { MEGA_REGION_LABELS } from '@/lib/useHomeRegion'
import { BRIDGE_CAMERAS } from '@/lib/bridgeCameras'
import { LiveCameraTile } from '@/components/LiveCameraTile'
import { StickyCamarasCta } from '@/components/StickyCamarasCta'
import type { MegaRegion } from '@/lib/portMeta'

const REGION_ORDER: MegaRegion[] = ['rgv', 'laredo', 'coahuila-tx', 'el-paso', 'sonora-az', 'baja', 'other']

export default function CamarasPage() {
  const { lang } = useLang()
  const { user } = useAuth()
  const { tier } = useTier()
  const es = lang === 'es'
  const { ports, loading } = usePorts()
  const [filter, setFilter] = useState<MegaRegion | 'all'>('all')
  const isPaid = tier === 'pro' || tier === 'business'
  const showLockCta = !isPaid

  // One tile per PORT (not per feed). A port with 5 angles (e.g., Mariposa)
  // used to render 5 tiles on the grid — cluttered + repetitive. The port
  // detail page has the tab picker for multiple angles; the grid is for
  // scanning bridges. Pick a representative feed per port: prefer a live
  // feed (HLS / iframe / YouTube) if available, otherwise the first
  // snapshot.
  const tiles = useMemo(() => {
    const byId = new Map(ports.map((p) => [p.portId, p]))
    const rows: Array<{
      portId: string
      portName: string
      regionLabel: string
      megaRegion: MegaRegion
      wait: number | null
      isClosed: boolean
      noData: boolean
      feedIdx: number
      angleCount: number
    }> = []
    for (const [portId, feeds] of Object.entries(BRIDGE_CAMERAS)) {
      if (!feeds || feeds.length === 0) continue
      const meta = getPortMeta(portId)
      const port = byId.get(portId)
      const name = port?.localNameOverride || meta.localName || port?.crossingName || port?.portName || portId
      const regionLabel = es
        ? MEGA_REGION_LABELS[meta.megaRegion]?.es || 'Otros'
        : MEGA_REGION_LABELS[meta.megaRegion]?.en || 'Other'
      // Pick representative feed: prefer live video over snapshot
      const liveIdx = feeds.findIndex((f) => f.kind === 'hls' || f.kind === 'iframe' || f.kind === 'youtube')
      const repIdx = liveIdx >= 0 ? liveIdx : 0
      rows.push({
        portId,
        portName: name,
        regionLabel,
        megaRegion: meta.megaRegion,
        wait: port?.vehicle ?? null,
        isClosed: port?.isClosed ?? false,
        noData: port?.noData ?? true,
        feedIdx: repIdx,
        angleCount: feeds.length,
      })
    }
    // Sort by region order first, then by wait within each region.
    const regionRank = (r: MegaRegion) => REGION_ORDER.indexOf(r)
    rows.sort((a, b) => {
      const ra = regionRank(a.megaRegion)
      const rb = regionRank(b.megaRegion)
      if (ra !== rb) return ra - rb
      const waitA = a.isClosed ? 999 : a.wait ?? 998
      const waitB = b.isClosed ? 999 : b.wait ?? 998
      return waitA - waitB
    })
    return rows
  }, [ports, es])

  const visible = filter === 'all' ? tiles : tiles.filter((t) => t.megaRegion === filter)

  const regionCounts = useMemo(() => {
    const counts: Record<string, number> = {}
    for (const t of tiles) counts[t.megaRegion] = (counts[t.megaRegion] || 0) + 1
    return counts
  }, [tiles])

  return (
    <main className="min-h-screen bg-gray-950">
      <div className="max-w-6xl mx-auto px-4 pb-24">
        <div className="pt-8 pb-4">
          <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-red-500/15 border border-red-500/30 text-[11px] font-bold text-red-400 mb-3">
            <span className="relative flex h-2 w-2">
              <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-red-500 opacity-75" />
              <span className="relative inline-flex rounded-full h-2 w-2 bg-red-500" />
            </span>
            {es ? 'EN VIVO · 24/7' : 'LIVE · 24/7'}
          </div>
          <h1 className="text-3xl sm:text-4xl font-black text-white tracking-tight leading-[1.05]">
            {es ? (
              <>Cámaras de los puentes.<br /><span className="text-green-400">En vivo, ahorita mismo.</span></>
            ) : (
              <>Live border bridge cameras.<br /><span className="text-green-400">Right now, no scrolling.</span></>
            )}
          </h1>
          <p className="text-sm text-white/60 mt-3 max-w-xl leading-relaxed">
            {es
              ? 'Mira las filas reales + el tiempo de espera en números. Todo en una sola página. Sin abrir Facebook, sin adivinar.'
              : 'See the actual lines + the wait in minutes. All on one page. No Facebook scroll, no guessing.'}
          </p>
        </div>

        {/* Primary in-content CTA for guests + free users. The floating
            install sheet can get dismissed; this lives inline so anyone
            scrolling sees the value + path concretely. */}
        {showLockCta && (
          <Link
            href={user ? '/welcome' : '/signup?next=%2Fcamaras'}
            className="group relative block mb-5 rounded-2xl border border-amber-400/40 bg-gradient-to-br from-amber-500/15 via-orange-500/10 to-pink-500/15 overflow-hidden"
          >
            <div className="absolute -top-12 -right-10 w-40 h-40 bg-amber-400/20 rounded-full blur-3xl pointer-events-none" />
            <div className="relative p-4 sm:p-5 flex items-center gap-3 sm:gap-4">
              <div className="flex-shrink-0 w-12 h-12 rounded-2xl bg-gradient-to-br from-amber-400 to-orange-500 flex items-center justify-center shadow-lg">
                <Lock className="w-5 h-5 text-white" />
              </div>
              <div className="flex-1 min-w-0">
                <p className="text-xs sm:text-sm font-black text-amber-100 uppercase tracking-wide">
                  🔔 {es ? 'Avísame cuando baje' : 'Ping me when it clears'}
                </p>
                <p className="text-sm sm:text-base font-bold text-white leading-tight mt-0.5">
                  {es
                    ? 'Te mandamos un push cuando tu puente esté flojo'
                    : 'Get a push when your bridge clears up'}
                </p>
                <p className="text-[11px] text-white/60 leading-snug mt-0.5">
                  {es
                    ? 'Cuenta gratis · 10 segundos · sin tarjeta'
                    : 'Free account · 10 seconds · no card'}
                </p>
              </div>
              <span className="flex-shrink-0 text-white text-lg font-black group-hover:translate-x-0.5 transition-transform">→</span>
            </div>
          </Link>
        )}

        <div className="flex gap-2 overflow-x-auto no-scrollbar -mx-4 px-4 py-2 mb-4">
          <FilterChip active={filter === 'all'} onClick={() => setFilter('all')} count={tiles.length}>
            {es ? 'Todas' : 'All'}
          </FilterChip>
          {REGION_ORDER.filter((r) => (regionCounts[r] || 0) > 0).map((r) => (
            <FilterChip key={r} active={filter === r} onClick={() => setFilter(r)} count={regionCounts[r] || 0}>
              {es ? MEGA_REGION_LABELS[r]?.es : MEGA_REGION_LABELS[r]?.en}
            </FilterChip>
          ))}
        </div>

        {loading ? (
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
            {Array.from({ length: 6 }).map((_, i) => (
              <div key={i} className="aspect-video rounded-2xl bg-gray-900 animate-pulse" />
            ))}
          </div>
        ) : visible.length === 0 ? (
          <div className="py-16 text-center">
            <Camera className="w-10 h-10 text-white/30 mx-auto mb-3" />
            <p className="text-sm text-white/50">
              {es ? 'No hay cámaras en esta región por ahora.' : 'No cameras in this region yet.'}
            </p>
          </div>
        ) : filter === 'all' ? (
          // Group by region when viewing all, so the grid reads as an
          // organized catalog instead of an opaque flat list.
          (() => {
            const byRegion = new Map<MegaRegion, typeof visible>()
            for (const t of visible) {
              const bucket = byRegion.get(t.megaRegion) ?? []
              bucket.push(t)
              byRegion.set(t.megaRegion, bucket)
            }
            return (
              <div className="space-y-6">
                {REGION_ORDER.filter((r) => byRegion.has(r)).map((r) => {
                  const group = byRegion.get(r)!
                  const label = es ? MEGA_REGION_LABELS[r]?.es : MEGA_REGION_LABELS[r]?.en
                  return (
                    <section key={r}>
                      <h2 className="text-xs font-black uppercase tracking-widest text-white/60 mb-2.5 px-0.5">
                        {label}
                        <span className="ml-2 text-white/30 font-bold">{group.length}</span>
                      </h2>
                      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
                        {group.map((t, i) => {
                          const feed = BRIDGE_CAMERAS[t.portId][t.feedIdx]
                          const angleNote = t.angleCount > 1
                            ? (es ? `${t.angleCount} ángulos` : `${t.angleCount} angles`)
                            : undefined
                          return (
                            <LiveCameraTile
                              key={`${t.portId}-${i}`}
                              portId={t.portId}
                              portName={angleNote ? `${t.portName} · ${angleNote}` : t.portName}
                              regionLabel={t.regionLabel}
                              wait={t.wait}
                              isClosed={t.isClosed}
                              noData={t.noData}
                              feed={feed}
                            />
                          )
                        })}
                      </div>
                    </section>
                  )
                })}
              </div>
            )
          })()
        ) : (
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
            {visible.map((t, i) => {
              const feed = BRIDGE_CAMERAS[t.portId][t.feedIdx]
              const angleNote = t.angleCount > 1
                ? (es ? `${t.angleCount} ángulos` : `${t.angleCount} angles`)
                : undefined
              return (
                <LiveCameraTile
                  key={`${t.portId}-${i}`}
                  portId={t.portId}
                  portName={angleNote ? `${t.portName} · ${angleNote}` : t.portName}
                  regionLabel={t.regionLabel}
                  wait={t.wait}
                  isClosed={t.isClosed}
                  noData={t.noData}
                  feed={feed}
                />
              )
            })}
          </div>
        )}

        <div className="mt-10 rounded-2xl border border-white/10 bg-white/[0.02] p-5">
          <h2 className="text-base font-bold text-white">
            {es ? '¿Conoces una cámara pública que falta?' : 'Know a public camera we should add?'}
          </h2>
          <p className="text-xs text-white/60 mt-1.5 leading-relaxed">
            {es
              ? 'Si el municipio, la ciudad o un negocio local transmite una cámara pública de algún puente, mándanos el link. Las añadimos en la misma semana.'
              : 'If a city, county, or local business streams a public bridge camera, send us the link. We add it within the week.'}
          </p>
          <a
            href="mailto:diegonaguirre@icloud.com?subject=Cruzar%20c%C3%A1mara%20p%C3%BAblica"
            className="inline-flex items-center gap-1.5 mt-3 text-xs font-bold text-green-400 hover:text-green-300"
          >
            {es ? 'Enviar link →' : 'Send link →'}
          </a>
        </div>

        <div className="mt-6 text-center">
          <Link href="/" className="text-xs text-white/40 hover:text-white/70">
            {es ? '← Volver a cruzar.app' : '← Back to cruzar.app'}
          </Link>
        </div>
      </div>
      <StickyCamarasCta />
    </main>
  )
}

function FilterChip({
  active,
  onClick,
  count,
  children,
}: {
  active: boolean
  onClick: () => void
  count: number
  children: React.ReactNode
}) {
  return (
    <button
      onClick={onClick}
      className={`shrink-0 inline-flex items-center gap-1.5 px-3 py-1.5 rounded-full text-xs font-bold whitespace-nowrap transition-colors ${
        active ? 'bg-white text-gray-900' : 'bg-white/5 text-white/70 hover:bg-white/10 hover:text-white'
      }`}
    >
      {children}
      <span className={`${active ? 'text-gray-500' : 'text-white/40'} text-[10px] tabular-nums`}>{count}</span>
    </button>
  )
}
