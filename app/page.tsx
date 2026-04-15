import { HomeClient } from '@/components/HomeClient'
import { fetchRgvWaitTimes } from '@/lib/cbp'
import { fetchRecentReports, type RecentReport } from '@/lib/recentReports'
import type { PortWaitTime } from '@/types'

// ISR with a 30-second revalidation window. Vercel's edge caches the
// rendered HTML globally for 30s, so repeat visits + cold PWA launches
// hit the edge cache instead of re-rendering per request. The SWR
// service worker layer then pulls fresh /api/ports data into the
// rendered shell client-side within 1-2s of first paint — so the user
// sees numbers instantly and watches them update a second later,
// instead of staring at a blank screen while the server awaits CBP.
//
// PREVIOUS config was `dynamic = 'force-dynamic'` + `revalidate = 0`,
// which meant every request rendered fresh server-side AND awaited
// CBP's external API before sending any HTML. On border cell service
// that was 5-30s of blank screen. See also public/sw.js v5 which
// flips page navigations to cache-first.
export const revalidate = 30

// Hard 2.5s timeout on the server-side initial data fetch. If CBP or
// Supabase is slow, we ship the HTML shell with null/empty initial
// data and let the client hydrate via the /api/ports SWR layer. This
// was the other half of the perf bug: a slow CBP response would hang
// the entire server render.
async function withTimeout<T>(promise: Promise<T>, ms: number, fallback: T): Promise<T> {
  return Promise.race([
    promise,
    new Promise<T>((resolve) => setTimeout(() => resolve(fallback), ms)),
  ])
}

// Server component shell. Fetches everything the homepage needs in one
// parallel server pass — port list + recent reports — and hands them
// down as props. Collapses what used to be 4-6 separate client
// round-trips (ports, reports, urgent alerts, ticker, etc.) into a
// single server render. If either fetch fails or times out, the client
// components still refetch on their own — we never throw from here.
export default async function Page() {
  const [initialPorts, initialReports] = await Promise.all([
    withTimeout(
      fetchRgvWaitTimes().catch<PortWaitTime[] | null>(() => null),
      2500,
      null,
    ),
    withTimeout(
      fetchRecentReports().catch<RecentReport[]>(() => []),
      2500,
      [],
    ),
  ])
  return <HomeClient initialPorts={initialPorts} initialReports={initialReports} />
}
