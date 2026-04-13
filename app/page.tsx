import { HomeClient } from '@/components/HomeClient'
import { fetchRgvWaitTimes } from '@/lib/cbp'
import { fetchRecentReports, type RecentReport } from '@/lib/recentReports'
import type { PortWaitTime } from '@/types'

export const dynamic = 'force-dynamic'
export const revalidate = 0

// Server component shell. Fetches everything the homepage needs in one
// parallel server pass — port list + recent reports — and hands them
// down as props. This collapses what used to be 4-6 separate client
// round-trips (ports, reports, urgent alerts, ticker, etc.) into a
// single server render. On a spotty border cell connection this is the
// difference between "broken skeletons everywhere" and "works the first
// time." If either fetch fails, the client components still refetch on
// their own — we never throw from here.
export default async function Page() {
  const [initialPorts, initialReports] = await Promise.all([
    fetchRgvWaitTimes().catch<PortWaitTime[] | null>(() => null),
    fetchRecentReports().catch<RecentReport[]>(() => []),
  ])
  return <HomeClient initialPorts={initialPorts} initialReports={initialReports} />
}
