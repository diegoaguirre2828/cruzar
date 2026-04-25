'use client'

import { useEffect, useState } from 'react'
import { useLang } from '@/lib/LangContext'
import { PORT_META } from '@/lib/portMeta'
import { Star, X } from 'lucide-react'

// Soft prompt for logged-in users without a favorite_port_id set.
// Shows a thin banner with a quick-pick of the 4 RGV bridges (the
// dominant Cruzar audience) + a "see all" expand. Once the user picks,
// the FavoriteHero component takes over the top of their home page.
//
// Sessionstorage dismiss flag keeps this from being annoying — if the
// user closes it, it stays gone for the day.

const QUICK_PICKS = [
  '230501', // Hidalgo
  '230502', // Pharr
  '230503', // Anzaldúas
  '535502', // Brownsville Los Tomates
  '535504', // Brownsville Gateway
  '230402', // Laredo II
  '230404', // Laredo World Trade
]

interface Props {
  user: { id: string } | null
  ports: Array<{ port_id: string }>
}

export function SetFavoriteBanner({ user, ports }: Props) {
  const { lang } = useLang()
  const [hasFavorite, setHasFavorite] = useState<boolean | null>(null)
  const [dismissed, setDismissed] = useState(false)
  const [saving, setSaving] = useState(false)
  const [expanded, setExpanded] = useState(false)

  useEffect(() => {
    if (!user) { setHasFavorite(null); return }
    if (typeof window !== 'undefined') {
      const dayKey = `set_fav_dismissed_${new Date().toDateString()}`
      if (sessionStorage.getItem(dayKey)) { setDismissed(true); return }
    }
    fetch('/api/profile')
      .then((r) => r.json())
      .then((d) => setHasFavorite(!!d?.profile?.favorite_port_id))
      .catch(() => setHasFavorite(false))
  }, [user])

  if (!user || dismissed || hasFavorite !== false) return null

  async function pick(portId: string) {
    setSaving(true)
    await fetch('/api/profile', {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ favorite_port_id: portId }),
    })
    setSaving(false)
    setHasFavorite(true)
    // Force the FavoriteHero to re-fetch by reloading. Cheap and bulletproof.
    if (typeof window !== 'undefined') window.location.reload()
  }

  function dismiss() {
    if (typeof window !== 'undefined') {
      sessionStorage.setItem(`set_fav_dismissed_${new Date().toDateString()}`, '1')
    }
    setDismissed(true)
  }

  // Build option list — quick picks first, then any other port in the
  // initial data that wasn't in quick picks (when expanded).
  const portIdSet = new Set(ports.map((p) => p.port_id))
  const quickAvailable = QUICK_PICKS.filter((id) => portIdSet.has(id))
  const otherIds = ports.map((p) => p.port_id).filter((id) => !quickAvailable.includes(id))
  const visible = expanded ? [...quickAvailable, ...otherIds] : quickAvailable.slice(0, 4)

  return (
    <div className="mb-4 bg-blue-50 dark:bg-blue-900/20 border border-blue-200 dark:border-blue-800 rounded-2xl p-4">
      <div className="flex items-start justify-between gap-2 mb-3">
        <div className="flex items-start gap-2">
          <Star className="w-4 h-4 text-blue-600 dark:text-blue-400 mt-0.5 flex-shrink-0" />
          <div>
            <p className="text-sm font-bold text-blue-800 dark:text-blue-300">
              {lang === 'es' ? 'Elige tu puente para una página personalizada' : 'Pick your bridge for a personalized home'}
            </p>
            <p className="text-xs text-blue-600 dark:text-blue-400 mt-0.5">
              {lang === 'es'
                ? 'Te ahorramos el desplazamiento — siempre arriba.'
                : 'We pin it to the top so you skip the scroll.'}
            </p>
          </div>
        </div>
        <button onClick={dismiss} aria-label="Dismiss" className="text-blue-300 hover:text-blue-500">
          <X className="w-4 h-4" />
        </button>
      </div>
      <div className="grid grid-cols-2 gap-1.5">
        {visible.map((id) => {
          const meta = PORT_META[id]
          if (!meta) return null
          const label = meta.localName || meta.city
          return (
            <button
              key={id}
              onClick={() => pick(id)}
              disabled={saving}
              className="text-xs font-semibold py-2 px-2 rounded-lg bg-white dark:bg-gray-800 border border-blue-200 dark:border-blue-700 text-blue-800 dark:text-blue-300 hover:bg-blue-100 dark:hover:bg-blue-900/30 disabled:opacity-50 text-left truncate"
            >
              {label}
            </button>
          )
        })}
      </div>
      {!expanded && otherIds.length > 0 && (
        <button
          onClick={() => setExpanded(true)}
          className="mt-2 text-xs font-semibold text-blue-700 dark:text-blue-400 hover:underline"
        >
          {lang === 'es' ? 'Ver todos los puentes →' : 'See all bridges →'}
        </button>
      )}
    </div>
  )
}
