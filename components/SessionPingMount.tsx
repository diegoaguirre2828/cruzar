'use client'

import { useSessionPing } from '@/lib/useSessionPing'

export function SessionPingMount() {
  useSessionPing()
  return null
}
