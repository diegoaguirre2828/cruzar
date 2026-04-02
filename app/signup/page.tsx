'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import Link from 'next/link'
import { createClient } from '@/lib/auth'
import { GoogleButton } from '@/components/GoogleButton'
import { PhoneButton } from '@/components/PhoneButton'
import { useLang } from '@/lib/LangContext'

export default function SignupPage() {
  const router = useRouter()
  const { t } = useLang()
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [role, setRole] = useState('driver')
  const [company, setCompany] = useState('')
  const [error, setError] = useState('')
  const [loading, setLoading] = useState(false)

  const ROLES = [
    { value: 'driver', label: t.roleDriver, desc: t.roleDriverDesc },
    { value: 'fleet_manager', label: t.roleFleetMgr, desc: t.roleFleetMgrDesc },
  ]

  async function handleSignup(e: React.FormEvent) {
    e.preventDefault()
    setLoading(true)
    setError('')
    const supabase = createClient()
    const { error } = await supabase.auth.signUp({
      email,
      password,
      options: {
        data: { role, company },
      },
    })
    if (error) {
      setError(error.message)
      setLoading(false)
    } else {
      router.push('/dashboard')
    }
  }

  return (
    <main className="min-h-screen bg-gray-50 flex items-center justify-center px-4">
      <div className="w-full max-w-sm">
        <div className="text-center mb-8">
          <h1 className="text-2xl font-bold text-gray-900">🌉 Cruza</h1>
          <p className="text-sm text-gray-500 mt-1">{t.signupSubtitle}</p>
        </div>

        <div className="bg-white rounded-2xl border border-gray-200 p-6 shadow-sm space-y-4">
          <GoogleButton label={t.signUpWithGoogle} />
          <PhoneButton label={t.signUpWithPhone} />

          <div className="flex items-center gap-3">
            <div className="flex-1 h-px bg-gray-200" />
            <span className="text-xs text-gray-400">o</span>
            <div className="flex-1 h-px bg-gray-200" />
          </div>

          <form onSubmit={handleSignup} className="space-y-4">
          {error && (
            <div className="bg-red-50 border border-red-200 text-red-600 text-sm rounded-xl px-4 py-3">
              {error}
            </div>
          )}

          <div className="space-y-2">
            <label className="block text-xs font-medium text-gray-700">{t.iAmA}</label>
            {ROLES.map(r => (
              <button
                key={r.value}
                type="button"
                onClick={() => setRole(r.value)}
                className={`w-full text-left p-3 rounded-xl border text-sm transition-all ${
                  role === r.value
                    ? 'border-blue-500 bg-blue-50 text-blue-800'
                    : 'border-gray-200 text-gray-700'
                }`}
              >
                <div className="font-medium">{r.label}</div>
                <div className="text-xs text-gray-500 mt-0.5">{r.desc}</div>
              </button>
            ))}
          </div>

          <div>
            <label className="block text-xs font-medium text-gray-700 mb-1">{t.emailLabel}</label>
            <input
              type="email"
              value={email}
              onChange={e => setEmail(e.target.value)}
              required
              className="w-full border border-gray-200 rounded-xl px-3 py-2.5 text-sm text-gray-900 focus:outline-none focus:ring-2 focus:ring-blue-500"
              placeholder="you@email.com"
            />
          </div>

          <div>
            <label className="block text-xs font-medium text-gray-700 mb-1">{t.passwordLabel}</label>
            <input
              type="password"
              value={password}
              onChange={e => setPassword(e.target.value)}
              required
              minLength={6}
              className="w-full border border-gray-200 rounded-xl px-3 py-2.5 text-sm text-gray-900 focus:outline-none focus:ring-2 focus:ring-blue-500"
              placeholder={t.passwordMinChars}
            />
          </div>

          {role === 'fleet_manager' && (
            <div>
              <label className="block text-xs font-medium text-gray-700 mb-1">{t.companyNameLabel}</label>
              <input
                type="text"
                value={company}
                onChange={e => setCompany(e.target.value)}
                className="w-full border border-gray-200 rounded-xl px-3 py-2.5 text-sm text-gray-900 focus:outline-none focus:ring-2 focus:ring-blue-500"
                placeholder={t.companyNamePlaceholder}
              />
            </div>
          )}

          <button
            type="submit"
            disabled={loading}
            className="w-full bg-gray-900 text-white text-sm font-medium py-3 rounded-xl hover:bg-gray-700 transition-colors disabled:opacity-50"
          >
            {loading ? t.creatingAccount : t.createAccountBtn}
          </button>
          </form>
        </div>

        <p className="text-center text-sm text-gray-500 mt-4">
          {t.alreadyHaveAccount}{' '}
          <Link href="/login" className="text-blue-600 font-medium hover:underline">{t.signInLink}</Link>
        </p>
      </div>
    </main>
  )
}
