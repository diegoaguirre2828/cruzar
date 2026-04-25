'use client'

import { useEffect, useState } from 'react'
import { useAuth } from '@/lib/useAuth'
import { useRouter } from 'next/navigation'
import { ExternalLink, RefreshCw, AlertCircle, CheckCircle2, Zap, Calendar, Trash2 } from 'lucide-react'

const ADMIN_EMAIL = 'cruzabusiness@gmail.com'

interface SocialPost {
  id: number
  posted_at: string
  caption: string
  fb_post_id: string | null
  fb_posted_at: string | null
  fb_post_error: string | null
  image_url: string | null
  image_kind: string | null
}

interface PostsResponse {
  posts: SocialPost[]
  fbEnvOk: boolean
  pageIdSet: boolean
  tokenSet: boolean
}

export default function FBPanelClient() {
  const { user, loading } = useAuth()
  const router = useRouter()
  const [data, setData] = useState<PostsResponse | null>(null)
  const [loadingPosts, setLoadingPosts] = useState(true)
  const [firing, setFiring] = useState(false)
  const [fireResult, setFireResult] = useState<string | null>(null)
  const [settingUpCrons, setSettingUpCrons] = useState(false)
  const [cronResult, setCronResult] = useState<string | null>(null)

  useEffect(() => {
    if (!loading && (!user || user.email !== ADMIN_EMAIL)) {
      router.push('/')
    }
  }, [user, loading, router])

  async function loadPosts() {
    setLoadingPosts(true)
    try {
      const res = await fetch('/api/admin/fb/posts', { cache: 'no-store' })
      const json = await res.json()
      setData(json)
    } finally {
      setLoadingPosts(false)
    }
  }

  useEffect(() => {
    if (user?.email === ADMIN_EMAIL) loadPosts()
  }, [user])

  async function fireNow() {
    if (firing) return
    setFiring(true)
    setFireResult(null)
    try {
      const res = await fetch('/api/admin/fb/fire', { method: 'POST' })
      const json = await res.json()
      if (json.ok && json.posted) {
        setFireResult(`✅ Posted! → facebook.com/${json.fbPostId}`)
      } else if (json.skipped) {
        setFireResult(`⏭️ Skipped: ${json.reason || 'recent post exists'}`)
      } else {
        setFireResult(`❌ ${json.stage || 'error'}: ${json.error || 'unknown'}`)
      }
      await loadPosts()
    } catch (err) {
      setFireResult(`❌ Network error: ${String(err)}`)
    } finally {
      setFiring(false)
    }
  }

  async function setupCrons() {
    if (settingUpCrons) return
    const cronApiKey = window.prompt(
      'cron-job.org API key:\n\nGet one at console.cron-job.org → Settings → API. Stored only in this request.',
    )
    if (!cronApiKey) return

    setSettingUpCrons(true)
    setCronResult(null)
    try {
      const res = await fetch('/api/admin/fb/setup-crons', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ cronApiKey }),
      })
      const json = await res.json()
      if (json.created) {
        setCronResult(`✅ Created ${json.created}/${json.created + (json.failed || 0)} jobs`)
      } else {
        setCronResult(`❌ ${json.error || 'Failed to create jobs'}`)
      }
    } catch (err) {
      setCronResult(`❌ ${String(err)}`)
    } finally {
      setSettingUpCrons(false)
    }
  }

  if (loading || !user) return null
  if (user.email !== ADMIN_EMAIL) return null

  return (
    <div className="min-h-screen bg-slate-950 text-white p-6 max-w-5xl mx-auto">
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-3xl font-bold tracking-tight">FB Page Publisher</h1>
          <p className="text-slate-400 text-sm mt-1">Native Graph API publish to the Cruzar FB Page</p>
        </div>
        <button
          onClick={loadPosts}
          className="flex items-center gap-2 text-sm text-slate-300 hover:text-white px-3 py-2 rounded-lg border border-white/10 hover:border-white/30"
        >
          <RefreshCw size={14} className={loadingPosts ? 'animate-spin' : ''} />
          Refresh
        </button>
      </div>

      {/* Make.com kill banner */}
      <div className="bg-amber-500/10 border border-amber-500/30 rounded-2xl p-4 mb-4 flex items-start gap-3">
        <Trash2 size={20} className="text-amber-400 flex-shrink-0 mt-0.5" />
        <div className="text-sm">
          <div className="font-semibold text-amber-200 mb-1">Disable the Make scenario</div>
          <div className="text-amber-100/80">
            Once a post here lands successfully (green row below), turn off the Make scenario that was posting to the page. Otherwise both pipelines fire and FB sees duplicate publishes — the algo will throttle both.
          </div>
        </div>
      </div>

      {/* Env status */}
      {data && !data.fbEnvOk && (
        <div className="bg-red-500/10 border border-red-500/30 rounded-2xl p-4 mb-4 flex items-start gap-3">
          <AlertCircle size={20} className="text-red-400 flex-shrink-0 mt-0.5" />
          <div className="text-sm">
            <div className="font-semibold text-red-200 mb-1">FB env missing in production</div>
            <div className="text-red-100/80 mb-2">
              {data.pageIdSet ? '✓' : '✗'} FACEBOOK_PAGE_ID &nbsp;&nbsp; {data.tokenSet ? '✓' : '✗'} FACEBOOK_PAGE_ACCESS_TOKEN
            </div>
            <div className="text-red-100/80">
              Set both in Vercel → Settings → Environment Variables (Production). Long-lived Page Access Token from Meta Developer Portal → Tools → Graph API Explorer → select the Page → Generate Access Token → exchange via /oauth/access_token for a 60-day token.
            </div>
          </div>
        </div>
      )}
      {data && data.fbEnvOk && (
        <div className="bg-green-500/10 border border-green-500/30 rounded-2xl p-4 mb-4 flex items-center gap-3">
          <CheckCircle2 size={20} className="text-green-400" />
          <div className="text-sm text-green-100">FB Graph API env wired ✓</div>
        </div>
      )}

      {/* Action row */}
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 mb-6">
        <button
          onClick={fireNow}
          disabled={firing}
          className="flex items-center justify-center gap-2 bg-blue-600 hover:bg-blue-500 disabled:bg-blue-800 disabled:cursor-not-allowed text-white font-semibold py-4 rounded-2xl"
        >
          <Zap size={18} />
          {firing ? 'Posting…' : 'Fire Now (force, bypass dedupe)'}
        </button>
        <button
          onClick={setupCrons}
          disabled={settingUpCrons}
          className="flex items-center justify-center gap-2 bg-slate-800 hover:bg-slate-700 disabled:bg-slate-900 disabled:cursor-not-allowed text-white font-semibold py-4 rounded-2xl border border-white/10"
        >
          <Calendar size={18} />
          {settingUpCrons ? 'Registering…' : 'Setup 4×/day cron schedule'}
        </button>
      </div>

      {fireResult && (
        <div className="text-sm text-slate-300 bg-slate-900 border border-white/10 rounded-xl p-3 mb-3 font-mono whitespace-pre-wrap">
          {fireResult}
        </div>
      )}
      {cronResult && (
        <div className="text-sm text-slate-300 bg-slate-900 border border-white/10 rounded-xl p-3 mb-3 font-mono whitespace-pre-wrap">
          {cronResult}
        </div>
      )}

      {/* Posts log */}
      <div className="space-y-2">
        <div className="text-xs uppercase tracking-wider text-slate-500 font-semibold mb-2">
          Last 30 generated · most recent first
        </div>
        {loadingPosts && <div className="text-sm text-slate-500">Loading…</div>}
        {!loadingPosts && data && data.posts.length === 0 && (
          <div className="text-sm text-slate-500">No posts yet — fire one above.</div>
        )}
        {!loadingPosts && data && data.posts.map(p => {
          const status: 'posted' | 'error' | 'pending' =
            p.fb_post_id ? 'posted' : p.fb_post_error ? 'error' : 'pending'
          const statusColor =
            status === 'posted' ? 'border-green-500/40 bg-green-500/5' :
            status === 'error' ? 'border-red-500/40 bg-red-500/5' :
            'border-white/10 bg-white/5'
          return (
            <div
              key={p.id}
              className={`border rounded-xl p-4 ${statusColor}`}
            >
              <div className="flex items-start justify-between gap-3 mb-2">
                <div className="text-xs text-slate-400">
                  {new Date(p.posted_at).toLocaleString('es-MX', { timeZone: 'America/Chicago', hour12: true })}
                </div>
                {p.fb_post_id && (
                  <a
                    href={`https://www.facebook.com/${p.fb_post_id}`}
                    target="_blank"
                    rel="noopener"
                    className="flex items-center gap-1 text-xs text-blue-300 hover:text-blue-200"
                  >
                    View on FB <ExternalLink size={12} />
                  </a>
                )}
                {p.fb_post_error && (
                  <span className="text-xs text-red-300 font-mono truncate max-w-xs">{p.fb_post_error}</span>
                )}
                {!p.fb_post_id && !p.fb_post_error && (
                  <span className="text-xs text-slate-500">Generated · not posted</span>
                )}
              </div>
              <pre className="text-xs text-slate-200 whitespace-pre-wrap font-sans line-clamp-6">
                {p.caption}
              </pre>
            </div>
          )
        })}
      </div>

      <div className="mt-8 text-xs text-slate-500 leading-relaxed">
        Schedule fires <code className="text-slate-300">/api/cron/fb-publish</code> at 5:30am, 11:30am, 3:30pm, 7:00pm CT.
        Each run calls <code className="text-slate-300">/api/social/next-post</code> for the caption (180-min dedupe), uploads the live wait-time card from <code className="text-slate-300">/api/social-image</code>, and posts via Graph API.
      </div>
    </div>
  )
}
