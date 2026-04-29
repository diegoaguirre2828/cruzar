'use client'

import { useEffect, useState } from 'react'
import { X, ChevronLeft, ChevronRight, ExternalLink } from 'lucide-react'
import Link from 'next/link'
import { BRIDGE_CAMERAS } from '@/lib/bridgeCameras'
import { getPortMeta } from '@/lib/portMeta'
import { slugForPort } from '@/lib/portSlug'
import { useLang } from '@/lib/LangContext'
import { FeedPlayer } from '@/components/BridgeCameras'

interface Props {
  portId: string | null
  onClose: () => void
}

// Full-screen camera lightbox shown on top of /camaras when a Pro user
// clicks a tile. Lets them flip between angles for a single port + see a
// bigger view, without leaving the grid. Closes on ESC, on backdrop
// click, or via the explicit X.
export function CameraLightbox({ portId, onClose }: Props) {
  const { lang } = useLang()
  const es = lang === 'es'
  const [angleIdx, setAngleIdx] = useState(0)

  // Reset angle picker when the port changes — opening Eagle Pass II
  // shouldn't carry over a "Stanton angle 4" selection.
  useEffect(() => {
    setAngleIdx(0)
  }, [portId])

  // ESC to close — body scroll lock while open so the page underneath
  // doesn't jitter when the user wheels through the lightbox.
  useEffect(() => {
    if (!portId) return
    const activePortId = portId
    function onKey(e: KeyboardEvent) {
      if (e.key === 'Escape') onClose()
      if (e.key === 'ArrowLeft') setAngleIdx((i) => Math.max(0, i - 1))
      if (e.key === 'ArrowRight') {
        const max = (BRIDGE_CAMERAS[activePortId]?.length ?? 1) - 1
        setAngleIdx((i) => Math.min(max, i + 1))
      }
    }
    document.addEventListener('keydown', onKey)
    const prevOverflow = document.body.style.overflow
    document.body.style.overflow = 'hidden'
    return () => {
      document.removeEventListener('keydown', onKey)
      document.body.style.overflow = prevOverflow
    }
  }, [portId, onClose])

  if (!portId) return null
  const feeds = BRIDGE_CAMERAS[portId] ?? []
  if (feeds.length === 0) return null
  const meta = getPortMeta(portId)
  const portName = meta.localName || portId
  const safeIdx = Math.min(angleIdx, feeds.length - 1)
  const feed = feeds[safeIdx]

  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-label={portName}
      className="fixed inset-0 z-50 flex items-center justify-center p-2 sm:p-6 bg-black/90 backdrop-blur-sm"
      onClick={onClose}
    >
      <div
        onClick={(e) => e.stopPropagation()}
        className="relative w-full max-w-5xl bg-gray-950 rounded-2xl overflow-hidden border border-white/10 shadow-2xl flex flex-col max-h-[95vh]"
      >
        {/* Header */}
        <div className="flex items-center gap-3 px-4 py-3 border-b border-white/10">
          <div className="min-w-0 flex-1">
            <h2 className="text-base font-bold text-white truncate">{portName}</h2>
            <div className="text-[11px] text-white/50 truncate">
              {feed.label || (es ? `Ángulo ${safeIdx + 1} de ${feeds.length}` : `Angle ${safeIdx + 1} of ${feeds.length}`)}
              {feed.credit ? ` · ${feed.credit}` : ''}
            </div>
          </div>
          <Link
            href={`/cruzar/${slugForPort(portId)}`}
            className="hidden sm:inline-flex shrink-0 items-center gap-1 text-[11px] font-semibold text-white/60 hover:text-white px-2 py-1 rounded-lg hover:bg-white/5"
            title={es ? 'Abrir página del puente' : 'Open bridge page'}
          >
            <ExternalLink className="w-3 h-3" />
            {es ? 'Detalles' : 'Details'}
          </Link>
          <button
            type="button"
            onClick={onClose}
            aria-label={es ? 'Cerrar' : 'Close'}
            className="shrink-0 inline-flex items-center justify-center w-9 h-9 rounded-full bg-white/5 hover:bg-white/15 text-white transition-colors"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* Player */}
        <div className="relative bg-black aspect-video w-full">
          <FeedPlayer feed={feed} portName={portName} />
          {/* Prev/Next overlay arrows — only when multiple angles */}
          {feeds.length > 1 && (
            <>
              <button
                type="button"
                onClick={() => setAngleIdx((i) => Math.max(0, i - 1))}
                disabled={safeIdx === 0}
                aria-label={es ? 'Ángulo anterior' : 'Previous angle'}
                className="absolute left-2 top-1/2 -translate-y-1/2 inline-flex items-center justify-center w-10 h-10 rounded-full bg-black/60 hover:bg-black/85 text-white backdrop-blur-sm disabled:opacity-30 disabled:cursor-not-allowed transition-colors"
              >
                <ChevronLeft className="w-5 h-5" />
              </button>
              <button
                type="button"
                onClick={() => setAngleIdx((i) => Math.min(feeds.length - 1, i + 1))}
                disabled={safeIdx === feeds.length - 1}
                aria-label={es ? 'Siguiente ángulo' : 'Next angle'}
                className="absolute right-2 top-1/2 -translate-y-1/2 inline-flex items-center justify-center w-10 h-10 rounded-full bg-black/60 hover:bg-black/85 text-white backdrop-blur-sm disabled:opacity-30 disabled:cursor-not-allowed transition-colors"
              >
                <ChevronRight className="w-5 h-5" />
              </button>
            </>
          )}
        </div>

        {/* Angle tabs — clickable + keyboard accessible. Stays scrollable
            on mobile when a port has 6+ angles (Stanton / Mariposa). */}
        {feeds.length > 1 && (
          <div className="flex gap-1.5 overflow-x-auto no-scrollbar px-3 py-3 border-t border-white/10 bg-black/40">
            {feeds.map((f, i) => {
              const active = i === safeIdx
              return (
                <button
                  key={i}
                  type="button"
                  onClick={() => setAngleIdx(i)}
                  className={`shrink-0 inline-flex items-center gap-1 text-[11px] font-bold uppercase tracking-wide px-3 py-1.5 rounded-full border transition-colors ${
                    active
                      ? 'bg-white text-gray-900 border-white'
                      : 'bg-white/5 text-gray-300 border-white/15 hover:bg-white/10'
                  }`}
                >
                  {f.label || (es ? `Ángulo ${i + 1}` : `Angle ${i + 1}`)}
                </button>
              )
            })}
          </div>
        )}
      </div>
    </div>
  )
}
