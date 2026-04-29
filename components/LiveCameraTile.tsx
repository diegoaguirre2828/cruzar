'use client'

import { useEffect, useRef, useState } from 'react'
import { useRouter } from 'next/navigation'
import { Bell, BellRing, Camera, Lock, Share2, Check, Maximize2 } from 'lucide-react'
import type { CameraFeed } from '@/lib/bridgeCameras'
import { slugForPort } from '@/lib/portSlug'
import { useTier } from '@/lib/useTier'
import { useAuth } from '@/lib/useAuth'
import { useLang } from '@/lib/LangContext'
import { trackShare } from '@/lib/trackShare'
import { trackEvent } from '@/lib/trackEvent'
import { FeedPlayer } from '@/components/BridgeCameras'

type Lane = 'vehicle' | 'commercial' | 'sentri' | 'pedestrian' | null

interface Props {
  portId: string
  portName: string
  regionLabel: string
  wait: number | null
  // Which CBP lane the wait number is for. When null/'vehicle' the pill
  // renders bare; for 'commercial'/'sentri'/'pedestrian' it appends a
  // small label so the user knows '45 min' refers to cargo, not GV.
  // Bridges like Stanton DCL + Pharr-Reynosa close their general-vehicle
  // lanes but stay active for commercial / SENTRI — the page falls back
  // to those waits instead of showing 's/datos'.
  lane?: Lane
  isClosed: boolean
  noData: boolean
  feed: CameraFeed
  // When provided, clicking the tile opens the in-page lightbox instead
  // of navigating to /cruzar/{slug}. Used by /camaras to keep users on
  // the grid while letting them enlarge a tile + cycle angles.
  onExpand?: (portId: string) => void
}

function levelTone(mins: number | null, isClosed: boolean): { text: string; border: string; label: string } {
  if (isClosed) return { text: 'text-gray-100', border: 'border-gray-300/60', label: 'Cerrado' }
  if (mins === null) return { text: 'text-gray-100', border: 'border-gray-300/60', label: 's/datos' }
  if (mins <= 20) return { text: 'text-green-300', border: 'border-green-300/70', label: `${mins} min` }
  if (mins <= 45) return { text: 'text-amber-300', border: 'border-amber-300/70', label: `${mins} min` }
  return { text: 'text-red-300', border: 'border-red-300/70', label: `${mins} min` }
}

function Polled({ src, alt, intervalMs = 15000 }: { src: string; alt: string; intervalMs?: number }) {
  const [tick, setTick] = useState(() => Date.now())
  const [loaded, setLoaded] = useState(false)

  useEffect(() => {
    const id = setInterval(() => {
      setTick(Date.now())
      setLoaded(false)
    }, intervalMs)
    return () => clearInterval(id)
  }, [intervalMs])

  const separator = src.includes('?') ? '&' : '?'
  const busted = `${src}${separator}_cruzar_t=${tick}`

  return (
    <>
      <img
        key={tick}
        src={busted}
        alt={alt}
        className="w-full h-full object-cover"
        onLoad={() => setLoaded(true)}
        onError={() => setLoaded(true)}
      />
      {!loaded && <div className="absolute inset-0 bg-gray-900 animate-pulse" />}
    </>
  )
}

