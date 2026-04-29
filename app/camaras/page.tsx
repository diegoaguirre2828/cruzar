'use client'

import { useEffect, useMemo, useState } from 'react'
import Link from 'next/link'
import { Camera, Gift } from 'lucide-react'
import { isIosSafari, isPwaInstalled } from '@/lib/iosDetect'
import { AFFILIATES, affiliatesForRegion, type AffiliateRegion } from '@/lib/affiliates'
import { trackEvent } from '@/lib/trackEvent'
import { useLang } from '@/lib/LangContext'
import { useAuth } from '@/lib/useAuth'
import { useTier } from '@/lib/useTier'
import { usePorts } from '@/lib/usePorts'
import { getPortMeta } from '@/lib/portMeta'
import { MEGA_REGION_LABELS } from '@/lib/useHomeRegion'
import { BRIDGE_CAMERAS } from '@/lib/bridgeCameras'
import { LiveCameraTile } from '@/components/LiveCameraTile'
import { CameraLightbox } from '@/components/CameraLightbox'
import { StickyCamarasCta } from '@/components/StickyCamarasCta'
import { CamarasStickyInstallCta } from '@/components/CamarasStickyInstallCta'
import { ProTabSwitcher } from '@/components/ProTabSwitcher'
import { AdBanner } from '@/components/AdBanner'
import type { MegaRegion } from '@/lib/portMeta'

const REGION_ORDER: MegaRegion[] = ['rgv', 'laredo', 'coahuila-tx', 'el-paso', 'sonora-az', 'baja', 'other']

