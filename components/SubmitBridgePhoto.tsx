'use client'

import { useRef, useState } from 'react'
import { Camera, X, Upload, AlertCircle, CheckCircle2 } from 'lucide-react'
import { useAuth } from '@/lib/useAuth'
import { useLang } from '@/lib/LangContext'
import { trackEvent } from '@/lib/trackEvent'

// "📸 Share the view" button for the port detail page. Authed users
// can submit a photo of the bridge they're physically at. The API
// enforces a geofence (~1km) so only users actually at the bridge
// can upload.
//
// Flow:
//   1. User taps "Share the view" → modal opens
//   2. Modal asks for camera permission + GPS (for geofence)
//   3. User picks a photo (mobile camera input with capture="environment")
//   4. Preview appears + optional caption field
//   5. "Submit" → base64 encode → POST /api/port-photos
//   6. Success toast → parent refetches photo list
//
// Privacy reminder shown inline: photos are public, live 2 hours,
// avoid showing faces or license plates.

interface Props {
  portId: string
  portName: string
  onSubmitted?: () => void
}

type Status = 'idle' | 'requesting_geo' | 'geo_denied' | 'ready' | 'uploading' | 'success' | 'error'

async function readFileAsDataUrl(file: File): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader()
    reader.onload = () => resolve(reader.result as string)
    reader.onerror = () => reject(reader.error)
    reader.readAsDataURL(file)
  })
}

