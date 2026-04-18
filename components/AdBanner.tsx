'use client'

import { useEffect, useRef } from 'react'
import { useTier } from '@/lib/useTier'

// Render-safe AdSense banner. Self-noops under any of:
//   1. Pro or Business tier — paying users never see ads.
//   2. Standalone PWA — paid-via-PWA users also skip ads.
//   3. Missing NEXT_PUBLIC_ADSENSE_CLIENT env var.
//   4. Missing slot prop (each placement has its own env-configured slot).
//
// The global <script src="adsbygoogle.js"> lives in app/layout.tsx,
// gated on NEXT_PUBLIC_ADSENSE_CLIENT. This component renders the per-
// placement <ins> tag and pushes it into Google's queue on mount.
//
// When Diego adds ad slot IDs in Vercel env (NEXT_PUBLIC_ADSENSE_SLOT_*),
// the corresponding placements light up automatically.

interface Props {
  slot: string | undefined
  format?: 'auto' | 'fluid' | 'rectangle'
  layout?: 'in-article' | 'in-feed'
  className?: string
}

declare global {
  interface Window {
    adsbygoogle?: unknown[]
  }
}

export function AdBanner({ slot, format = 'auto', layout, className = '' }: Props) {
  const { tier } = useTier()
  const pushed = useRef(false)
  const client = process.env.NEXT_PUBLIC_ADSENSE_CLIENT

  useEffect(() => {
    if (!client || !slot) return
    if (tier === 'pro' || tier === 'business') return
    if (pushed.current) return
    try {
      ;(window.adsbygoogle = window.adsbygoogle || []).push({})
      pushed.current = true
    } catch {
      /* adsense not ready yet — ignore */
    }
  }, [client, slot, tier])

  if (!client || !slot) return null
  if (tier === 'pro' || tier === 'business') return null

  return (
    <ins
      className={`adsbygoogle block ${className}`}
      style={{ display: 'block' }}
      data-ad-client={client}
      data-ad-slot={slot}
      data-ad-format={format}
      data-ad-layout={layout}
      data-full-width-responsive="true"
    />
  )
}
