'use client'

import { useEffect, useRef, useState, type ReactNode } from 'react'
import { useLang } from '@/lib/LangContext'
import { trackEvent } from '@/lib/trackEvent'

// Three-panel horizontal-swipe home shell. Replaces the 25-section
// vertical stack that pushed the bridge list way below the fold.
//
// Default panel ("Cerca") is the bridge list scoped to the user's home
// region — the thing 90% of visitors came for. Swipe left/right reveals
// "Mi puente" (favorite hero + forecast + insights) and "Comunidad"
// (live activity, reports, regional snapshot, ads).
//
// Implementation notes:
//   - Native CSS scroll-snap. No swipe library, no touch listeners.
//     Works because every modern mobile browser does inertial pan on
//     overflow-x-auto containers.
//   - Each panel is `flex: 0 0 100%` so it pins to the parent's width
//     regardless of how wide the parent is (max-w-lg on desktop,
//     viewport on mobile).
//   - The container uses `-mx-4` to bleed past the parent's px-4
//     gutter so swipe gestures start from the screen edge. Each panel
//     re-applies `px-4` on its own content.
//   - The active panel is tracked via scroll position with a single
//     rAF-throttled handler; no IntersectionObserver needed.
//   - The dot/tab bar is the swipe affordance — tap to jump, watch
//     the active dot shift as you swipe.

export type PanelId = 'cerca' | 'mio' | 'comunidad'

export interface SwipePanel {
  id: PanelId
  labelEs: string
  labelEn: string
  content: ReactNode
}

interface Props {
  panels: SwipePanel[]
  initialPanel?: PanelId
}

export function HomeSwipe({ panels, initialPanel = 'cerca' }: Props) {
  const { lang } = useLang()
  const es = lang === 'es'
  const containerRef = useRef<HTMLDivElement>(null)
  const [activeIdx, setActiveIdx] = useState(() => {
    const idx = panels.findIndex((p) => p.id === initialPanel)
    return idx === -1 ? 0 : idx
  })

  useEffect(() => {
    const el = containerRef.current
    if (!el) return
    if (activeIdx === 0) return
    el.scrollTo({ left: activeIdx * el.clientWidth, behavior: 'auto' })
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  useEffect(() => {
    const el = containerRef.current
    if (!el) return
    let frame = 0
    let lastIdx = activeIdx
    const onScroll = () => {
      cancelAnimationFrame(frame)
      frame = requestAnimationFrame(() => {
        const w = el.clientWidth
        if (w === 0) return
        const idx = Math.round(el.scrollLeft / w)
        if (idx !== lastIdx && idx >= 0 && idx < panels.length) {
          lastIdx = idx
          setActiveIdx(idx)
          trackEvent('home_panel_changed', { panel: panels[idx].id, via: 'swipe' })
        }
      })
    }
    el.addEventListener('scroll', onScroll, { passive: true })
    return () => {
      el.removeEventListener('scroll', onScroll)
      cancelAnimationFrame(frame)
    }
  }, [panels])

  function jumpTo(idx: number) {
    const el = containerRef.current
    if (!el) return
    el.scrollTo({ left: idx * el.clientWidth, behavior: 'smooth' })
    trackEvent('home_panel_changed', { panel: panels[idx].id, via: 'tab' })
  }

  // Segmented control with a sliding indicator. The connected look reads
  // as ONE tabbed control rather than three independent nav pills, which
  // is the affordance Diego flagged was missing — users were forgetting
  // they could swipe between panels because the pills looked like filters
  // or nav links, not a paginator.
  const indicatorWidthPct = 100 / panels.length
  const indicatorOffsetPct = activeIdx * indicatorWidthPct

  return (
    <div className="mt-2">
      <div
        role="tablist"
        aria-label={es ? 'Secciones del inicio' : 'Home sections'}
        className="relative flex items-stretch bg-gray-100 dark:bg-gray-800/80 rounded-xl p-1 mb-2 mx-1"
      >
        {/* Sliding active-tab pill */}
        <div
          aria-hidden="true"
          className="absolute top-1 bottom-1 bg-white dark:bg-gray-700 rounded-lg shadow-sm transition-transform duration-200 ease-out"
          style={{
            width: `calc(${indicatorWidthPct}% - 0.25rem)`,
            transform: `translateX(calc(${indicatorOffsetPct}% + 0.125rem))`,
            left: 0,
          }}
        />
        {panels.map((p, i) => {
          const active = i === activeIdx
          return (
            <button
              key={p.id}
              type="button"
              role="tab"
              aria-selected={active}
              aria-controls={`home-panel-${p.id}`}
              onClick={() => jumpTo(i)}
              className={`relative z-10 flex-1 px-2 py-1.5 rounded-lg text-[12.5px] transition-colors ${
                active
                  ? 'text-gray-900 dark:text-gray-100 font-bold'
                  : 'text-gray-500 dark:text-gray-400 font-semibold hover:text-gray-700 dark:hover:text-gray-200'
              }`}
            >
              {es ? p.labelEs : p.labelEn}
            </button>
          )
        })}
      </div>

      {/* Page-position dots — redundant cue that this is a paginator. */}
      <div className="flex items-center justify-center gap-1.5 mb-3" aria-hidden="true">
        {panels.map((p, i) => (
          <span
            key={p.id}
            className={`block h-1 rounded-full transition-all duration-200 ${
              i === activeIdx
                ? 'w-5 bg-blue-600 dark:bg-blue-400'
                : 'w-1 bg-gray-300 dark:bg-gray-600'
            }`}
          />
        ))}
      </div>

      <div
        ref={containerRef}
        className="flex overflow-x-auto scrollbar-hide overscroll-x-contain"
        style={{
          scrollSnapType: 'x mandatory',
          WebkitOverflowScrolling: 'touch',
        }}
      >
        {panels.map((p) => (
          <section
            key={p.id}
            id={`home-panel-${p.id}`}
            role="tabpanel"
            aria-label={es ? p.labelEs : p.labelEn}
            style={{
              flex: '0 0 100%',
              width: '100%',
              minWidth: 0,
              maxWidth: '100%',
              boxSizing: 'border-box',
              overflowX: 'hidden',
              scrollSnapAlign: 'start',
              scrollSnapStop: 'always',
            }}
          >
            {p.content}
          </section>
        ))}
      </div>
    </div>
  )
}