export default function CamarasPage() {
  const { lang } = useLang()
  const { user } = useAuth()
  const { tier } = useTier()
  const es = lang === 'es'
  const { ports, loading } = usePorts()
  const [filter, setFilter] = useState<MegaRegion | 'all'>('all')
  // Lightbox-expanded port. Click on a tile (Pro user) opens this; ESC,
  // backdrop click, or X closes. Lets users cycle camera angles for one
  // port without leaving /camaras.
  const [expandedPort, setExpandedPort] = useState<string | null>(null)
  const isPaid = tier === 'pro' || tier === 'business'
  // Hide the install-Pro hero for already-installed users — they've
  // already claimed (or will auto-claim) the 3-month grant. Also hide
  // for paid users for the same reason.
  const [installed, setInstalled] = useState(false)
  const [iosNonInstalled, setIosNonInstalled] = useState(false)
  useEffect(() => {
    setInstalled(isPwaInstalled())
    setIosNonInstalled(isIosSafari() && !isPwaInstalled())
  }, [])
  const showInstallHero = !isPaid && !installed

  // Pick the right install target per platform + auth state:
  //   - iOS Safari non-installed → /ios-install walkthrough
  //   - signed-in (any device) → /welcome (step 2 forces install)
  //   - guest (Android/desktop) → /signup, then bounce back to /camaras
  const installHref = iosNonInstalled
    ? '/ios-install?next=%2Fcamaras'
    : user
      ? '/welcome'
      : '/signup?next=%2Fcamaras'

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
      city: string
      regionLabel: string
      megaRegion: MegaRegion
      lng: number
      wait: number | null
      lane: 'vehicle' | 'commercial' | 'sentri' | 'pedestrian' | null
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
      // Pick the best-available wait. Some bridges (Stanton DCL,
      // Pharr-Reynosa) close their general-vehicle lanes but stay
      // active for SENTRI / commercial — vehicle: null then. Falling
      // back to other lanes shows real numbers instead of 's/datos'.
      // Lane label is rendered on the tile pill so the user knows
      // 'this 45 min is for cargo, not GV'.
      let wait: number | null = null
      let lane: 'vehicle' | 'commercial' | 'sentri' | 'pedestrian' | null = null
      if (port) {
        if (port.vehicle != null) { wait = port.vehicle; lane = 'vehicle' }
        else if (port.commercial != null) { wait = port.commercial; lane = 'commercial' }
        else if (port.sentri != null) { wait = port.sentri; lane = 'sentri' }
        else if (port.pedestrian != null) { wait = port.pedestrian; lane = 'pedestrian' }
      }
      rows.push({
        portId,
        portName: name,
        city: meta.city || '',
        regionLabel,
        megaRegion: meta.megaRegion,
        lng: meta.lng ?? 0,
        wait,
        lane,
        isClosed: port?.isClosed ?? false,
        noData: port?.noData ?? true,
        feedIdx: repIdx,
        angleCount: feeds.length,
      })
    }
    // Sort by region order first (matches the megaRegion grouping in the
    // header), then west → east by longitude (ascending lng) within each
    // region. Was wait-asc, but wait times shuffle every 15 min — users
    // could never find a specific bridge twice in a row. Geographic order
    // is stable AND matches the natural mental map.
    const regionRank = (r: MegaRegion) => REGION_ORDER.indexOf(r)
    rows.sort((a, b) => {
      const ra = regionRank(a.megaRegion)
      const rb = regionRank(b.megaRegion)
      if (ra !== rb) return ra - rb
      return a.lng - b.lng
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
          <div className="mb-3">
            <ProTabSwitcher />
          </div>
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

        {/* Primary in-content CTA. Repositioned (2026-04-18) from a
            signup push to an install push — funnel data shows the page
            already converts to signup fine via StickyCamarasCta; the
            real leak is the 8.3% install rate, so the hero now pairs
            live-camera value with the Pro unlock on install. */}
        {showInstallHero && (
          <Link
            href={installHref}
            className="group relative block mb-5 rounded-2xl border border-amber-400/40 bg-gradient-to-br from-amber-500/15 via-orange-500/10 to-pink-500/15 overflow-hidden"
          >
            <div className="absolute -top-12 -right-10 w-40 h-40 bg-amber-400/20 rounded-full blur-3xl pointer-events-none" />
            <div className="relative p-4 sm:p-5 flex items-center gap-3 sm:gap-4">
              <div className="flex-shrink-0 w-12 h-12 rounded-2xl bg-gradient-to-br from-amber-400 to-orange-500 flex items-center justify-center shadow-lg">
                <Gift className="w-5 h-5 text-white" />
              </div>
              <div className="flex-1 min-w-0">
                <p className="text-xs sm:text-sm font-black text-amber-100 uppercase tracking-wide">
                  🎁 {es ? '3 meses Pro — gratis al instalar la app' : '3 months Pro — free when you install'}
                </p>
                <p className="text-sm sm:text-base font-bold text-white leading-tight mt-1">
                  {es
                    ? 'Las cámaras en vivo + alertas push cuando baje tu puente son Pro. Instala Cruzar y desbloquea todo por 90 días — gratis.'
                    : 'Live cameras + push alerts when your bridge clears are Pro. Install Cruzar to unlock everything for 90 days — free.'}
                </p>
              </div>
              <span className="flex-shrink-0 text-white text-lg font-black group-hover:translate-x-0.5 transition-transform">→</span>
            </div>
          </Link>
        )}

        {/* Region-contextual affiliate services strip. Swaps in the
            right services for whichever region the user is browsing —
            RGV sees Mexican insurance + Holafly + Bankrate, Baja sees
            Baja Bound + Tijuana dental + Holafly, etc. The 3-card cap
            keeps it compact above the camera grid. Horizontal scroll on
            mobile, grid on desktop. */}
        <CamarasServicesStrip
          filter={filter}
          es={es}
        />

        {/* AdSense — Pro/Business users skip this automatically. */}
        <div className="mb-4">
          <AdBanner slot={process.env.NEXT_PUBLIC_ADSENSE_SLOT_CAMARAS} />
        </div>

        <div className="flex gap-2 overflow-x-auto no-scrollbar -mx-4 px-4 py-2 mb-2">
          <FilterChip active={filter === 'all'} onClick={() => setFilter('all')} count={tiles.length}>
            {es ? 'Todas' : 'All'}
          </FilterChip>
          {REGION_ORDER.filter((r) => (regionCounts[r] || 0) > 0).map((r) => (
            <FilterChip key={r} active={filter === r} onClick={() => setFilter(r)} count={regionCounts[r] || 0}>
              {es ? MEGA_REGION_LABELS[r]?.es : MEGA_REGION_LABELS[r]?.en}
            </FilterChip>
          ))}
        </div>

        {/* Bridge-name jump chips — scroll-to a specific tile by name.
            Added because region-only pills hid bridges that users know
            by name (Hidalgo, Pharr, Progreso). Filtered by current
            region selection so the row stays scannable. */}
        <div className="flex gap-1.5 overflow-x-auto no-scrollbar -mx-4 px-4 py-1.5 mb-4">
          <span className="shrink-0 text-[10px] font-black uppercase tracking-widest text-white/40 self-center pr-1">
            {es ? 'Ir a:' : 'Jump to:'}
          </span>
          {visible.map((t) => (
            <button
              key={`jump-${t.portId}`}
              onClick={() => {
                const el = document.getElementById(`cam-${t.portId}`)
                if (el) el.scrollIntoView({ behavior: 'smooth', block: 'start' })
              }}
              className="shrink-0 inline-flex items-center px-2.5 py-1 rounded-full text-[11px] font-semibold whitespace-nowrap bg-white/5 text-white/70 hover:bg-white/10 hover:text-white transition-colors"
            >
              {t.portName.split(' · ')[0]}
            </button>
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
                            <div key={`${t.portId}-${i}`} id={`cam-${t.portId}`} className="scroll-mt-4">
                              <LiveCameraTile
                                portId={t.portId}
                                portName={angleNote ? `${t.portName} · ${angleNote}` : t.portName}
                                regionLabel={t.regionLabel}
                                wait={t.wait}
                                lane={t.lane}
                                isClosed={t.isClosed}
                                noData={t.noData}
                                feed={feed}
                                onExpand={setExpandedPort}
                              />
                            </div>
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
                <div key={`${t.portId}-${i}`} id={`cam-${t.portId}`} className="scroll-mt-4">
                  <LiveCameraTile
                    portId={t.portId}
                    portName={angleNote ? `${t.portName} · ${angleNote}` : t.portName}
                    regionLabel={t.regionLabel}
                    wait={t.wait}
                    lane={t.lane}
                    isClosed={t.isClosed}
                    noData={t.noData}
                    feed={feed}
                    onExpand={setExpandedPort}
                  />
                </div>
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
      <CamarasStickyInstallCta />
      <StickyCamarasCta />
      <CameraLightbox portId={expandedPort} onClose={() => setExpandedPort(null)} />
    </main>
  )
}

// Region-aware services strip — 3 relevant affiliates filtered by the
// currently-selected region chip. On 'all' we show the top 3 border-wide
// offers (insurance + eSIM + credit cards). Compact cards so the camera
// grid stays above the fold on most phones.
function CamarasServicesStrip({
  filter,
  es,
}: {
  filter: AffiliateRegion
  es: boolean
}) {
  const region: AffiliateRegion = filter
  const pool =
    region === 'all'
      ? AFFILIATES
      : affiliatesForRegion(region)
  // Cap to 3 so the strip stays a strip, not a second grid.
  const offers = pool.slice(0, 3)
  if (offers.length === 0) return null

  const seeAllHref = region === 'all' ? '/servicios' : `/servicios?region=${encodeURIComponent(region)}`

  return (
    <section className="mb-4" aria-label={es ? 'Servicios pa\' este cruce' : 'Services for this crossing'}>
      <div className="flex items-center justify-between mb-2">
        <h2 className="text-xs font-black uppercase tracking-widest text-white/70">
          {es ? 'Servicios pa\' este cruce' : 'Services for this crossing'}
        </h2>
        <Link
          href={seeAllHref}
          onClick={() =>
            trackEvent('affiliate_clicked', {
              id: 'see_all',
              category: 'other',
              source: 'camaras_strip_see_all',
              region,
            })
          }
          className="text-[11px] font-bold text-green-400 hover:text-green-300 whitespace-nowrap"
        >
          {es ? 'Ver todos los servicios →' : 'See all services →'}
        </Link>
      </div>
      <div className="flex gap-2 overflow-x-auto no-scrollbar -mx-4 px-4 sm:mx-0 sm:px-0 sm:grid sm:grid-cols-3 sm:gap-3 pb-1">
        {offers.map((o) => (
          <a
            key={o.id}
            href={o.url}
            target="_blank"
            rel="sponsored noopener"
            onClick={() =>
              trackEvent('affiliate_clicked', {
                id: o.id,
                category: o.category,
                source: 'camaras_strip',
                region,
              })
            }
            className="shrink-0 w-64 sm:w-auto rounded-2xl border border-white/10 bg-white/[0.04] hover:bg-white/[0.08] p-3 flex items-start gap-3 transition-colors active:scale-[0.99]"
          >
            <span className="text-2xl flex-shrink-0" aria-hidden>{o.icon}</span>
            <div className="flex-1 min-w-0">
              <p className="text-[13px] font-bold text-white leading-snug line-clamp-2">
                {es ? o.headline.es : o.headline.en}
              </p>
              <p className="text-[11px] text-white/60 leading-snug mt-0.5 line-clamp-2">
                {es ? o.sub.es : o.sub.en}
              </p>
              <span className="inline-block mt-1.5 text-[11px] font-bold text-green-400">
                {es ? o.cta.es : o.cta.en} →
              </span>
            </div>
          </a>
        ))}
      </div>
    </section>
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
