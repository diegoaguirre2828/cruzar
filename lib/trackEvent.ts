// Client-side event tracker. Fires the Vercel Analytics event for
// real-time dashboard visibility AND writes to our own app_events
// table for queryable historical aggregation. Fully fire-and-forget —
// never blocks the caller, never throws.
//
// Usage:
//   trackEvent('iab_banner_shown', { platform: 'ios' })
//   trackEvent('report_submitted', { port_id: '535501', type: 'clear' })
//
// The Vercel Analytics side is still useful for the built-in
// dashboard / realtime view. The app_events side lets us build our
// own admin tiles that grow over time — "alert conversions per
// week", "IAB rescue rate trend", etc.

import { track as vercelTrack } from '@vercel/analytics'

const SESSION_ID_KEY = 'cruzar_session_id_v1'

function getSessionId(): string | null {
  if (typeof window === 'undefined') return null
  try {
    let id = sessionStorage.getItem(SESSION_ID_KEY)
    if (!id) {
      id = `${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 10)}`
      sessionStorage.setItem(SESSION_ID_KEY, id)
    }
    return id
  } catch {
    return null
  }
}

export function trackEvent(
  eventName: string,
  props?: Record<string, string | number | boolean | null | undefined>,
): void {
  if (typeof window === 'undefined') return

  // Fire-and-forget the Vercel Analytics side. Their own SDK is
  // already resilient to failures so no try/catch needed.
  try {
    // Vercel's track() accepts a flat props object with string/number/bool/null values.
    const vercelProps: Record<string, string | number | boolean | null> = {}
    if (props) {
      for (const [k, v] of Object.entries(props)) {
        if (v === undefined) continue
        vercelProps[k] = v as string | number | boolean | null
      }
    }
    vercelTrack(eventName, vercelProps)
  } catch { /* ignore */ }

  // Fire-and-forget the server write. keepalive so it survives a
  // subsequent page navigation that would otherwise cancel the fetch.
  try {
    fetch('/api/events/track', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        event_name: eventName,
        props: props || null,
        session_id: getSessionId(),
      }),
      keepalive: true,
    }).catch(() => { /* ignore */ })
  } catch { /* ignore */ }
}
