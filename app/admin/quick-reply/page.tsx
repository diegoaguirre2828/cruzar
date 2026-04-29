'use client'

import { useState, useEffect } from 'react'
import { useAuth } from '@/lib/useAuth'
import { useRouter } from 'next/navigation'
import Link from 'next/link'

const ADMIN_EMAIL = 'cruzabusiness@gmail.com'

type Variant = { text: string; tone: string }

// Standalone quick-reply page. Designed to be pinned as a browser tab so
// Diego can Alt+Tab between Facebook and Cruzar, paste the post he wants
// to reply to, get 3 casual replies, copy one, Alt+Tab back. Zero
// navigation, zero scrolling, one shortcut (Ctrl+Enter).
//
// Not linked from the main /admin — it's a power tool for when he's in
// FB-reply flow and doesn't want the full admin UI.

export default function QuickReplyPage() {
  const { user, loading } = useAuth()
  const router = useRouter()
  const [context, setContext] = useState('')
  const [variants, setVariants] = useState<Variant[]>([])
  const [generating, setGenerating] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [copied, setCopied] = useState<number | null>(null)
  const [history, setHistory] = useState<{ context: string; variants: Variant[]; ts: number }[]>([])

  useEffect(() => {
    if (!loading && (!user || user.email !== ADMIN_EMAIL)) router.push('/')
  }, [user, loading, router])

  async function generate() {
    const trimmed = context.trim()
    if (!trimmed || generating) return
    setGenerating(true)
    setError(null)
    setVariants([])
    setCopied(null)
    try {
      const res = await fetch('/api/admin/quick-reply', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ context: trimmed }),
      })
      const data = await res.json()
      if (!res.ok || !data.variants) {
        setError(data.error || `HTTP ${res.status}`)
        return
      }
      setVariants(data.variants)
      setHistory((h) => [{ context: trimmed, variants: data.variants, ts: Date.now() }, ...h].slice(0, 8))
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err))
    } finally {
      setGenerating(false)
    }
  }

  function copyText(text: string, idx: number) {
    navigator.clipboard.writeText(text).catch(() => {})
    setCopied(idx)
    setTimeout(() => setCopied(null), 1500)
  }

  function reset() {
    setContext('')
    setVariants([])
    setError(null)
    setCopied(null)
  }

  function handleKeyDown(e: React.KeyboardEvent<HTMLTextAreaElement>) {
    // Ctrl/Cmd + Enter to generate
    if ((e.ctrlKey || e.metaKey) && e.key === 'Enter') {
      e.preventDefault()
      generate()
    }
  }

  if (loading || !user || user.email !== ADMIN_EMAIL) return null

  return (
    <main className="min-h-screen bg-gray-50">
      <div className="max-w-2xl mx-auto px-4 py-6">
        <div className="flex items-baseline justify-between mb-4">
          <div>
            <h1 className="text-xl font-bold text-gray-900">⚡ Quick Reply</h1>
            <p className="text-xs text-gray-500 mt-0.5">
              Paste a FB post/comment → get 3 casual RGV Spanish replies. No emojis, not salesy, uses cruzar.app.
            </p>
          </div>
          <Link href="/admin" className="text-xs text-gray-500 hover:text-gray-800">← Admin</Link>
        </div>

        <div className="bg-white rounded-2xl border border-gray-200 p-4 shadow-sm">
          <label className="text-[10px] uppercase tracking-wider font-bold text-gray-500 block mb-1">
            FB post or comment to reply to
          </label>
          <textarea
            value={context}
            onChange={(e) => setContext(e.target.value)}
            onKeyDown={handleKeyDown}
            placeholder="Paste the original FB post or comment here…"
            rows={5}
            autoFocus
            className="w-full border border-gray-200 rounded-xl px-3 py-2.5 text-sm text-gray-900 focus:outline-none focus:ring-2 focus:ring-blue-500 font-mono leading-relaxed"
          />
          <div className="flex items-center justify-between mt-2">
            <p className="text-[10px] text-gray-400">
              <kbd className="bg-gray-100 px-1 rounded">Ctrl+Enter</kbd> to generate
            </p>
            <div className="flex gap-2">
              {(context || variants.length > 0) && (
                <button
                  onClick={reset}
                  className="text-xs font-semibold text-gray-500 hover:text-gray-800 px-3 py-1.5 rounded-lg"
                >
                  Clear
                </button>
              )}
              <button
                onClick={generate}
                disabled={!context.trim() || generating}
                className="px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white text-sm font-bold rounded-xl disabled:opacity-40"
              >
                {generating ? 'Generating…' : '⚡ Generate replies'}
              </button>
            </div>
          </div>
        </div>

        {error && (
          <div className="mt-3 bg-red-50 border border-red-200 text-red-700 text-xs rounded-xl px-3 py-2">
            ✗ {error}
          </div>
        )}

        {variants.length > 0 && (
          <div className="mt-4 space-y-2">
            {variants.map((v, i) => (
              <div
                key={i}
                className={`bg-white rounded-2xl border-2 p-4 shadow-sm transition-colors ${
                  copied === i ? 'border-green-500 bg-green-50' : 'border-gray-200 hover:border-blue-400'
                }`}
              >
                <div className="flex items-center justify-between mb-2">
                  <span className="text-[10px] uppercase tracking-wider font-bold text-gray-500">
                    {v.tone}
                  </span>
                  <button
                    onClick={() => copyText(v.text, i)}
                    className={`text-xs font-bold px-3 py-1 rounded-lg ${
                      copied === i
                        ? 'bg-green-600 text-white'
                        : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
                    }`}
                  >
                    {copied === i ? '✓ Copied' : '📋 Copy'}
                  </button>
                </div>
                <p className="text-sm text-gray-900 leading-relaxed whitespace-pre-wrap">
                  {v.text}
                </p>
              </div>
            ))}
            <p className="text-[11px] text-gray-400 text-center mt-2">
              Don&apos;t love any of them? Edit the context and generate again.
            </p>
          </div>
        )}

        {/* Recent history — quick access to past generations without losing them */}
        {history.length > 1 && (
          <details className="mt-6">
            <summary className="text-xs font-semibold text-gray-500 cursor-pointer">
              Recent ({history.length})
            </summary>
            <div className="mt-2 space-y-2">
              {history.slice(1).map((h, i) => (
                <button
                  key={i}
                  onClick={() => { setContext(h.context); setVariants(h.variants); setCopied(null) }}
                  className="w-full text-left bg-white border border-gray-200 rounded-xl p-3 hover:border-gray-400 text-xs"
                >
                  <p className="text-gray-900 line-clamp-2 leading-snug">{h.context}</p>
                  <p className="text-gray-400 mt-1">
                    {new Date(h.ts).toLocaleTimeString()} · {h.variants.length} variants
                  </p>
                </button>
              ))}
            </div>
          </details>
        )}

        <div className="mt-8 bg-blue-50 border border-blue-200 rounded-xl p-3 text-[11px] text-blue-900 leading-relaxed">
          <b>Workflow tip:</b> pin this page as a browser tab (right-click → Pin). Keep FB open in another tab.
          Copy a post from FB → Alt+Tab here → paste → <kbd className="bg-white px-1 rounded">Ctrl+Enter</kbd> →
          click Copy on the reply you like → Alt+Tab back to FB → paste. About 10 seconds per reply.
        </div>
      </div>
    </main>
  )
}
