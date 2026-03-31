'use client'

import { useState, useEffect } from 'react'
import { useRouter } from 'next/navigation'
import Link from 'next/link'
import { useAuth } from '@/lib/useAuth'
import { createClient } from '@/lib/auth'
import { BADGES } from '@/lib/points'
import { ArrowLeft, Save, CreditCard, LogOut, User, Building2, FileText, Trophy } from 'lucide-react'

const TIER_LABELS: Record<string, { label: string; color: string }> = {
  free:     { label: 'Free',     color: 'bg-gray-100 text-gray-600' },
  pro:      { label: 'Pro',      color: 'bg-blue-100 text-blue-700' },
  business: { label: 'Business', color: 'bg-gray-900 text-white' },
}

const ROLE_LABELS: Record<string, string> = {
  driver:        '🚛 Driver / Daily Commuter',
  fleet_manager: '🏢 Fleet Manager',
  other:         '👤 Other',
}

export default function AccountPage() {
  const { user, loading: authLoading } = useAuth()
  const router = useRouter()

  const [profile, setProfile] = useState<Record<string, unknown> | null>(null)
  const [subscription, setSubscription] = useState<Record<string, unknown> | null>(null)
  const [email, setEmail] = useState('')
  const [form, setForm] = useState({ display_name: '', full_name: '', company: '', bio: '' })
  const [saving, setSaving] = useState(false)
  const [saved, setSaved] = useState(false)
  const [portalLoading, setPortalLoading] = useState(false)

  useEffect(() => {
    if (!authLoading && !user) router.push('/login')
  }, [user, authLoading, router])

  useEffect(() => {
    if (!user) return
    fetch('/api/profile').then(r => r.json()).then(d => {
      setProfile(d.profile || {})
      setSubscription(d.subscription || null)
      setEmail(d.email || '')
      setForm({
        display_name: d.profile?.display_name || '',
        full_name: d.profile?.full_name || '',
        company:   d.profile?.company || '',
        bio:       d.profile?.bio || '',
      })
    })
  }, [user])

  async function handleSave(e: React.FormEvent) {
    e.preventDefault()
    setSaving(true)
    await fetch('/api/profile', {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(form),
    })
    setSaving(false)
    setSaved(true)
    setTimeout(() => setSaved(false), 2000)
  }

  async function handlePortal() {
    setPortalLoading(true)
    const res = await fetch('/api/stripe/portal', { method: 'POST' })
    const { url, error } = await res.json()
    if (url) window.location.href = url
    else {
      alert(error || 'Could not open billing portal')
      setPortalLoading(false)
    }
  }

  async function signOut() {
    await createClient().auth.signOut()
    router.push('/')
  }

  if (authLoading || !profile) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <div className="w-8 h-8 border-2 border-gray-300 border-t-gray-900 rounded-full animate-spin" />
      </div>
    )
  }

  const tier = String(profile?.tier || 'free')
  const tierInfo = TIER_LABELS[tier] || TIER_LABELS.free
  const isPaid = tier === 'pro' || tier === 'business'

  return (
    <main className="min-h-screen bg-gray-50">
      <div className="max-w-lg mx-auto px-4 pb-16">
        <div className="pt-6 pb-4 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <Link href="/dashboard" className="p-2 rounded-xl bg-white border border-gray-200 text-gray-600 hover:bg-gray-50">
              <ArrowLeft className="w-4 h-4" />
            </Link>
            <h1 className="text-xl font-bold text-gray-900">My Account</h1>
          </div>
          <button onClick={signOut} className="flex items-center gap-1.5 text-xs text-gray-500 hover:text-red-500 transition-colors">
            <LogOut className="w-3.5 h-3.5" /> Sign out
          </button>
        </div>

        {/* Subscription status */}
        <div className="bg-white rounded-2xl border border-gray-200 p-5 shadow-sm mb-4">
          <div className="flex items-center justify-between mb-3">
            <h2 className="text-sm font-semibold text-gray-700">Subscription</h2>
            <span className={`text-xs font-bold px-2.5 py-1 rounded-full ${tierInfo.color}`}>
              {tierInfo.label}
            </span>
          </div>
          <p className="text-xs text-gray-500 mb-1">{email}</p>
          {subscription && (
            <p className="text-xs text-gray-400">
              Status: <span className="font-medium text-gray-600">{String(subscription.status ?? '')}</span>
              {!!subscription.current_period_end && (
                <> · Renews {new Date(String(subscription.current_period_end)).toLocaleDateString()}</>
              )}
            </p>
          )}

          <div className="mt-4 flex gap-2">
            {isPaid ? (
              <button
                onClick={handlePortal}
                disabled={portalLoading}
                className="flex items-center gap-1.5 text-xs font-medium bg-gray-100 text-gray-700 px-4 py-2 rounded-xl hover:bg-gray-200 transition-colors disabled:opacity-50"
              >
                <CreditCard className="w-3.5 h-3.5" />
                {portalLoading ? 'Opening...' : 'Manage Billing'}
              </button>
            ) : (
              <Link
                href="/pricing"
                className="flex items-center gap-1.5 text-xs font-medium bg-blue-600 text-white px-4 py-2 rounded-xl hover:bg-blue-700 transition-colors"
              >
                Upgrade to Pro →
              </Link>
            )}
          </div>
        </div>

        {/* Points & badges */}
        {!!profile && (Number(profile.points) > 0 || Number(profile.reports_count) > 0) && (
          <div className="bg-white rounded-2xl border border-gray-200 p-5 shadow-sm mb-4">
            <div className="flex items-center justify-between mb-3">
              <h2 className="text-sm font-semibold text-gray-700">Community Stats</h2>
              <Link href="/leaderboard" className="text-xs text-blue-600 hover:underline flex items-center gap-1">
                <Trophy className="w-3 h-3" /> Leaderboard
              </Link>
            </div>
            <div className="flex gap-4 mb-3">
              <div className="text-center">
                <p className="text-2xl font-bold text-gray-900">{Number(profile.points) || 0}</p>
                <p className="text-xs text-gray-500">Points</p>
              </div>
              <div className="text-center">
                <p className="text-2xl font-bold text-gray-900">{Number(profile.reports_count) || 0}</p>
                <p className="text-xs text-gray-500">Reports</p>
              </div>
            </div>
            {Array.isArray(profile.badges) && profile.badges.length > 0 && (
              <div className="flex flex-wrap gap-2">
                {(profile.badges as string[]).map((b) => BADGES[b] && (
                  <div key={b} className="flex items-center gap-1 bg-gray-50 border border-gray-200 rounded-full px-2.5 py-1">
                    <span>{BADGES[b].emoji}</span>
                    <span className="text-xs font-medium text-gray-700">{BADGES[b].label}</span>
                  </div>
                ))}
              </div>
            )}
          </div>
        )}

        {/* Profile form */}
        <form onSubmit={handleSave} className="bg-white rounded-2xl border border-gray-200 p-5 shadow-sm mb-4">
          <h2 className="text-sm font-semibold text-gray-700 mb-4">Profile</h2>

          <div className="space-y-4">
            <div>
              <label className="flex items-center gap-1.5 text-xs font-medium text-gray-700 mb-1">
                <User className="w-3.5 h-3.5" /> Display name
                <span className="text-gray-400 font-normal">(shown on your reports)</span>
              </label>
              <input
                value={form.display_name}
                onChange={e => setForm(f => ({ ...f, display_name: e.target.value }))}
                className="w-full border border-gray-200 rounded-xl px-3 py-2.5 text-sm text-gray-900 focus:outline-none focus:ring-2 focus:ring-blue-500"
                placeholder="e.g. BorderPro_Laredo"
                maxLength={30}
              />
            </div>
            <div>
              <label className="flex items-center gap-1.5 text-xs font-medium text-gray-700 mb-1">
                Full name
              </label>
              <input
                value={form.full_name}
                onChange={e => setForm(f => ({ ...f, full_name: e.target.value }))}
                className="w-full border border-gray-200 rounded-xl px-3 py-2.5 text-sm text-gray-900 focus:outline-none focus:ring-2 focus:ring-blue-500"
                placeholder="Your name"
              />
            </div>

            <div>
              <label className="flex items-center gap-1.5 text-xs font-medium text-gray-700 mb-1">
                <Building2 className="w-3.5 h-3.5" /> Company / Employer
              </label>
              <input
                value={form.company}
                onChange={e => setForm(f => ({ ...f, company: e.target.value }))}
                className="w-full border border-gray-200 rounded-xl px-3 py-2.5 text-sm text-gray-900 focus:outline-none focus:ring-2 focus:ring-blue-500"
                placeholder="e.g. Laredo Freight Co."
              />
            </div>

            <div>
              <label className="flex items-center gap-1.5 text-xs font-medium text-gray-700 mb-1">
                <FileText className="w-3.5 h-3.5" /> Short bio
                <span className="text-gray-400 font-normal">(shows on your reports)</span>
              </label>
              <textarea
                value={form.bio}
                onChange={e => setForm(f => ({ ...f, bio: e.target.value }))}
                className="w-full border border-gray-200 rounded-xl px-3 py-2.5 text-sm text-gray-900 focus:outline-none focus:ring-2 focus:ring-blue-500 resize-none"
                rows={2}
                maxLength={120}
                placeholder="e.g. Daily commuter crossing Hidalgo since 2018"
              />
              <p className="text-xs text-gray-400 mt-1 text-right">{form.bio.length}/120</p>
            </div>

            <div>
              <label className="text-xs font-medium text-gray-700 mb-1 block">Role</label>
              <p className="text-sm text-gray-600">{ROLE_LABELS[String(profile?.role || 'other')] || ROLE_LABELS.other}</p>
            </div>
          </div>

          <button
            type="submit"
            disabled={saving}
            className="mt-5 w-full flex items-center justify-center gap-2 bg-gray-900 text-white text-sm font-medium py-2.5 rounded-xl hover:bg-gray-700 disabled:opacity-50 transition-colors"
          >
            <Save className="w-4 h-4" />
            {saved ? 'Saved!' : saving ? 'Saving...' : 'Save Profile'}
          </button>
        </form>

        {/* Danger zone */}
        <div className="bg-white rounded-2xl border border-gray-200 p-5 shadow-sm">
          <h2 className="text-sm font-semibold text-gray-700 mb-3">Account</h2>
          <div className="space-y-2">
            <Link href="/pricing" className="block text-xs text-gray-600 hover:text-gray-900">
              View pricing & plans →
            </Link>
            <button
              onClick={signOut}
              className="block text-xs text-red-500 hover:text-red-700 transition-colors"
            >
              Sign out of Cruza
            </button>
          </div>
        </div>
      </div>
    </main>
  )
}
