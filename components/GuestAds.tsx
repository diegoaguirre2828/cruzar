'use client'

import { useAuth } from '@/lib/useAuth'
import { AdsenseBlock } from './AdsenseBlock'
import Link from 'next/link'

export function GuestAds() {
  const { user, loading } = useAuth()

  // Logged-in users never see ads
  if (loading || user) return null

  return (
    <div className="mb-4">
      <AdsenseBlock slot="1234567890" />
      <p className="text-center text-xs text-gray-400 mt-2">
        <Link href="/signup" className="text-gray-600 font-medium hover:underline">
          Create a free account
        </Link>{' '}
        to remove ads
      </p>
    </div>
  )
}
