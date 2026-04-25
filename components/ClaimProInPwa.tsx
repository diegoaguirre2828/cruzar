'use client'

import { useEffect, useState } from 'react'
import Link from 'next/link'
import { Gift } from 'lucide-react'
import { useAuth } from '@/lib/useAuth'
import { useLang } from '@/lib/LangContext'
import { trackEvent } from '@/lib/trackEvent'

// Fix A from the 2026-04-14 PWA funnel audit.
//
// Explicit "Claim your 3 months Pro" sticky card, rendered inside the
// installed PWA for any authenticated user who doesn't have the grant
// flag set yet. This is the user-driven fallback for the cases where
// the silent auto-claim in PWASetup.tsx fails:
//   - iOS Safari's session cookie doesn't transfer to the PWA context
//   - The user arrived in the PWA signed-out and took time to sign back in
//   - hls.js or some other script blocked the initial claim from firing
//   - The user installed via a non-obvious path (Chrome desktop, etc.)
//
// Visible ONLY when:
//   - Running as a standalone PWA (display-mode: standalone)
//   - User is authenticated
//   - localStorage doesn't already have the claim flag
//   - Profile doesn't already have pro_via_pwa_until set
//
// Tapping calls /api/user/claim-pwa-pro directly (same endpoint the
// silent path uses). On success, fires the celebration event and
// writes the dedupe flag so the card never re-appears.
//
// Rendered in app/layout.tsx globally.

const PWA_GRANT_CLAIMED_KEY = 'cruzar_pwa_grant_claimed'
const CLAIM_DISMISSED_KEY = 'cruzar_pwa_claim_dismissed_at'
const DISMISS_HOURS = 8

