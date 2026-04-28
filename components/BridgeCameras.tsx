'use client'

import { useEffect, useRef, useState } from 'react'
import Link from 'next/link'
import { Camera, ChevronDown, ChevronUp, Lock } from 'lucide-react'
import { useLang } from '@/lib/LangContext'
import { useTier } from '@/lib/useTier'
import { getBridgeCameras, isProFeed, type CameraFeed } from '@/lib/bridgeCameras'

// Polled-image player. Municipal webcam sources almost universally serve
// a JPEG URL that the server rewrites every 10-30 seconds — NOT a video
// stream. Without a refresh loop the browser caches the first fetch and
// the image sits frozen forever, which is the "live feed is static"
// bug Diego reported 2026-04-15. This component appends a cache-busting
// query param on an interval so each tick pulls a fresh JPEG and the
// viewer sees the image tick forward every N seconds.
//
// 12s interval is the sweet spot: fast enough that the lanes look live,
// slow enough that we don't hammer a free municipal server or blow the
// mobile user's data. "Updated Xs ago" chip gives the user honest
// context on the cadence.
function PolledImage({ src, alt, intervalMs = 12000 }: { src: string; alt: string; intervalMs?: number }) {
  const [tick, setTick] = useState(() => Date.now())
  const [loaded, setLoaded] = useState(false)
  const [secondsAgo, setSecondsAgo] = useState(0)

  useEffect(() => {
    // Reset state when the upstream src prop changes (different camera tab).
    setTick(Date.now())
    setLoaded(false)
    setSecondsAgo(0)
  }, [src])

  useEffect(() => {
    const poll = setInterval(() => {
      setTick(Date.now())
      setSecondsAgo(0)
    }, intervalMs)
    const age = setInterval(() => {
      setSecondsAgo((s) => s + 1)
    }, 1000)
    return () => {
      clearInterval(poll)
      clearInterval(age)
    }
  }, [intervalMs])

  // Cache-busting param — avoids the service worker AND the browser HTTP
  // cache both. Named `_cruzar_t` so it's obvious in dev tools.
  const separator = src.includes('?') ? '&' : '?'
  const busted = `${src}${separator}_cruzar_t=${tick}`

  return (
    <div className="relative w-full h-full">
      <img
        key={tick}
        src={busted}
        alt={alt}
        className="w-full h-full object-cover"
        onLoad={() => setLoaded(true)}
      />
      {!loaded && (
        <div className="absolute inset-0 bg-gray-900 animate-pulse" />
      )}
      <div className="absolute bottom-1.5 right-1.5 flex items-center gap-1 bg-black/70 backdrop-blur-sm rounded-full px-2 py-0.5 text-[9px] font-bold text-white">
        <span className="inline-flex rounded-full h-1.5 w-1.5 bg-green-500" />
        <span className="tabular-nums">
          {secondsAgo === 0 ? 'nueva foto' : `hace ${secondsAgo}s`}
        </span>
      </div>
    </div>
  )
}

// HLS video player sub-component. Dynamically imports hls.js ONLY when
// a video element mounts with an hls-kind feed, so guest/free/non-hls
// users never download the library. Safari natively supports HLS via
// the video element's src attribute, so we short-circuit for that case
// and skip loading hls.js entirely. Fired from state 2 (Pro unlocked).
function HlsVideo({ src, title }: { src: string; title: string }) {
  const videoRef = useRef<HTMLVideoElement>(null)

  useEffect(() => {
    const video = videoRef.current
    if (!video) return

    if (video.canPlayType('application/vnd.apple.mpegurl')) {
      video.src = src
      return
    }

    let hls: { destroy: () => void } | null = null
    let cancelled = false
    import('hls.js').then((mod) => {
      if (cancelled || !videoRef.current) return
      const Hls = mod.default
      if (Hls.isSupported()) {
        const instance = new Hls({ enableWorker: true })
        instance.loadSource(src)
        instance.attachMedia(videoRef.current)
        hls = instance
      }
    }).catch(() => { /* hls.js failed to load — silent fallback */ })

    return () => {
      cancelled = true
      hls?.destroy()
    }
  }, [src])

  return (
    <video
      ref={videoRef}
      className="w-full h-full object-cover"
      autoPlay
      muted
      playsInline
      controls
      title={title}
    />
  )
}

// Renders a single feed inside the camera card. Used for both Pro
// state (full clarity) and — indirectly — for the blurred teaser
// when the feed happens to be kind:'image'.
function FeedPlayer({ feed, portName }: { feed: CameraFeed; portName: string }) {
  if (feed.kind === 'iframe') {
    return (
      <iframe
        src={feed.src}
        className="w-full h-full"
        allow="autoplay; fullscreen"
        loading="lazy"
        title={`${portName} live camera`}
      />
    )
  }
  if (feed.kind === 'youtube') {
    return (
      <iframe
        src={`https://www.youtube.com/embed/${feed.src}?autoplay=1&mute=1&rel=0`}
        className="w-full h-full"
        allow="autoplay; encrypted-media"
        loading="lazy"
        title={`${portName} live camera`}
      />
    )
  }
  if (feed.kind === 'image') {
    return <PolledImage src={feed.src} alt={`${portName} live camera`} />
  }
  if (feed.kind === 'hls') {
    return <HlsVideo src={feed.src} title={`${portName} live camera`} />
  }
  return null
}

