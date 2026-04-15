'use client'

import { useEffect } from 'react'
import { useAuth } from './useAuth'
import { captureFingerprint } from './detectClient'

// Fires /api/user/touch exactly once per page load for signed-in users.
// Rate-limited via sessionStorage so if the user navigates between pages
// in a single session, we don't re-hit the endpoint. Data updates the
// last_seen_* columns on profiles so the admin panel can slice by
// device, OS, and install state. Guests are skipped — no data stored.

const SESSION_FLAG = 'cruzar_session_pinged_v1'

export function useSessionPing() {
  const { user, loading } = useAuth()

  useEffect(() => {
    if (loading || !user) return
    if (typeof window === 'undefined') return
    try {
      if (sessionStorage.getItem(SESSION_FLAG) === '1') return
      sessionStorage.setItem(SESSION_FLAG, '1')
    } catch { /* storage blocked — still ping */ }

    const fingerprint = captureFingerprint()
    fetch('/api/user/touch', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(fingerprint),
      keepalive: true,
    }).catch(() => { /* silent — not critical */ })
  }, [loading, user])
}