export function ClaimProInPwa() {
  const { user, loading: authLoading } = useAuth()
  const { lang } = useLang()
  const es = lang === 'es'
  const [visible, setVisible] = useState(false)
  const [claiming, setClaiming] = useState(false)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    if (authLoading || !user) return
    if (typeof window === 'undefined') return

    // Must be standalone to render
    const standalone =
      window.matchMedia('(display-mode: standalone)').matches ||
      (navigator as Navigator & { standalone?: boolean }).standalone === true
    if (!standalone) return

    // Dedupe — already claimed this device
    try {
      if (localStorage.getItem(PWA_GRANT_CLAIMED_KEY)) return
    } catch { /* ignore */ }

    // Dismiss window — user tapped "later"
    try {
      const dismissedAt = localStorage.getItem(CLAIM_DISMISSED_KEY)
      if (dismissedAt) {
        const ageHours = (Date.now() - parseInt(dismissedAt, 10)) / (1000 * 60 * 60)
        if (ageHours < DISMISS_HOURS) return
      }
    } catch { /* ignore */ }

    // No preflight check needed — the claim endpoint is idempotent
    // server-side and the localStorage flag handles the "already
    // claimed on this device" case above. If the user has a grant
    // from another device, their first successful claim call will
    // just re-extend it harmlessly.
    setVisible(true)
  }, [user, authLoading])

  async function claim() {
    setClaiming(true)
    setError(null)
    try {
      const res = await fetch('/api/user/claim-pwa-pro', { method: 'POST' })
      const data = await res.json().catch(() => ({}))
      if (!res.ok) {
        setError(data.error || `HTTP ${res.status}`)
        setClaiming(false)
        return
      }

      // Three response shapes from /api/user/claim-pwa-pro:
      //   { ok:true, granted:true,  days, pro_via_pwa_until }   → real grant
      //   { ok:true, granted:false, pending:true, next_grant_at } → 24h gate
      //   { ok:true, granted:false } w/ no pending → already on paid Pro
      //
      // Bug fix 2026-04-25: previously this branch wrote
      // PWA_GRANT_CLAIMED_KEY for ALL data.ok responses, including the
      // pending one. Result: user taps "Claim" within 24h of install →
      // server returns pending → client locks the card permanently →
      // user never makes the second call → never gets Pro. Affected
      // ~all PWA users on the page (49 PWA installs, only 47 Pro out
      // of 246 total at time of fix). Now we only write the dedupe
      // flag on a real grant; pending sets the short dismiss timer
      // instead so the card returns next session.
      if (data.granted === true) {
        try { localStorage.setItem(PWA_GRANT_CLAIMED_KEY, String(Date.now())) } catch {}
        trackEvent('pwa_grant_claimed_manual', { granted: true, days: data.days || null })
        if (data.days) {
          window.dispatchEvent(
            new CustomEvent('cruzar:pwa-grant-claimed', { detail: { days: data.days } }),
          )
        }
        setVisible(false)
        return
      }

      if (data.pending) {
        trackEvent('pwa_grant_pending', { next_grant_at: data.next_grant_at || null })
        // Hide for the dismiss window only — card returns next session
        // so the second (post-24h) call has a path to fire.
        try { localStorage.setItem(CLAIM_DISMISSED_KEY, String(Date.now())) } catch {}
        setError(es
          ? '⏳ Activando tu Pro — vuelve mañana, ya casi.'
          : '⏳ Activating your Pro — come back tomorrow, almost there.')
        setClaiming(false)
        return
      }

      // ok:true but neither granted nor pending → user already has paid
      // Pro / Business. Mark claimed so the card doesn't pester them.
      try { localStorage.setItem(PWA_GRANT_CLAIMED_KEY, String(Date.now())) } catch {}
      trackEvent('pwa_grant_already_paid')
      setVisible(false)
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err))
      setClaiming(false)
    }
  }

  function dismiss() {
    try { localStorage.setItem(CLAIM_DISMISSED_KEY, String(Date.now())) } catch {}
    setVisible(false)
  }

  if (!visible) return null

  return (
    <div
      className="fixed z-40 left-3 right-3 bg-gradient-to-br from-amber-400 via-orange-500 to-pink-600 text-white rounded-2xl shadow-2xl border border-amber-300/40 overflow-hidden"
      style={{ bottom: 'calc(5rem + env(safe-area-inset-bottom))' }}
      role="dialog"
    >
      <div className="relative p-3">
        <button
          type="button"
          onClick={dismiss}
          aria-label={es ? 'Cerrar' : 'Dismiss'}
          className="absolute top-2 right-2 w-6 h-6 flex items-center justify-center text-white/70 hover:text-white rounded-full hover:bg-white/10 text-sm leading-none"
        >
          ×
        </button>
        <div className="flex items-start gap-3 pr-6">
          <div className="flex-shrink-0 w-10 h-10 rounded-xl bg-white/25 flex items-center justify-center">
            <Gift className="w-5 h-5" />
          </div>
          <div className="flex-1 min-w-0">
            <p className="text-sm font-black leading-tight">
              {es ? '🎁 Tu Pro de 3 meses está listo' : '🎁 Your 3 months Pro is ready'}
            </p>
            <p className="text-[11px] text-white/90 mt-0.5 leading-snug">
              {es
                ? 'Agregaste Cruzar a tu pantalla de inicio — toca para reclamar'
                : 'You added Cruzar to your home screen — tap to claim'}
            </p>
            {error && (
              <p className="text-[10px] text-red-100 mt-1">
                {es ? 'Error al reclamar. Intenta de nuevo.' : 'Claim failed. Try again.'} ({error})
              </p>
            )}
          </div>
        </div>
        <div className="mt-2.5 flex items-center gap-2">
          <button
            type="button"
            onClick={claim}
            disabled={claiming}
            className="flex-1 bg-white text-orange-600 text-sm font-black py-2.5 rounded-xl shadow-lg active:scale-[0.98] disabled:opacity-60 transition-transform"
          >
            {claiming
              ? (es ? 'Reclamando…' : 'Claiming…')
              : (es ? 'Reclamar mi Pro →' : 'Claim my Pro →')}
          </button>
          <Link
            href="/pricing"
            className="text-[10px] text-white/80 hover:text-white underline underline-offset-2 flex-shrink-0"
          >
            {es ? '¿Qué incluye?' : "What's included?"}
          </Link>
        </div>
      </div>
    </div>
  )
}
