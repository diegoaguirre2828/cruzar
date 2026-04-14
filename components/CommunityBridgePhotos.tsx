'use client'

import { useCallback, useEffect, useState } from 'react'
import { Users, Flag, Clock } from 'lucide-react'
import { useLang } from '@/lib/LangContext'
import { SubmitBridgePhoto } from './SubmitBridgePhoto'

// Community photo rail — renders below BridgeCameras on port detail.
// Fetches live, non-expired photos for the port from /api/port-photos
// and renders them as a horizontal scroll rail of thumbnails. Tap
// to expand. Report button per photo (3 reports auto-hides).

interface Photo {
  id: string
  port_id: string
  url: string
  caption: string | null
  created_at: string
  expires_at: string
  report_count: number
  display_name: string | null
}

interface Props {
  portId: string
  portName: string
}

function minutesAgo(iso: string): number {
  return Math.round((Date.now() - new Date(iso).getTime()) / 60000)
}

function minutesLeft(iso: string): number {
  return Math.max(0, Math.round((new Date(iso).getTime() - Date.now()) / 60000))
}

export function CommunityBridgePhotos({ portId, portName }: Props) {
  const { lang } = useLang()
  const es = lang === 'es'
  const [photos, setPhotos] = useState<Photo[]>([])
  const [loading, setLoading] = useState(true)
  const [expandedId, setExpandedId] = useState<string | null>(null)
  const [reportingId, setReportingId] = useState<string | null>(null)

  const load = useCallback(() => {
    setLoading(true)
    fetch(`/api/port-photos?portId=${encodeURIComponent(portId)}`, { cache: 'no-store' })
      .then((r) => r.json())
      .then((d) => setPhotos(d.photos || []))
      .catch(() => setPhotos([]))
      .finally(() => setLoading(false))
  }, [portId])

  useEffect(() => { load() }, [load])

  async function report(id: string) {
    setReportingId(id)
    try {
      await fetch(`/api/port-photos/${id}/report`, { method: 'POST' })
      // Optimistically remove from view
      setPhotos((prev) => prev.filter((p) => p.id !== id))
      setExpandedId(null)
    } finally {
      setReportingId(null)
    }
  }

  const expanded = photos.find((p) => p.id === expandedId) || null

  return (
    <div className="bg-white dark:bg-gray-900 rounded-2xl border border-gray-200 dark:border-gray-800 p-4">
      <div className="flex items-center gap-2 mb-3">
        <Users className="w-4 h-4 text-amber-600 dark:text-amber-400" />
        <h2 className="text-sm font-bold text-gray-900 dark:text-gray-100">
          {es ? 'Lo que la gente ve ahorita' : "What people are seeing now"}
        </h2>
        <span className="ml-auto text-[10px] text-gray-400">
          {es ? 'fotos de la raza · 2 h' : 'community · 2 h'}
        </span>
      </div>

      {loading ? (
        <div className="h-24 flex items-center justify-center">
          <p className="text-xs text-gray-400">{es ? 'Cargando…' : 'Loading…'}</p>
        </div>
      ) : photos.length === 0 ? (
        <div className="bg-gray-50 dark:bg-gray-800/50 rounded-xl px-4 py-5 text-center mb-3">
          <p className="text-xs text-gray-500 dark:text-gray-400 leading-snug">
            {es
              ? 'Nadie ha compartido una foto en las últimas 2 horas.'
              : "No one has shared a photo in the last 2 hours."}
          </p>
          <p className="text-[11px] text-gray-400 mt-1">
            {es ? '¿Estás en el puente? Compártela abajo.' : 'At the bridge? Share one below.'}
          </p>
        </div>
      ) : (
        <div className="flex gap-2 overflow-x-auto pb-2 scrollbar-hide mb-3">
          {photos.map((p) => (
            <button
              key={p.id}
              type="button"
              onClick={() => setExpandedId(p.id)}
              className="relative flex-shrink-0 w-32 h-32 rounded-xl overflow-hidden border border-amber-200 dark:border-amber-900/40 shadow-sm active:scale-[0.97] transition-transform"
            >
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img
                src={p.url}
                alt={p.caption ?? ''}
                className="w-full h-full object-cover"
                loading="lazy"
              />
              <div className="absolute inset-x-0 bottom-0 bg-gradient-to-t from-black/80 to-transparent px-2 py-1">
                <p className="text-[9px] font-bold text-white/90 truncate">
                  {p.display_name ? `@${p.display_name}` : es ? 'alguien' : 'someone'}
                </p>
                <p className="text-[8px] text-white/70 flex items-center gap-0.5">
                  <Clock className="w-2.5 h-2.5" />
                  {minutesAgo(p.created_at)}m
                </p>
              </div>
            </button>
          ))}
        </div>
      )}

      <SubmitBridgePhoto portId={portId} portName={portName} onSubmitted={load} />

      {/* Expanded view modal */}
      {expanded && (
        <div
          className="fixed inset-0 z-[70] flex items-center justify-center bg-black/85 backdrop-blur-md p-4"
          role="dialog"
          onClick={() => setExpandedId(null)}
        >
          <div
            className="relative max-w-md w-full bg-gray-900 rounded-2xl overflow-hidden shadow-2xl"
            onClick={(e) => e.stopPropagation()}
          >
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img src={expanded.url} alt={expanded.caption ?? ''} className="w-full max-h-[70vh] object-contain bg-black" />
            <div className="p-3 border-t border-gray-800">
              <div className="flex items-center justify-between gap-2">
                <div className="min-w-0">
                  <p className="text-[11px] font-bold text-white">
                    {expanded.display_name ? `@${expanded.display_name}` : es ? 'alguien' : 'someone'}
                    <span className="ml-2 text-gray-400 font-normal">· {minutesAgo(expanded.created_at)}m {es ? 'hace' : 'ago'}</span>
                  </p>
                  {expanded.caption && (
                    <p className="text-[12px] text-gray-200 mt-1 leading-snug">{expanded.caption}</p>
                  )}
                </div>
                <button
                  type="button"
                  onClick={() => report(expanded.id)}
                  disabled={reportingId === expanded.id}
                  className="flex-shrink-0 flex items-center gap-1 text-[10px] font-bold text-red-300 hover:text-red-100 border border-red-400/30 rounded-full px-2.5 py-1 disabled:opacity-50"
                >
                  <Flag className="w-3 h-3" />
                  {reportingId === expanded.id
                    ? (es ? 'Enviando…' : 'Sending…')
                    : (es ? 'Reportar' : 'Report')}
                </button>
              </div>
              <p className="text-[9px] text-gray-500 mt-2">
                {es ? `Expira en ${minutesLeft(expanded.expires_at)} min` : `Expires in ${minutesLeft(expanded.expires_at)} min`}
              </p>
            </div>
            <button
              type="button"
              onClick={() => setExpandedId(null)}
              className="absolute top-3 right-3 w-8 h-8 flex items-center justify-center rounded-full bg-black/60 text-white hover:bg-black/80 text-lg"
              aria-label={es ? 'Cerrar' : 'Close'}
            >
              ×
            </button>
          </div>
        </div>
      )}
    </div>
  )
}
