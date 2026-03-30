'use client'

import Link from 'next/link'
import { useAuth } from '@/lib/useAuth'
import { User, Truck } from 'lucide-react'

export function NavBar() {
  const { user, loading } = useAuth()
  if (loading) return null

  return (
    <div className="flex items-center gap-2 mt-1">
      <Link href="/advertise" className="text-xs font-medium text-amber-600 hover:text-amber-700 transition-colors">
        Local business?
      </Link>
      {user ? (
        <>
          <Link
            href="/dashboard"
            className="flex items-center gap-1 text-xs font-medium text-white bg-gray-900 px-3 py-1.5 rounded-xl hover:bg-gray-700 transition-colors"
          >
            <User className="w-3 h-3" /> Me
          </Link>
        </>
      ) : (
        <Link
          href="/signup"
          className="text-xs font-medium text-white bg-gray-900 px-3 py-1.5 rounded-xl hover:bg-gray-700 transition-colors"
        >
          Sign Up Free
        </Link>
      )}
    </div>
  )
}
