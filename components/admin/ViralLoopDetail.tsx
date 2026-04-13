'use client'

import { useEffect, useState } from 'react'

// Admin-only viral loop detail. Fetches /api/admin/viral-loop and
// renders a per-user table showing who's sharing, through what
// channel, when, and who they brought back via referral. Replaces
// the two aggregate-count tiles that used to be the only visibility
// Diego had into the viral loop.

interface Referral {
  id: string
  email: string
  event_type: string | null
  created_at: string | null
}

interface RecentShare {
  channel: string | null
  context: string | null
  created_at: string
}

interface Sharer {
  user_id: string
  email: string
  display_name: string | null
  tier: string
  share_count: number
  reports_count: number
  created_at: string
  last_share_at: string | null
  channel_counts: Record<string, number>
  recent_shares: RecentShare[]
  referrals: Referral[]
  referral_count: number
}

function timeAgo(iso: string | null): string {
  if (!iso) return '—'
  const mins = Math.floor((Date.now() - new Date(iso).getTime()) / 60000)
  if (mins < 1) return 'ahora'
  if (mins < 60) return `${mins}m`
  const hrs = Math.floor(mins / 60)
  if (hrs < 24) return `${hrs}h`
  return `${Math.floor(hrs / 24)}d`
}

function channelLabel(ch: string | null): string {
  if (!ch) return '—'
  const map: Record<string, string> = {
    whatsapp: 'WhatsApp',
    facebook: 'Facebook',
    copy:     'Copy',
    native:   'Native',
  }
  return map[ch] || ch
}

function tierColor(tier: string): string {
  if (tier === 'pro') return 'bg-blue-100 text-blue-700'
  if (tier === 'business') return 'bg-purple-100 text-purple-700'
  if (tier === 'guest') return 'bg-gray-100 text-gray-600'
  return 'bg-green-100 text-green-700'
}

