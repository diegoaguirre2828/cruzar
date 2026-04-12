'use client'

import { useState, useEffect } from 'react'
import { useAuth } from '@/lib/useAuth'
import { useRouter } from 'next/navigation'
import { Copy, Check, ExternalLink, RefreshCw } from 'lucide-react'

const ADMIN_EMAIL = 'cruzabusiness@gmail.com'

type RegionKey = 'rgv' | 'brownsville' | 'laredo' | 'eagle_pass' | 'el_paso' | 'san_luis' | 'other'

const REPLY_PORTS: { portId: string; name: string; regionKey: RegionKey }[] = [
  { portId: '230501', name: 'Puente Hidalgo (McAllen)',       regionKey: 'rgv' },
  { portId: '230502', name: 'Puente Pharr–Reynosa',           regionKey: 'rgv' },
  { portId: '230503', name: 'Puente Anzaldúas',               regionKey: 'rgv' },
  { portId: '230901', name: 'Puente Progreso',                regionKey: 'rgv' },
  { portId: '230902', name: 'Puente Donna / Los Indios',      regionKey: 'rgv' },
  { portId: '535501', name: 'Puente Gateway (Brownsville)',   regionKey: 'brownsville' },
  { portId: '535502', name: 'Puente Veterans (Brownsville)',  regionKey: 'brownsville' },
  { portId: '535503', name: 'Puente Los Tomates',             regionKey: 'brownsville' },
  { portId: '230401', name: 'Puente Laredo I (Internacional)',regionKey: 'laredo' },
  { portId: '230402', name: 'Puente Laredo II (World Trade)', regionKey: 'laredo' },
  { portId: '230301', name: 'Puente Eagle Pass / Piedras Negras', regionKey: 'eagle_pass' },
  { portId: '240201', name: 'Puente El Paso / Juárez',        regionKey: 'el_paso' },
]

const REGIONS: { key: RegionKey; label: string; emoji: string }[] = [
  { key: 'rgv',         label: 'RGV / McAllen / Reynosa',         emoji: '🌵' },
  { key: 'brownsville', label: 'Matamoros / Brownsville',          emoji: '🏙️' },
  { key: 'laredo',      label: 'Laredo / Nuevo Laredo',            emoji: '🛣️' },
  { key: 'eagle_pass',  label: 'Eagle Pass / Piedras Negras',      emoji: '🦅' },
  { key: 'el_paso',     label: 'El Paso / Juárez',                 emoji: '⛰️' },
  { key: 'san_luis',    label: 'San Luis RC / Arizona',            emoji: '🌵' },
  { key: 'other',       label: 'Other',                            emoji: '📍' },
]

