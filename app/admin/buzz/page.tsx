'use client'

import { useState, useEffect } from 'react'
import Link from 'next/link'
import { useRouter } from 'next/navigation'
import { useAuth } from '@/lib/useAuth'
import { ArrowLeft, Copy, Check, ExternalLink } from 'lucide-react'

const ADMIN_EMAIL = 'cruzabusiness@gmail.com'
const DONE_KEY = 'cruzar_buzz_done_v1'

type Channel = {
  id: string
  day: string
  platform: string
  emoji: string
  color: string
  windowTiming: string
  submitUrl: string
  title: string
  body: string
  notes?: string
}

const CHANNELS: Channel[] = [
  {
    id: 'reddit-rgv',
    day: 'Mon',
    platform: 'r/rgv',
    emoji: '👽',
    color: '#ff4500',
    windowTiming: 'Tue–Thu · 10am–1pm CT (commuter lunch scroll)',
    submitUrl: 'https://www.reddit.com/r/rgv/submit',
    title: 'built an app for the puentes — cruzar.app',
    body: `got tired of scrolling filas de los puentes on FB every morning guessing if hidalgo was moving, so i built one.

cruzar.app — live wait time at every bridge, refreshed every 15 min from the CBP feed. free, no login to check the number.

i'm 20, UTRGV, solo project. not selling anything.

one ask — if you cross, tap "report" when you do. the app's only as good as the people in it.

also just added southbound reports since CBP only publishes northbound. if you cross into MX, those help the next person going the same direction.

roast welcome.`,
  },
  {
    id: 'twitter',
    day: 'Mon eve',
    platform: 'Twitter/X build-in-public thread',
    emoji: '🐦',
    color: '#1d9bf0',
    windowTiming: 'Tue or Thu · 8–10am CT (dev Twitter window)',
    submitUrl: 'https://twitter.com/compose/tweet',
    title: 'Thread · 6 tweets',
    body: `Tweet 1:
i'm 20, live in the RGV, spent the last 6 months building a live border wait-time app because the only alternative was scrolling a Facebook group every morning.

tonight i shipped something that doesn't exist anywhere else. 🧵

---

Tweet 2:
cruzar.app — live wait at every US–MX bridge, every 15 min from the CBP public feed.

---

Tweet 3:
the new thing: southbound community reports.

CBP only publishes northbound. half the market (going INTO MX) has no live data anywhere. cruzar now accepts reports with a direction flag. the feed becomes the source.

---

Tweet 4:
stack: next.js 16, supabase, vercel, stripe.
solo. no VC.
$19.99/mo trucking tier — tracking link the dispatcher pastes into whatsapp, customer sees live status + border wait.

---

Tweet 5:
not trying to be samsara.
trying to be the thing a RGV commuter or a 5-truck Laredo dispatcher actually uses every morning.

---

Tweet 6:
free for commuters. trucking tier 14-day trial, no card.

if you cross — please report when you do. the app's only as good as the people in it.

cruzar.app

— Diego`,
    notes: 'Post as a thread — paste tweet 1, hit "add", paste tweet 2, repeat. Each --- = new tweet.',
  },
  {
    id: 'show-hn',
    day: 'Tue',
    platform: 'Show HN · Hacker News',
    emoji: '🟠',
    color: '#ff6600',
    windowTiming: 'Mon–Wed · 6:30–8:00am PT (11:30am–1pm UTC). Do NOT post on weekends.',
    submitUrl: 'https://news.ycombinator.com/submit',
    title: 'Show HN: Cruzar – live US-Mexico border wait times',
    body: `URL field: https://cruzar.app

Text field (optional — can leave blank):

Solo build from the Rio Grande Valley. CBP publishes wait times at https://bwt.cbp.gov/api/bwtnew but nothing consumer-facing was using the feed well for my region.

Cruzar pulls it every 15 min, adds community reports, alerts, bridge cameras where cities publish them, and a $19.99/mo dispatcher tier with a customer-facing tracking URL.

Stack: Next.js 16 / Supabase / Vercel / Stripe. Happy to take critique on architecture or positioning.

The non-obvious thing I'm proudest of: southbound community reports. CBP only publishes northbound, so there's been no live data for the half of the market crossing INTO Mexico. Direction flag + community reports = the only feed.`,
    notes: 'After posting, DO NOT touch it for 4 hours. Comment on replies, but no self-bumps.',
  },
  {
    id: 'product-hunt',
    day: 'Tue/Wed',
    platform: 'Product Hunt',
    emoji: '🚀',
    color: '#da552f',
    windowTiming: 'Schedule in advance for a Tue or Wed launch. PH maker submit is fine.',
    submitUrl: 'https://www.producthunt.com/posts/new',
    title: 'Cruzar — Live US-Mexico border wait times — replace the FB group scroll',
    body: `Name: Cruzar

Tagline (60 char max):
Live US-Mexico border wait times — replace the FB group scroll

Topic tags:
Productivity · Travel · Public API · Location · Utilities

Description:

**Built in the Rio Grande Valley by a solo 20-year-old CS/bio student.**

Cruzar is a live border wait-time app for every US-Mexico crossing — from Brownsville/Matamoros to San Ysidro/Tijuana. Replaces the habit of scrolling Facebook border-wait groups every morning.

**Free for commuters:**
- Every crossing, refreshed every 15 minutes from the CBP API
- Community reports — one-tap "just crossed" from the bridge
- Push alerts: "ping me when Pharr drops below 30 min"
- Live bridge cameras where cities publish feeds
- Exchange-rate widget from real casas de cambio
- Bilingual (Spanish/English, default Spanish)

**$19.99/mo for small trucking fleets (2–10 trucks):**
- Public tracking link to share with customers
- Weekly "$ lost to delays" email
- Southbound community reports (CBP is northbound-only — this is a data moat)
- OAuth integrations with Samsara + Motive

No VC, no team. Every feature is something I personally needed when crossing or dispatching.

---

First comment (post as maker after launch):

Hey everyone 👋

I'm Diego, 20, RGV. This started because my family crosses the border for groceries/medical/family and I was sick of reading "cómo está Hidalgo?" posts in Facebook groups every day.

The one thing I'd love feedback on specifically: the **southbound reports**. CBP only publishes northbound — there's literally no live data source for the ~50% of crossings going INTO Mexico. I just added community reports with a direction flag. If you cross, please report; the feed is the feature.

Ask me anything about the stack (Next.js 16 / Supabase / Vercel) or the regional-builder arc.`,
  },
  {
    id: 'reddit-utrgv',
    day: 'Wed',
    platform: 'r/UTRGV',
    emoji: '🎓',
    color: '#ff4500',
    windowTiming: 'Sun night 8–10pm CT or Mon morning',
    submitUrl: 'https://www.reddit.com/r/UTRGV/submit',
    title: 'UTRGV student here — built a free border wait app for anyone who crosses to MX',
    body: `hey Vaqueros.

if you cross to Reynosa / Matamoros / Nuevo Progreso for pharmacy, dental, family, whatever — built something for you:

cruzar.app — shows the live wait at every bridge, every 15 min from the CBP feed. free, no login.

i'm a student here too, bio minor. built it because i was sick of guessing before leaving campus.

if you commute and cross, please tap "report" when you do. one tap, helps the next car in line.

— Diego`,
  },
  {
    id: 'reddit-brownsville',
    day: 'Thu AM',
    platform: 'r/brownsville',
    emoji: '🏙️',
    color: '#ff4500',
    windowTiming: 'Thu · 10am CT',
    submitUrl: 'https://www.reddit.com/r/brownsville/submit',
    title: 'built a free app for the puentes — Gateway, Veterans, Los Tomates',
    body: `cruzar.app — live wait at every crossing, every 15 min from the CBP feed. free, no login.

solo dev from McAllen, not selling anything.

if you cross through brownsville, tap "report" when you do — those reports help the next car in line. also just added southbound reports since CBP only publishes northbound.

roast welcome.`,
  },
  {
    id: 'reddit-laredo',
    day: 'Thu AM',
    platform: 'r/Laredo',
    emoji: '🛣️',
    color: '#ff4500',
    windowTiming: 'Thu · 10am CT (post ~30min after Brownsville to avoid mod cross-flag)',
    submitUrl: 'https://www.reddit.com/r/Laredo/submit',
    title: 'built a free app for the puentes — all 4 Laredo crossings',
    body: `cruzar.app — live wait at World Trade, Lincoln, Colombia, Laredo IV. every 15 min from the CBP feed. free, no login.

solo dev from McAllen.

if you cross through laredo, tap "report" when you do. just added southbound reports since CBP only publishes northbound.

roast welcome.`,
  },
  {
    id: 'news-pitch',
    day: 'Thu',
    platform: 'Local news pitches (7 outlets, 7 emails)',
    emoji: '📰',
    color: '#111827',
    windowTiming: 'Thu morning · send all 7 same day, one email each, DO NOT CC',
    submitUrl: 'mailto:?subject=UTRGV%20student%20built%20a%20free%20border-wait-time%20app%20replacing%20the%20Facebook%20group%20scroll%20%E2%80%94%20500%2B%20RGV%20users',
    title: 'Subject: UTRGV student built a free border-wait-time app replacing the Facebook group scroll — 500+ RGV users, free for commuters, $19.99/mo for trucking fleets',
    body: `Send one email per outlet. Recipients:

• ValleyCentral (KVEO Ch 23)        news@valleycentral.com
• KRGV Channel 5                     newsroom@krgv.com
• The Monitor (McAllen)              newsroom@themonitor.com
• Brownsville Herald                 news@brownsvilleherald.com
• Rio Grande Guardian                newsdesk@riograndeguardian.com
• Texas Border Business              news@texasborderbusiness.com
• Laredo Morning Times               lmt@hearstnp.com

---

Body (paste once, address each recipient individually):

Hi [first name],

I'm Diego Aguirre, 20, a UTRGV student in [your major] — born and raised in the Valle. I built and just launched **cruzar.app**, a free live border wait-time app for every US-Mexico crossing.

**Why I think this is a story:**
- Solo RGV student building regional tech that actually solves a daily pain for ~1.4M RGV border crossers
- The only alternative today is scrolling Facebook groups — Cruzar is the first structured, bilingual, free, real-time alternative
- Just added **southbound community reports** — CBP's public API only publishes northbound, so there's been no live data for the half of the market crossing INTO Mexico. Cruzar fills that gap with community-sourced data.
- New $19.99/mo Business tier for small RGV trucking fleets (2–10 trucks) — they can share a live tracking link with their customers (paste in WhatsApp), same price point their fleets can actually afford
- 100% free for commuters. No ads, no login required, data from the public CBP feed

If you'd like to talk, I'm local — happy to meet in person for a demo at a [McAllen / Brownsville / Edinburg] coffee shop. I can also send screenshots or a 60-second video walkthrough.

Thanks for reading,

Diego Aguirre
hello@cruzar.app
cruzar.app

---

FOLLOW-UP RULES:
- 7 days with no reply: one polite bump. "Hi [name], circling back on the Cruzar story — happy to jump on a 5-min call whenever."
- 14 days with no reply: drop it, move on. Do NOT bump a third time.
- If reply lands: respond within 4 hours. Regional reporters hate waiting.`,
    notes: 'Attach 1 homepage mobile screenshot, 1 /camaras screenshot, 1-line bio.',
  },
]

