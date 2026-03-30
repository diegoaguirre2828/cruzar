'use client'

import { useEffect } from 'react'

const ADSENSE_CLIENT = process.env.NEXT_PUBLIC_ADSENSE_CLIENT || ''

export function AdsenseBlock({ slot }: { slot: string }) {
  useEffect(() => {
    try {
      // @ts-expect-error adsbygoogle not typed
      ;(window.adsbygoogle = window.adsbygoogle || []).push({})
    } catch {}
  }, [])

  if (!ADSENSE_CLIENT) {
    return (
      <div className="bg-gray-100 border border-dashed border-gray-300 rounded-xl p-4 text-center">
        <p className="text-xs text-gray-400">Ad space</p>
      </div>
    )
  }

  return (
    <ins
      className="adsbygoogle"
      style={{ display: 'block' }}
      data-ad-client={ADSENSE_CLIENT}
      data-ad-slot={slot}
      data-ad-format="auto"
      data-full-width-responsive="true"
    />
  )
}
