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

  return (
    <div className="mt-2">
      <div
        role="tablist"
        aria-label={es ? 'Secciones del inicio' : 'Home sections'}
        className="flex items-center justify-center gap-1.5 mb-3"
      >
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
              className={`px-3.5 py-1.5 rounded-full text-[12px] font-bold transition-colors ${
                active
                  ? 'bg-blue-600 text-white'
                  : 'bg-gray-200 dark:bg-gray-800 text-gray-600 dark:text-gray-400'
              }`}
            >
              {es ? p.labelEs : p.labelEn}
            </button>
          )
        })}
      </div>

      <div
        ref={containerRef}
        className="flex overflow-x-auto -mx-4 scrollbar-hide overscroll-x-contain"
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
            className="px-4"
            style={{
              flex: '0 0 100%',
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