export function ViralLoopDetail() {
  const [sharers, setSharers] = useState<Sharer[] | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [expanded, setExpanded] = useState<string | null>(null)

  useEffect(() => {
    fetch('/api/admin/viral-loop')
      .then(async (r) => {
        if (!r.ok) throw new Error((await r.json()).error || `HTTP ${r.status}`)
        return r.json()
      })
      .then((d) => setSharers(d.sharers || []))
      .catch((e) => setError(e.message))
      .finally(() => setLoading(false))
  }, [])

  if (loading) return <p className="mt-4 text-xs text-gray-400">Loading viral detail…</p>
  if (error) return <p className="mt-4 text-xs text-red-500">Error: {error}</p>
  if (!sharers || sharers.length === 0) {
    return (
      <p className="mt-4 text-xs text-gray-400 text-center italic">
        No shares tracked yet. Once share_events starts getting rows, this table will populate.
      </p>
    )
  }

  return (
    <div className="mt-4 bg-white border border-gray-200 rounded-2xl overflow-hidden">
      <div className="px-4 py-3 border-b border-gray-100 bg-gray-50">
        <p className="text-xs font-bold text-gray-700">
          Per-user viral loop detail
        </p>
        <p className="text-[10px] text-gray-500 mt-0.5">
          Top {sharers.length} sharers · tap a row to see their share timeline + referrals
        </p>
      </div>
      <div className="divide-y divide-gray-100">
        {sharers.map((s) => {
          const isExpanded = expanded === s.user_id
          return (
            <div key={s.user_id}>
              <button
                type="button"
                onClick={() => setExpanded(isExpanded ? null : s.user_id)}
                className="w-full px-4 py-3 flex items-center gap-3 hover:bg-gray-50 text-left"
              >
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2 flex-wrap">
                    <p className="text-xs font-bold text-gray-900 truncate">
                      {s.display_name || s.email || s.user_id.slice(0, 8)}
                    </p>
                    <span className={`text-[9px] font-bold px-1.5 py-0.5 rounded-full uppercase ${tierColor(s.tier)}`}>
                      {s.tier}
                    </span>
                  </div>
                  <p className="text-[10px] text-gray-400 truncate">{s.email}</p>
                </div>
                <div className="flex items-center gap-3 flex-shrink-0 text-right">
                  <div>
                    <p className="text-base font-black text-emerald-700 tabular-nums leading-none">{s.share_count}</p>
                    <p className="text-[9px] text-gray-400 uppercase font-bold">shares</p>
                  </div>
                  <div>
                    <p className="text-base font-black text-blue-700 tabular-nums leading-none">{s.reports_count}</p>
                    <p className="text-[9px] text-gray-400 uppercase font-bold">reports</p>
                  </div>
                  <div>
                    <p className="text-base font-black text-purple-700 tabular-nums leading-none">{s.referral_count}</p>
                    <p className="text-[9px] text-gray-400 uppercase font-bold">referred</p>
                  </div>
                  <div className="w-10 text-right">
                    <p className="text-[10px] text-gray-500 tabular-nums">{timeAgo(s.last_share_at)}</p>
                  </div>
                </div>
                <span className="text-gray-300 text-xs flex-shrink-0">{isExpanded ? '▼' : '▶'}</span>
              </button>

              {isExpanded && (
                <div className="px-4 py-3 bg-gray-50 border-t border-gray-100">
                  {/* Channel breakdown */}
                  {Object.keys(s.channel_counts).length > 0 && (
                    <div className="mb-3">
                      <p className="text-[10px] font-bold text-gray-500 uppercase tracking-wide mb-1.5">Channels used</p>
                      <div className="flex gap-1.5 flex-wrap">
                        {Object.entries(s.channel_counts).map(([ch, n]) => (
                          <span key={ch} className="text-[10px] font-semibold bg-white border border-gray-200 rounded-full px-2 py-0.5">
                            {channelLabel(ch)} · {n}
                          </span>
                        ))}
                      </div>
                    </div>
                  )}

                  {/* Recent shares */}
                  {s.recent_shares.length > 0 ? (
                    <div className="mb-3">
                      <p className="text-[10px] font-bold text-gray-500 uppercase tracking-wide mb-1.5">Recent shares</p>
                      <div className="space-y-1">
                        {s.recent_shares.map((ev, i) => (
                          <div key={i} className="flex items-center justify-between text-[11px] bg-white rounded-lg px-2.5 py-1.5 border border-gray-100">
                            <span className="font-semibold text-gray-700">
                              {channelLabel(ev.channel)} <span className="text-gray-400">· {ev.context || 'unknown'}</span>
                            </span>
                            <span className="text-gray-400 tabular-nums">{timeAgo(ev.created_at)}</span>
                          </div>
                        ))}
                      </div>
                    </div>
                  ) : (
                    <p className="text-[10px] text-gray-400 italic mb-3">
                      No per-event data yet — the share_events table may not have been migrated, or this user shared before it existed.
                    </p>
                  )}

                  {/* Referrals this user drove */}
                  {s.referrals.length > 0 ? (
                    <div>
                      <p className="text-[10px] font-bold text-gray-500 uppercase tracking-wide mb-1.5">
                        People they brought back ({s.referrals.length})
                      </p>
                      <div className="space-y-1">
                        {s.referrals.slice(0, 10).map((r) => (
                          <div key={r.id} className="flex items-center justify-between text-[11px] bg-white rounded-lg px-2.5 py-1.5 border border-gray-100">
                            <div className="min-w-0 flex-1">
                              <span className="font-semibold text-gray-700 truncate block">{r.email || r.id.slice(0, 8)}</span>
                              {r.event_type && (
                                <span className="text-[9px] text-gray-400 uppercase">{r.event_type}</span>
                              )}
                            </div>
                            <span className="text-gray-400 tabular-nums flex-shrink-0 ml-2">{timeAgo(r.created_at)}</span>
                          </div>
                        ))}
                      </div>
                    </div>
                  ) : (
                    <p className="text-[10px] text-gray-400 italic">
                      No attributed referrals yet. A referral counts when someone they directed signs up or files a report with their ref code.
                    </p>
                  )}
                </div>
              )}
            </div>
          )
        })}
      </div>
    </div>
  )
}