export function LiveCameraTile({ portId, portName, regionLabel, wait, lane = 'vehicle', isClosed, noData, feed, onExpand }: Props) {
  const tone = levelTone(wait, isClosed)
  const { tier } = useTier()
  const { user } = useAuth()
  const { lang } = useLang()
  const router = useRouter()
  const es = lang === 'es'
  const isPaid = tier === 'pro' || tier === 'business'
  // 2026-04-28: /camaras locked to Pro per Diego's pick. Free users see
  // a teaser tile (bridge name + region + wait time + locked-camera
  // overlay) instead of the live feed. Removes the "why is Laredo free
  // but Eagle Pass Pro?" inconsistency by gating the page wholesale.
  const showProLock = !isPaid
  const [shareLabel, setShareLabel] = useState<'idle' | 'done'>('idle')
  const [alertState, setAlertState] = useState<'idle' | 'saving' | 'done' | 'exists'>('idle')
  // Lazy-mount the live feed only when the tile scrolls into view.
  // Without this, every HLS / iframe / YouTube tile on the grid loads
  // simultaneously, which crushes mobile and burns publishers' bandwidth
  // for a stream the user never looks at. rootMargin lets us pre-mount
  // ~half a screen before viewport so the feed is ready by the time the
  // user actually sees it. We mount once and KEEP mounted (vs unmount
  // on scroll-out) to avoid HLS buffer thrash.
  const tileRef = useRef<HTMLDivElement>(null)
  const [inView, setInView] = useState(false)
  useEffect(() => {
    if (!tileRef.current || inView) return
    const obs = new IntersectionObserver(([entry]) => {
      if (entry.isIntersecting) {
        setInView(true)
        obs.disconnect()
      }
    }, { rootMargin: '400px 0px' })
    obs.observe(tileRef.current)
    return () => obs.disconnect()
  }, [inView])

  async function handleAlert(e: React.MouseEvent) {
    e.preventDefault()
    e.stopPropagation()
    // Guest / free users: route to signup — alerts are Pro-only. Takes them
    // through the signup → welcome → 3-months-Pro funnel then back to /camaras.
    if (!user || !isPaid) {
      router.push(`/signup?next=${encodeURIComponent('/camaras')}`)
      return
    }
    if (alertState !== 'idle') return
    setAlertState('saving')
    try {
      const res = await fetch('/api/alerts', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ portId, laneType: 'vehicle', thresholdMinutes: 30 }),
      })
      if (res.ok) {
        trackEvent('alert_created', {
          port_id: portId,
          source: 'camaras_tile',
          lane: 'vehicle',
          threshold: 30,
        })
        if (typeof window !== 'undefined') {
          window.dispatchEvent(new CustomEvent('cruzar:alert-created', { detail: { portId } }))
        }
        setAlertState('done')
        setTimeout(() => setAlertState('idle'), 3500)
      } else {
        const data = await res.json().catch(() => ({}))
        // If free-tier cap or already-exists — reflect as "exists" to avoid
        // confusing error toast. Free users shouldn't land here (isPaid gate
        // above) but defense in depth.
        if (data.error === 'free_limit') {
          setAlertState('exists')
          setTimeout(() => setAlertState('idle'), 3500)
        } else {
          setAlertState('idle')
        }
      }
    } catch {
      setAlertState('idle')
    }
  }

  async function handleShare(e: React.MouseEvent) {
    e.preventDefault()
    e.stopPropagation()
    const slug = slugForPort(portId)
    const url = wait != null && wait >= 0 && wait <= 240
      ? `https://cruzar.app/w/${portId}/${wait}`
      : `https://cruzar.app/cruzar/${slug}`
    const text = wait != null
      ? `${portName} está en ${wait} min ahorita — cámara + tiempo en vivo en cruzar.app`
      : `${portName} — cámara y tiempo en vivo en cruzar.app`
    trackShare('native', 'camera_tile')
    let shared = false
    if (typeof navigator !== 'undefined' && navigator.share) {
      try {
        await navigator.share({ title: 'Cruzar', text, url })
        shared = true
      } catch { /* cancelled */ }
    }
    if (!shared) {
      try { await navigator.clipboard.writeText(`${text}\n${url}`) } catch {}
    }
    setShareLabel('done')
    setTimeout(() => setShareLabel('idle'), 2500)
  }

  // Frame variants:
  //   - Free user (showProLock): locked teaser. Camera area is dark with
  //     a centered Pro lock + caption. Click anywhere on the tile bumps
  //     the user into /signup. No upstream feed loads — saves both
  //     bandwidth and publisher load for users who can't view it anyway.
  //   - Paid user + image: <Polled> (existing behavior, unchanged).
  //   - Paid user + youtube/hls/iframe: <FeedPlayer> from BridgeCameras —
  //     the same renderer the detail page uses. Only mounts when the
  //     tile is in view (see IntersectionObserver above). Replaces the
  //     stub placeholder that left every HLS/iframe tile blank on /camaras.
  const Frame = () => {
    if (showProLock) {
      return (
        <div className="w-full h-full bg-gradient-to-br from-gray-900 via-gray-950 to-black flex flex-col items-center justify-center gap-2 text-center px-3">
          <div className="w-10 h-10 rounded-full bg-gradient-to-br from-amber-400 to-orange-500 flex items-center justify-center shadow-lg">
            <Lock className="w-4 h-4 text-white" />
          </div>
          <div className="text-[11px] font-black uppercase tracking-widest text-amber-300/90">
            {es ? 'Cámara en vivo · Pro' : 'Live camera · Pro'}
          </div>
          <div className="text-[10px] text-white/50 leading-snug max-w-[200px]">
            {es ? 'Toca para desbloquear con 3 meses gratis al instalar la app' : 'Tap to unlock — 3 months free when you install'}
          </div>
        </div>
      )
    }
    if (feed.kind === 'image') return <Polled src={feed.src} alt={`${portName} cámara`} />
    if (!inView) {
      return (
        <div className="w-full h-full bg-gray-900 flex items-center justify-center">
          <Camera className="w-7 h-7 text-white/20" />
        </div>
      )
    }
    return <FeedPlayer feed={feed} portName={portName} />
  }

  // Tile click — free → /signup paywall; Pro → expand lightbox if the
  // page provides one, else fall back to the port detail page. Keeps
  // /camaras users in-page when the host page wires onExpand.
  function handleTileClick(e: React.MouseEvent) {
    if (showProLock) {
      e.preventDefault()
      router.push(`/signup?next=${encodeURIComponent('/camaras')}`)
      return
    }
    if (onExpand) {
      e.preventDefault()
      onExpand(portId)
    }
  }

  return (
    <a
      ref={tileRef as unknown as React.RefObject<HTMLAnchorElement>}
      href={`/cruzar/${slugForPort(portId)}`}
      onClick={handleTileClick}
      className="group relative block rounded-2xl overflow-hidden border border-white/10 bg-gray-900 hover:border-white/25 transition-colors cursor-pointer"
    >
      <div className="relative aspect-video w-full bg-black">
        <Frame />
        {/* Maximize hint — only shown to paid users since free clicks
            redirect to signup; the lightbox affordance is for Pro. */}
        {!showProLock && onExpand && (
          <div className="absolute top-2 left-1/2 -translate-x-1/2 inline-flex items-center gap-1 bg-black/55 backdrop-blur-sm rounded-full px-2 py-0.5 text-[10px] font-semibold text-white/80 opacity-0 group-hover:opacity-100 transition-opacity pointer-events-none">
            <Maximize2 className="w-2.5 h-2.5" />
            {es ? 'Toca para ampliar + cambiar ángulo' : 'Tap to enlarge + switch angle'}
          </div>
        )}
        <div className="absolute top-2 left-2 flex items-center gap-1 bg-black/70 backdrop-blur-sm rounded-full px-2 py-0.5 text-[10px] font-bold text-white">
          <span className="relative flex h-1.5 w-1.5">
            <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-white opacity-75" />
            <span className="relative inline-flex rounded-full h-1.5 w-1.5 bg-white" />
          </span>
          <span>EN VIVO</span>
        </div>
        <div className="absolute top-2 right-2 flex items-center gap-1.5">
          <button
            type="button"
            onClick={handleAlert}
            aria-label={
              alertState === 'done'
                ? (es ? 'Alerta creada' : 'Alert created')
                : (es ? 'Alertame cuando baje este puente' : 'Alert me when this bridge clears')
            }
            title={
              !user || !isPaid
                ? (es ? 'Alertas son Pro — regístrate para 3 meses gratis.' : 'Alerts are Pro — sign up for 3 months free.')
                : (es ? 'Alertame cuando baje este puente' : 'Alert me when this bridge clears')
            }
            className={`inline-flex items-center justify-center rounded-full backdrop-blur-sm border transition-all md:opacity-0 md:group-hover:opacity-100 active:scale-95 ${
              alertState === 'done' || alertState === 'exists'
                ? 'bg-green-500/90 text-white border-green-400/60 w-7 h-7 px-1.5'
                : 'bg-black/70 text-white border-white/20 hover:bg-black/90 w-7 h-7'
            }`}
          >
            {alertState === 'done' || alertState === 'exists' ? (
              <Check className="w-3.5 h-3.5" />
            ) : alertState === 'saving' ? (
              <BellRing className="w-3.5 h-3.5 animate-pulse" />
            ) : (
              <Bell className="w-3.5 h-3.5" />
            )}
          </button>
          <div className={`rounded-full border px-2.5 py-1 text-xs font-bold tabular-nums bg-black/75 backdrop-blur-sm shadow-lg ${tone.text} ${tone.border}`}>
            {tone.label}
            {wait != null && !isClosed && lane && lane !== 'vehicle' && (
              <span className="ml-1 text-[9px] font-bold uppercase tracking-wider opacity-80">
                {lane === 'commercial' ? (es ? 'carga' : 'cargo')
                  : lane === 'sentri' ? 'SENTRI'
                  : lane === 'pedestrian' ? (es ? 'peat.' : 'ped.')
                  : ''}
              </span>
            )}
          </div>
        </div>
        {alertState === 'done' && (
          <div className="absolute bottom-2 right-2 inline-flex items-center gap-1 bg-green-600/95 text-white rounded-full px-2.5 py-1 text-[11px] font-bold shadow-lg">
            <Check className="w-3 h-3" />
            {es ? 'Alerta creada' : 'Alert created'}
          </div>
        )}
      </div>
      <div className="p-3">
        <div className="flex items-start justify-between gap-2">
          <div className="min-w-0 flex-1">
            <div className="text-sm font-bold text-white truncate">{portName}</div>
            <div className="text-[11px] text-white/50 truncate">{regionLabel}</div>
          </div>
          <button
            type="button"
            onClick={handleShare}
            aria-label="Share"
            className="shrink-0 p-1.5 rounded-lg text-white/60 hover:text-white hover:bg-white/10 transition-colors"
          >
            {shareLabel === 'done' ? <Check className="w-3.5 h-3.5 text-green-400" /> : <Share2 className="w-3.5 h-3.5" />}
          </button>
        </div>
        {feed.credit && (
          <div className="mt-2 text-[10px] text-white/35 truncate">Fuente: {feed.credit}</div>
        )}
      </div>
    </a>
  )
}
