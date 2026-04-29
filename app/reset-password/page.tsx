'use client'

import { useState } from 'react'
import Link from 'next/link'
import { createClient } from '@/lib/auth'
import { ArrowLeft } from 'lucide-react'
import { BridgeLogo } from '@/components/BridgeLogo'

export default function ResetPasswordPage() {
  const [email, setEmail] = useState('')
  const [sent, setSent] = useState(false)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')

  async function handleReset(e: React.FormEvent) {
    e.preventDefault()
    setLoading(true)
    setError('')
    const supabase = createClient()
    const { error } = await supabase.auth.resetPasswordForEmail(email, {
      redirectTo: `${window.location.origin}/account`,
    })
    if (error) setError(error.message)
    else setSent(true)
    setLoading(false)
  }

  return (
    <main className="min-h-screen bg-gray-50 flex items-center justify-center px-4">
      <div className="w-full max-w-sm">
        <div className="text-center mb-8">
          <h1 className="text-2xl font-bold text-gray-900 inline-flex items-center gap-2"><BridgeLogo size={28} /> Cruzar</h1>
          <p className="text-sm text-gray-500 mt-1">Reset your password</p>
        </div>

        {sent ? (
          <div className="bg-white rounded-2xl border border-gray-200 p-6 shadow-sm text-center">
            <p className="text-2xl mb-3">📬</p>
            <p className="font-semibold text-gray-900">Check your email</p>
            <p className="text-sm text-gray-500 mt-2">We sent a reset link to <strong>{email}</strong></p>
            <Link href="/login" className="inline-block mt-5 text-sm text-blue-600 hover:underline">
              Back to sign in
            </Link>
          </div>
        ) : (
          <form onSubmit={handleReset} className="bg-white rounded-2xl border border-gray-200 p-6 shadow-sm space-y-4">
            {error && (
              <div className="bg-red-50 border border-red-200 text-red-600 text-sm rounded-xl px-4 py-3">{error}</div>
            )}
            <div>
              <label className="block text-xs font-medium text-gray-700 mb-1">Email address</label>
              <input
                type="email"
                value={email}
                onChange={e => setEmail(e.target.value)}
                required
                className="w-full border border-gray-200 rounded-xl px-3 py-2.5 text-sm text-gray-900 focus:outline-none focus:ring-2 focus:ring-blue-500"
                placeholder="you@email.com"
              />
            </div>
            <button
              type="submit"
              disabled={loading}
              className="w-full bg-gray-900 text-white text-sm font-medium py-3 rounded-xl hover:bg-gray-700 transition-colors disabled:opacity-50"
            >
              {loading ? 'Sending...' : 'Send Reset Link'}
            </button>
            <Link href="/login" className="flex items-center justify-center gap-1 text-xs text-gray-400 hover:text-gray-700">
              <ArrowLeft className="w-3 h-3" /> Back to sign in
            </Link>
          </form>
        )}
      </div>
    </main>
  )
}
