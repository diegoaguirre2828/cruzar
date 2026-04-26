'use client'

import { useEffect, useState } from 'react'
import { Check, X } from 'lucide-react'
import { useLang } from '@/lib/LangContext'
import { trackEvent } from '@/lib/trackEvent'

// "Es correcto" / "No, fue X min" buttons under the wait number on
// port detail. Posts to /api/reports/confirm. Renders a small trust
// badge with rolling 30-min confirm/reject counts.
//
// Why this exists: Bordify's #1 review complaint is wait-time
// inaccuracy. Their patch is community confirmation. Cruzar can
// ship the same on top of better data (CBP + cameras + auto-
// crossing) and own the accuracy moat instead of just claiming it.

interface Props {
  portId: string
  cbpWait: number | null
}

interface Stats {
  confirms: number
  rejects: number
  trust: number | null
}

const REJECT_OPTIONS_MIN = [10, 20, 30, 45, 60, 90, 120]

export function WaitConfirmStrip({ portId, cbpWait }: Props) {
  const { lang } = useLang()
  const es = lang === 'es'
  const [stats, setStats] = useState<Stats | null>(null)
  const [voted, setVoted] = useState<'confirm' | 'reject' | null>(null)
  const [showRejectPicker, setShowRejectPicker] = useState(false)
  const [submitting, setSubmitting] = useState(false)

  // Fetch initial trust stats. Tolerate failure silently — strip just
  // hides the badge if the GET fails.
  useEffect(() => {
    let cancelled = false
    fetch(`/api/reports/confirm?portId=${encodeURIComponent(portId)}`)
      .then(r => r.ok ? r.json() : null)
      .then(d => { if (!cancelled && d) setStats({ confirms: d.confirms, rejects: d.rejects, trust: d.trust }) })
      .catch(() => { /* hide badge */ })
    return () => { cancelled = true }
  }, [portId])

  // Persist per-port "I voted" flag in sessionStorage so a tap lasts
  // the session but resets on next visit (CBP wait will have refreshed).
  useEffect(() => {
    try {
      const v = sessionStorage.getItem(`cruzar_wait_voted_${portId}`)
      if (v === 'confirm' || v === 'reject') setVoted(v)
    } catch { /* private browsing */ }
  }, [portId])

  async function castVote(accurate: boolean, actualWait: number | null = null) {
    if (submitting || cbpWait == null) return
    setSubmitting(true)
    try {
      const res = await fetch('/api/reports/confirm', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          portId,
          cbpWait,
          accurate,
          actualWait,
        }),
      })
      if (res.ok) {
        const v = accurate ? 'confirm' : 'reject'
        setVoted(v)
        try { sessionStorage.setItem(`cruzar_wait_voted_${portId}`, v) } catch {}
        trackEvent('wait_confirm_vote', { port_id: portId, accurate, actual_wait: actualWait })
        // Refresh stats to reflect the new vote
        fetch(`/api/reports/confirm?portId=${encodeURIComponent(portId)}`)
          .then(r => r.ok ? r.json() : null)
          .then(d => { if (d) setStats({ confirms: d.confirms, rejects: d.rejects, trust: d.trust }) })
          .catch(() => {})
      }
    } finally {
      setSubmitting(false)
      setShowRejectPicker(false)
    }
  }

  // Hide entirely when the port has no live wait — confirming "no data"
  // is not a useful action.
  if (cbpWait == null) return null

  const totalVotes = stats ? stats.confirms + stats.rejects : 0
  const trust = stats?.trust ?? null

  return (
    <div className="mt-3 flex flex-col gap-2">
      {/* Trust badge — appears when there's at least 1 vote in the window */}
      {totalVotes > 0 && stats && (
        <div className="flex items-center gap-2 text-xs text-gray-600 dark:text-gray-400">
          {trust != null && trust >= 60 && (
            <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full bg-emerald-50 dark:bg-emerald-900/20 text-emerald-700 dark:text-emerald-400 font-semibold">
              ✓ {trust}% {es ? 'confirmado' : 'confirmed'}
            </span>
          )}
          {trust != null && trust < 60 && (
            <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full bg-amber-50 dark:bg-amber-900/20 text-amber-700 dark:text-amber-400 font-semibold">
              ⚠ {es ? 'Espera real puede diferir' : 'Real wait may differ'}
            </span>
          )}
          <span className="text-[11px] text-gray-500">
            {stats.confirms} ✓ · {stats.rejects} ✗ {es ? 'en últimos 30 min' : 'in last 30 min'}
          </span>
        </div>
      )}

      {/* Voting buttons */}
      {voted ? (
        <div className="text-xs text-gray-500 dark:text-gray-400 italic">
          {voted === 'confirm'
            ? (es ? '✓ Tu confirmación cuenta — gracias' : '✓ Your confirmation counts — thanks')
            : (es ? '✗ Reportado — la próxima espera reflejará la realidad' : '✗ Reported — next wait will reflect reality')}
        </div>
      ) : showRejectPicker ? (
        <div className="flex flex-col gap-2">
          <div className="text-xs text-gray-600 dark:text-gray-400">
            {es ? '¿Cuántos minutos esperaste tú?' : 'How many minutes did you actually wait?'}
          </div>
          <div className="flex flex-wrap gap-1.5">
            {REJECT_OPTIONS_MIN.map(m => (
              <button
                key={m}
                type="button"
                disabled={submitting}
                onClick={() => castVote(false, m)}
                className="px-3 py-1.5 text-xs font-semibold rounded-lg bg-gray-100 dark:bg-gray-800 hover:bg-gray-200 dark:hover:bg-gray-700 text-gray-900 dark:text-gray-100 disabled:opacity-50"
              >
                {m} min
              </button>
            ))}
            <button
              type="button"
              disabled={submitting}
              onClick={() => castVote(false, null)}
              className="px-3 py-1.5 text-xs font-semibold rounded-lg bg-gray-200 dark:bg-gray-700 text-gray-700 dark:text-gray-300 disabled:opacity-50"
            >
              {es ? 'Solo rechazar' : 'Just reject'}
            </button>
            <button
              type="button"
              onClick={() => setShowRejectPicker(false)}
              className="px-3 py-1.5 text-xs text-gray-500 hover:text-gray-700"
            >
              {es ? 'Cancelar' : 'Cancel'}
            </button>
          </div>
        </div>
      ) : (
        <div className="flex items-center gap-2">
          <span className="text-xs text-gray-600 dark:text-gray-400 mr-1">
            {es ? '¿Es correcto?' : 'Accurate?'}
          </span>
          <button
            type="button"
            disabled={submitting}
            onClick={() => castVote(true)}
            className="inline-flex items-center gap-1 px-3 py-1.5 text-xs font-semibold rounded-lg bg-emerald-50 dark:bg-emerald-900/20 hover:bg-emerald-100 dark:hover:bg-emerald-900/30 text-emerald-700 dark:text-emerald-400 disabled:opacity-50"
            aria-label={es ? 'Confirmar tiempo' : 'Confirm wait time'}
          >
            <Check size={14} />
            {es ? 'Sí' : 'Yes'}
          </button>
          <button
            type="button"
            disabled={submitting}
            onClick={() => setShowRejectPicker(true)}
            className="inline-flex items-center gap-1 px-3 py-1.5 text-xs font-semibold rounded-lg bg-rose-50 dark:bg-rose-900/20 hover:bg-rose-100 dark:hover:bg-rose-900/30 text-rose-700 dark:text-rose-400 disabled:opacity-50"
            aria-label={es ? 'Reportar diferente' : 'Report different'}
          >
            <X size={14} />
            {es ? 'No' : 'No'}
          </button>
        </div>
      )}
    </div>
  )
}