const FACEBOOK_GROUPS: { name: string; regionKey: RegionKey; url: string; members: string }[] = [
  { name: 'FILAS DE PUENTES ANZALDUAS, HIDALGO, PHARR, DONNA, PROGRESO, INDIOS', regionKey: 'rgv', url: 'https://www.facebook.com/groups/2331786033753528', members: '' },
  { name: 'Fila en Puentes Reynosa Hidalgo, Anzalduas y Pharr',                  regionKey: 'rgv', url: 'https://www.facebook.com/groups/630300451147099', members: '' },
  { name: 'FILAS DE PUENTES REYNOSA HIDALGO, DONNA, PHARR, ANZALDUAS, PROGRESO', regionKey: 'rgv', url: 'https://www.facebook.com/groups/302019986939323', members: '' },
  { name: 'Fila en Puente Reynosa-Hidalgo',                                       regionKey: 'rgv', url: 'https://www.facebook.com/groups/978204527689403', members: '' },
  { name: 'Filas de Progreso, Donna, y Los Indios',                               regionKey: 'rgv', url: 'https://www.facebook.com/groups/302878187276542', members: '' },
  { name: 'FILA PUENTE LOS INDIOS',                                               regionKey: 'brownsville', url: 'https://www.facebook.com/groups/230659829875807', members: '' },
  { name: 'FILA PUENTE LOS INDIOS (2)',                                            regionKey: 'brownsville', url: 'https://www.facebook.com/groups/1731295540981020', members: '' },
  { name: 'Fila de Los Puentes Internacionales',                                  regionKey: 'brownsville', url: 'https://www.facebook.com/groups/796522180440318', members: '' },
  { name: 'Filas de Puentes Matamoros/Brownsville',                               regionKey: 'brownsville', url: 'https://www.facebook.com/groups/416633560460332', members: '' },
  { name: 'Matamoros/Brownsville Bridge Rows.',                                   regionKey: 'brownsville', url: 'https://www.facebook.com/groups/3374381019461919', members: '' },
  { name: 'Filas Puentes Bville/Matamoros — SOLO FILA PUENTES',                  regionKey: 'brownsville', url: 'https://www.facebook.com/groups/2232818820081853', members: '' },
  { name: 'Filas de Puentes Matamoros - Brownsville',                             regionKey: 'brownsville', url: 'https://www.facebook.com/groups/autosenmatamoros', members: '' },
  { name: 'Report on queues at international bridges in Nuevo Laredo',            regionKey: 'laredo', url: 'https://www.facebook.com/groups/276336942705237', members: '' },
  { name: 'Fila puente 2. nuevo laredo tamaulipas NO CENTRI',                     regionKey: 'laredo', url: 'https://www.facebook.com/groups/1752011028879761', members: '' },
  { name: 'Filas de los puentes 1 y 2 (Piedras Negras - Eagle Pass)',             regionKey: 'eagle_pass', url: 'https://www.facebook.com/groups/994149160726349', members: '' },
  { name: 'Puente Internacional Piedras Negras - Eagle Pass',                     regionKey: 'eagle_pass', url: 'https://www.facebook.com/groups/218202582825387', members: '' },
  { name: 'Reporte de Puentes Juarez-El Paso',                                    regionKey: 'el_paso', url: 'https://www.facebook.com/groups/1615115372079924', members: '' },
  { name: 'TU REPORTE PUENTES JUAREZ/EL PASO',                                   regionKey: 'el_paso', url: 'https://www.facebook.com/groups/reportepuentes', members: '' },
  { name: 'JRZ-ELP Bridge Report',                                                regionKey: 'el_paso', url: 'https://www.facebook.com/groups/464122564438748', members: '' },
  { name: 'En Donde Va La Fila? San Luis RC',                                     regionKey: 'san_luis', url: 'https://www.facebook.com/groups/208758912816787', members: '' },
]

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
  const [tab, setTab] = useState<'groups' | 'post' | 'reply' | 'cron' | 'advertisers' | 'subs' | 'stats' | 'blast'>('groups')
  const [advertisers, setAdvertisers] = useState<Advertiser[]>([])
  const [subs, setSubs] = useState<Subscription[]>([])
  const [stats, setStats] = useState<{
    users: { total: number; new7: number; new30: number; active7: number; active30: number; byTier: Record<string, number> }
    reports: { total: number; last7: number; last30: number; recent: { id: string; port_id: string; report_type: string; condition: string; wait_minutes: number | null; created_at: string }[] }
    recentUsers: { id: string; email: string; tier: string; created_at: string }[]
  } | null>(null)
  const [revenue, setRevenue] = useState<{
    mrr: number; activeSubscriptions: number; proCount: number; businessCount: number
    recentCharges: { id: string; amount: number; email: string; created: number; description: string }[]
  } | null>(null)
  const [blastTitle, setBlastTitle] = useState('')
  const [blastBody, setBlastBody] = useState('')
  const [blastUrl, setBlastUrl] = useState('')
  const [blastSending, setBlastSending] = useState(false)
  const [blastResult, setBlastResult] = useState<{ sent: number; failed: number; total: number } | null>(null)
  const [caption, setCaption] = useState('')
  const [pageCaption, setPageCaption] = useState('')
  const [loadingPost, setLoadingPost] = useState(false)
  const [posting, setPosting] = useState(false)
  const [postResult, setPostResult] = useState<{ fbPostId?: string; fbError?: string; tone?: string } | null>(null)
  const [copied, setCopied] = useState(false)
  const [copiedPage, setCopiedPage] = useState(false)
  const [replyPortId, setReplyPortId] = useState('230501')
  const [replyTopic, setReplyTopic] = useState<'wait' | 'exchange' | 'documents' | 'sentri' | 'insurance' | 'fmm' | 'best_time' | 'secondary' | 'items'>('wait')
  const [replyText, setReplyText] = useState('')
  const [replyWait, setReplyWait] = useState<number | null>(null)
  const [replyVariant, setReplyVariant] = useState(-1)
  const [replyLang, setReplyLang] = useState<'es' | 'en'>('es')
  const [loadingReply, setLoadingReply] = useState(false)
  const [replyCopied, setReplyCopied] = useState(false)
  const [copiedUrl, setCopiedUrl] = useState<string | null>(null)
  const [selectedRegion, setSelectedRegion] = useState<string>('all')
  const [cronApiKey, setCronApiKey] = useState('')
  const [cronCreateStatus, setCronCreateStatus] = useState<{ created: number; failed: number; firstError?: string | null } | null>(null)
  const [cronCreating, setCronCreating] = useState(false)
  const [postedGroups, setPostedGroups] = useState<string[]>(() => {
    if (typeof window === 'undefined') return []
    const saved = localStorage.getItem('cruzar_posted_groups')
    return saved ? JSON.parse(saved) : []
  })

  useEffect(() => {
    if (!loading && (!user || user.email !== ADMIN_EMAIL)) {
      router.push('/')
    }
  }, [user, loading, router])

  useEffect(() => {
    if (!user || user.email !== ADMIN_EMAIL) return
    fetch('/api/admin/advertisers').then(r => r.json()).then(d => setAdvertisers(d.advertisers || []))
    fetch('/api/admin/subscriptions').then(r => r.json()).then(d => setSubs(d.subscriptions || []))
    fetch('/api/admin/stats').then(r => r.json()).then(d => { if (d.users) setStats(d) })
    fetch('/api/admin/revenue').then(r => r.json()).then(d => { if (d.mrr !== undefined) setRevenue(d) })
  }, [user])

  function togglePosted(name: string) {
    setPostedGroups(prev => {
      const next = prev.includes(name) ? prev.filter(g => g !== name) : [...prev, name]
      localStorage.setItem('cruzar_posted_groups', JSON.stringify(next))
      return next
    })
  }

  function resetPosted() {
    setPostedGroups([])
    localStorage.removeItem('cruzar_posted_groups')
  }

  async function generatePost(region = selectedRegion) {
    setLoadingPost(true)
    setCaption('')
    setPageCaption('')
    try {
      const res = await fetch(`/api/admin/generate-post?region=${region}`)
      const data = await res.json()
      setCaption(data.groupCaption || data.caption || '')
      setPageCaption(data.pageCaption || '')
    } catch {
      setCaption('Error fetching post. Try again.')
    } finally {
      setLoadingPost(false)
    }
  }

  async function postToPageNow(region = selectedRegion) {
    setPosting(true)
    setPostResult(null)
    setCaption('')
    setPageCaption('')
    try {
      const res = await fetch('/api/admin/generate-post', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ region }),
      })
      const data = await res.json()
      setCaption(data.groupCaption || data.caption || '')
      setPageCaption(data.pageCaption || '')
      setPostResult({ fbPostId: data.fbPostId, fbError: data.fbError, tone: data.tone })
    } catch {
      setPostResult({ fbError: 'Request failed. Try again.' })
    } finally {
      setPosting(false)
    }
  }

  async function createAllCronJobs() {
    if (!cronApiKey.trim()) return
    setCronCreating(true)
    setCronCreateStatus(null)
    try {
      const res = await fetch('/api/admin/create-cron-jobs', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ cronApiKey: cronApiKey.trim() }),
      })
      const data = await res.json()
      setCronCreateStatus({ created: data.created, failed: data.failed, firstError: data.firstError })
    } catch {
      setCronCreateStatus({ created: 0, failed: 24 })
    } finally {
      setCronCreating(false)
    }
  }

  function copyCaption() {
    navigator.clipboard.writeText(caption)
    setCopied(true)
    setTimeout(() => setCopied(false), 2000)
  }

  function copyPageCaption() {
    navigator.clipboard.writeText(pageCaption)
    setCopiedPage(true)
    setTimeout(() => setCopiedPage(false), 2000)
  }


  if (loading) return null

  return (
    <main className="min-h-screen bg-gray-50">
      <div className="max-w-4xl mx-auto px-4 pb-10">
        <div className="pt-6 pb-4">
          <h1 className="text-xl font-bold text-gray-900">🔐 Admin Panel</h1>
          <p className="text-xs text-gray-400">cruzar.app</p>
        </div>

        {/* Tabs */}
        <div className="flex flex-wrap gap-1 bg-gray-100 rounded-xl p-1 mb-5">
          {(['stats', 'blast', 'groups', 'post', 'reply', 'cron', 'advertisers', 'subs'] as const).map(t => (
            <button key={t} onClick={() => setTab(t)}
              className={`px-4 py-2 text-xs font-medium rounded-lg transition-colors capitalize ${tab === t ? 'bg-white shadow text-gray-900' : 'text-gray-500'}`}>
              {t === 'stats'       ? '📊 Stats' :
               t === 'blast'       ? '📣 Blast' :
               t === 'groups'      ? `Groups (${FACEBOOK_GROUPS.length})` :
               t === 'post'        ? '✍️ Posts' :
               t === 'reply'       ? '💬 Reply' :
               t === 'cron'        ? '⏰ Cron' :
               t === 'advertisers' ? `Ads (${advertisers.length})` :
               `Subs (${subs.length})`}
            </button>
          ))}
        </div>

        {/* Facebook Groups Tracker */}
        {tab === 'groups' && (
          <div>
            <div className="flex items-center justify-between mb-4">
              <div>
                <p className="text-sm font-semibold text-gray-900">Facebook Groups</p>
                <p className="text-xs text-gray-500">{postedGroups.length}/{FACEBOOK_GROUPS.length} posted today — check off as you go</p>
              </div>
              {postedGroups.length > 0 && (
                <button onClick={resetPosted} className="text-xs text-red-500 hover:text-red-700">Reset all</button>
              )}
            </div>
            {REGIONS.map(region => {
              const groups = FACEBOOK_GROUPS.filter(g => g.regionKey === region.key)
              if (groups.length === 0) return null
              const doneCount = groups.filter(g => postedGroups.includes(g.name)).length
              return (
                <div key={region.key} className="mb-5">
                  <div className="flex items-center justify-between mb-2">
                    <p className="text-xs font-bold text-gray-500 uppercase tracking-wider">
                      {region.emoji} {region.label}
                    </p>
                    <div className="flex items-center gap-2">
                      <span className="text-xs text-gray-400">{doneCount}/{groups.length}</span>
                      <button
                        onClick={() => { setTab('post'); setSelectedRegion(region.key); setCaption('') }}
                        className="text-xs font-medium text-blue-600 hover:text-blue-800 flex items-center gap-0.5"
                      >
                        Generate post <ExternalLink className="w-2.5 h-2.5" />
                      </button>
                    </div>
                  </div>
                  <div className="space-y-2">
                    {groups.map(g => (
                      <div key={g.name} className={`bg-white rounded-2xl border p-4 shadow-sm flex items-center justify-between gap-3 transition-colors ${postedGroups.includes(g.name) ? 'border-green-300 bg-green-50' : 'border-gray-200'}`}>
                        <div className="flex items-center gap-3 flex-1 min-w-0">
                          <button
                            onClick={() => togglePosted(g.name)}
                            className={`w-6 h-6 rounded-full border-2 flex-shrink-0 flex items-center justify-center transition-colors ${postedGroups.includes(g.name) ? 'bg-green-500 border-green-500 text-white' : 'border-gray-300'}`}
                          >
                            {postedGroups.includes(g.name) && <Check className="w-3.5 h-3.5" />}
                          </button>
                          <div className="min-w-0">
                            <p className={`text-sm font-medium truncate ${postedGroups.includes(g.name) ? 'text-green-800 line-through' : 'text-gray-900'}`}>{g.name}</p>
                            {g.members && <p className="text-xs text-gray-400">{g.members} members</p>}
                          </div>
                        </div>
                        <a href={g.url} target="_blank" rel="noopener noreferrer"
                          className="flex-shrink-0 flex items-center gap-1 text-xs text-blue-600 hover:text-blue-800 font-medium">
                          Open <ExternalLink className="w-3 h-3" />
                        </a>
                      </div>
                    ))}
                  </div>
                </div>
              )
            })}
            <div className="mt-2 bg-amber-50 border border-amber-200 rounded-xl p-4">
              <p className="text-xs font-semibold text-amber-800 mb-1">📅 Best times to post</p>
              <div className="grid grid-cols-2 gap-1 text-xs text-amber-700">
                <span>🌅 5:30am — morning commute</span>
                <span>☀️ 11:30am — midday truckers</span>
                <span>🌆 3:30pm — after work/school</span>
                <span>🌙 7:00pm — evening crossing</span>
              </div>
            </div>
          </div>
        )}

        {/* Post Generator */}
        {tab === 'post' && (
          <div className="space-y-4">
            <div>
              <p className="text-sm font-semibold text-gray-900">Facebook Posts</p>
              <p className="text-xs text-gray-500 mt-0.5">Posts to your Page automatically. Generates a group caption to copy-paste.</p>
            </div>

            {/* Region selector */}
            <div className="flex flex-wrap gap-2">
              {[{ key: 'rgv', label: '🌵 RGV' }, { key: 'all', label: '🌎 All Regions' }].map(r => (
                <button
                  key={r.key}
                  onClick={() => { setSelectedRegion(r.key); setCaption(''); setPageCaption(''); setPostResult(null) }}
                  className={`px-3 py-1.5 rounded-full text-xs font-semibold border transition-colors ${selectedRegion === r.key ? 'bg-gray-900 text-white border-gray-900' : 'bg-white text-gray-600 border-gray-200 hover:border-gray-400'}`}
                >
                  {r.label}
                </button>
              ))}
            </div>

            {/* Main action — Post to Page */}
            <button
              onClick={() => postToPageNow(selectedRegion)}
              disabled={posting}
              className="w-full bg-blue-600 hover:bg-blue-700 text-white font-semibold py-3.5 rounded-xl text-sm transition-colors disabled:opacity-50 flex items-center justify-center gap-2"
            >
              {posting ? 'Posting...' : '🚀 Post to Facebook Page Now'}
            </button>

            {/* Post result */}
            {postResult && (
              <div className={`rounded-xl px-4 py-3 text-sm font-medium ${postResult.fbPostId ? 'bg-green-50 border border-green-200 text-green-800' : 'bg-red-50 border border-red-200 text-red-700'}`}>
                {postResult.fbPostId
                  ? `✅ Posted to Facebook Page — tone: ${postResult.tone || 'auto'}`
                  : `❌ Facebook error: ${postResult.fbError}`}
              </div>
            )}

            {/* Page caption preview */}
            {pageCaption && (
              <div className="bg-white rounded-2xl border border-gray-200 shadow-sm overflow-hidden">
                <div className="flex items-center justify-between px-4 py-3 border-b border-gray-100">
                  <p className="text-xs font-semibold text-gray-500 uppercase tracking-wide">📄 Page Post (auto-posted above)</p>
                </div>
                <textarea
                  readOnly
                  value={pageCaption}
                  onClick={e => (e.target as HTMLTextAreaElement).select()}
                  className="w-full px-4 py-3 text-sm text-gray-600 whitespace-pre-wrap leading-relaxed resize-none focus:outline-none font-mono bg-gray-50"
                  rows={Math.min(pageCaption.split('\n').length + 1, 18)}
                />
                <div className="px-4 pb-3">
                  <button
                    onClick={copyPageCaption}
                    className={`w-full flex items-center justify-center gap-2 py-2.5 rounded-xl font-semibold text-xs transition-colors ${copiedPage ? 'bg-green-500 text-white' : 'bg-gray-100 text-gray-700 hover:bg-gray-200'}`}
                  >
                    {copiedPage ? <><Check className="w-3.5 h-3.5" /> Copied!</> : <><Copy className="w-3.5 h-3.5" /> Copy page caption</>}
                  </button>
                </div>
              </div>
            )}

            {/* Group caption */}
            {caption && (
              <div className="bg-white rounded-2xl border border-gray-200 shadow-sm overflow-hidden">
                <div className="flex items-center justify-between px-4 py-3 border-b border-gray-100">
                  <p className="text-xs font-semibold text-gray-500 uppercase tracking-wide">💬 Group Caption (paste manually in groups)</p>
                </div>
                <textarea
                  readOnly
                  value={caption}
                  onClick={e => (e.target as HTMLTextAreaElement).select()}
                  className="w-full px-4 py-3 text-sm text-gray-700 whitespace-pre-wrap leading-relaxed resize-none focus:outline-none font-mono bg-white"
                  rows={Math.min(caption.split('\n').length + 1, 18)}
                />
                <div className="px-4 pb-3">
                  <button
                    onClick={copyCaption}
                    className={`w-full flex items-center justify-center gap-2 py-2.5 rounded-xl font-semibold text-sm transition-colors ${copied ? 'bg-green-500 text-white' : 'bg-gray-900 text-white hover:bg-gray-700'}`}
                  >
                    {copied ? <><Check className="w-4 h-4" /> Copied!</> : <><Copy className="w-4 h-4" /> Copy group caption</>}
                  </button>
                </div>
              </div>
            )}

            {/* Preview only — no posting */}
            <button
              onClick={() => generatePost(selectedRegion)}
              disabled={loadingPost}
              className="w-full border border-gray-300 text-gray-600 font-medium py-2.5 rounded-xl text-xs hover:bg-gray-50 transition-colors disabled:opacity-50"
            >
              {loadingPost ? 'Generating preview...' : '👁 Preview captions without posting'}
            </button>
          </div>
        )}

        {/* Reply Generator */}
        {tab === 'reply' && (() => {
          const TOPICS = [
            { key: 'wait' as const,      label: 'Fila en puente',         emoji: '🚗', needsBridge: true },
            { key: 'exchange' as const,  label: 'Tipo de cambio',         emoji: '💵' },
            { key: 'documents' as const, label: 'Documentos pa cruzar',   emoji: '📄' },
            { key: 'sentri' as const,    label: 'SENTRI / Global Entry',  emoji: '⭐' },
            { key: 'insurance' as const, label: 'Seguro de auto México',  emoji: '🛡️' },
            { key: 'fmm' as const,       label: 'FMM / Permiso turista',  emoji: '📋' },
            { key: 'best_time' as const, label: 'Mejor hora pa cruzar',   emoji: '⏰' },
            { key: 'secondary' as const, label: 'Qué es secundaria',      emoji: '🔍' },
            { key: 'items' as const,     label: 'Qué puedo traer',        emoji: '🛃' },
          ]

          const selectedTopic = TOPICS.find(t => t.key === replyTopic)!

          async function generateTopicReply(variant = -1) {
            setLoadingReply(true)
            setReplyText('')
            setReplyWait(null)
            try {
              const variantParam = variant >= 0 ? `&variant=${variant}` : ''
              const portParam = replyTopic === 'wait' ? `&portId=${replyPortId}` : ''
              const res = await fetch(`/api/admin/generate-reply?type=${replyTopic}&lang=${replyLang}${portParam}${variantParam}`)
              const data = await res.json()
              setReplyText(data.reply || '')
              setReplyWait(data.wait ?? null)
              setReplyVariant(data.variant ?? -1)
            } catch {
              setReplyText('Error cargando. Intenta de nuevo.')
            } finally {
              setLoadingReply(false)
            }
          }

          return (
            <div>
              <div className="mb-4">
                <p className="text-sm font-semibold text-gray-900">Respuestas para Grupos de Facebook</p>
                <p className="text-xs text-gray-500">Selecciona de qué están preguntando y genera una respuesta casual con datos en vivo.</p>
              </div>

              {/* Language toggle */}
              <div className="flex gap-2 mb-4">
                {(['es', 'en'] as const).map(l => (
                  <button
                    key={l}
                    onClick={() => { setReplyLang(l); setReplyText(''); setReplyWait(null) }}
                    className={`flex-1 py-2.5 rounded-xl text-sm font-semibold border transition-colors ${replyLang === l ? 'bg-gray-900 text-white border-gray-900' : 'bg-white text-gray-600 border-gray-200 hover:border-gray-400'}`}
                  >
                    {l === 'es' ? '🇲🇽 Español' : '🇺🇸 English'}
                  </button>
                ))}
              </div>

              {/* Topic selector */}
              <div className="bg-white rounded-2xl border border-gray-200 shadow-sm p-4 mb-4">
                <label className="text-xs font-semibold text-gray-600 block mb-3">¿De qué están preguntando?</label>
                <div className="grid grid-cols-2 gap-2">
                  {TOPICS.map(t => (
                    <button
                      key={t.key}
                      onClick={() => { setReplyTopic(t.key); setReplyText(''); setReplyWait(null) }}
                      className={`px-3 py-2.5 rounded-xl text-xs font-semibold border text-left transition-colors ${replyTopic === t.key ? 'bg-gray-900 text-white border-gray-900' : 'bg-gray-50 text-gray-700 border-gray-200 hover:border-gray-400'}`}
                    >
                      {t.emoji} {t.label}
                    </button>
                  ))}
                </div>
              </div>

              {/* Bridge picker — only shows when topic is "wait" */}
              {selectedTopic.needsBridge && (
                <div className="bg-white rounded-2xl border border-gray-200 shadow-sm p-4 mb-4">
                  <label className="text-xs font-semibold text-gray-600 block mb-3">¿Cuál puente?</label>
                  <div className="grid grid-cols-2 gap-2">
                    {REPLY_PORTS.map(p => (
                      <button
                        key={p.portId}
                        onClick={() => { setReplyPortId(p.portId); setReplyText(''); setReplyWait(null) }}
                        className={`px-3 py-2.5 rounded-xl text-xs font-semibold border text-left transition-colors ${replyPortId === p.portId ? 'bg-gray-900 text-white border-gray-900' : 'bg-gray-50 text-gray-700 border-gray-200 hover:border-gray-400'}`}
                      >
                        {p.name}
                      </button>
                    ))}
                  </div>
                </div>
              )}

              <button
                onClick={() => generateTopicReply()}
                disabled={loadingReply}
                className="w-full bg-gray-900 text-white font-medium py-3 rounded-xl text-sm hover:bg-gray-700 transition-colors disabled:opacity-50 mb-4"
              >
                {loadingReply ? 'Generando...' : `⚡ Generar Respuesta — ${selectedTopic.emoji} ${selectedTopic.label}`}
              </button>

              {replyText && (
                <div className="bg-white rounded-2xl border border-gray-200 shadow-sm overflow-hidden">
                  <div className="flex items-center justify-between px-4 py-3 border-b border-gray-100">
                    <div className="flex items-center gap-2">
                      <p className="text-sm font-semibold text-gray-700">✅ Listo para pegar en Facebook</p>
                      {replyWait !== null && (
                        <span className={`text-xs font-bold px-2 py-0.5 rounded-full ${replyWait <= 20 ? 'bg-green-100 text-green-700' : replyWait <= 45 ? 'bg-yellow-100 text-yellow-700' : 'bg-red-100 text-red-700'}`}>
                          {replyWait} min
                        </span>
                      )}
                    </div>
                    <button
                      onClick={() => generateTopicReply((replyVariant + 1) % 6)}
                      className="flex items-center gap-1 text-xs text-gray-500 hover:text-gray-900 transition-colors"
                      title="Otra variante"
                    >
                      <RefreshCw className="w-3.5 h-3.5" /> Otra
                    </button>
                  </div>
                  <textarea
                    readOnly
                    value={replyText}
                    onClick={e => (e.target as HTMLTextAreaElement).select()}
                    className="w-full px-4 py-4 text-sm text-gray-800 whitespace-pre-wrap leading-relaxed resize-none focus:outline-none bg-white"
                    rows={Math.min(replyText.split('\n').length + 2, 10)}
                  />
                  <div className="px-4 pb-4">
                    <button
                      onClick={() => {
                        navigator.clipboard.writeText(replyText)
                        setReplyCopied(true)
                        setTimeout(() => setReplyCopied(false), 2000)
                      }}
                      className={`w-full flex items-center justify-center gap-2 py-3 rounded-xl font-semibold text-sm transition-colors ${
                        replyCopied ? 'bg-green-500 text-white' : 'bg-gray-900 text-white hover:bg-gray-700'
                      }`}
                    >
                      {replyCopied
                        ? <><Check className="w-4 h-4" /> ¡Copiado!</>
                        : <><Copy className="w-4 h-4" /> Copiar respuesta</>}
                    </button>
                  </div>
                </div>
              )}

              <div className="mt-4 bg-blue-50 border border-blue-200 rounded-xl p-4">
                <p className="text-xs font-semibold text-blue-800 mb-1">💡 Cómo usar</p>
                <ol className="text-xs text-blue-700 space-y-1 list-decimal list-inside">
                  <li>Ves un post en el grupo — selecciona el tema arriba</li>
                  <li>Si es sobre fila, selecciona el puente específico</li>
                  <li>Toca "Generar Respuesta" y cópiala</li>
                  <li>Pégala como comentario — toca "Otra" para otra variante</li>
                </ol>
              </div>
            </div>
          )
        })()}

        {tab === 'cron' && (() => {
          const SECRET_PLACEHOLDER = 'YOUR_CRON_SECRET'
          const BASE = 'https://cruzar.app/api/generate-post'

          const CRON_REGIONS = [
            {
              key: 'rgv', label: 'RGV / McAllen', emoji: '🌵',
              tz: 'CST/CDT (Central)', note: 'Same times for Brownsville, Laredo, Eagle Pass',
              jobs: [
                { local: '5:30am',  utcSummer: '10:30', utcWinter: '11:30', label: 'Morning commute' },
                { local: '11:30am', utcSummer: '16:30', utcWinter: '17:30', label: 'Midday' },
                { local: '3:30pm',  utcSummer: '20:30', utcWinter: '21:30', label: 'Afternoon rush' },
                { local: '7:00pm',  utcSummer: '00:30', utcWinter: '01:30', label: 'Evening' },
              ],
            },
            {
              key: 'brownsville', label: 'Matamoros / Brownsville', emoji: '🏙️',
              tz: 'CST/CDT (Central)', note: '',
              jobs: [
                { local: '5:30am',  utcSummer: '10:30', utcWinter: '11:30', label: 'Morning commute' },
                { local: '11:30am', utcSummer: '16:30', utcWinter: '17:30', label: 'Midday' },
                { local: '3:30pm',  utcSummer: '20:30', utcWinter: '21:30', label: 'Afternoon rush' },
                { local: '7:00pm',  utcSummer: '00:30', utcWinter: '01:30', label: 'Evening' },
              ],
            },
            {
              key: 'laredo', label: 'Laredo / Nuevo Laredo', emoji: '🛣️',
              tz: 'CST/CDT (Central)', note: '',
              jobs: [
                { local: '5:30am',  utcSummer: '10:30', utcWinter: '11:30', label: 'Morning commute' },
                { local: '11:30am', utcSummer: '16:30', utcWinter: '17:30', label: 'Midday' },
                { local: '3:30pm',  utcSummer: '20:30', utcWinter: '21:30', label: 'Afternoon rush' },
                { local: '7:00pm',  utcSummer: '00:30', utcWinter: '01:30', label: 'Evening' },
              ],
            },
            {
              key: 'eagle_pass', label: 'Eagle Pass / Piedras Negras', emoji: '🦅',
              tz: 'CST/CDT (Central)', note: '',
              jobs: [
                { local: '5:30am',  utcSummer: '10:30', utcWinter: '11:30', label: 'Morning commute' },
                { local: '11:30am', utcSummer: '16:30', utcWinter: '17:30', label: 'Midday' },
                { local: '3:30pm',  utcSummer: '20:30', utcWinter: '21:30', label: 'Afternoon rush' },
                { local: '7:00pm',  utcSummer: '00:30', utcWinter: '01:30', label: 'Evening' },
              ],
            },
            {
              key: 'el_paso', label: 'El Paso / Juárez', emoji: '⛰️',
              tz: 'MST/MDT (Mountain — 1hr behind TX)', note: '',
              jobs: [
                { local: '5:30am',  utcSummer: '11:30', utcWinter: '12:30', label: 'Morning commute' },
                { local: '11:30am', utcSummer: '17:30', utcWinter: '18:30', label: 'Midday' },
                { local: '3:30pm',  utcSummer: '21:30', utcWinter: '22:30', label: 'Afternoon rush' },
                { local: '7:00pm',  utcSummer: '01:30', utcWinter: '02:30', label: 'Evening' },
              ],
            },
            {
              key: 'san_luis', label: 'San Luis RC / Arizona', emoji: '🌵',
              tz: 'MST always — no DST (UTC-7 year-round)', note: '',
              jobs: [
                { local: '5:30am',  utcSummer: '12:30', utcWinter: '12:30', label: 'Morning commute' },
                { local: '11:30am', utcSummer: '18:30', utcWinter: '18:30', label: 'Midday' },
                { local: '3:30pm',  utcSummer: '22:30', utcWinter: '22:30', label: 'Afternoon rush' },
                { local: '7:00pm',  utcSummer: '02:30', utcWinter: '02:30', label: 'Evening' },
              ],
            },
          ]

          function copyUrl(url: string) {
            navigator.clipboard.writeText(url)
            setCopiedUrl(url)
            setTimeout(() => setCopiedUrl(null), 2000)
          }

          return (
            <div>
              <div className="mb-4">
                <p className="text-sm font-semibold text-gray-900">⏰ Cron Job Setup</p>
                <p className="text-xs text-gray-500 mt-0.5">Auto-create all 24 jobs at once, or copy URLs manually below.</p>
              </div>

              {/* Auto-create section */}
              <div className="bg-green-50 border border-green-200 rounded-2xl p-4 mb-5">
                <p className="text-xs font-bold text-green-800 mb-1">⚡ Auto-Create 4 Cron Jobs</p>
                <p className="text-xs text-green-700 mb-3">
                  One job per peak time — each one emails all regions at once. Get your API key from <strong>cron-job.org → API → Create API Key</strong>, paste it below.
                </p>
                <input
                  type="password"
                  placeholder="cron-job.org API key"
                  value={cronApiKey}
                  onChange={e => setCronApiKey(e.target.value)}
                  className="w-full border border-green-300 rounded-xl px-3 py-2.5 text-sm text-gray-900 bg-white outline-none focus:ring-2 focus:ring-green-400 mb-3"
                />
                <button
                  onClick={createAllCronJobs}
                  disabled={cronCreating || !cronApiKey.trim()}
                  className="w-full bg-green-600 hover:bg-green-700 disabled:opacity-50 text-white font-semibold py-2.5 rounded-xl text-sm transition-colors"
                >
                  {cronCreating ? 'Creating jobs...' : '🚀 Create All 4 Cron Jobs'}
                </button>
                {cronCreateStatus && (
                  <div className={`mt-3 rounded-xl px-3 py-2 text-xs font-semibold ${cronCreateStatus.failed === 0 ? 'bg-green-100 text-green-800' : 'bg-yellow-100 text-yellow-800'}`}>
                    {cronCreateStatus.failed === 0
                      ? `✅ All ${cronCreateStatus.created} jobs created successfully!`
                      : <>
                          <p>⚠️ {cronCreateStatus.created} created, {cronCreateStatus.failed} failed</p>
                          {cronCreateStatus.firstError && <p className="mt-1 font-mono font-normal break-all">{cronCreateStatus.firstError}</p>}
                        </>}
                  </div>
                )}
              </div>
              <div className="mb-4 bg-amber-50 border border-amber-200 rounded-xl p-3">
                <p className="text-xs font-semibold text-amber-800">⚠️ When clocks change</p>
                <p className="text-xs text-amber-700 mt-0.5">In <strong>March</strong> (spring forward): switch to Summer UTC. In <strong>November</strong> (fall back): switch to Winter UTC. San Luis / Arizona never changes.</p>
              </div>

              <div className="space-y-5">
                {CRON_REGIONS.map(region => (
                  <div key={region.key} className="bg-white border border-gray-200 rounded-2xl overflow-hidden shadow-sm">
                    <div className="px-4 py-3 bg-gray-50 border-b border-gray-100 flex items-center justify-between">
                      <div>
                        <p className="text-sm font-bold text-gray-900">{region.emoji} {region.label}</p>
                        <p className="text-xs text-gray-500">{region.tz}</p>
                        {region.note && <p className="text-xs text-blue-600 mt-0.5">{region.note}</p>}
                      </div>
                      <span className="text-xs font-medium bg-gray-200 text-gray-600 px-2 py-1 rounded-full">4 jobs</span>
                    </div>
                    <div className="divide-y divide-gray-100">
                      {region.jobs.map((job, i) => {
                        const url = `${BASE}?secret=${SECRET_PLACEHOLDER}&region=${region.key}`
                        const isSame = job.utcSummer === job.utcWinter
                        return (
                          <div key={i} className="px-4 py-3">
                            <div className="flex items-center justify-between mb-1.5">
                              <span className="text-xs font-semibold text-gray-700">{job.local} — {job.label}</span>
                              <div className="flex items-center gap-3 text-xs text-gray-500">
                                {isSame
                                  ? <span className="bg-green-50 text-green-700 px-2 py-0.5 rounded font-mono">UTC {job.utcSummer}</span>
                                  : <>
                                      <span className="bg-yellow-50 text-yellow-700 px-2 py-0.5 rounded font-mono">☀️ {job.utcSummer}</span>
                                      <span className="bg-blue-50 text-blue-700 px-2 py-0.5 rounded font-mono">❄️ {job.utcWinter}</span>
                                    </>
                                }
                              </div>
                            </div>
                            <div className="flex items-center gap-2">
                              <code className="flex-1 text-xs bg-gray-50 border border-gray-200 rounded-lg px-2 py-1.5 text-gray-700 break-all">{url}</code>
                              <button
                                onClick={() => copyUrl(url)}
                                className="flex-shrink-0 flex items-center gap-1 text-xs font-medium text-gray-500 hover:text-gray-900 bg-gray-100 hover:bg-gray-200 px-2 py-1.5 rounded-lg transition-colors"
                              >
                                {copiedUrl === url ? <><Check className="w-3 h-3 text-green-500" /> Done</> : <><Copy className="w-3 h-3" /> Copy</>}
                              </button>
                            </div>
                          </div>
                        )
                      })}
                    </div>
                  </div>
                ))}
              </div>

              <div className="mt-4 bg-blue-50 border border-blue-200 rounded-xl p-4">
                <p className="text-xs font-semibold text-blue-800 mb-1">📋 How to add each job on cron-job.org</p>
                <ol className="text-xs text-blue-700 space-y-1 list-decimal list-inside">
                  <li>Go to cron-job.org → Jobs → Create cronjob</li>
                  <li>Paste the URL (replace YOUR_CRON_SECRET first)</li>
                  <li>Set Method to GET</li>
                  <li>Set Schedule → Custom → enter the UTC time above</li>
                  <li>Set Days → Every day</li>
                  <li>Save → enable the job</li>
                </ol>
              </div>
            </div>
          )
        })()}

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

        {tab === 'stats' && (
          <div className="space-y-5">
            {/* Revenue */}
            <div>
              <p className="text-xs font-bold text-gray-400 uppercase tracking-wider mb-3">Revenue</p>
              {!revenue ? (
                <p className="text-sm text-gray-400">Loading...</p>
              ) : (
                <div className="space-y-3">
                  <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
                    {[
                      { label: 'MRR', value: `$${(revenue.mrr / 100).toFixed(2)}` },
                      { label: 'Active Subs', value: revenue.activeSubscriptions },
                      { label: 'Pro', value: revenue.proCount },
                      { label: 'Business', value: revenue.businessCount },
                    ].map(({ label, value }) => (
                      <div key={label} className="bg-white rounded-2xl border border-gray-200 p-4 shadow-sm text-center">
                        <p className="text-2xl font-bold text-gray-900">{value}</p>
                        <p className="text-xs text-gray-500 mt-1">{label}</p>
                      </div>
                    ))}
                  </div>
                  {revenue.recentCharges.length > 0 && (
                    <div className="bg-white rounded-2xl border border-gray-200 shadow-sm overflow-hidden">
                      <p className="text-xs font-semibold text-gray-700 px-4 py-3 border-b border-gray-100">Recent Charges</p>
                      <div className="divide-y divide-gray-100">
                        {revenue.recentCharges.map(c => (
                          <div key={c.id} className="px-4 py-2.5 flex items-center justify-between">
                            <div>
                              <p className="text-sm font-medium text-gray-900">${(c.amount / 100).toFixed(2)}</p>
                              <p className="text-xs text-gray-400">{c.email || 'Unknown'}</p>
                            </div>
                            <p className="text-xs text-gray-400">{new Date(c.created * 1000).toLocaleDateString()}</p>
                          </div>
                        ))}
                      </div>
                    </div>
                  )}
                </div>
              )}
            </div>

            {/* Users */}
            <div>
              <p className="text-xs font-bold text-gray-400 uppercase tracking-wider mb-3">Users</p>
              {!stats ? (
                <p className="text-sm text-gray-400">Loading...</p>
              ) : (
                <div className="space-y-3">
                  <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
                    {[
                      { label: 'Total', value: stats.users.total },
                      { label: 'New (7d)', value: stats.users.new7 },
                      { label: 'New (30d)', value: stats.users.new30 },
                      { label: 'Active (7d)', value: stats.users.active7 },
                    ].map(({ label, value }) => (
                      <div key={label} className="bg-white rounded-2xl border border-gray-200 p-4 shadow-sm text-center">
                        <p className="text-2xl font-bold text-gray-900">{value}</p>
                        <p className="text-xs text-gray-500 mt-1">{label}</p>
                      </div>
                    ))}
                  </div>

                  {/* Tiers */}
                  <div className="bg-white rounded-2xl border border-gray-200 p-4 shadow-sm">
                    <p className="text-xs font-semibold text-gray-700 mb-3">By tier</p>
                    <div className="space-y-2">
                      {(['business', 'pro', 'free', 'guest'] as const).map(tier => {
                        const count = stats.users.byTier[tier] ?? 0
                        const max = stats.users.total || 1
                        const pct = Math.round((count / max) * 100)
                        const colors: Record<string, string> = { business: 'bg-purple-500', pro: 'bg-blue-500', free: 'bg-green-500', guest: 'bg-gray-300' }
                        return (
                          <div key={tier} className="flex items-center gap-3">
                            <span className="text-xs font-medium text-gray-600 w-16 capitalize">{tier}</span>
                            <div className="flex-1 bg-gray-100 rounded-full h-2">
                              <div className={`${colors[tier]} h-2 rounded-full`} style={{ width: `${pct}%` }} />
                            </div>
                            <span className="text-xs font-bold text-gray-900 w-8 text-right">{count}</span>
                          </div>
                        )
                      })}
                    </div>
                  </div>

                  {/* Recent signups */}
                  {stats.recentUsers.length > 0 && (
                    <div className="bg-white rounded-2xl border border-gray-200 shadow-sm overflow-hidden">
                      <p className="text-xs font-semibold text-gray-700 px-4 py-3 border-b border-gray-100">Recent Signups</p>
                      <div className="divide-y divide-gray-100">
                        {stats.recentUsers.map(u => (
                          <div key={u.id} className="px-4 py-2.5 flex items-center justify-between">
                            <div>
                              <p className="text-sm font-medium text-gray-900">{u.email}</p>
                              <span className={`text-xs font-semibold px-1.5 py-0.5 rounded-full ${
                                u.tier === 'business' ? 'bg-purple-100 text-purple-700' :
                                u.tier === 'pro' ? 'bg-blue-100 text-blue-700' :
                                'bg-gray-100 text-gray-500'
                              }`}>{u.tier}</span>
                            </div>
                            <p className="text-xs text-gray-400">{new Date(u.created_at).toLocaleDateString()}</p>
                          </div>
                        ))}
                      </div>
                    </div>
                  )}
                </div>
              )}
            </div>

            {/* Reports feed */}
            <div>
              <p className="text-xs font-bold text-gray-400 uppercase tracking-wider mb-3">Recent Reports</p>
              {!stats ? (
                <p className="text-sm text-gray-400">Loading...</p>
              ) : (
                <div className="space-y-3">
                  <div className="grid grid-cols-3 gap-3 text-center">
                    {[
                      { label: 'Total', value: stats.reports.total },
                      { label: 'Last 7d', value: stats.reports.last7 },
                      { label: 'Last 30d', value: stats.reports.last30 },
                    ].map(({ label, value }) => (
                      <div key={label} className="bg-white rounded-2xl border border-gray-200 p-4 shadow-sm">
                        <p className="text-xl font-bold text-gray-900">{value}</p>
                        <p className="text-xs text-gray-500">{label}</p>
                      </div>
                    ))}
                  </div>
                  {stats.reports.recent.length > 0 && (
                    <div className="bg-white rounded-2xl border border-gray-200 shadow-sm overflow-hidden">
                      <div className="divide-y divide-gray-100">
                        {stats.reports.recent.map(r => (
                          <div key={r.id} className="px-4 py-2.5 flex items-center justify-between">
                            <div>
                              <p className="text-sm font-medium text-gray-900">{r.port_id}</p>
                              <p className="text-xs text-gray-400">{r.report_type || r.condition || 'report'}{r.wait_minutes ? ` · ${r.wait_minutes} min` : ''}</p>
                            </div>
                            <p className="text-xs text-gray-400">{new Date(r.created_at).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}</p>
                          </div>
                        ))}
                      </div>
                    </div>
                  )}
                </div>
              )}
            </div>
          </div>
        )}

        {tab === 'blast' && (
          <div>
            <p className="text-sm font-semibold text-gray-900 mb-1">Push Notification Blast</p>
            <p className="text-xs text-gray-500 mb-4">Sends a push notification to every user who has notifications enabled.</p>
            <div className="bg-white rounded-2xl border border-gray-200 p-4 shadow-sm space-y-3">
              <div>
                <label className="text-xs font-semibold text-gray-600 block mb-1">Title</label>
                <input
                  type="text"
                  value={blastTitle}
                  onChange={e => setBlastTitle(e.target.value)}
                  placeholder="e.g. 🌉 Wait times just dropped!"
                  className="w-full border border-gray-200 rounded-xl px-3 py-2.5 text-sm text-gray-900 outline-none focus:ring-2 focus:ring-gray-900"
                />
              </div>
              <div>
                <label className="text-xs font-semibold text-gray-600 block mb-1">Message</label>
                <textarea
                  value={blastBody}
                  onChange={e => setBlastBody(e.target.value)}
                  placeholder="e.g. Hidalgo is at 8 min right now — perfect time to cross."
                  rows={3}
                  className="w-full border border-gray-200 rounded-xl px-3 py-2.5 text-sm text-gray-900 outline-none focus:ring-2 focus:ring-gray-900 resize-none"
                />
              </div>
              <div>
                <label className="text-xs font-semibold text-gray-600 block mb-1">Link (optional)</label>
                <input
                  type="text"
                  value={blastUrl}
                  onChange={e => setBlastUrl(e.target.value)}
                  placeholder="https://cruzar.app"
                  className="w-full border border-gray-200 rounded-xl px-3 py-2.5 text-sm text-gray-900 outline-none focus:ring-2 focus:ring-gray-900"
                />
              </div>
              <button
                disabled={blastSending || !blastTitle.trim() || !blastBody.trim()}
                onClick={async () => {
                  setBlastSending(true)
                  setBlastResult(null)
                  try {
                    const res = await fetch('/api/admin/push-blast', {
                      method: 'POST',
                      headers: { 'Content-Type': 'application/json' },
                      body: JSON.stringify({ title: blastTitle, body: blastBody, url: blastUrl }),
                    })
                    const data = await res.json()
                    setBlastResult(data)
                  } catch {
                    setBlastResult({ sent: 0, failed: 0, total: 0 })
                  } finally {
                    setBlastSending(false)
                  }
                }}
                className="w-full bg-gray-900 text-white font-semibold py-3 rounded-xl text-sm hover:bg-gray-700 transition-colors disabled:opacity-50"
              >
                {blastSending ? 'Sending...' : '🚀 Send to All Users'}
              </button>
              {blastResult && (
                <div className={`rounded-xl px-4 py-3 text-sm font-semibold text-center ${blastResult.sent > 0 ? 'bg-green-50 text-green-700' : 'bg-red-50 text-red-700'}`}>
                  {blastResult.sent > 0
                    ? `✅ Sent to ${blastResult.sent} users${blastResult.failed > 0 ? ` (${blastResult.failed} failed)` : ''}`
                    : `No push subscribers yet — users need to enable notifications first.`}
                </div>
              )}
            </div>
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
