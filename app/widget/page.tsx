'use client'

import { useState } from 'react'
import Link from 'next/link'
import { ArrowLeft, Copy, Check } from 'lucide-react'
import { BridgeLogo } from '@/components/BridgeLogo'

export default function WidgetPage() {
  const [portId, setPortId] = useState('')
  const [theme, setTheme] = useState<'light' | 'dark'>('light')
  const [copied, setCopied] = useState(false)

  const embedUrl = `https://cruzar.app/api/widget?theme=${theme}${portId ? `&portId=${portId}` : ''}`
  const iframeCode = `<iframe src="${embedUrl}" width="360" height="120" frameborder="0" scrolling="no" style="border-radius:14px;"></iframe>`

  function copy() {
    navigator.clipboard.writeText(iframeCode)
    setCopied(true)
    setTimeout(() => setCopied(false), 2000)
  }

  return (
    <main className="min-h-screen bg-gray-50 dark:bg-gray-950">
      <div className="max-w-2xl mx-auto px-4 pb-16 pt-8">
        <Link href="/" className="flex items-center gap-1 text-xs text-gray-400 hover:text-gray-700 mb-6">
          <ArrowLeft className="w-3 h-3" /> Back
        </Link>

        <h1 className="text-2xl font-bold text-gray-900 dark:text-gray-100 mb-1 inline-flex items-center gap-2"><BridgeLogo size={28} /> Embeddable Border Widget</h1>
        <p className="text-gray-500 dark:text-gray-400 text-sm mb-8">
          Show live wait times on your website. Free for all businesses near the border.
        </p>

        {/* Preview */}
        <div className="bg-white dark:bg-gray-800 rounded-2xl border border-gray-200 dark:border-gray-700 p-5 shadow-sm mb-6">
          <h2 className="text-sm font-semibold text-gray-700 dark:text-gray-300 mb-4">Preview</h2>
          <iframe
            src={embedUrl}
            width="360"
            height="110"
            style={{ borderRadius: 14, border: 'none', maxWidth: '100%' }}
          />
        </div>

        {/* Customize */}
        <div className="bg-white dark:bg-gray-800 rounded-2xl border border-gray-200 dark:border-gray-700 p-5 shadow-sm mb-6">
          <h2 className="text-sm font-semibold text-gray-700 dark:text-gray-300 mb-4">Customize</h2>
          <div className="space-y-3">
            <div>
              <label className="text-xs text-gray-500 dark:text-gray-400 mb-1 block">Port ID (leave blank for auto)</label>
              <input
                type="text"
                value={portId}
                onChange={e => setPortId(e.target.value)}
                placeholder="e.g. 240401"
                className="w-full border border-gray-200 dark:border-gray-700 dark:bg-gray-700 rounded-xl px-3 py-2.5 text-sm text-gray-900 dark:text-gray-100 placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-blue-500"
              />
              <p className="text-xs text-gray-400 mt-1">Find port IDs at <Link href="/" className="text-blue-500">cruzar.app</Link> → click any crossing → the ID is in the URL</p>
            </div>
            <div>
              <label className="text-xs text-gray-500 dark:text-gray-400 mb-1 block">Theme</label>
              <div className="flex gap-2">
                {(['light', 'dark'] as const).map(t => (
                  <button
                    key={t}
                    onClick={() => setTheme(t)}
                    className={`px-4 py-2 rounded-xl text-sm font-medium border transition-colors capitalize ${
                      theme === t
                        ? 'bg-gray-900 dark:bg-gray-100 text-white dark:text-gray-900 border-gray-900'
                        : 'bg-white dark:bg-gray-700 text-gray-600 dark:text-gray-400 border-gray-200 dark:border-gray-600'
                    }`}
                  >
                    {t}
                  </button>
                ))}
              </div>
            </div>
          </div>
        </div>

        {/* Embed code */}
        <div className="bg-white dark:bg-gray-800 rounded-2xl border border-gray-200 dark:border-gray-700 p-5 shadow-sm mb-6">
          <div className="flex items-center justify-between mb-3">
            <h2 className="text-sm font-semibold text-gray-700 dark:text-gray-300">Embed Code</h2>
            <button
              onClick={copy}
              className="flex items-center gap-1.5 text-xs font-medium text-gray-500 dark:text-gray-400 hover:text-gray-800 dark:hover:text-gray-200 transition-colors"
            >
              {copied ? <Check className="w-3.5 h-3.5 text-green-500" /> : <Copy className="w-3.5 h-3.5" />}
              {copied ? 'Copied!' : 'Copy'}
            </button>
          </div>
          <pre className="bg-gray-50 dark:bg-gray-900 rounded-xl p-3 text-xs text-gray-700 dark:text-gray-300 overflow-x-auto whitespace-pre-wrap break-all">
            {iframeCode}
          </pre>
          <p className="text-xs text-gray-400 mt-2">Paste this anywhere in your website HTML. Updates automatically every 60 seconds.</p>
        </div>

        <div className="bg-amber-50 dark:bg-amber-900/20 border border-amber-200 dark:border-amber-800 rounded-2xl p-5 text-center">
          <p className="text-sm font-semibold text-amber-800 dark:text-amber-300">Want your business featured on Cruzar?</p>
          <p className="text-xs text-amber-700 dark:text-amber-400 mt-1 mb-3">Reach thousands of daily cross-border commuters with a sponsored listing.</p>
          <Link href="/advertise" className="inline-block bg-amber-500 text-white text-sm font-medium px-5 py-2.5 rounded-xl hover:bg-amber-600 transition-colors">
            Advertise Your Business →
          </Link>
        </div>
      </div>
    </main>
  )
}
