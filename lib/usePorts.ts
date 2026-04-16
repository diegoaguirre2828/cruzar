'use client'

import useSWR from 'swr'
import type { PortWaitTime } from '@/types'

const fetcher = (url: string) =>
  fetch(url, { cache: 'no-store' })
    .then((r) => r.json())
    .then((d) => (d.ports || []) as PortWaitTime[])

// Shared SWR hook for port data. Every component that calls usePorts()
// shares the SAME cached data — navigating between tabs doesn't
// re-fetch. SWR deduplicates in-flight requests automatically.
//
// - dedupingInterval: 30s — won't re-fetch if data is <30s old
// - revalidateOnFocus: true — fresh data when user comes back to tab
// - keepPreviousData: true — old data stays visible during revalidation
export function usePorts() {
  const { data, error, isLoading, mutate } = useSWR<PortWaitTime[]>(
    '/api/ports',
    fetcher,
    {
      dedupingInterval: 30_000,
      revalidateOnFocus: true,
      keepPreviousData: true,
      refreshInterval: 60_000,
      fallbackData: [],
    },
  )

  return {
    ports: data ?? [],
    loading: isLoading,
    error,
    refresh: mutate,
  }
}
