'use client'

import { useEffect, useState } from 'react'
import Link from 'next/link'
import { Camera } from 'lucide-react'
import type { CameraFeed } from '@/lib/bridgeCameras'

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
      href={`/port/${portId}`}
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
        <div className={`absolute top-2 right-2 rounded-full border px-2.5 py-0.5 text-[11px] font-bold tabular-nums ${tone.bg} ${tone.text} ${tone.border}`}>
          {tone.label}
        </div>
      </div>
      <div className="p-3">
        <div className="flex items-start justify-between gap-2">
          <div className="min-w-0">
            <div className="text-sm font-bold text-white truncate">{portName}</div>
            <div className="text-[11px] text-white/50 truncate">{regionLabel}</div>
          </div>
          <div className="shrink-0 text-[11px] font-bold text-white/70 group-hover:text-white transition-colors">
            Ver →
          </div>
        </div>
        {feed.credit && (
          <div className="mt-2 text-[10px] text-white/35 truncate">Fuente: {feed.credit}</div>
        )}
      </div>
    </Link>
  )
}
