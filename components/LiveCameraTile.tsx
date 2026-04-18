'use client'

import { useEffect, useState } from 'react'
import Link from 'next/link'
import { useRouter } from 'next/navigation'
import { Bell, BellRing, Camera, Lock, Share2, Check } from 'lucide-react'
import type { CameraFeed } from '@/lib/bridgeCameras'
import { isProFeed } from '@/lib/bridgeCameras'
import { slugForPort } from '@/lib/portSlug'
import { useTier } from '@/lib/useTier'
import { useAuth } from '@/lib/useAuth'
import { useLang } from '@/lib/LangContext'
import { trackShare } from '@/lib/trackShare'
import { trackEvent } from '@/lib/trackEvent'

interface Props {
  portId: string
  portName: string
  regionLabel: string
  wait: number | null
  isClosed: boolean
  noData: boolean
  feed: CameraFeed
}

function levelTone(mins: number | null, isClosed: boolean): { bg: string; text: string; border: string; label: string } {
  if (isClosed) return { bg: 'bg-gray-500/15', text: 'text-gray-300', border: 'border-gray-500/30', label: 'Cerrado' }
  if (mins === null) return { bg: 'bg-gray-500/15', text: 'text-gray-300', border: 'border-gray-500/30', label: 's/datos' }
  if (mins <= 20) return { bg: 'bg-green-500/15', text: 'text-green-400', border: 'border-green-500/30', label: `${mins} min` }
  if (mins <= 45) return { bg: 'bg-amber-500/15', text: 'text-amber-400', border: 'border-amber-500/30', label: `${mins} min` }
  return { bg: 'bg-red-500/15', text: 'text-red-400', border: 'border-red-500/30', label: `${mins} min` }
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

export function LiveCameraTile({ portId, portName, regionLabel, wait, isClosed, noData, feed }: Props) {
  const tone = levelTone(wait, isClosed)
  const { tier } = useTier()
  const { user } = useAuth()
  const { lang } = useLang()
  const router = useRouter()
  const es = lang === 'es'
  const isPaid = tier === 'pro' || tier === 'business'
  const isProPort = isProFeed(feed)
  const showProLock = isProPort && !isPaid
  const [shareLabel, setShareLabel] = useState<'idle' | 'done'>('idle')
  const [alertState, setAlertState] = useState<'idle' | 'saving' | 'done' | 'exists'>('idle')

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

  const Frame = () => {
    if (feed.kind === 'image') return <Polled src={feed.src} alt={`${portName} cámara`} />
    if (feed.kind === 'youtube') {
      return (
        <iframe
          src={`https://www.youtube.com/embed/${feed.src}?autoplay=1&mute=1&rel=0&modestbranding=1`}
          className="w-full h-full"
          allow="autoplay; encrypted-media"
          loading="lazy"
          title={`${portName} cámara`}
        />
      )
    }
    if (feed.kind === 'hls' || feed.kind === 'iframe') {
      // HLS + iframe live players are heavy to render N times on one
      // grid page. Show a placeholder tile; the real live view renders
      // on the port detail page.
      return (
        <div className="w-full h-full bg-gray-900 flex items-center justify-center">
          <Camera className="w-8 h-8 text-white/30" />
        </div>
      )
    }
    return null
  }

  return (
    <Link
      href={`/cruzar/${slugForPort(portId)}`}
      className="group relative block rounded-2xl overflow-hidden border border-white/10 bg-gray-900 hover:border-white/25 transition-colors"
    >
      <div className="relative aspect-video w-full bg-black">
        <Frame />
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
          <div className={`rounded-full border px-2.5 py-0.5 text-[11px] font-bold tabular-nums ${tone.bg} ${tone.text} ${tone.border}`}>
            {tone.label}
          </div>
        </div>
        {alertState === 'done' && (
          <div className="absolute bottom-2 right-2 inline-flex items-center gap-1 bg-green-600/95 text-white rounded-full px-2.5 py-1 text-[11px] font-bold shadow-lg">
            <Check className="w-3 h-3" />
            {es ? 'Alerta creada' : 'Alert created'}
          </div>
        )}
        {showProLock && (
          <div className="absolute bottom-2 left-2 inline-flex items-center gap-1 bg-gradient-to-r from-amber-500/90 to-orange-600/90 text-white rounded-full px-2 py-0.5 text-[10px] font-black uppercase tracking-wide shadow-lg">
            <Lock className="w-2.5 h-2.5" />
            Pro
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
    </Link>
  )
}
