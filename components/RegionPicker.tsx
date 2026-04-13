'use client'

import { useState } from 'react'
import { MapPin, Check } from 'lucide-react'
import { useHomeRegion, MEGA_REGIONS, MEGA_REGION_LABELS } from '@/lib/useHomeRegion'
import { useLang } from '@/lib/LangContext'
import type { MegaRegion } from '@/lib/portMeta'

// Small pill in the home-page header row that shows the user's
// current home region and opens a bottom-sheet selector when tapped.
// Tapping a region writes to localStorage + profile (if signed in)
// and immediately re-filters the home list + map below.
//
// Design goals:
//   - One tap to open, one tap to select. No nested menus.
//   - "Show all border" option at the top so users who WANT the
//     full picture aren't locked out.
//   - Bilingual labels from MEGA_REGION_LABELS.

export function RegionPicker() {
  const { lang } = useLang()
  const { homeRegion, setHomeRegion, loading } = useHomeRegion()
  const [open, setOpen] = useState(false)
  const es = lang === 'es'

  if (loading) {
    return (
      <div className="inline-flex items-center gap-1 bg-gray-100 dark:bg-gray-800 rounded-full px-2.5 py-1 text-[11px] font-semibold text-gray-400">
        <MapPin className="w-3 h-3" />
        <span>…</span>
      </div>
    )
  }

  const currentLabel = homeRegion
    ? MEGA_REGION_LABELS[homeRegion].short
    : (es ? 'Toda la frontera' : 'All border')

  return (
    <>
      <button
        onClick={() => setOpen(true)}
        className="inline-flex items-center gap-1 bg-blue-50 dark:bg-blue-900/30 border border-blue-200 dark:border-blue-800 rounded-full px-2.5 py-1 text-[11px] font-bold text-blue-700 dark:text-blue-300 active:scale-95 transition-transform"
      >
        <MapPin className="w-3 h-3" />
        <span>{currentLabel}</span>
        <span className="text-blue-400 dark:text-blue-500">▾</span>
      </button>

      {open && (
        <div
          className="fixed inset-0 z-[70] flex items-end md:items-center justify-center bg-black/60 backdrop-blur-sm"
          role="dialog"
          aria-modal="true"
          onClick={() => setOpen(false)}
        >
          <div
            className="w-full max-w-sm bg-white dark:bg-gray-900 rounded-t-3xl md:rounded-3xl shadow-2xl relative overflow-hidden"
            onClick={(e) => e.stopPropagation()}
            style={{ paddingBottom: 'env(safe-area-inset-bottom)' }}
          >
            <div className="p-5">
              <div className="flex items-center justify-between mb-1">
                <h2 className="text-base font-black text-gray-900 dark:text-gray-100">
                  {es ? '¿Dónde cruzas?' : 'Where do you cross?'}
                </h2>
                <button
                  onClick={() => setOpen(false)}
                  className="text-xs font-semibold text-gray-400 hover:text-gray-600 dark:hover:text-gray-300"
                >
                  ✕
                </button>
              </div>
              <p className="text-xs text-gray-500 dark:text-gray-400 mb-4 leading-snug">
                {es
                  ? 'Te mostramos solo los puentes de tu zona. Puedes cambiarlo en cualquier momento.'
                  : "We'll only show you bridges in your area. You can change this anytime."}
              </p>

              <div className="space-y-1">
                <button
                  onClick={() => { setHomeRegion(null); setOpen(false) }}
                  className={`w-full flex items-center justify-between gap-2 px-3 py-3 rounded-2xl border-2 text-left transition-colors ${
                    homeRegion === null
                      ? 'border-blue-500 bg-blue-50 dark:bg-blue-900/30'
                      : 'border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-800 hover:bg-gray-50 dark:hover:bg-gray-700'
                  }`}
                >
                  <div className="min-w-0">
                    <p className="text-sm font-bold text-gray-900 dark:text-gray-100">
                      🌎 {es ? 'Toda la frontera' : 'All border'}
                    </p>
                    <p className="text-[11px] text-gray-500 dark:text-gray-400 mt-0.5">
                      {es ? '52 cruces · de Baja al Valle' : '52 crossings · Baja to RGV'}
                    </p>
                  </div>
                  {homeRegion === null && <Check className="w-4 h-4 text-blue-600 flex-shrink-0" />}
                </button>

                {MEGA_REGIONS.filter(r => r !== 'other').map(r => {
                  const meta = MEGA_REGION_LABELS[r]
                  const isSel = homeRegion === r
                  return (
                    <button
                      key={r}
                      onClick={() => { setHomeRegion(r); setOpen(false) }}
                      className={`w-full flex items-center justify-between gap-2 px-3 py-3 rounded-2xl border-2 text-left transition-colors ${
                        isSel
                          ? 'border-blue-500 bg-blue-50 dark:bg-blue-900/30'
                          : 'border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-800 hover:bg-gray-50 dark:hover:bg-gray-700'
                      }`}
                    >
                      <div className="min-w-0">
                        <p className="text-sm font-bold text-gray-900 dark:text-gray-100">
                          {es ? meta.es : meta.en}
                        </p>
                      </div>
                      {isSel && <Check className="w-4 h-4 text-blue-600 flex-shrink-0" />}
                    </button>
                  )
                })}
              </div>
            </div>
          </div>
        </div>
      )}
    </>
  )
}
