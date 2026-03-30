'use client'

import { useEffect, useState } from 'react'
import { useTier } from '@/lib/useTier'
import { AdsenseBlock } from './AdsenseBlock'
import { AdCard } from './AdCard'
import Link from 'next/link'

interface Ad {
  id: string
  title: string
  description: string | null
  cta_text: string
  cta_url: string | null
  image_url: string | null
  ad_type: string
}

export function GuestAds() {
  const { tier, loading } = useTier()
  const [localAd, setLocalAd] = useState<Ad | null>(null)

  // Fetch a local business ad for free users
  useEffect(() => {
    if (tier === 'free') {
      fetch('/api/ads')
        .then(r => r.json())
        .then(d => {
          if (d.ads?.length) setLocalAd(d.ads[0])
        })
        .catch(() => {})
    }
  }, [tier])

  if (loading) return null

  // Pro / Business — no ads ever
  if (tier === 'pro' || tier === 'business') return null

  // Free account — show local business ads only
  if (tier === 'free') {
    if (!localAd) return null
    return (
      <div className="mb-4">
        <AdCard ad={localAd} variant="banner" />
      </div>
    )
  }

  // Guest (no account) — full Google AdSense
  return (
    <div className="mb-4">
      <AdsenseBlock slot="1234567890" />
      <p className="text-center text-xs text-gray-400 mt-2">
        <Link href="/signup" className="text-gray-600 font-medium hover:underline">
          Create a free account
        </Link>{' '}
        to see local deals instead of ads
      </p>
    </div>
  )
}