export function SubmitBridgePhoto({ portId, portName, onSubmitted }: Props) {
  const { user } = useAuth()
  const { lang } = useLang()
  const es = lang === 'es'
  const [open, setOpen] = useState(false)
  const [file, setFile] = useState<File | null>(null)
  const [preview, setPreview] = useState<string | null>(null)
  const [caption, setCaption] = useState('')
  const [status, setStatus] = useState<Status>('idle')
  const [error, setError] = useState<string | null>(null)
  const [coords, setCoords] = useState<{ lat: number; lng: number } | null>(null)
  const fileInputRef = useRef<HTMLInputElement>(null)

  // Don't render the button for guests — the API would 401 them
  // anyway, but surfacing an option a user can't use is worse UX
  // than hiding it.
  if (!user) return null

  function openModal() {
    setOpen(true)
    setStatus('requesting_geo')
    setError(null)
    if (!navigator.geolocation) {
      setStatus('geo_denied')
      setError(es ? 'Tu navegador no soporta geolocalización' : 'Geolocation not supported')
      return
    }
    navigator.geolocation.getCurrentPosition(
      (pos) => {
        setCoords({ lat: pos.coords.latitude, lng: pos.coords.longitude })
        setStatus('ready')
      },
      () => {
        setStatus('geo_denied')
        setError(
          es
            ? 'Necesitamos tu ubicación pa\' verificar que estás en el puente. Permítela en la configuración del navegador.'
            : "We need your location to verify you're at the bridge. Allow it in your browser settings.",
        )
      },
      { enableHighAccuracy: true, timeout: 10000 },
    )
  }

  function close() {
    setOpen(false)
    setFile(null)
    setPreview(null)
    setCaption('')
    setCoords(null)
    setError(null)
    setStatus('idle')
  }

  async function handleFile(e: React.ChangeEvent<HTMLInputElement>) {
    const f = e.target.files?.[0]
    if (!f) return
    if (f.size > 8 * 1024 * 1024) {
      setError(es ? 'Foto muy grande (máximo 5MB)' : 'Photo too large (5MB max)')
      return
    }
    setFile(f)
    try {
      const dataUrl = await readFileAsDataUrl(f)
      setPreview(dataUrl)
    } catch {
      setError(es ? 'No pude leer la foto' : "Couldn't read the photo")
    }
  }

  async function submit() {
    if (!preview || !coords) return
    setStatus('uploading')
    setError(null)
    try {
      const res = await fetch('/api/port-photos', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          portId,
          base64Image: preview,
          caption: caption.trim() || undefined,
          lat: coords.lat,
          lng: coords.lng,
        }),
      })
      const data = await res.json().catch(() => ({}))
      if (!res.ok) {
        setStatus('error')
        setError(
          data.error
            || (es ? 'No se pudo enviar la foto' : "Couldn't submit the photo"),
        )
        return
      }
      setStatus('success')
      trackEvent('port_photo_submitted', { port_id: portId })
      onSubmitted?.()
      setTimeout(close, 1400)
    } catch (err) {
      setStatus('error')
      setError(err instanceof Error ? err.message : String(err))
    }
  }

  return (
    <>
      <button
        type="button"
        onClick={openModal}
        className="flex items-center justify-center gap-2 w-full bg-white dark:bg-gray-800 border border-amber-400 dark:border-amber-600 text-amber-700 dark:text-amber-400 text-sm font-bold py-2.5 rounded-xl active:scale-[0.98] transition-transform"
      >
        <Camera className="w-4 h-4" />
        {es ? '📸 Comparte lo que ves' : '📸 Share the view'}
      </button>

      {open && (
        <div
          className="fixed inset-0 z-[70] flex items-end md:items-center justify-center bg-black/70 backdrop-blur-sm p-0 md:p-4"
          role="dialog"
          aria-modal="true"
          onClick={close}
        >
          <div
            className="w-full max-w-md bg-white dark:bg-gray-900 rounded-t-3xl md:rounded-3xl shadow-2xl overflow-hidden"
            onClick={(e) => e.stopPropagation()}
            style={{ paddingBottom: 'env(safe-area-inset-bottom)' }}
          >
            {/* Header */}
            <div className="relative p-4 border-b border-gray-200 dark:border-gray-700">
              <button
                type="button"
                onClick={close}
                aria-label={es ? 'Cerrar' : 'Close'}
                className="absolute top-3 right-3 w-8 h-8 flex items-center justify-center rounded-full text-gray-400 hover:text-gray-900 dark:hover:text-gray-100 hover:bg-gray-100 dark:hover:bg-gray-800"
              >
                <X className="w-4 h-4" />
              </button>
              <h2 className="text-base font-black text-gray-900 dark:text-gray-100 pr-8">
                {es ? `Comparte lo que ves en ${portName}` : `Share the view at ${portName}`}
              </h2>
              <p className="text-[11px] text-gray-500 dark:text-gray-400 mt-1 leading-snug">
                {es
                  ? 'Tu foto vive 2 horas y se borra sola. Evita mostrar caras o placas.'
                  : 'Your photo lives for 2 hours then auto-deletes. Avoid showing faces or license plates.'}
              </p>
            </div>

            <div className="p-4">
              {/* Status-specific content */}
              {status === 'requesting_geo' && (
                <div className="py-8 text-center">
                  <p className="text-sm text-gray-600 dark:text-gray-300">
                    {es ? 'Verificando que estás en el puente…' : 'Verifying you are at the bridge…'}
                  </p>
                </div>
              )}

              {status === 'geo_denied' && (
                <div className="bg-amber-50 dark:bg-amber-900/20 border border-amber-200 dark:border-amber-800 rounded-xl p-3 flex items-start gap-2">
                  <AlertCircle className="w-4 h-4 text-amber-600 flex-shrink-0 mt-0.5" />
                  <p className="text-xs text-amber-800 dark:text-amber-200 leading-snug">{error}</p>
                </div>
              )}

              {status === 'ready' && !preview && (
                <div>
                  <button
                    type="button"
                    onClick={() => fileInputRef.current?.click()}
                    className="w-full flex flex-col items-center justify-center gap-2 py-10 border-2 border-dashed border-gray-300 dark:border-gray-700 rounded-2xl hover:border-blue-500 transition-colors"
                  >
                    <Camera className="w-8 h-8 text-gray-400" />
                    <p className="text-sm font-bold text-gray-700 dark:text-gray-200">
                      {es ? 'Toma una foto' : 'Take a photo'}
                    </p>
                    <p className="text-[11px] text-gray-500 dark:text-gray-400">
                      {es ? 'Usa la cámara trasera del teléfono' : "Use your phone's rear camera"}
                    </p>
                  </button>
                  <input
                    ref={fileInputRef}
                    type="file"
                    accept="image/jpeg,image/png,image/webp"
                    capture="environment"
                    onChange={handleFile}
                    className="hidden"
                  />
                </div>
              )}

              {preview && (status === 'ready' || status === 'uploading' || status === 'error') && (
                <div>
                  <div className="relative rounded-2xl overflow-hidden bg-black mb-3">
                    {/* eslint-disable-next-line @next/next/no-img-element */}
                    <img src={preview} alt="" className="w-full max-h-80 object-contain" />
                    <button
                      type="button"
                      onClick={() => { setPreview(null); setFile(null) }}
                      disabled={status === 'uploading'}
                      className="absolute top-2 right-2 w-8 h-8 flex items-center justify-center rounded-full bg-black/60 text-white hover:bg-black/80"
                    >
                      <X className="w-4 h-4" />
                    </button>
                  </div>
                  <textarea
                    value={caption}
                    onChange={(e) => setCaption(e.target.value.slice(0, 140))}
                    placeholder={es ? 'Caption (opcional) — ej: "X-ray en línea 3"' : 'Caption (optional) — e.g. "X-ray on lane 3"'}
                    rows={2}
                    disabled={status === 'uploading'}
                    className="w-full bg-gray-50 dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-xl px-3 py-2 text-sm text-gray-900 dark:text-gray-100 resize-none focus:outline-none focus:ring-2 focus:ring-blue-500"
                  />
                  <p className="text-[10px] text-gray-400 text-right mt-1">{caption.length}/140</p>

                  {error && (
                    <div className="mt-2 bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 rounded-xl px-3 py-2">
                      <p className="text-xs text-red-800 dark:text-red-200 leading-snug">{error}</p>
                    </div>
                  )}

                  <button
                    type="button"
                    onClick={submit}
                    disabled={status === 'uploading'}
                    className="mt-3 w-full flex items-center justify-center gap-2 bg-blue-600 hover:bg-blue-700 text-white text-sm font-black py-3 rounded-2xl shadow-lg disabled:opacity-60 active:scale-[0.98] transition-transform"
                  >
                    <Upload className="w-4 h-4" />
                    {status === 'uploading'
                      ? (es ? 'Enviando…' : 'Uploading…')
                      : (es ? 'Enviar foto' : 'Submit photo')}
                  </button>
                </div>
              )}

              {status === 'success' && (
                <div className="py-6 text-center">
                  <CheckCircle2 className="w-10 h-10 text-green-500 mx-auto mb-2" />
                  <p className="text-sm font-bold text-gray-900 dark:text-gray-100">
                    {es ? '¡Gracias! Tu foto está en vivo 2 horas.' : "Thanks! Your photo is live for 2 hours."}
                  </p>
                </div>
              )}
            </div>
          </div>
        </div>
      )}
    </>
  )
}
