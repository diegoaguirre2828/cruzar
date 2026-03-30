'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { createClient } from '@/lib/auth'

type Step = 'idle' | 'entering_phone' | 'entering_otp' | 'loading'

export function PhoneButton({ label = 'Continue with Phone' }: { label?: string }) {
  const router = useRouter()
  const [step, setStep] = useState<Step>('idle')
  const [phone, setPhone] = useState('')
  const [otp, setOtp] = useState('')
  const [error, setError] = useState('')

  async function sendOtp(e: React.FormEvent) {
    e.preventDefault()
    setError('')
    setStep('loading')
    const supabase = createClient()
    // Normalize: strip spaces/dashes, ensure + prefix
    const normalized = phone.replace(/[\s\-\(\)]/g, '')
    const withPlus = normalized.startsWith('+') ? normalized : `+1${normalized}`
    const { error } = await supabase.auth.signInWithOtp({ phone: withPlus })
    if (error) {
      setError(error.message)
      setStep('entering_phone')
    } else {
      setStep('entering_otp')
    }
  }

  async function verifyOtp(e: React.FormEvent) {
    e.preventDefault()
    setError('')
    setStep('loading')
    const supabase = createClient()
    const normalized = phone.replace(/[\s\-\(\)]/g, '')
    const withPlus = normalized.startsWith('+') ? normalized : `+1${normalized}`
    const { error } = await supabase.auth.verifyOtp({
      phone: withPlus,
      token: otp,
      type: 'sms',
    })
    if (error) {
      setError(error.message)
      setStep('entering_otp')
    } else {
      router.push('/dashboard')
    }
  }

  if (step === 'idle') {
    return (
      <button
        type="button"
        onClick={() => setStep('entering_phone')}
        className="w-full flex items-center justify-center gap-3 bg-white border border-gray-200 text-gray-700 text-sm font-medium py-2.5 rounded-xl hover:bg-gray-50 transition-colors shadow-sm"
      >
        <svg className="w-4 h-4 text-gray-500" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.8}>
          <path strokeLinecap="round" strokeLinejoin="round" d="M2.25 6.75c0 8.284 6.716 15 15 15h2.25a2.25 2.25 0 0 0 2.25-2.25v-1.372c0-.516-.351-.966-.852-1.091l-4.423-1.106c-.44-.11-.902.055-1.173.417l-.97 1.293c-.282.376-.769.542-1.21.38a12.035 12.035 0 0 1-7.143-7.143c-.162-.441.004-.928.38-1.21l1.293-.97c.363-.271.527-.734.417-1.173L6.963 3.102a1.125 1.125 0 0 0-1.091-.852H4.5A2.25 2.25 0 0 0 2.25 4.5v2.25Z" />
        </svg>
        {label}
      </button>
    )
  }

  if (step === 'entering_phone') {
    return (
      <form onSubmit={sendOtp} className="space-y-3">
        {error && (
          <p className="text-xs text-red-600 bg-red-50 border border-red-200 rounded-xl px-3 py-2">{error}</p>
        )}
        <div>
          <label className="block text-xs font-medium text-gray-700 mb-1">Phone number</label>
          <input
            type="tel"
            value={phone}
            onChange={e => setPhone(e.target.value)}
            required
            autoFocus
            className="w-full border border-gray-200 rounded-xl px-3 py-2.5 text-sm text-gray-900 focus:outline-none focus:ring-2 focus:ring-blue-500"
            placeholder="+1 (555) 000-0000 or +52 ..."
          />
          <p className="text-xs text-gray-400 mt-1">Include country code: +1 for US, +52 for Mexico</p>
        </div>
        <div className="flex gap-2">
          <button
            type="button"
            onClick={() => { setStep('idle'); setPhone(''); setError('') }}
            className="flex-1 border border-gray-200 text-gray-600 text-sm font-medium py-2.5 rounded-xl hover:bg-gray-50 transition-colors"
          >
            Cancel
          </button>
          <button
            type="submit"
            className="flex-1 bg-gray-900 text-white text-sm font-medium py-2.5 rounded-xl hover:bg-gray-700 transition-colors"
          >
            Send Code
          </button>
        </div>
      </form>
    )
  }

  if (step === 'entering_otp') {
    return (
      <form onSubmit={verifyOtp} className="space-y-3">
        <p className="text-xs text-gray-500 text-center">
          We sent a 6-digit code to <strong className="text-gray-800">{phone}</strong>
        </p>
        {error && (
          <p className="text-xs text-red-600 bg-red-50 border border-red-200 rounded-xl px-3 py-2">{error}</p>
        )}
        <div>
          <label className="block text-xs font-medium text-gray-700 mb-1">Verification code</label>
          <input
            type="text"
            inputMode="numeric"
            pattern="[0-9]*"
            maxLength={6}
            value={otp}
            onChange={e => setOtp(e.target.value.replace(/\D/g, ''))}
            required
            autoFocus
            className="w-full border border-gray-200 rounded-xl px-3 py-2.5 text-sm text-gray-900 tracking-widest text-center font-mono focus:outline-none focus:ring-2 focus:ring-blue-500"
            placeholder="000000"
          />
        </div>
        <div className="flex gap-2">
          <button
            type="button"
            onClick={() => { setStep('entering_phone'); setOtp(''); setError('') }}
            className="flex-1 border border-gray-200 text-gray-600 text-sm font-medium py-2.5 rounded-xl hover:bg-gray-50 transition-colors"
          >
            Back
          </button>
          <button
            type="submit"
            className="flex-1 bg-gray-900 text-white text-sm font-medium py-2.5 rounded-xl hover:bg-gray-700 transition-colors"
          >
            Verify
          </button>
        </div>
        <button
          type="button"
          onClick={sendOtp as unknown as React.MouseEventHandler}
          className="w-full text-xs text-blue-600 hover:underline text-center"
        >
          Resend code
        </button>
      </form>
    )
  }

  // loading
  return (
    <div className="w-full flex items-center justify-center py-2.5 text-sm text-gray-500">
      <svg className="animate-spin w-4 h-4 mr-2" fill="none" viewBox="0 0 24 24">
        <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
        <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8v8H4z" />
      </svg>
      {otp ? 'Verifying...' : 'Sending code...'}
    </div>
  )
}
