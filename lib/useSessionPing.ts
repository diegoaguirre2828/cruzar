'use client'

import { useEffect } from 'react'
import { useAuth } from './useAuth'
import { captureFingerprint } from './detectClient'

// Per-session presence ping for signed-in users. Two modes, both
// hitting /api/user/touch (which upserts last_seen_at + device fields):
//
//   1. Initial ping on mount — gated by sessionStorage so navigating
//      between pages in the same tab doesn't re-fire it.
//   2. Heartbeat every 60s while the tab is visible. Pauses when
//      hidden (visibilitychange) and fires immediately when the user
//      returns. Lets the admin panel compute real session duration
//      from the spread between first_seen_at and last_seen_at, instead
//      of the broken "always 0-5s" you got when the touch only fired
//      once per session.
//
// Module-level guard so multiple mounts of useSessionPing in the same
// tab (LazyGlobalOverlays + HomeClient both call it) don't spawn
// duplicate intervals. The interval lives for the tab lifetime;
// LazyGlobalOverlays never unmounts during normal navigation.

const SESSION_FLAG = 'cruzar_session_pinged_v1'
const HEARTBEAT_MS = 60 * 1000

let heartbeatStarted = false

function fireTouch(fingerprint: ReturnType<typeof captureFingerprint>) {
  fetch('/api/user/touch', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(fingerprint),
    keepalive: true,
  }).catch(() => { /* silent — not critical */ })
}

export function useSessionPing() {
  const { user, loading } = useAuth()

  useEffect(() => {
    if (loading || !user) return
    if (typeof window === 'undefined') return

    const fingerprint = captureFingerprint()

    // Initial ping (sessionStorage-gated against duplicate page mounts)
    let didInitialPing = false
    try {
      if (sessionStorage.getItem(SESSION_FLAG) !== '1') {
        sessionStorage.setItem(SESSION_FLAG, '1')
        fireTouch(fingerprint)
        didInitialPing = true
      }
    } catch {
      // sessionStorage blocked (private browsing) — fire anyway
      fireTouch(fingerprint)
      didInitialPing = true
    }

    // Heartbeat — module-level guard so we only start one interval per
    // tab regardless of how many components mount this hook.
    if (heartbeatStarted) return
    heartbeatStarted = true

    let heartbeat: ReturnType<typeof setInterval> | null = null
    const startHeartbeat = () => {
      if (heartbeat) return
      heartbeat = setInterval(() => {
        if (document.visibilityState === 'visible') {
          fireTouch(fingerprint)
        }
      }, HEARTBEAT_MS)
    }
    const stopHeartbeat = () => {
      if (!heartbeat) return
      clearInterval(heartbeat)
      heartbeat = null
    }

    if (document.visibilityState === 'visible') startHeartbeat()

    const onVisibilityChange = () => {
      if (document.visibilityState === 'visible') {
        // User came back to the tab — fire immediately so the admin
        // panel sees activity, then resume the cadence.
        if (!didInitialPing) {
          // Only happens on tabs that started hidden; rare path
          fireTouch(fingerprint)
        } else {
          fireTouch(fingerprint)
        }
        startHeartbeat()
      } else {
        stopHeartbeat()
      }
    }
    document.addEventListener('visibilitychange', onVisibilityChange)

    // No cleanup — the heartbeat is intentionally tab-lifetime. The
    // wrapping component (LazyGlobalOverlays) never unmounts during
    // navigation. If it ever does, the next mount sees
    // heartbeatStarted=true and no-ops, which is fine but means a
    // remount-after-unmount tab won't get heartbeats. Accept the
    // tradeoff to keep the implementation simple.
  }, [loading, user])
}
