'use client'

import { useState } from 'react'
import Link from 'next/link'
import { ArrowLeft, Check } from 'lucide-react'

const PACKAGES = [
  {
    name: 'Nearby Listing',
    price: '$49/mo',
    desc: 'Show up in the "Nearby while you wait" section when users are at your local crossing with 30+ min wait.',
    features: ['1 crossing targeted', 'Shows when wait > 30 min', 'Business name + description + link'],
  },
  {
    name: 'Sponsored Card',
    price: '$99/mo',
    desc: 'Featured card on the home screen for your region. Seen by every user browsing crossings in your area.',
    features: ['1 region targeted', 'Home screen placement', 'Image + title + CTA button', 'Click tracking'],
    popular: true,
  },
  {
    name: 'Full Region',
    price: '$299/mo',
    desc: 'Maximum visibility across all crossings in your region. Best for freight brokers, insurance, and large businesses.',
    features: ['All crossings in region', 'Home + detail pages', 'Fleet manager panel placement', 'Monthly performance report'],
  },
]

export default function AdvertisePage() {
  const [form, setForm] = useState({
    businessName: '',
    email: '',
    phone: '',
    website: '',
    description: '',
    package: 'Sponsored Card',
    regions: [] as string[],
  })
  const [submitted, setSubmitted] = useState(false)
  const [loading, setLoading] = useState(false)

  const REGIONS = ['RGV – McAllen / Hidalgo', 'RGV – Progreso / Donna', 'Brownsville', 'Laredo', 'Eagle Pass', 'El Paso', 'San Diego', 'Nogales, AZ']

  function toggleRegion(r: string) {
    setForm(f => ({
      ...f,
      regions: f.regions.includes(r) ? f.regions.filter(x => x !== r) : [...f.regions, r],
    }))
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    setLoading(true)
    await fetch('/api/advertise', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(form),
    })
    setSubmitted(true)
    setLoading(false)
  }

  if (submitted) {
    return (
      <main className="min-h-screen bg-gray-50 flex items-center justify-center px-4">
        <div className="text-center max-w-sm">
          <div className="w-16 h-16 bg-green-100 rounded-full flex items-center justify-center mx-auto mb-4">
            <Check className="w-8 h-8 text-green-600" />
          </div>
          <h2 className="text-xl font-bold text-gray-900">Application received!</h2>
          <p className="text-gray-500 mt-2 text-sm">
            We'll review your application and contact you within 24 hours to set up your ad.
          </p>
          <Link href="/" className="inline-block mt-6 bg-gray-900 text-white font-medium px-6 py-2.5 rounded-xl text-sm hover:bg-gray-700 transition-colors">
            Back to App
          </Link>
        </div>
      </main>
    )
  }

  return (
    <main className="min-h-screen bg-gray-50">
      <div className="max-w-2xl mx-auto px-4 pb-16">
        <div className="pt-8 pb-6">
          <Link href="/pricing" className="flex items-center gap-1 text-xs text-gray-400 hover:text-gray-700 mb-4">
            <ArrowLeft className="w-3 h-3" /> Pricing
          </Link>
          <h1 className="text-2xl font-bold text-gray-900">Advertise on Cruza</h1>
          <p className="text-gray-500 mt-1 text-sm">
            Reach thousands of daily cross-border commuters, truckers, and shoppers at the exact moment they're waiting at the border.
          </p>
        </div>

        {/* Packages */}
        <div className="grid grid-cols-1 gap-4 mb-8">
          {PACKAGES.map(pkg => (
            <button
              key={pkg.name}
              onClick={() => setForm(f => ({ ...f, package: pkg.name }))}
              className={`w-full text-left p-4 rounded-2xl border-2 transition-all ${
                form.package === pkg.name
                  ? 'border-amber-500 bg-amber-50'
                  : 'border-gray-200 bg-white'
              } ${pkg.popular ? 'relative' : ''}`}
            >
              {pkg.popular && (
                <span className="absolute -top-2.5 left-4 bg-amber-500 text-white text-xs font-semibold px-3 py-0.5 rounded-full">
                  Most Popular
                </span>
              )}
              <div className="flex items-start justify-between">
                <div>
                  <p className="font-bold text-gray-900">{pkg.name}</p>
                  <p className="text-xs text-gray-500 mt-0.5">{pkg.desc}</p>
                </div>
                <span className="font-bold text-gray-900 text-sm whitespace-nowrap ml-4">{pkg.price}</span>
              </div>
              <ul className="mt-2 space-y-1">
                {pkg.features.map((f, i) => (
                  <li key={i} className="flex items-center gap-1.5 text-xs text-gray-600">
                    <Check className="w-3 h-3 text-green-500" /> {f}
                  </li>
                ))}
              </ul>
            </button>
          ))}
        </div>

        {/* Application form */}
        <form onSubmit={handleSubmit} className="bg-white rounded-2xl border border-gray-200 p-6 shadow-sm space-y-4">
          <h2 className="font-semibold text-gray-900">Your Business Details</h2>

          <div className="grid grid-cols-2 gap-4">
            <div className="col-span-2">
              <label className="block text-xs font-medium text-gray-600 mb-1">Business Name *</label>
              <input required value={form.businessName} onChange={e => setForm(f => ({ ...f, businessName: e.target.value }))}
                className="w-full border border-gray-200 rounded-xl px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-amber-500"
                placeholder="Joe's Tacos & Tire Shop" />
            </div>
            <div>
              <label className="block text-xs font-medium text-gray-600 mb-1">Email *</label>
              <input required type="email" value={form.email} onChange={e => setForm(f => ({ ...f, email: e.target.value }))}
                className="w-full border border-gray-200 rounded-xl px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-amber-500"
                placeholder="you@business.com" />
            </div>
            <div>
              <label className="block text-xs font-medium text-gray-600 mb-1">Phone</label>
              <input type="tel" value={form.phone} onChange={e => setForm(f => ({ ...f, phone: e.target.value }))}
                className="w-full border border-gray-200 rounded-xl px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-amber-500"
                placeholder="(956) 555-0000" />
            </div>
            <div className="col-span-2">
              <label className="block text-xs font-medium text-gray-600 mb-1">Website</label>
              <input type="url" value={form.website} onChange={e => setForm(f => ({ ...f, website: e.target.value }))}
                className="w-full border border-gray-200 rounded-xl px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-amber-500"
                placeholder="https://yourbusiness.com" />
            </div>
            <div className="col-span-2">
              <label className="block text-xs font-medium text-gray-600 mb-1">Ad description (what should users see?)</label>
              <textarea value={form.description} onChange={e => setForm(f => ({ ...f, description: e.target.value }))}
                className="w-full border border-gray-200 rounded-xl px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-amber-500 resize-none"
                rows={2} placeholder="Best money exchange rates near the Hidalgo bridge. Open 24/7." />
            </div>
          </div>

          <div>
            <label className="block text-xs font-medium text-gray-600 mb-2">Target regions</label>
            <div className="flex flex-wrap gap-2">
              {REGIONS.map(r => (
                <button key={r} type="button" onClick={() => toggleRegion(r)}
                  className={`text-xs px-3 py-1.5 rounded-full border font-medium transition-colors ${
                    form.regions.includes(r)
                      ? 'bg-amber-500 text-white border-amber-500'
                      : 'bg-white text-gray-600 border-gray-200 hover:border-amber-300'
                  }`}>
                  {r}
                </button>
              ))}
            </div>
          </div>

          <button type="submit" disabled={loading}
            className="w-full bg-amber-500 text-white font-medium py-3 rounded-xl hover:bg-amber-600 transition-colors disabled:opacity-50 text-sm">
            {loading ? 'Submitting...' : 'Submit Application →'}
          </button>
          <p className="text-xs text-gray-400 text-center">We'll contact you within 24 hours to finalize your ad and set up billing.</p>
        </form>
      </div>
    </main>
  )
}
