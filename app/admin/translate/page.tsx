'use client'

import { useState, useEffect } from 'react'
import { useAuth } from '@/lib/useAuth'
import { useRouter } from 'next/navigation'
import { PageHeader } from '@/components/PageHeader'

const ADMIN_EMAIL = 'cruzabusiness@gmail.com'

type Variant = { text: string; tone: string }

// Paste-anything → casual RGV Spanish. 3 tonal variants returned so
// Diego can pick which one fits the FB group / DM / push copy he's
// writing. Same voice contract as /api/admin/ai-generate so all
// outputs across the app sound like one person.
//
// Shortcut: Ctrl/Cmd+Enter to translate. Matches the quick-reply
// pattern Diego already has muscle memory for.

const TONE_LABEL: Record<string, { es: string; en: string; hint: string }> = {
  casual:  { es: 'Casual', en: 'Casual',  hint: 'default FB-drop tone' },
  urgent:  { es: 'Urgente', en: 'Urgent', hint: 'weather / line warning' },
  helpful: { es: 'Helpful', en: 'Helpful', hint: 'feature or tip' },
}

export default function TranslatePage() {
  const { user, loading } = useAuth()
  const router = useRouter()
  const [text, setText] = useState('')
  const [variants, setVariants] = useState<Variant[]>([])
  const [generating, setGenerating] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [copied, setCopied] = useState<number | null>(null)

  useEffect(() => {
    if (!loading && (!user || user.email !== ADMIN_EMAIL)) router.push('/')
  }, [user, loading, router])

  async function translate() {
    const trimmed = text.trim()
    if (!trimmed || generating) return
    setGenerating(true)
    setError(null)
    setVariants([])
    setCopied(null)
    try {
      const res = await fetch('/api/admin/translate', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ text: trimmed }),
      })
      const data = await res.json()
      if (!res.ok || !data.variants) {
        setError(data.error || `HTTP ${res.status}`)
        return
      }
      setVariants(data.variants)
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err))
    } finally {
      setGenerating(false)
    }
  }

  function copyText(t: string, idx: number) {
    navigator.clipboard.writeText(t).catch(() => {})
    setCopied(idx)
    setTimeout(() => setCopied(null), 1500)
  }

  function handleKeyDown(e: React.KeyboardEvent<HTMLTextAreaElement>) {
    if ((e.ctrlKey || e.metaKey) && e.key === 'Enter') {
      e.preventDefault()
      translate()
    }
  }

  if (loading || !user) {
    return (
      <main className="min-h-screen bg-gray-50 dark:bg-gray-950 flex items-center justify-center">
        <p className="text-sm text-gray-500">Loading…</p>
      </main>
    )
  }

  return (
    <main className="min-h-screen bg-gray-50 dark:bg-gray-950">
      <div className="max-w-2xl mx-auto px-4 pb-24">
        <PageHeader
          title="Translator"
          subtitle="English (or standard Spanish) → casual RGV FB voice. 3 tonal variants."
          backHref="/admin"
          backLabelEs="Volver al admin"
          backLabelEn="Back to admin"
        />

        <div className="mt-4 bg-white dark:bg-gray-800 rounded-2xl border border-gray-200 dark:border-gray-700 p-4">
          <label className="block text-xs font-bold text-gray-700 dark:text-gray-300 mb-1.5 uppercase tracking-wide">
            What you want to say
          </label>
          <textarea
            value={text}
            onChange={(e) => setText(e.target.value)}
            onKeyDown={handleKeyDown}
            rows={5}
            placeholder="e.g. Avoid getting stuck in line due to the weather — use cruzar.app for live info"
            className="w-full bg-gray-50 dark:bg-gray-900 border border-gray-200 dark:border-gray-700 rounded-xl px-3 py-2.5 text-sm text-gray-900 dark:text-gray-100 focus:outline-none focus:ring-2 focus:ring-blue-500 resize-y font-mono"
          />
          <div className="flex items-center justify-between mt-3 gap-2 flex-wrap">
            <p className="text-[11px] text-gray-500 dark:text-gray-400">
              Ctrl/Cmd+Enter to translate · {text.length}/2000
            </p>
            <div className="flex items-center gap-2">
              {text && (
                <button
                  type="button"
                  onClick={() => { setText(''); setVariants([]); setError(null) }}
                  className="text-xs font-semibold text-gray-500 hover:text-gray-800 dark:text-gray-400 dark:hover:text-gray-200 px-3 py-1.5 rounded-lg hover:bg-gray-100 dark:hover:bg-gray-700 transition-colors active:scale-95"
                >
                  Clear
                </button>
              )}
              <button
                type="button"
                onClick={translate}
                disabled={!text.trim() || generating}
                className="text-xs font-black text-white bg-blue-600 hover:bg-blue-700 disabled:opacity-40 disabled:cursor-not-allowed px-4 py-2 rounded-lg transition-all active:scale-95"
              >
                {generating ? 'Translating…' : 'Translate →'}
              </button>
            </div>
          </div>
        </div>

        {error && (
          <div className="mt-4 bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 rounded-2xl px-4 py-3">
            <p className="text-sm text-red-800 dark:text-red-300">Error: {error}</p>
          </div>
        )}

        {variants.length > 0 && (
          <div className="mt-4 space-y-3">
            {variants.map((v, idx) => {
              const label = TONE_LABEL[v.tone] ?? { es: v.tone, en: v.tone, hint: '' }
              const isCopied = copied === idx
              return (
                <div
                  key={idx}
                  className="bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-2xl p-4 shadow-sm"
                >
                  <div className="flex items-center justify-between mb-2">
                    <div className="flex items-center gap-2">
                      <span className="text-[10px] font-black uppercase tracking-widest text-blue-600 dark:text-blue-400 px-2 py-0.5 rounded-full bg-blue-50 dark:bg-blue-900/30">
                        {label.en}
                      </span>
                      {label.hint && (
                        <span className="text-[11px] text-gray-400 dark:text-gray-500">{label.hint}</span>
                      )}
                    </div>
                    <button
                      type="button"
                      onClick={() => copyText(v.text, idx)}
                      className={`text-xs font-bold px-3 py-1.5 rounded-lg transition-all active:scale-95 ${
                        isCopied
                          ? 'bg-green-100 dark:bg-green-900/30 text-green-700 dark:text-green-400'
                          : 'bg-gray-100 dark:bg-gray-700 text-gray-700 dark:text-gray-300 hover:bg-gray-200 dark:hover:bg-gray-600'
                      }`}
                    >
                      {isCopied ? 'Copied' : 'Copy'}
                    </button>
                  </div>
                  <p className="text-[15px] text-gray-900 dark:text-gray-100 whitespace-pre-wrap leading-relaxed">
                    {v.text}
                  </p>
                  <p className="text-[10px] text-gray-400 dark:text-gray-500 mt-2">
                    {v.text.length} char
                  </p>
                </div>
              )
            })}
          </div>
        )}

        <p className="mt-8 text-center text-[10px] text-gray-400 dark:text-gray-500">
          Voice rules: no emojis · cruzar.app · casual RGV Spanish
        </p>
      </div>
    </main>
  )
}