interface Props {
  portId: string
  portName: string
}

// Port detail camera section. Three states:
//   1. No feeds registered for this port → "próximamente" card
//   2. Feeds exist, active is free or user has Pro → live embed + tabs
//   3. Active feed is Pro-gated and user is free → lock overlay with
//      "3 months Pro free — just install the app" CTA (ties the camera
//      gate directly to the PWA-install acquisition loop).
//
// Split locked 2026-04-17 per Diego's F)b pick: snapshots (JPEG feeds)
// stay free as /camaras acquisition surface; real live video (HLS,
// YouTube live, ipcamlive iframe) is Pro.
export function BridgeCameras({ portId, portName }: Props) {
  const { lang } = useLang()
  const { tier } = useTier()
  const es = lang === 'es'
  const feeds = getBridgeCameras(portId)
  const isPaid = tier === 'pro' || tier === 'business'

  // Default tab: free users start on the first SNAPSHOT angle (if any),
  // so the card opens to a working camera instead of a lock screen.
  const firstFreeIdx = feeds.findIndex((f) => !isProFeed(f))
  const defaultIdx = !isPaid && firstFreeIdx >= 0 ? firstFreeIdx : 0
  const [activeIdx, setActiveIdx] = useState(defaultIdx)

  // Closed by default to avoid running a polled JPEG / HLS / iframe
  // stream the moment the port page loads. The player is conditionally
  // mounted only when `open === true`, so close = real teardown of the
  // stream (HlsVideo's effect destroys hls.js on unmount). Persisted per
  // port: a Pro user who always opens Hidalgo's camera doesn't tap on
  // every visit.
  const storageKey = `cruzar_cam_open_${portId}`
  const [open, setOpen] = useState(false)
  useEffect(() => {
    if (typeof window === 'undefined') return
    try {
      if (window.localStorage.getItem(storageKey) === '1') setOpen(true)
    } catch {
      // localStorage blocked (private mode / iframes) — silent
    }
  }, [storageKey])
  function toggleOpen() {
    setOpen((prev) => {
      const next = !prev
      if (typeof window !== 'undefined') {
        try {
          if (next) window.localStorage.setItem(storageKey, '1')
          else window.localStorage.removeItem(storageKey)
        } catch {
          // localStorage blocked — silent
        }
      }
      return next
    })
  }

  // State 1 — no feeds registered
  if (feeds.length === 0) {
    return (
      <div className="bg-gradient-to-br from-gray-900 to-gray-800 dark:from-gray-900 dark:to-black rounded-2xl border border-gray-700 p-5 shadow-sm overflow-hidden relative">
        <div className="absolute -top-10 -right-10 w-40 h-40 bg-blue-500/10 rounded-full blur-3xl pointer-events-none" />
        <div className="relative">
          <div className="flex items-center gap-2 mb-2">
            <Camera className="w-4 h-4 text-blue-400" />
            <h2 className="text-sm font-bold text-white">
              {es ? 'Cámara en vivo' : 'Live camera'}
            </h2>
          </div>
          <div className="aspect-video bg-black/50 rounded-xl border border-gray-700 flex flex-col items-center justify-center gap-2 text-center p-4">
            <Camera className="w-8 h-8 text-gray-600" />
            <p className="text-xs font-semibold text-gray-300">
              {es ? 'Cámara próximamente' : 'Camera coming soon'}
            </p>
            <p className="text-[10px] text-gray-500 leading-snug max-w-[240px]">
              {es
                ? `Todavía no tenemos cámara pública de ${portName}. Si conoces alguna, escríbenos.`
                : `No public camera for ${portName} yet. Send us a tip if you know of one.`}
            </p>
            <Link
              href="/camaras"
              className="mt-1 text-[10px] font-bold text-blue-400 hover:text-blue-300"
            >
              {es ? 'Ver otras cámaras →' : 'See other cameras →'}
            </Link>
          </div>
        </div>
      </div>
    )
  }

  const safeIdx = Math.min(activeIdx, feeds.length - 1)
  const activeFeed = feeds[safeIdx]
  const hasTabs = feeds.length > 1
  const activeIsPro = isProFeed(activeFeed)
  const showLock = activeIsPro && !isPaid
  const isLiveVideo =
    activeFeed.kind === 'youtube' ||
    activeFeed.kind === 'hls' ||
    activeFeed.kind === 'iframe'

  // State 2 — feeds exist. Header doubles as a toggle; player only
  // mounts when expanded so a closed card consumes zero network /
  // decode budget.
  return (
    <div className="bg-gray-900 dark:bg-black rounded-2xl border border-gray-700 shadow-sm">
        <button
          type="button"
          onClick={toggleOpen}
          aria-expanded={open}
          aria-controls={`bridge-camera-${portId}`}
          className="w-full flex items-center gap-2 px-4 py-3 text-left active:scale-[0.99] transition-transform"
        >
          <Camera className={`w-4 h-4 ${isLiveVideo ? 'text-green-400' : 'text-blue-400'}`} />
          <h2 className="text-sm font-bold text-white">
            {isLiveVideo
              ? (es ? 'Cámara en vivo' : 'Live camera')
              : (es ? 'Webcam del puente' : 'Bridge webcam')}
          </h2>
          {isLiveVideo ? (
            <span className="flex items-center gap-1 text-[10px] font-semibold text-green-400">
              <span className="relative flex h-2 w-2">
                <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-green-400 opacity-75" />
                <span className="relative inline-flex rounded-full h-2 w-2 bg-green-500" />
              </span>
              {es ? 'EN VIVO' : 'LIVE'}
            </span>
          ) : (
            <span className="flex items-center gap-1 text-[10px] font-semibold text-gray-400">
              <span className="inline-flex rounded-full h-2 w-2 bg-green-500" />
              {es ? 'Foto cada ~12s' : 'Photo every ~12s'}
            </span>
          )}
          <span className="ml-auto flex items-center gap-1 text-[10px] font-semibold text-gray-400">
            {open
              ? (es ? 'Ocultar' : 'Hide')
              : (es ? 'Ver' : 'View')}
            {open ? <ChevronUp className="w-3.5 h-3.5" /> : <ChevronDown className="w-3.5 h-3.5" />}
          </span>
        </button>

        {open && (
          <div id={`bridge-camera-${portId}`} className="px-4 pb-4">
            {hasTabs && (
              <div className="flex flex-wrap gap-1.5 mb-2">
                {feeds.map((f, i) => {
                  const active = i === safeIdx
                  const locked = isProFeed(f) && !isPaid
                  return (
                    <button
                      key={i}
                      type="button"
                      onClick={() => setActiveIdx(i)}
                      className={`inline-flex items-center gap-1 text-[10px] font-bold uppercase tracking-wide px-2.5 py-1 rounded-full border transition-colors ${
                        active
                          ? 'bg-white text-gray-900 border-white'
                          : 'bg-white/5 text-gray-300 border-white/15 hover:bg-white/10'
                      }`}
                    >
                      {locked && <Lock className="w-2.5 h-2.5" />}
                      {f.label || `Cam ${i + 1}`}
                    </button>
                  )
                })}
              </div>
            )}

            <div className="aspect-video bg-black rounded-xl overflow-hidden border border-gray-800 relative">
              {showLock ? (
                <div className="absolute inset-0 flex flex-col items-center justify-center gap-2 text-center p-4 bg-gradient-to-br from-gray-900 via-black to-gray-900">
                  <div className="w-12 h-12 rounded-full bg-gradient-to-br from-amber-400 to-orange-500 flex items-center justify-center shadow-lg">
                    <Lock className="w-5 h-5 text-white" />
                  </div>
                  <p className="text-sm font-black text-white">
                    {es ? 'Video en vivo es Pro' : 'Live video is Pro'}
                  </p>
                  <p className="text-[11px] text-white/70 max-w-[260px] leading-snug">
                    {es
                      ? '3 meses gratis — agrega Cruzar a tu pantalla de inicio y desbloquea todas las cámaras en vivo.'
                      : '3 months free — add Cruzar to your home screen and unlock every live camera.'}
                  </p>
                  <Link
                    href="/pricing"
                    className="mt-1 inline-block bg-gradient-to-br from-amber-400 to-orange-500 text-white text-xs font-black px-4 py-2 rounded-xl active:scale-95 transition-transform"
                  >
                    {es ? 'Desbloquear Pro gratis →' : 'Unlock Pro free →'}
                  </Link>
                </div>
              ) : (
                <FeedPlayer feed={activeFeed} portName={portName} />
              )}
            </div>

            {activeFeed.note && (
              <p className="text-[10px] text-gray-400 mt-1.5 leading-snug">{activeFeed.note}</p>
            )}
            <p className="text-[10px] text-gray-500 mt-1">
              {es ? 'Fuente: ' : 'Source: '}
              {activeFeed.creditUrl ? (
                <a href={activeFeed.creditUrl} target="_blank" rel="noopener noreferrer" className="underline hover:text-gray-300">
                  {activeFeed.credit}
                </a>
              ) : activeFeed.credit}
            </p>
          </div>
        )}
      </div>
    )
}
