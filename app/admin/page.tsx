'use client'

import { useState, useEffect } from 'react'
import { useAuth } from '@/lib/useAuth'
import { useRouter } from 'next/navigation'
import { Copy, Check, ExternalLink, RefreshCw } from 'lucide-react'
import { HeroGenerator } from '@/components/admin/HeroGenerator'
import { DataExplorer } from '@/components/admin/DataExplorer'
import { ViralLoopDetail } from '@/components/admin/ViralLoopDetail'
import { DivergenceTile } from '@/components/admin/DivergenceTile'
import { GrowthEventsTile } from '@/components/admin/GrowthEventsTile'

const ADMIN_EMAIL = 'cruzabusiness@gmail.com'

type RegionKey =
  | 'rgv' | 'brownsville' | 'laredo' | 'eagle_pass' | 'el_paso'
  | 'san_luis' | 'nogales' | 'tijuana' | 'mexicali' | 'other'

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
  { portId: '260401', name: 'Nogales Deconcini',              regionKey: 'nogales' },
  { portId: '260402', name: 'Nogales Mariposa (Comercial)',   regionKey: 'nogales' },
  { portId: '250401', name: 'San Ysidro (La Línea)',          regionKey: 'tijuana' },
  { portId: '250601', name: 'Otay Mesa',                      regionKey: 'tijuana' },
  { portId: '250501', name: 'Tecate',                         regionKey: 'tijuana' },
  { portId: '250301', name: 'Calexico East',                  regionKey: 'mexicali' },
  { portId: '250302', name: 'Calexico West',                  regionKey: 'mexicali' },
  { portId: '250201', name: 'Los Algodones ↔ Andrade',        regionKey: 'mexicali' },
]

