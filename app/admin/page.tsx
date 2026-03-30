'use client'

import { useState, useEffect } from 'react'
import { useAuth } from '@/lib/useAuth'
import { useRouter } from 'next/navigation'

const ADMIN_EMAIL = 'diegonaguirre@icloud.com' // your email

interface Advertiser {
  id: string
  business_name: string
  contact_email: string
  contact_phone: string
  website: string
  description: string
  status: string
  created_at: string
}

interface Subscription {
  id: string
  user_id: string
  tier: string
  status: string
  current_period_end: string
}

export default function AdminPage() {
  const { user, loading } = useAuth()
  const router = useRouter()
  const [tab, setTab] = useState<'advertisers' | 'subs'>('advertisers')
  const [advertisers, setAdvertisers] = useState<Advertiser[]>([])
  const [subs, setSubs] = useState<Subscription[]>([])

  useEffect(() => {
    if (!loading && (!user || user.email !== ADMIN_EMAIL)) {
      router.push('/')
    }
  }, [user, loading, router])

  useEffect(() => {
    if (!user || user.email !== ADMIN_EMAIL) return
    fetch('/api/admin/advertisers').then(r => r.json()).then(d => setAdvertisers(d.advertisers || []))
    fetch('/api/admin/subscriptions').then(r => r.json()).then(d => setSubs(d.subscriptions || []))
  }, [user])

  if (loading) return null

  return (
    <main className="min-h-screen bg-gray-50">
      <div className="max-w-4xl mx-auto px-4 pb-10">
        <div className="pt-6 pb-4">
          <h1 className="text-xl font-bold text-gray-900">🔐 Admin Panel</h1>
          <p className="text-xs text-gray-400">cruza.app</p>
        </div>

        {/* Tabs */}
        <div className="flex bg-gray-100 rounded-xl p-1 mb-5 w-fit">
          <button onClick={() => setTab('advertisers')}
            className={`px-4 py-2 text-xs font-medium rounded-lg transition-colors ${tab === 'advertisers' ? 'bg-white shadow text-gray-900' : 'text-gray-500'}`}>
            Ad Applications ({advertisers.length})
          </button>
          <button onClick={() => setTab('subs')}
            className={`px-4 py-2 text-xs font-medium rounded-lg transition-colors ${tab === 'subs' ? 'bg-white shadow text-gray-900' : 'text-gray-500'}`}>
            Subscriptions ({subs.length})
          </button>
        </div>

        {tab === 'advertisers' && (
          <div className="space-y-3">
            {advertisers.length === 0 && <p className="text-gray-400 text-sm">No applications yet.</p>}
            {advertisers.map(a => (
              <div key={a.id} className="bg-white rounded-2xl border border-gray-200 p-4 shadow-sm">
                <div className="flex items-start justify-between">
                  <div>
                    <p className="font-semibold text-gray-900">{a.business_name}</p>
                    <p className="text-xs text-gray-500">{a.contact_email} · {a.contact_phone}</p>
                    {a.website && <p className="text-xs text-blue-500">{a.website}</p>}
                    {a.description && <p className="text-xs text-gray-600 mt-1 whitespace-pre-wrap">{a.description}</p>}
                  </div>
                  <span className={`text-xs font-semibold px-2 py-1 rounded-full ${
                    a.status === 'active' ? 'bg-green-100 text-green-700' :
                    a.status === 'pending' ? 'bg-yellow-100 text-yellow-700' :
                    'bg-gray-100 text-gray-500'
                  }`}>{a.status}</span>
                </div>
                <p className="text-xs text-gray-400 mt-2">{new Date(a.created_at).toLocaleDateString()}</p>
              </div>
            ))}
          </div>
        )}

        {tab === 'subs' && (
          <div className="space-y-3">
            {subs.length === 0 && <p className="text-gray-400 text-sm">No subscriptions yet.</p>}
            {subs.map(s => (
              <div key={s.id} className="bg-white rounded-2xl border border-gray-200 p-4 shadow-sm flex items-center justify-between">
                <div>
                  <p className="text-sm font-medium text-gray-900">{s.user_id}</p>
                  <p className="text-xs text-gray-500">Tier: {s.tier} · Status: {s.status}</p>
                </div>
                <span className={`text-xs font-semibold px-2 py-1 rounded-full ${
                  s.status === 'active' ? 'bg-green-100 text-green-700' : 'bg-red-100 text-red-700'
                }`}>{s.tier}</span>
              </div>
            ))}
          </div>
        )}
      </div>
    </main>
  )
}
