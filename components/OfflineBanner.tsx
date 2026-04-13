'use client'

import { useEffect, useState } from 'react'
import { useLang } from '@/lib/LangContext'
import { loadCachedPorts } from '@/lib/portCache'

// Persistent top banner when the user is offline. Shows them the
// age of the cached data they're currently looking at so they can
// still make a decision ("Hidalgo was 14 min, 8 minutes ago —
// probably still fine"). The border has notoriously bad cell
// coverage and the moment the user needs the app most — sitting
// in the fila — is also when their signal is worst. Silently
// serving stale data works, but only if the user KNOWS it's stale
// so they trust the number.

export function OfflineBanner() {
  const { lang } = useLang()
  const es = lang === 'es'
  const [offline, setOffline] = useState(false)
  const [cacheAgeMin, setCacheAgeMin] = useState<number | null>(null)

  useEffect(() => {
    if (typeof window === 'undefined') return
    const refreshCache = () => {
      const cached = loadCachedPorts()
      setCacheAgeMin(cached?.ageMin ?? null)
    }
    const update = () => {
      setOffline(!navigator.onLine)
      refreshCache()
    }
    update()
    window.addEventListener('online', update)
    window.addEventListener('offline', update)
    // Also refresh cache age every 60s so the "hace X min" label
    // doesn't get stuck at the value from when the banner mounted.
    const tick = setInterval(refreshCache, 60_000)
    return () => {
      window.removeEventListener('online', update)
      window.removeEventListener('offline', update)
      clearInterval(tick)
    }
  }, [])

  if (!offline) return null

  const ageLabel =
    cacheAgeMin == null
      ? (es ? 'sin datos guardados' : 'no saved data')
      : cacheAgeMin < 1
        ? (es ? 'guardados hace instantes' : 'saved just now')
        : cacheAgeMin < 60
          ? (es ? `guardados hace ${cacheAgeMin} min` : `saved ${cacheAgeMin}m ago`)
          : (es ? `guardados hace ${Math.floor(cacheAgeMin / 60)}h` : `saved ${Math.floor(cacheAgeMin / 60)}h ago`)

  return (
    <div
      className="fixed left-0 right-0 z-40 bg-amber-500 text-white text-center"
      style={{ top: 'env(safe-area-inset-top)' }}
    >
      <div className="max-w-lg mx-auto px-4 py-1.5 flex items-center justify-center gap-2">
        <span className="text-base leading-none">📡</span>
        <p className="text-[11px] font-bold leading-tight">
          {es ? 'Sin señal' : 'Offline'} · {es ? 'mostrando datos' : 'showing data'} {ageLabel}
        </p>
      </div>
    </div>
  )
}
