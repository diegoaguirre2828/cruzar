'use client'

import { useEffect, useState } from 'react'
import Link from 'next/link'
import { useLang } from '@/lib/LangContext'
import { useAuth } from '@/lib/useAuth'
import { getPortMeta } from '@/lib/portMeta'

// Welcome-back reactions toast. Fires once per session for signed-in
// users when new upvotes have landed on their reports since their
// last visit. This is the "people reacted to your post" half of the
// FB-like posting loop — without it, upvotes happen silently and the
// reporter never finds out anyone acknowledged their contribution.
//
// Cheap implementation: stash a { reportId: upvoteCount } snapshot
// in localStorage after every check. On next visit, compare the
// current server totals against the stored snapshot and surface the
// delta. No push notifications required, works universally for any
// signed-in user regardless of PWA install state.

const LAST_SEEN_KEY = 'cruzar_reactions_last_seen_v1'
const SESSION_SHOWN_KEY = 'cruzar_reactions_shown_session'

interface Report {
  id: string
  port_id: string
  report_type: string
  upvotes: number
  created_at: string
}

interface Delta {
  totalNew: number
  topPortId: string | null
}

function loadLastSeen(): Record<string, number> {
  if (typeof window === 'undefined') return {}
  try {
    const raw = localStorage.getItem(LAST_SEEN_KEY)
    if (!raw) return {}
    const parsed = JSON.parse(raw)
    return parsed && typeof parsed === 'object' ? parsed : {}
  } catch {
    return {}
  }
}

function saveLastSeen(snapshot: Record<string, number>) {
  if (typeof window === 'undefined') return
  try {
    localStorage.setItem(LAST_SEEN_KEY, JSON.stringify(snapshot))
  } catch { /* ignore */ }
}

export function ReactionsWelcomeToast() {
  const { user } = useAuth()
  const { lang } = useLang()
  const es = lang === 'es'
  const [delta, setDelta] = useState<Delta | null>(null)
  const [dismissed, setDismissed] = useState(false)

  useEffect(() => {
    if (!user || typeof window === 'undefined') return
    // Only fire once per browser session to avoid nagging.
    try {
      if (sessionStorage.getItem(SESSION_SHOWN_KEY)) return
    } catch { /* ignore */ }

    let cancelled = false
    fetch('/api/user/reactions')
      .then((r) => r.ok ? r.json() : null)
      .then((d) => {
        if (cancelled || !d?.reports) return
        const reports = d.reports as Report[]
        const lastSeen = loadLastSeen()
        let totalNew = 0
        let topReport: { portId: string; delta: number } | null = null
        const nextSnapshot: Record<string, number> = {}
        for (const r of reports) {
          nextSnapshot[r.id] = r.upvotes || 0
          const prev = lastSeen[r.id] ?? 0
          const d = (r.upvotes || 0) - prev
          if (d > 0) {
            totalNew += d
            if (!topReport || d > topReport.delta) {
              topReport = { portId: r.port_id, delta: d }
            }
          }
        }
        // Save the snapshot regardless — if the user has seen the
        // reactions (toast fires or not), we don't want to surface
        // them again on the next visit.
        saveLastSeen(nextSnapshot)
        try { sessionStorage.setItem(SESSION_SHOWN_KEY, '1') } catch { /* ignore */ }
        if (totalNew > 0 && topReport) {
          setDelta({ totalNew, topPortId: topReport.portId })
        }
      })
      .catch(() => { /* silent */ })
    return () => { cancelled = true }
  }, [user])

  function dismiss() {
    setDismissed(true)
    setTimeout(() => setDelta(null), 200)
  }

  if (!delta || dismissed) return null

  const portName = delta.topPortId
    ? (getPortMeta(delta.topPortId).localName || delta.topPortId)
    : ''
  const href = delta.topPortId ? `/port/${encodeURIComponent(delta.topPortId)}` : '/leaderboard'

  return (
    <div
      className={`fixed left-3 right-3 z-40 md:left-auto md:right-4 md:max-w-sm transition-transform duration-200 ${dismissed ? '-translate-y-4 opacity-0' : 'translate-y-0 opacity-100'}`}
      style={{ top: 'calc(env(safe-area-inset-top) + 0.75rem)' }}
    >
      <Link
        href={href}
        onClick={dismiss}
        className="block bg-gradient-to-br from-emerald-500 to-teal-600 rounded-2xl px-4 py-3 shadow-2xl text-white relative overflow-hidden active:scale-[0.98] transition-transform"
      >
        <button
          type="button"
          onClick={(e) => { e.preventDefault(); dismiss() }}
          className="absolute top-1.5 right-2 text-white/70 hover:text-white text-xl leading-none"
          aria-label={es ? 'Cerrar' : 'Close'}
        >
          ×
        </button>
        <div className="flex items-center gap-3 pr-4">
          <span className="text-2xl leading-none flex-shrink-0">🙌</span>
          <div className="min-w-0 flex-1">
            <p className="text-sm font-black leading-tight">
              {delta.totalNew === 1
                ? (es ? 'Alguien te agradeció' : 'Someone thanked you')
                : (es ? `${delta.totalNew} personas te agradecieron` : `${delta.totalNew} people thanked you`)}
            </p>
            <p className="text-[11px] text-emerald-100 leading-snug truncate">
              {es
                ? `Tu reporte de ${portName} les ayudó a cruzar`
                : `Your ${portName} report helped them cross`}
            </p>
          </div>
        </div>
      </Link>
    </div>
  )
}