export default function AdminBuzzPage() {
  const { user, loading } = useAuth()
  const router = useRouter()
  const [copiedId, setCopiedId] = useState<string | null>(null)
  const [done, setDone] = useState<Record<string, boolean>>({})

  useEffect(() => {
    if (!loading && (!user || user.email !== ADMIN_EMAIL)) {
      router.push('/')
    }
  }, [user, loading, router])

  useEffect(() => {
    try {
      const raw = localStorage.getItem(DONE_KEY)
      if (raw) setDone(JSON.parse(raw))
    } catch {}
  }, [])

  function toggleDone(id: string) {
    setDone(prev => {
      const next = { ...prev, [id]: !prev[id] }
      try { localStorage.setItem(DONE_KEY, JSON.stringify(next)) } catch {}
      return next
    })
  }

  async function copy(text: string, id: string) {
    try {
      await navigator.clipboard.writeText(text)
      setCopiedId(id)
      setTimeout(() => setCopiedId(null), 1400)
    } catch {}
  }

  if (loading || !user || user.email !== ADMIN_EMAIL) {
    return <main className="min-h-screen bg-gray-950 p-8 text-white/50">Loading…</main>
  }

  const completedCount = CHANNELS.filter(c => done[c.id]).length

  return (
    <main className="min-h-screen bg-gray-50 dark:bg-gray-950">
      <div className="max-w-3xl mx-auto px-4 pb-16">
        <div className="pt-6 pb-4 flex items-center justify-between">
          <Link href="/admin" className="flex items-center gap-1 text-xs text-gray-500 hover:text-gray-700 dark:hover:text-gray-200">
            <ArrowLeft className="w-3 h-3" /> Admin
          </Link>
          <span className="text-xs font-bold text-gray-500 dark:text-gray-400">
            {completedCount} / {CHANNELS.length} posted
          </span>
        </div>

        <h1 className="text-2xl font-bold text-gray-900 dark:text-gray-100 mb-1">
          Buzz posting queue
        </h1>
        <p className="text-sm text-gray-600 dark:text-gray-400 mb-6">
          Each card = one post. Copy the title, copy the body, hit the OPEN button, paste both, submit. Mark as posted.
        </p>

        <div className="space-y-6">
          {CHANNELS.map(ch => {
            const isDone = !!done[ch.id]
            return (
              <div
                key={ch.id}
                className={`rounded-2xl border-2 overflow-hidden transition-opacity ${
                  isDone
                    ? 'border-green-500 bg-green-50 dark:bg-green-900/10 opacity-60'
                    : 'border-gray-200 dark:border-gray-800 bg-white dark:bg-gray-900'
                }`}
              >
                <div
                  className="px-5 py-3 flex items-center justify-between"
                  style={{ background: `${ch.color}15`, borderBottom: `1px solid ${ch.color}33` }}
                >
                  <div className="flex items-center gap-2">
                    <span className="text-xl">{ch.emoji}</span>
                    <div>
                      <div className="text-xs font-bold uppercase tracking-wider" style={{ color: ch.color }}>
                        {ch.day} · {ch.platform}
                      </div>
                      <div className="text-[11px] text-gray-600 dark:text-gray-400 mt-0.5">
                        {ch.windowTiming}
                      </div>
                    </div>
                  </div>
                  <label className="flex items-center gap-2 cursor-pointer">
                    <input
                      type="checkbox"
                      checked={isDone}
                      onChange={() => toggleDone(ch.id)}
                      className="w-4 h-4 accent-green-600"
                    />
                    <span className="text-xs font-bold text-gray-700 dark:text-gray-200">
                      {isDone ? 'Posted ✓' : 'Mark posted'}
                    </span>
                  </label>
                </div>

                <div className="p-5 space-y-4">
                  <div>
                    <div className="flex items-center justify-between mb-1.5">
                      <label className="text-[11px] font-bold uppercase tracking-wider text-gray-500 dark:text-gray-400">
                        Title
                      </label>
                      <button
                        onClick={() => copy(ch.title, `${ch.id}-title`)}
                        className="inline-flex items-center gap-1 text-xs font-bold px-2.5 py-1 rounded-md bg-gray-900 dark:bg-gray-100 text-white dark:text-gray-900"
                      >
                        {copiedId === `${ch.id}-title` ? <Check className="w-3 h-3" /> : <Copy className="w-3 h-3" />}
                        {copiedId === `${ch.id}-title` ? 'Copied' : 'Copy title'}
                      </button>
                    </div>
                    <div className="bg-gray-50 dark:bg-gray-800 rounded-lg p-3 text-sm text-gray-900 dark:text-gray-100 font-medium leading-snug break-words">
                      {ch.title}
                    </div>
                  </div>

                  <div>
                    <div className="flex items-center justify-between mb-1.5">
                      <label className="text-[11px] font-bold uppercase tracking-wider text-gray-500 dark:text-gray-400">
                        Body
                      </label>
                      <button
                        onClick={() => copy(ch.body, `${ch.id}-body`)}
                        className="inline-flex items-center gap-1 text-sm font-bold px-3 py-1.5 rounded-md bg-green-600 hover:bg-green-700 text-white"
                      >
                        {copiedId === `${ch.id}-body` ? <Check className="w-4 h-4" /> : <Copy className="w-4 h-4" />}
                        {copiedId === `${ch.id}-body` ? 'Copied' : 'Copy body'}
                      </button>
                    </div>
                    <textarea
                      readOnly
                      value={ch.body}
                      className="w-full h-48 bg-gray-50 dark:bg-gray-800 rounded-lg p-3 text-xs font-mono text-gray-900 dark:text-gray-100 leading-relaxed resize-none focus:outline-none focus:ring-2"
                      style={{ outlineColor: ch.color }}
                    />
                  </div>

                  {ch.notes && (
                    <div className="text-[11px] text-amber-800 dark:text-amber-300 bg-amber-50 dark:bg-amber-900/20 border border-amber-200 dark:border-amber-800/50 rounded-lg px-3 py-2">
                      ⚠️ {ch.notes}
                    </div>
                  )}

                  <a
                    href={ch.submitUrl}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="block w-full text-center py-3.5 rounded-xl font-black text-base text-white active:scale-[0.98] transition-transform"
                    style={{ background: ch.color }}
                  >
                    <ExternalLink className="w-4 h-4 inline-block mr-1.5 -mt-0.5" />
                    Open {ch.platform} →
                  </a>
                </div>
              </div>
            )
          })}
        </div>

        <p className="text-[11px] text-gray-400 dark:text-gray-600 mt-8 text-center">
          Progress saved in this browser. Checked state clears if you wipe localStorage.
        </p>
      </div>
    </main>
  )
}