const REGIONS: { key: RegionKey; label: string; emoji: string }[] = [
  { key: 'rgv',         label: 'RGV / McAllen / Reynosa',         emoji: '🌵' },
  { key: 'brownsville', label: 'Matamoros / Brownsville',          emoji: '🏙️' },
  { key: 'laredo',      label: 'Laredo / Nuevo Laredo',            emoji: '🛣️' },
  { key: 'eagle_pass',  label: 'Eagle Pass / Piedras Negras',      emoji: '🦅' },
  { key: 'el_paso',     label: 'El Paso / Juárez',                 emoji: '⛰️' },
  { key: 'nogales',     label: 'Nogales / Sonora',                 emoji: '🌵' },
  { key: 'san_luis',    label: 'San Luis RC / Yuma',               emoji: '☀️' },
  { key: 'tijuana',     label: 'Tijuana / San Ysidro / Otay',      emoji: '🌊' },
  { key: 'mexicali',    label: 'Mexicali / Calexico / Algodones',  emoji: '🏜️' },
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
  type AdminTab = 'groups' | 'post' | 'reply' | 'cron' | 'advertisers' | 'subs' | 'stats' | 'blast' | 'users' | 'ingest' | 'ports' | 'hero' | 'moat'
  type AdminSection = 'observe' | 'users' | 'content' | 'ai'
  const [tab, setTab] = useState<AdminTab>('moat')
  const [section, setSection] = useState<AdminSection>('observe')
  const [advertisers, setAdvertisers] = useState<Advertiser[]>([])
  const [subs, setSubs] = useState<Subscription[]>([])
  const [stats, setStats] = useState<{
    users: { total: number; new7: number; new30: number; active7: number; active30: number; returning?: number; power?: number; withAlerts?: number; totalShares?: number; usersWhoShared?: number; byTier: Record<string, number> }
    reports: { total: number; last7: number; last30: number; recent: { id: string; port_id: string; report_type: string; condition: string; wait_minutes: number | null; created_at: string }[] }
    recentUsers: { id: string; email: string; tier: string; created_at: string }[]
  } | null>(null)
  const [revenue, setRevenue] = useState<{
    mrr: number; activeSubscriptions: number; proCount: number; businessCount: number
    recentCharges: { id: string; amount: number; email: string; created: number; description: string }[]
  } | null>(null)
  type AdminUserRow = {
    id: string; email: string; display_name: string | null; tier: string; points: number
    reports_count: number; last_report_at: string | null; last_sign_in_at: string | null
    created_at: string | null; badges: string[]; sub_status: string | null; sub_tier: string | null
    home_region: string | null; last_seen_at: string | null; last_seen_age_days: number | null
    last_seen_device: string | null; last_seen_os: string | null; last_seen_browser: string | null
    install_state: string | null; first_seen_at: string | null
  }
  const [usersRows, setUsersRows] = useState<AdminUserRow[]>([])
  const [usersTotal, setUsersTotal] = useState(0)
  const [usersPage, setUsersPage] = useState(1)
  const [usersSearch, setUsersSearch] = useState('')
  const [usersTier, setUsersTier] = useState<'all' | 'free' | 'pro' | 'business'>('all')
  const [usersSort, setUsersSort] = useState<'created_desc' | 'reports_desc' | 'points_desc' | 'last_active_desc' | 'last_signin_desc' | 'last_seen_desc'>('created_desc')
  const [usersOs, setUsersOs] = useState<'all' | 'ios' | 'android' | 'windows' | 'macos' | 'linux' | 'other'>('all')
  const [usersDevice, setUsersDevice] = useState<'all' | 'mobile' | 'tablet' | 'desktop'>('all')
  const [usersInstall, setUsersInstall] = useState<'all' | 'web' | 'pwa' | 'twa' | 'capacitor' | 'installed'>('all')
  const [usersRegion, setUsersRegion] = useState<'all' | 'unset' | 'rgv' | 'coahuila-tx' | 'sonora-az' | 'cali-baja' | 'el-paso-cd-juarez' | 'laredo-nuevo-laredo'>('all')
  const [usersActivity, setUsersActivity] = useState<'all' | '24h' | '7d' | '30d' | 'inactive'>('all')
  const [usersLoading, setUsersLoading] = useState(false)
  const [selectedUserId, setSelectedUserId] = useState<string | null>(null)
  type AdminUserDetail = {
    id: string; email: string; auth_created_at: string | null; last_sign_in_at: string | null
    email_confirmed_at: string | null; provider: string | null
    profile: { display_name?: string | null; tier?: string; points?: number; reports_count?: number; badges?: string[]; full_name?: string | null; company?: string | null; role?: string | null; bio?: string | null; created_at?: string | null } | null
    subscription: { tier?: string; status?: string; current_period_end?: string | null; stripe_subscription_id?: string | null } | null
    reports: { id: string; port_id: string; report_type: string; wait_minutes: number | null; description: string | null; created_at: string; upvotes: number | null }[]
    alerts: { id: string; port_id: string; lane_type: string; threshold_minutes: number; active: boolean; last_triggered_at: string | null }[]
    saved_ports: string[]
    push_subscription_count: number
  }
  const [userDetail, setUserDetail] = useState<AdminUserDetail | null>(null)
  const [userDetailLoading, setUserDetailLoading] = useState(false)
  const USERS_PAGE_SIZE = 25
  const [testingNotify, setTestingNotify] = useState(false)
  const [testNotifyResult, setTestNotifyResult] = useState<Record<string, { ok: boolean; detail: string }> | null>(null)
  type PortRow = {
    port_id: string
    city: string
    region: string
    mega_region: string
    static_local_name: string | null
    override_local_name: string | null
    effective_local_name: string | null
    notes: string | null
    updated_at: string | null
  }
  const [portsRows, setPortsRows] = useState<PortRow[]>([])
  const [portsLoading, setPortsLoading] = useState(false)
  const [portEditingId, setPortEditingId] = useState<string | null>(null)
  const [portEditDraft, setPortEditDraft] = useState<string>('')
  const [portFilter, setPortFilter] = useState<string>('')

  const [ingestText, setIngestText] = useState('')
  const [ingestGroup, setIngestGroup] = useState('')
  const [ingestImagePreview, setIngestImagePreview] = useState<string | null>(null)
  const [ingestImageBase64, setIngestImageBase64] = useState<string | null>(null)
  const [ingestImageMime, setIngestImageMime] = useState<string>('image/jpeg')
  const [ingestSubmitting, setIngestSubmitting] = useState(false)
  const [ingestResult, setIngestResult] = useState<{ ok?: boolean; inserted?: number; skipped?: string; observations?: unknown[]; error?: string; parsed?: unknown; _filter?: { keptCount: number; totalCount: number; charsBefore: number; charsAfter: number } | null } | null>(null)

  async function handleImageFile(file: File) {
    if (!file.type.startsWith('image/')) return
    const buf = await file.arrayBuffer()
    const bytes = new Uint8Array(buf)
    let binary = ''
    const chunk = 0x8000
    for (let i = 0; i < bytes.length; i += chunk) {
      binary += String.fromCharCode.apply(null, Array.from(bytes.subarray(i, i + chunk)))
    }
    const base64 = btoa(binary)
    setIngestImageBase64(base64)
    setIngestImageMime(file.type || 'image/jpeg')
    setIngestImagePreview(`data:${file.type};base64,${base64}`)
  }

  // Client-side pre-filter. When Diego pastes a whole FB feed (Ctrl+A →
  // Ctrl+C), most of the text is ads, sale posts, comment chrome ('Like',
  // 'Reply', 'Share'), names, reactions, and chit-chat. Stripping the noise
  // here saves Claude Haiku tokens AND gives the LLM a much more focused
  // signal. Heuristic: keep only lines/paragraphs that mention a border
  // crossing keyword AND a time unit or wait phrase.
  function filterFbNoise(raw: string): { kept: string; keptCount: number; totalCount: number } {
    if (!raw) return { kept: '', keptCount: 0, totalCount: 0 }

    // Normalize and split into chunks. Treat blank lines as separators so
    // each "post" stays together with its comments.
    const chunks = raw
      .replace(/\r/g, '')
      .split(/\n{2,}/g)
      .map((c) => c.trim())
      .filter(Boolean)

    const crossingKw = /\b(hidalgo|pharr|anzald[uú]a|progreso|donna|rio grande|roma|brownsville|b&m|gateway|veterans|tomates|indios|laredo|eagle pass|del rio|ju[aá]rez|el paso|nogales|douglas|naco|san luis|mexicali|tecate|san ysidro|otay|calexico|tijuana|garita|puente|fila)\b/i
    const waitKw = /\b(\d{1,3}\s*(?:min|minuto|hora|h\b))\b|\bfluid|\bmucha fila\b|\bllen[oa]\b|\bsin fila\b|\brapid|\bahorita\b|\brayos x\b|\binspecci[oó]n\b|\bret[eé]n\b|\bsentri\b|\bpeatonal\b|\bcami[oó]n\b|\btraila\b|\btr[aá]iler\b/i

    // Also strip obvious FB chrome lines
    const chromeLine = /^(like|reply|share|see translation|most relevant|write a (public )?reply|follow|see more|view \d+|replied)$/i

    const kept: string[] = []
    for (const chunk of chunks) {
      // Drop each chunk's chrome lines and see what's left
      const meaningfulLines = chunk
        .split('\n')
        .map((l) => l.trim())
        .filter((l) => l && !chromeLine.test(l))
      if (meaningfulLines.length === 0) continue
      const joined = meaningfulLines.join('\n')
      // Keep only if the chunk mentions a crossing AND something wait-like
      if (crossingKw.test(joined) && waitKw.test(joined)) {
        kept.push(joined)
      }
    }
    return {
      kept: kept.join('\n\n---\n\n'),
      keptCount: kept.length,
      totalCount: chunks.length,
    }
  }

  async function runIngest() {
    if (!ingestText.trim() && !ingestImageBase64) return
    setIngestSubmitting(true)
    setIngestResult(null)
    try {
      const raw = ingestText.trim()
      // Only pre-filter if the blob is big enough to plausibly be a bulk paste.
      // For small inputs (single post), send as-is so we don't accidentally drop
      // a short but valid report.
      const SHOULD_FILTER = raw.length > 600
      const { kept, keptCount, totalCount } = SHOULD_FILTER
        ? filterFbNoise(raw)
        : { kept: raw, keptCount: 1, totalCount: 1 }

      const textToSend = SHOULD_FILTER ? (kept || raw) : raw

      const res = await fetch('/api/ingest/fb-post', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify({
          text: textToSend || '(foto sin texto)',
          group_name: ingestGroup.trim() || 'manual',
          posted_at: new Date().toISOString(),
          image_base64: ingestImageBase64 ?? undefined,
          image_media_type: ingestImageBase64 ? ingestImageMime : undefined,
        }),
      })
      const data = await res.json().catch(() => ({ error: `HTTP ${res.status}` }))
      setIngestResult({
        ...data,
        _filter: SHOULD_FILTER ? { keptCount, totalCount, charsBefore: raw.length, charsAfter: textToSend.length } : null,
      })
      if (data?.ok || data?.inserted) {
        setIngestText('')
        setIngestImagePreview(null)
        setIngestImageBase64(null)
        setIngestImageMime('image/jpeg')
      }
    } catch (err) {
      setIngestResult({ error: err instanceof Error ? err.message : String(err) })
    } finally {
      setIngestSubmitting(false)
    }
  }

  async function runTestNotify(channel: 'email' | 'push' | 'both') {
    setTestingNotify(true)
    setTestNotifyResult(null)
    try {
      const res = await fetch('/api/admin/test-notify', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ channel }),
      })
      const data = await res.json()
      setTestNotifyResult(data.results || { error: { ok: false, detail: data.error || 'Unknown error' } })
    } catch (err) {
      setTestNotifyResult({ error: { ok: false, detail: String(err) } })
    } finally {
      setTestingNotify(false)
    }
  }
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

  // Auto-switch to Ingest tab + prefill text from PWA share target or query param
  useEffect(() => {
    if (typeof window === 'undefined') return
    const params = new URLSearchParams(window.location.search)
    const tabParam = params.get('tab')
    if (tabParam === 'ingest') setTab('ingest')
    // Query param prefill (bookmarklet path)
    const textParam = params.get('ingest_text')
    if (textParam) {
      setTab('ingest')
      setIngestText(textParam)
      window.history.replaceState({}, '', '/admin')
    }
    // sessionStorage prefill (PWA share target path)
    try {
      const pending = sessionStorage.getItem('cruzar_pending_ingest')
      if (pending) {
        setTab('ingest')
        setIngestText(pending)
        sessionStorage.removeItem('cruzar_pending_ingest')
      }
    } catch { /* ignore */ }
  }, [])

  useEffect(() => {
    if (!user || user.email !== ADMIN_EMAIL) return
    if (tab !== 'ports') return
    setPortsLoading(true)
    fetch('/api/admin/port-overrides')
      .then((r) => r.json())
      .then((d) => setPortsRows(d.ports || []))
      .finally(() => setPortsLoading(false))
  }, [user, tab])

  async function savePortOverride(portId: string, localName: string) {
    const res = await fetch('/api/admin/port-overrides', {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ port_id: portId, local_name: localName }),
    })
    if (res.ok) {
      setPortsRows((rows) =>
        rows.map((r) =>
          r.port_id === portId
            ? { ...r, override_local_name: localName || null, effective_local_name: localName || r.static_local_name }
            : r
        )
      )
      setPortEditingId(null)
      setPortEditDraft('')
    }
  }

  useEffect(() => {
    if (!user || user.email !== ADMIN_EMAIL) return
    if (tab !== 'users') return
    setUsersLoading(true)
    const params = new URLSearchParams({
      page: String(usersPage),
      pageSize: String(USERS_PAGE_SIZE),
      tier: usersTier,
      sort: usersSort,
      search: usersSearch,
      os: usersOs,
      device: usersDevice,
      install_state: usersInstall,
      home_region: usersRegion,
      activity: usersActivity,
    })
    fetch(`/api/admin/users?${params}`)
      .then(r => r.json())
      .then(d => {
        setUsersRows(d.users || [])
        setUsersTotal(d.total || 0)
      })
      .finally(() => setUsersLoading(false))
  }, [user, tab, usersPage, usersTier, usersSort, usersSearch, usersOs, usersDevice, usersInstall, usersRegion, usersActivity])

  useEffect(() => {
    if (!selectedUserId) { setUserDetail(null); return }
    setUserDetailLoading(true)
    fetch(`/api/admin/users/${selectedUserId}`)
      .then(r => r.json())
      .then(d => setUserDetail(d))
      .finally(() => setUserDetailLoading(false))
  }, [selectedUserId])

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

        {/* Section picker — top-level groups that reduce the flat
            12-tab density to 4 manageable sections. Diego's
            2026-04-14 direction: "tab density" was the clutter source.
            Each section shows only its 2-3 relevant sub-tabs. */}
        <div className="flex gap-1 mb-3 overflow-x-auto">
          {([
            { id: 'observe' as const, label: '📊 Observe',  tabs: ['moat', 'stats', 'ingest', 'cron'] as AdminTab[] },
            { id: 'users'   as const, label: '👥 Accounts', tabs: ['users', 'subs', 'advertisers'] as AdminTab[] },
            { id: 'content' as const, label: '🌉 Content',  tabs: ['groups', 'ports', 'hero'] as AdminTab[] },
            { id: 'ai'      as const, label: '🤖 AI Tools', tabs: ['post', 'reply', 'blast'] as AdminTab[] },
          ]).map((s) => (
            <button
              key={s.id}
              onClick={() => {
                setSection(s.id)
                // Jump to the first tab in the new section so content
                // matches the selector state.
                if (!s.tabs.includes(tab)) setTab(s.tabs[0])
              }}
              className={`flex-shrink-0 px-4 py-2 text-xs font-bold rounded-xl transition-colors whitespace-nowrap ${
                section === s.id
                  ? 'bg-gray-900 text-white shadow'
                  : 'bg-white text-gray-600 border border-gray-200 hover:border-gray-400'
              }`}
            >
              {s.label}
            </button>
          ))}
        </div>

        {/* Sub-tabs — only the 2-3 tabs belonging to the active section */}
        <div className="flex flex-wrap gap-1 bg-gray-100 rounded-xl p-1 mb-5">
          {(() => {
            const SECTION_TABS: Record<AdminSection, AdminTab[]> = {
              observe: ['moat', 'stats', 'ingest', 'cron'],
              users:   ['users', 'subs', 'advertisers'],
              content: ['groups', 'ports', 'hero'],
              ai:      ['post', 'reply', 'blast'],
            }
            return SECTION_TABS[section].map((t) => (
              <button key={t} onClick={() => setTab(t)}
                className={`px-4 py-2 text-xs font-medium rounded-lg transition-colors capitalize ${tab === t ? 'bg-white shadow text-gray-900' : 'text-gray-500'}`}>
                {t === 'moat'        ? '💎 Moat' :
                 t === 'stats'       ? '📊 Stats' :
                 t === 'ingest'      ? '📥 Ingest' :
                 t === 'users'       ? '👥 Users' :
                 t === 'ports'       ? '🌉 Ports' :
                 t === 'blast'       ? '📣 Blast' :
                 t === 'hero'        ? '🎨 Hero' :
                 t === 'groups'      ? `Groups (${FACEBOOK_GROUPS.length})` :
                 t === 'post'        ? '✍️ Posts' :
                 t === 'reply'       ? '💬 Reply' :
                 t === 'cron'        ? '⏰ Cron' :
                 t === 'advertisers' ? `Ads (${advertisers.length})` :
                 `Subs (${subs.length})`}
              </button>
            ))
          })()}
        </div>

        {/* Data Explorer — the moat made visible */}
        {tab === 'moat' && <DataExplorer />}

        {/* Hero Generator */}
        {tab === 'hero' && <HeroGenerator />}

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

            {/* Region selector — all regions we can generate posts for */}
            <div className="flex flex-wrap gap-2">
              {[
                { key: 'all',         label: '🌎 All Regions' },
                { key: 'rgv',         label: '🌵 RGV' },
                { key: 'brownsville', label: '🏙️ Brownsville' },
                { key: 'laredo',      label: '🛣️ Laredo' },
                { key: 'eagle_pass',  label: '🦅 Eagle Pass' },
                { key: 'el_paso',     label: '⛰️ El Paso' },
                { key: 'nogales',     label: '🌵 Nogales' },
                { key: 'san_luis',    label: '☀️ San Luis' },
                { key: 'tijuana',     label: '🌊 Tijuana' },
                { key: 'mexicali',    label: '🏜️ Mexicali' },
              ].map(r => (
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
                <p className="text-sm font-semibold text-gray-900">Facebook Group Replies</p>
                <p className="text-xs text-gray-500">Pick what they&apos;re asking about and generate a casual reply with live data. The reply itself will be in Spanish (it&apos;s what users actually paste into groups).</p>
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
                <label className="text-xs font-semibold text-gray-600 block mb-3">What are they asking about?</label>
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
                  <label className="text-xs font-semibold text-gray-600 block mb-3">Which bridge?</label>
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
                {loadingReply ? 'Generating…' : `⚡ Generate Reply — ${selectedTopic.emoji} ${selectedTopic.label}`}
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
                        ? <><Check className="w-4 h-4" /> Copied!</>
                        : <><Copy className="w-4 h-4" /> Copy reply</>}
                    </button>
                  </div>
                </div>
              )}

              <div className="mt-4 bg-blue-50 border border-blue-200 rounded-xl p-4">
                <p className="text-xs font-semibold text-blue-800 mb-1">💡 How to use</p>
                <ol className="text-xs text-blue-700 space-y-1 list-decimal list-inside">
                  <li>You see a post in a group — pick the topic above</li>
                  <li>If it&apos;s about wait times, pick the specific bridge</li>
                  <li>Tap &quot;Generate Reply&quot; and copy it</li>
                  <li>Paste as a comment — tap &quot;Another&quot; for a different variant</li>
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
              key: 'nogales', label: 'Nogales / Sonora', emoji: '🌵',
              tz: 'MST always — no DST (UTC-7 year-round)', note: 'Nogales AZ observes MST year-round (no DST)',
              jobs: [
                { local: '5:30am',  utcSummer: '12:30', utcWinter: '12:30', label: 'Morning commute' },
                { local: '11:30am', utcSummer: '18:30', utcWinter: '18:30', label: 'Midday' },
                { local: '3:30pm',  utcSummer: '22:30', utcWinter: '22:30', label: 'Afternoon rush' },
                { local: '7:00pm',  utcSummer: '02:30', utcWinter: '02:30', label: 'Evening' },
              ],
            },
            {
              key: 'san_luis', label: 'San Luis RC / Yuma', emoji: '☀️',
              tz: 'MST always — no DST (UTC-7 year-round)', note: '',
              jobs: [
                { local: '5:30am',  utcSummer: '12:30', utcWinter: '12:30', label: 'Morning commute' },
                { local: '11:30am', utcSummer: '18:30', utcWinter: '18:30', label: 'Midday' },
                { local: '3:30pm',  utcSummer: '22:30', utcWinter: '22:30', label: 'Afternoon rush' },
                { local: '7:00pm',  utcSummer: '02:30', utcWinter: '02:30', label: 'Evening' },
              ],
            },
            {
              key: 'tijuana', label: 'Tijuana / San Ysidro / Otay', emoji: '🌊',
              tz: 'PST/PDT (Pacific — Baja California observes DST)', note: '',
              jobs: [
                { local: '5:30am',  utcSummer: '12:30', utcWinter: '13:30', label: 'Morning commute' },
                { local: '11:30am', utcSummer: '18:30', utcWinter: '19:30', label: 'Midday' },
                { local: '3:30pm',  utcSummer: '22:30', utcWinter: '23:30', label: 'Afternoon rush' },
                { local: '7:00pm',  utcSummer: '02:30', utcWinter: '03:30', label: 'Evening' },
              ],
            },
            {
              key: 'mexicali', label: 'Mexicali / Calexico / Algodones', emoji: '🏜️',
              tz: 'PST/PDT (Pacific — Baja California observes DST)', note: '',
              jobs: [
                { local: '5:30am',  utcSummer: '12:30', utcWinter: '13:30', label: 'Morning commute' },
                { local: '11:30am', utcSummer: '18:30', utcWinter: '19:30', label: 'Midday' },
                { local: '3:30pm',  utcSummer: '22:30', utcWinter: '23:30', label: 'Afternoon rush' },
                { local: '7:00pm',  utcSummer: '02:30', utcWinter: '03:30', label: 'Evening' },
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
                  {/* Funnel: total → active → returning → power */}
                  <div>
                    <p className="text-[10px] font-bold text-gray-400 uppercase tracking-wider mb-2">Funnel</p>
                    <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
                      {(() => {
                        const total = stats.users.total
                        const active = stats.users.active7
                        const returning = stats.users.returning ?? 0
                        const power = stats.users.power ?? 0
                        const pct = (n: number) => total > 0 ? Math.round((n / total) * 100) : 0
                        const cards = [
                          { label: 'Total signups',          value: total,     sub: '100%',               color: 'text-gray-900'  },
                          { label: 'Active (7d)',             value: active,    sub: `${pct(active)}%`,    color: 'text-blue-700',  hint: 'signed in or reported in last 7 days' },
                          { label: 'Returning',               value: returning, sub: `${pct(returning)}%`, color: 'text-emerald-700', hint: '2+ reports OR alert OR saved crossing' },
                          { label: 'Power users',             value: power,     sub: `${pct(power)}%`,     color: 'text-purple-700', hint: '3+ reports OR alert + saved combo' },
                        ]
                        return cards.map(({ label, value, sub, color, hint }) => (
                          <div key={label} className="bg-white rounded-2xl border border-gray-200 p-4 shadow-sm text-center" title={hint}>
                            <p className={`text-3xl font-black ${color}`}>{value}</p>
                            <p className="text-[10px] text-gray-400 font-bold">{sub}</p>
                            <p className="text-[11px] text-gray-500 mt-1 font-medium">{label}</p>
                          </div>
                        ))
                      })()}
                    </div>
                  </div>

                  {/* Acquisition stats */}
                  <div>
                    <p className="text-[10px] font-bold text-gray-400 uppercase tracking-wider mb-2 mt-3">Acquisition</p>
                    <div className="grid grid-cols-3 gap-3">
                      {[
                        { label: 'New (7d)',  value: stats.users.new7 },
                        { label: 'New (30d)', value: stats.users.new30 },
                        { label: 'Active (30d)', value: stats.users.active30 },
                      ].map(({ label, value }) => (
                        <div key={label} className="bg-gray-50 rounded-xl border border-gray-200 p-3 text-center">
                          <p className="text-xl font-bold text-gray-900">{value}</p>
                          <p className="text-[11px] text-gray-500 mt-0.5">{label}</p>
                        </div>
                      ))}
                    </div>
                  </div>

                  {/* Viral loop — admin only. Tracks share buttons tapped
                      across ReportForm, JustCrossed, PortCard, Hero. Not
                      shown to users per Diego's 'no gamification' call. */}
                  <div>
                    <p className="text-[10px] font-bold text-gray-400 uppercase tracking-wider mb-2 mt-3">Viral loop (admin only)</p>
                    <div className="grid grid-cols-2 gap-3">
                      <div className="bg-gradient-to-br from-green-50 to-emerald-50 border border-emerald-200 rounded-xl p-3 text-center">
                        <p className="text-2xl font-black text-emerald-700">{stats.users.totalShares ?? 0}</p>
                        <p className="text-[11px] text-emerald-600 mt-0.5 font-semibold">Total shares</p>
                      </div>
                      <div className="bg-gradient-to-br from-green-50 to-emerald-50 border border-emerald-200 rounded-xl p-3 text-center">
                        <p className="text-2xl font-black text-emerald-700">{stats.users.usersWhoShared ?? 0}</p>
                        <p className="text-[11px] text-emerald-600 mt-0.5 font-semibold">Users who shared</p>
                      </div>
                    </div>
                    <ViralLoopDetail />
                    <DivergenceTile />
                    <GrowthEventsTile />
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

            {/* Notifications health */}
            <div>
              <p className="text-xs font-bold text-gray-400 uppercase tracking-wider mb-3">Notifications Health</p>
              <div className="bg-white rounded-2xl border border-gray-200 p-4 shadow-sm">
                <p className="text-xs text-gray-500 mb-3">
                  Send a test email and push to yourself to verify each channel end-to-end.
                </p>
                <div className="flex flex-wrap gap-2">
                  <button
                    onClick={() => runTestNotify('both')}
                    disabled={testingNotify}
                    className="px-3 py-2 text-xs font-semibold bg-gray-900 text-white rounded-lg disabled:opacity-50"
                  >
                    {testingNotify ? 'Sending…' : '🧪 Test email + push'}
                  </button>
                  <button
                    onClick={() => runTestNotify('email')}
                    disabled={testingNotify}
                    className="px-3 py-2 text-xs font-semibold bg-gray-100 text-gray-700 rounded-lg disabled:opacity-50"
                  >
                    📧 Email only
                  </button>
                  <button
                    onClick={() => runTestNotify('push')}
                    disabled={testingNotify}
                    className="px-3 py-2 text-xs font-semibold bg-gray-100 text-gray-700 rounded-lg disabled:opacity-50"
                  >
                    🔔 Push only
                  </button>
                </div>
                {testNotifyResult && (
                  <div className="mt-3 space-y-2">
                    {Object.entries(testNotifyResult).map(([channel, result]) => (
                      <div
                        key={channel}
                        className={`text-xs p-2 rounded-lg ${
                          result.ok ? 'bg-green-50 text-green-800' : 'bg-red-50 text-red-800'
                        }`}
                      >
                        <span className="font-semibold capitalize">{result.ok ? '✓' : '✗'} {channel}:</span>{' '}
                        {result.detail}
                      </div>
                    ))}
                  </div>
                )}
              </div>
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

        {tab === 'ingest' && (
          <div>
            <div className="mb-4">
              <p className="text-sm font-semibold text-gray-900">📥 Manual Ingest</p>
              <p className="text-xs text-gray-500 mt-0.5">
                Paste a Facebook post (with comments, if possible) and/or a screenshot. The LLM reads text + image and creates real reports in the app. <b>Important:</b> on FB, click &quot;view more comments&quot; BEFORE you Ctrl+A — that&apos;s where the wait times live.
              </p>
            </div>

            {/* Bookmarklet installer — drag to the bookmark bar, then click while
                on any FB post. It captures your selection (or the focused post's
                text) and opens this page with the Ingest tab pre-filled. */}
            <div className="mb-4 bg-gradient-to-r from-blue-50 to-indigo-50 border border-blue-200 rounded-2xl p-4">
              <p className="text-sm font-bold text-gray-900 mb-1">
                ⚡ Add "Send to Cruzar" to your browser
              </p>
              <p className="text-xs text-gray-600 mb-3">
                Drag this button to your bookmark bar. Then click it while on any Facebook post to grab the selected text and send it here automatically.
              </p>
              <a
                href={`javascript:(function(){var t=window.getSelection().toString().trim();if(!t){var a=document.activeElement&&document.activeElement.closest&&document.activeElement.closest('[role=article]');if(a)t=a.innerText;}if(!t){alert('Select some text from a FB post first');return;}window.open('https://cruzar.app/admin?ingest_text='+encodeURIComponent(t.substring(0,2000)),'_blank');})();`}
                draggable="true"
                onClick={(e) => {
                  e.preventDefault()
                  alert('Drag this button to your bookmark bar instead of clicking it.')
                }}
                className="inline-block px-4 py-2 bg-blue-600 text-white text-sm font-bold rounded-xl cursor-move hover:bg-blue-700"
              >
                📥 Send to Cruzar
              </a>
              <p className="text-[11px] text-gray-400 mt-2">
                Or on mobile: install Cruzar as a PWA (Add to Home Screen) and share any FB post to the <b>Cruzar</b> app from the share sheet.
              </p>
            </div>

            <div
              onPaste={async (e) => {
                const items = e.clipboardData?.items
                if (!items) return
                for (const item of Array.from(items)) {
                  if (item.kind === 'file' && item.type.startsWith('image/')) {
                    const file = item.getAsFile()
                    if (file) {
                      e.preventDefault()
                      await handleImageFile(file)
                      return
                    }
                  }
                }
              }}
              className="bg-white rounded-2xl border-2 border-dashed border-gray-300 p-4 space-y-3"
            >
              <div>
                <label className="text-[10px] uppercase tracking-wider font-bold text-gray-500">
                  Text · Single post or full feed
                </label>
                <p className="text-[11px] text-gray-400 mt-0.5 mb-1.5">
                  Paste a single post, a post with its comments, or <b>the whole page</b> (Ctrl+A → Ctrl+C on an FB group) — the AI will find every wait-time report in the text.
                </p>
                <textarea
                  value={ingestText}
                  onChange={(e) => setIngestText(e.target.value)}
                  placeholder="e.g. 'Los Tomates horita 45 min' — or paste the whole feed with many posts"
                  rows={10}
                  className="w-full border border-gray-200 rounded-xl px-3 py-2.5 text-sm text-gray-900 focus:outline-none focus:ring-2 focus:ring-blue-500 font-mono leading-relaxed"
                />
                <p className="text-[10px] text-gray-400 mt-1 text-right">
                  {ingestText.length.toLocaleString()} / 20,000 chars
                </p>
              </div>

              <div>
                <label className="text-[10px] uppercase tracking-wider font-bold text-gray-500">
                  Group (optional)
                </label>
                <input
                  type="text"
                  value={ingestGroup}
                  onChange={(e) => setIngestGroup(e.target.value)}
                  placeholder="e.g. Filas de Puentes Matamoros/Brownsville"
                  className="mt-1 w-full border border-gray-200 rounded-xl px-3 py-2 text-sm"
                />
              </div>

              <div>
                <label className="text-[10px] uppercase tracking-wider font-bold text-gray-500">
                  Image (optional)
                </label>
                <p className="text-[11px] text-gray-400 mt-0.5 mb-2">
                  Paste (Ctrl+V) a screenshot or upload a file. The AI analyzes the photo to count cars and estimate the wait.
                </p>
                {ingestImagePreview ? (
                  <div className="relative inline-block">
                    {/* eslint-disable-next-line @next/next/no-img-element */}
                    <img src={ingestImagePreview} alt="preview" className="max-h-48 rounded-xl border border-gray-200" />
                    <button
                      onClick={() => { setIngestImagePreview(null); setIngestImageBase64(null) }}
                      className="absolute top-1 right-1 bg-black/60 text-white rounded-full w-6 h-6 text-sm leading-none"
                    >×</button>
                  </div>
                ) : (
                  <input
                    type="file"
                    accept="image/*"
                    onChange={(e) => {
                      const f = e.target.files?.[0]
                      if (f) handleImageFile(f)
                    }}
                    className="text-xs text-gray-500 file:mr-2 file:py-1.5 file:px-3 file:rounded-lg file:border-0 file:bg-gray-100 file:text-gray-700 file:text-xs file:font-semibold"
                  />
                )}
              </div>

              <button
                onClick={runIngest}
                disabled={ingestSubmitting || (!ingestText.trim() && !ingestImageBase64)}
                className="w-full py-3 bg-blue-600 hover:bg-blue-700 text-white text-sm font-bold rounded-2xl disabled:opacity-40"
              >
                {ingestSubmitting ? 'Processing…' : '📥 Ingest post'}
              </button>
            </div>

            {ingestResult && (
              <div className="mt-4 bg-white rounded-2xl border border-gray-200 p-4">
                <p className="text-xs font-bold text-gray-500 uppercase tracking-wide mb-2">Result</p>
                {ingestResult.error && (
                  <p className="text-sm text-red-600">✗ {ingestResult.error}</p>
                )}
                {(ingestResult.inserted ?? 0) > 0 && (
                  <p className="text-sm text-green-600 font-semibold">✓ {ingestResult.inserted} report{ingestResult.inserted === 1 ? '' : 's'} inserted</p>
                )}
                {ingestResult.skipped === 'no_wait_info' && !ingestResult.error && (
                  <div className="text-sm">
                    <p className="text-amber-700 font-semibold">↷ No wait-time info found</p>
                    <p className="text-xs text-gray-600 mt-1 leading-relaxed">
                      The pasted text was either a question (like &quot;cómo está la fila?&quot;), an ad, or chit-chat — no concrete wait times to extract.
                      {ingestResult._filter && ingestResult._filter.keptCount === 0 && ingestResult._filter.totalCount > 0 && (
                        <> {ingestResult._filter.totalCount} post{ingestResult._filter.totalCount === 1 ? '' : 's'} checked, none had a bridge name + wait time in the same chunk.</>
                      )}
                    </p>
                    <p className="text-[11px] text-gray-500 mt-2">
                      <b>Tip:</b> On FB, scroll and <b>click &quot;view more comments&quot;</b> on each post <i>before</i> Ctrl+A — the replies are where the actual wait times live. A question post alone won&apos;t have data to extract.
                    </p>
                  </div>
                )}
                {ingestResult.skipped && ingestResult.skipped !== 'no_wait_info' && (
                  <p className="text-sm text-amber-600">↷ Skipped: {ingestResult.skipped}</p>
                )}
                {ingestResult._filter && (
                  <p className="text-[11px] text-gray-500 mt-2">
                    🧹 Filter: kept {ingestResult._filter.keptCount} of {ingestResult._filter.totalCount} post{ingestResult._filter.totalCount === 1 ? '' : 's'}
                    {ingestResult._filter.keptCount > 0 && (
                      <> · {ingestResult._filter.charsBefore.toLocaleString()} → {ingestResult._filter.charsAfter.toLocaleString()} chars sent to LLM</>
                    )}
                    {ingestResult._filter.keptCount === 0 && (
                      <> · sent raw as fallback ({ingestResult._filter.charsBefore.toLocaleString()} chars)</>
                    )}
                  </p>
                )}
                {Array.isArray(ingestResult.observations) && ingestResult.observations.length > 0 && (
                  <pre className="mt-2 text-[10px] bg-gray-50 rounded-lg p-2 overflow-x-auto font-mono text-gray-700">
                    {JSON.stringify(ingestResult.observations, null, 2)}
                  </pre>
                )}
              </div>
            )}

            <p className="mt-4 text-[11px] text-gray-400 leading-relaxed">
              <b>Pro tip:</b> On Windows, <kbd className="bg-gray-100 px-1 rounded">Win+Shift+S</kbd> takes a screenshot straight to clipboard, and you can paste it right here with <kbd className="bg-gray-100 px-1 rounded">Ctrl+V</kbd> (no need to save the file).
            </p>
          </div>
        )}

        {tab === 'ports' && (
          <div>
            <div className="mb-4">
              <p className="text-sm font-semibold text-gray-900">🌉 Port Local Names</p>
              <p className="text-xs text-gray-500 mt-0.5">
                Override the local name shown on each port card. Leave empty to fall back to the static default in <code>lib/portMeta.ts</code>. Changes apply instantly — no redeploy needed.
              </p>
            </div>

            <input
              type="text"
              placeholder="Filter by city, bridge, port_id…"
              value={portFilter}
              onChange={(e) => setPortFilter(e.target.value)}
              className="w-full mb-3 px-3 py-2 text-sm border border-gray-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-blue-500"
            />

            {portsLoading ? (
              <p className="text-xs text-gray-500">Loading ports…</p>
            ) : (
              <div className="bg-white rounded-2xl border border-gray-200 overflow-hidden">
                <div className="hidden sm:grid sm:grid-cols-12 px-4 py-2 bg-gray-50 text-[10px] uppercase tracking-wide text-gray-500 font-semibold">
                  <div className="col-span-2">Port ID</div>
                  <div className="col-span-2">City</div>
                  <div className="col-span-3">Default</div>
                  <div className="col-span-4">Override (edit to save)</div>
                  <div className="col-span-1 text-right">·</div>
                </div>
                {portsRows
                  .filter((r) => {
                    if (!portFilter.trim()) return true
                    const q = portFilter.toLowerCase()
                    return (
                      r.port_id.toLowerCase().includes(q) ||
                      r.city.toLowerCase().includes(q) ||
                      (r.static_local_name || '').toLowerCase().includes(q) ||
                      (r.override_local_name || '').toLowerCase().includes(q) ||
                      r.region.toLowerCase().includes(q)
                    )
                  })
                  .map((r) => {
                    const isEditing = portEditingId === r.port_id
                    return (
                      <div key={r.port_id} className="sm:grid sm:grid-cols-12 px-4 py-2.5 text-sm border-t border-gray-100 items-center">
                        <div className="col-span-2 font-mono text-[11px] text-gray-500">{r.port_id}</div>
                        <div className="col-span-2">
                          <p className="text-gray-900 font-medium">{r.city}</p>
                          <p className="text-[10px] text-gray-400 truncate">{r.region}</p>
                        </div>
                        <div className="col-span-3 text-xs text-gray-500">
                          {r.static_local_name || <span className="italic text-gray-400">— none —</span>}
                        </div>
                        <div className="col-span-4">
                          {isEditing ? (
                            <div className="flex items-center gap-1.5">
                              <input
                                type="text"
                                value={portEditDraft}
                                onChange={(e) => setPortEditDraft(e.target.value)}
                                autoFocus
                                placeholder={r.static_local_name || 'local name'}
                                className="flex-1 px-2 py-1.5 text-xs border border-blue-400 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
                                onKeyDown={(e) => {
                                  if (e.key === 'Enter') savePortOverride(r.port_id, portEditDraft)
                                  if (e.key === 'Escape') { setPortEditingId(null); setPortEditDraft('') }
                                }}
                              />
                              <button
                                onClick={() => savePortOverride(r.port_id, portEditDraft)}
                                className="text-[11px] font-bold px-2 py-1.5 bg-blue-600 text-white rounded-lg"
                              >Save</button>
                              <button
                                onClick={() => { setPortEditingId(null); setPortEditDraft('') }}
                                className="text-[11px] font-bold px-2 py-1.5 bg-gray-100 text-gray-700 rounded-lg"
                              >×</button>
                            </div>
                          ) : (
                            <button
                              onClick={() => {
                                setPortEditingId(r.port_id)
                                setPortEditDraft(r.override_local_name || r.static_local_name || '')
                              }}
                              className="w-full text-left px-2 py-1.5 rounded-lg hover:bg-gray-50 transition-colors"
                            >
                              {r.override_local_name ? (
                                <span className="text-blue-700 font-semibold">{r.override_local_name}</span>
                              ) : (
                                <span className="text-gray-400 italic">{r.effective_local_name || 'Click to add'}</span>
                              )}
                            </button>
                          )}
                        </div>
                        <div className="col-span-1 text-right">
                          {r.override_local_name && (
                            <button
                              onClick={() => savePortOverride(r.port_id, '')}
                              title="Reset to default"
                              className="text-[10px] text-red-500 hover:text-red-700"
                            >reset</button>
                          )}
                        </div>
                      </div>
                    )
                  })}
              </div>
            )}

            <p className="text-[10px] text-gray-400 mt-3 leading-relaxed">
              💡 <b>Tip:</b> Blue bold = you&apos;ve set an override. Gray italic = using the static default from <code>portMeta.ts</code>. Click any row to edit. Press <kbd className="bg-gray-100 px-1 rounded">Enter</kbd> to save, <kbd className="bg-gray-100 px-1 rounded">Esc</kbd> to cancel. Click <b>reset</b> to clear an override and fall back to the default.
            </p>
          </div>
        )}

        {tab === 'users' && (
          <div>
            <div className="mb-4 grid grid-cols-1 sm:grid-cols-4 gap-2">
              <input
                type="text"
                placeholder="Search email or name…"
                value={usersSearch}
                onChange={e => { setUsersSearch(e.target.value); setUsersPage(1) }}
                className="sm:col-span-2 px-3 py-2 text-sm border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
              />
              <select
                value={usersTier}
                onChange={e => { setUsersTier(e.target.value as typeof usersTier); setUsersPage(1) }}
                className="px-3 py-2 text-sm border border-gray-200 rounded-lg bg-white"
              >
                <option value="all">All tiers</option>
                <option value="free">Free</option>
                <option value="pro">Pro</option>
                <option value="business">Business</option>
              </select>
              <select
                value={usersSort}
                onChange={e => { setUsersSort(e.target.value as typeof usersSort); setUsersPage(1) }}
                className="px-3 py-2 text-sm border border-gray-200 rounded-lg bg-white"
              >
                <option value="created_desc">Newest first</option>
                <option value="last_seen_desc">Last seen (any page)</option>
                <option value="last_signin_desc">Last sign-in</option>
                <option value="last_active_desc">Last report</option>
                <option value="reports_desc">Most reports</option>
                <option value="points_desc">Most points</option>
              </select>
            </div>

            {/* Device / install / region / activity filters — v27 */}
            <div className="mb-4 grid grid-cols-2 sm:grid-cols-5 gap-2">
              <select
                value={usersOs}
                onChange={e => { setUsersOs(e.target.value as typeof usersOs); setUsersPage(1) }}
                className="px-3 py-2 text-sm border border-gray-200 rounded-lg bg-white"
              >
                <option value="all">All OS</option>
                <option value="ios">iOS</option>
                <option value="android">Android</option>
                <option value="windows">Windows</option>
                <option value="macos">macOS</option>
                <option value="linux">Linux</option>
                <option value="other">Other</option>
              </select>
              <select
                value={usersDevice}
                onChange={e => { setUsersDevice(e.target.value as typeof usersDevice); setUsersPage(1) }}
                className="px-3 py-2 text-sm border border-gray-200 rounded-lg bg-white"
              >
                <option value="all">All devices</option>
                <option value="mobile">Mobile</option>
                <option value="tablet">Tablet</option>
                <option value="desktop">Desktop</option>
              </select>
              <select
                value={usersInstall}
                onChange={e => { setUsersInstall(e.target.value as typeof usersInstall); setUsersPage(1) }}
                className="px-3 py-2 text-sm border border-gray-200 rounded-lg bg-white"
              >
                <option value="all">All install states</option>
                <option value="installed">Any install (PWA/TWA/Capacitor)</option>
                <option value="web">Web (browser tab)</option>
                <option value="pwa">PWA installed</option>
                <option value="twa">TWA (Play Store)</option>
                <option value="capacitor">Capacitor (App Store)</option>
              </select>
              <select
                value={usersRegion}
                onChange={e => { setUsersRegion(e.target.value as typeof usersRegion); setUsersPage(1) }}
                className="px-3 py-2 text-sm border border-gray-200 rounded-lg bg-white"
              >
                <option value="all">All regions</option>
                <option value="unset">Unset (no region picked)</option>
                <option value="rgv">RGV</option>
                <option value="laredo-nuevo-laredo">Laredo · Nuevo Laredo</option>
                <option value="el-paso-cd-juarez">El Paso · Cd. Juárez</option>
                <option value="coahuila-tx">Coahuila · Texas</option>
                <option value="sonora-az">Sonora · Arizona</option>
                <option value="cali-baja">Cali · Baja</option>
              </select>
              <select
                value={usersActivity}
                onChange={e => { setUsersActivity(e.target.value as typeof usersActivity); setUsersPage(1) }}
                className="px-3 py-2 text-sm border border-gray-200 rounded-lg bg-white"
              >
                <option value="all">Any activity</option>
                <option value="24h">Last 24h</option>
                <option value="7d">Last 7 days</option>
                <option value="30d">Last 30 days</option>
                <option value="inactive">Inactive 30d+</option>
              </select>
            </div>

            <div className="flex items-center justify-between mb-3">
              <p className="text-xs text-gray-500">
                {usersLoading ? 'Loading…' : `${usersTotal} user${usersTotal === 1 ? '' : 's'} · page ${usersPage} of ${Math.max(1, Math.ceil(usersTotal / USERS_PAGE_SIZE))}`}
              </p>
              <div className="flex gap-1">
                <button
                  onClick={() => setUsersPage(p => Math.max(1, p - 1))}
                  disabled={usersPage === 1 || usersLoading}
                  className="px-3 py-1 text-xs bg-gray-100 rounded-lg disabled:opacity-40"
                >
                  ← Prev
                </button>
                <button
                  onClick={() => setUsersPage(p => p + 1)}
                  disabled={usersPage * USERS_PAGE_SIZE >= usersTotal || usersLoading}
                  className="px-3 py-1 text-xs bg-gray-100 rounded-lg disabled:opacity-40"
                >
                  Next →
                </button>
              </div>
            </div>

            <div className="bg-white rounded-2xl border border-gray-200 overflow-hidden">
              <div className="hidden sm:grid sm:grid-cols-12 px-4 py-2 bg-gray-50 text-[10px] uppercase tracking-wide text-gray-500 font-semibold">
                <div className="col-span-3">User</div>
                <div className="col-span-1">Tier</div>
                <div className="col-span-2">Device · OS</div>
                <div className="col-span-1">Install</div>
                <div className="col-span-1">Region</div>
                <div className="col-span-1 text-right">Rpts</div>
                <div className="col-span-1 text-right">Pts</div>
                <div className="col-span-2">Last seen</div>
              </div>
              {usersRows.length === 0 && !usersLoading && (
                <p className="text-gray-400 text-sm p-6 text-center">No users match.</p>
              )}
              {usersRows.map(u => {
                // Prefer last_seen_at (any page) over last_sign_in_at (auth-only)
                // over last_report_at (only users who report). Falls back
                // cleanly when the migration hasn't been applied yet.
                const lastSeen = u.last_seen_at || u.last_sign_in_at || u.last_report_at
                const osIcon = u.last_seen_os === 'ios' ? '🍎' : u.last_seen_os === 'android' ? '🤖' : u.last_seen_os === 'windows' ? '🪟' : u.last_seen_os === 'macos' ? '💻' : '·'
                const installBadge =
                  u.install_state === 'pwa' ? { label: 'PWA', cls: 'bg-emerald-100 text-emerald-700' }
                  : u.install_state === 'twa' ? { label: 'Play', cls: 'bg-green-100 text-green-700' }
                  : u.install_state === 'capacitor' ? { label: 'App', cls: 'bg-blue-100 text-blue-700' }
                  : u.install_state === 'web' ? { label: 'Web', cls: 'bg-gray-100 text-gray-500' }
                  : { label: '—', cls: 'bg-gray-50 text-gray-400' }
                return (
                  <button
                    key={u.id}
                    onClick={() => setSelectedUserId(u.id)}
                    className="w-full text-left border-t border-gray-100 hover:bg-gray-50 transition-colors"
                  >
                    <div className="sm:grid sm:grid-cols-12 px-4 py-3 items-center text-sm">
                      <div className="col-span-3">
                        <p className="font-medium text-gray-900 truncate">{u.email || '(no email)'}</p>
                        {u.display_name && u.display_name !== u.email && (
                          <p className="text-xs text-gray-500 truncate">{u.display_name}</p>
                        )}
                      </div>
                      <div className="col-span-1">
                        <span className={`inline-block text-[10px] font-semibold px-2 py-0.5 rounded-full ${
                          u.tier === 'business' ? 'bg-purple-100 text-purple-700' :
                          u.tier === 'pro'      ? 'bg-blue-100 text-blue-700' :
                                                  'bg-gray-100 text-gray-600'
                        }`}>{u.tier}</span>
                      </div>
                      <div className="col-span-2 text-xs text-gray-600">
                        {u.last_seen_os ? (
                          <span className="inline-flex items-center gap-1">
                            <span>{osIcon}</span>
                            <span className="capitalize">{u.last_seen_device || '—'}</span>
                            <span className="text-gray-400">·</span>
                            <span className="uppercase">{u.last_seen_os}</span>
                          </span>
                        ) : (
                          <span className="text-gray-300">—</span>
                        )}
                      </div>
                      <div className="col-span-1">
                        <span className={`inline-block text-[9px] font-semibold px-1.5 py-0.5 rounded ${installBadge.cls}`}>
                          {installBadge.label}
                        </span>
                      </div>
                      <div className="col-span-1 text-[10px] text-gray-500 uppercase tracking-wide">
                        {u.home_region || '—'}
                      </div>
                      <div className="col-span-1 text-right text-gray-700">{u.reports_count}</div>
                      <div className="col-span-1 text-right text-gray-700">{u.points}</div>
                      <div className="col-span-2 text-xs text-gray-500">
                        {lastSeen ? new Date(lastSeen).toLocaleDateString() : 'never'}
                        {u.last_seen_age_days != null && u.last_seen_age_days < 1 && (
                          <span className="ml-1 text-emerald-600 font-semibold">· now</span>
                        )}
                      </div>
                    </div>
                  </button>
                )
              })}
            </div>
          </div>
        )}

        {selectedUserId && (
          <div
            className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center p-4"
            onClick={() => setSelectedUserId(null)}
          >
            <div
              className="bg-white rounded-2xl max-w-2xl w-full max-h-[85vh] overflow-y-auto shadow-xl"
              onClick={e => e.stopPropagation()}
            >
              <div className="sticky top-0 bg-white border-b border-gray-100 px-6 py-4 flex items-center justify-between">
                <div>
                  <p className="text-sm font-semibold text-gray-900">
                    {userDetail?.email || 'Loading…'}
                  </p>
                  <p className="text-xs text-gray-400 font-mono">{selectedUserId}</p>
                </div>
                <button
                  onClick={() => setSelectedUserId(null)}
                  className="text-gray-400 hover:text-gray-700 text-2xl leading-none"
                >
                  ×
                </button>
              </div>
              {userDetailLoading && <p className="p-6 text-sm text-gray-500">Loading…</p>}
              {userDetail && !userDetailLoading && (
                <div className="p-6 space-y-5 text-sm">
                  <div className="grid grid-cols-2 gap-3">
                    <Info label="Tier"         value={userDetail.profile?.tier || 'free'} />
                    <Info label="Points"       value={String(userDetail.profile?.points ?? 0)} />
                    <Info label="Provider"     value={userDetail.provider || 'email'} />
                    <Info label="Email confirmed" value={userDetail.email_confirmed_at ? '✓ yes' : '✗ no'} />
                    <Info label="Signed up"    value={userDetail.auth_created_at ? new Date(userDetail.auth_created_at).toLocaleString() : '—'} />
                    <Info label="Last sign-in" value={userDetail.last_sign_in_at ? new Date(userDetail.last_sign_in_at).toLocaleString() : 'never'} />
                    <Info label="Saved ports"  value={String(userDetail.saved_ports.length)} />
                    <Info label="Push enabled" value={userDetail.push_subscription_count > 0 ? `✓ (${userDetail.push_subscription_count})` : '✗'} />
                  </div>

                  {userDetail.subscription && (
                    <div>
                      <p className="text-xs font-semibold text-gray-500 uppercase tracking-wide mb-2">Subscription</p>
                      <div className="bg-gray-50 rounded-lg p-3 text-xs">
                        <p>Tier: <span className="font-medium">{userDetail.subscription.tier}</span></p>
                        <p>Status: <span className="font-medium">{userDetail.subscription.status}</span></p>
                        {userDetail.subscription.current_period_end && (
                          <p>Renews: {new Date(userDetail.subscription.current_period_end).toLocaleDateString()}</p>
                        )}
                      </div>
                    </div>
                  )}

                  <div>
                    <p className="text-xs font-semibold text-gray-500 uppercase tracking-wide mb-2">
                      Reports ({userDetail.reports.length})
                    </p>
                    {userDetail.reports.length === 0 ? (
                      <p className="text-xs text-gray-400">No reports yet.</p>
                    ) : (
                      <div className="space-y-1 max-h-48 overflow-y-auto">
                        {userDetail.reports.map(r => (
                          <div key={r.id} className="text-xs bg-gray-50 rounded px-2 py-1.5 flex justify-between gap-2">
                            <div className="flex-1 min-w-0">
                              <span className="font-mono text-gray-500">{r.port_id}</span>
                              <span className="ml-2 text-gray-700">{r.report_type}</span>
                              {r.wait_minutes != null && <span className="ml-2 text-gray-500">{r.wait_minutes} min</span>}
                            </div>
                            <span className="text-gray-400 whitespace-nowrap">{new Date(r.created_at).toLocaleDateString()}</span>
                          </div>
                        ))}
                      </div>
                    )}
                  </div>

                  <div>
                    <p className="text-xs font-semibold text-gray-500 uppercase tracking-wide mb-2">
                      Alerts ({userDetail.alerts.length})
                    </p>
                    {userDetail.alerts.length === 0 ? (
                      <p className="text-xs text-gray-400">No alerts configured.</p>
                    ) : (
                      <div className="space-y-1">
                        {userDetail.alerts.map(a => (
                          <div key={a.id} className="text-xs bg-gray-50 rounded px-2 py-1.5 flex justify-between">
                            <span><span className="font-mono">{a.port_id}</span> · {a.lane_type} · ≤{a.threshold_minutes} min</span>
                            <span className={a.active ? 'text-green-600' : 'text-gray-400'}>{a.active ? 'active' : 'off'}</span>
                          </div>
                        ))}
                      </div>
                    )}
                  </div>

                  {userDetail.saved_ports.length > 0 && (
                    <div>
                      <p className="text-xs font-semibold text-gray-500 uppercase tracking-wide mb-2">Saved crossings</p>
                      <p className="text-xs font-mono text-gray-600">{userDetail.saved_ports.join(', ')}</p>
                    </div>
                  )}
                </div>
              )}
            </div>
          </div>
        )}
      </div>
    </main>
  )
}

function Info({ label, value }: { label: string; value: string }) {
  return (
    <div>
      <p className="text-[10px] uppercase tracking-wide text-gray-400 font-semibold">{label}</p>
      <p className="text-sm text-gray-800">{value}</p>
    </div>
  )
}
