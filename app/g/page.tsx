'use client'

import { useEffect } from 'react'
import { useRouter } from 'next/navigation'
import { trackEvent } from '@/lib/trackEvent'

// Branded short-path for inbound traffic from FB group comments.
//
// Diego posts "cruzar punto app slash g" in FB group comments (the
// manual-spell workaround FB admins accept). Readers type
// cruzar.app/g into their browser, land here, get counted as
// fb-sourced in both Vercel Analytics (because /g is a distinct
// page hit) AND in app_events (via the trackEvent below), then
// navigate to home.
//
// Why not just /?s=fb: users would have to type the query string
// manually which nobody does. /g is 2 characters, easy to say
// verbally ("slash G"), and Vercel Analytics shows /g as its own
// row in the pages list so Diego can see the FB-comment traffic
// volume at a glance instead of it getting lumped into "Direct".
//
// /fb is reserved for OUTBOUND (follow our FB page). /g is INBOUND
// tracking from FB.

export default function SourceTagFbPage() {
  const router = useRouter()

  useEffect(() => {
    // Stamp localStorage so downstream signup attribution knows this
    // session came from a FB group comment. Persists through the
    // session until the user clears storage or it rotates out.
    try {
      localStorage.setItem('cruzar_source', 'fb')
      localStorage.setItem('cruzar_source_ts', String(Date.now()))
    } catch { /* ignore */ }
    trackEvent('inbound_source_tag', { source: 'fb', path: '/g' })
    router.replace('/')
  }, [router])

  return (
    <main className="min-h-screen flex items-center justify-center bg-gray-950 text-white">
      <p className="text-sm text-gray-400">Cruzar…</p>
    </main>
  )
}
