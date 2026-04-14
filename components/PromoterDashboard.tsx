'use client'

import { useEffect, useState, useMemo } from 'react'
import Link from 'next/link'
import { Copy, Check, ExternalLink, TrendingUp, Users, MessageSquare, Share2, ArrowLeft, Languages, Zap, Plus, Trash2 } from 'lucide-react'
import { useAuth } from '@/lib/useAuth'
import { useLang } from '@/lib/LangContext'
import {
  PROMOTER_TEMPLATES,
  CATEGORY_META,
  renderTemplate,
  type TemplateCategory,
} from '@/lib/promoterContent'
import { FACEBOOK_GROUPS, REGION_LABELS, type FbGroupRegion, type FacebookGroup } from '@/lib/facebookGroups'

// Extended group type returned by /api/promoter/groups — includes a
// DB id so the delete button knows what to call. Core (hardcoded)
// groups from lib/facebookGroups.ts don't have an id and are
// non-deletable.
interface GroupWithId extends FacebookGroup {
  id?: string
}

// Promoter dashboard — the Raul panel.
//
// Gated behind profile.is_promoter (checked server-side by the stats
// endpoint). Non-promoters see a "not authorized" placeholder rather
// than a redirect so a wrong-URL visit doesn't feel hostile.
//
// Layout:
//   1. Top: hero with the promoter's unique ref link + big copy button
//   2. Stats row: shares, signups, reports, weekly signups
//   3. Content library: tabs per category, tap any template to copy
//      it to clipboard with the ref link already baked in. Each copy
//      fires a log-share event so the stats reflect it.
//   4. FB group bank: region-tabbed list of groups with one-tap open
//      in new window. Lets the promoter copy a template then jump
//      straight to the group to paste it.
//
// Everything happens on one screen, no navigation required. That's
// the point — it's a "scroll and post" tool.

interface Stats {
  signups: number
  reports: number
  shares: number
  weeklySignups: number
}

const ALL_CATEGORIES: TemplateCategory[] = [
  'morning', 'midday', 'afternoon', 'evening', 'heads_up', 'tip', 'ask', 'evergreen', 'page_follow',
]

// Chrome label translations for the promoter dashboard. Prompts and
// captions stay in Spanish everywhere because 99% of border-crossing
// FB group culture is Spanish — this toggle is only for the panel
// chrome so English-dominant promoters can navigate without guessing
// at labels. The copy-to-clipboard output is ALWAYS Spanish.
const T = {
  backToApp: { es: '← Cruzar', en: '← Cruzar' },
  panelTitle: { es: 'Panel del promotor', en: 'Promoter panel' },
  panelSub:   { es: 'Tu link, tu contenido, tus números.', en: 'Your link, your content, your numbers.' },
  refLinkLabel:    { es: 'Tu link único', en: 'Your unique link' },
  copy:            { es: 'Copiar', en: 'Copy' },
  copied:          { es: 'Copiado', en: 'Copied' },
  refLinkCaveat: {
    es: 'Cada usuario que se registre por este link queda atribuido a ti. No cambies el link, no lo acortes — se rompe el tracking.',
    en: 'Every user who signs up through this link is attributed to you. Do not modify or shorten the link — it breaks tracking.',
  },
  shareCenter:      { es: '🚀 Share Center', en: '🚀 Share Center' },
  currentPostLabel: { es: 'Publicación actual', en: 'Current post' },
  currentPostSub: {
    es: 'Esta es la publicación que Cruzar está posteando en FB ahorita mismo. Cópiala y pégala directo en los grupos.',
    en: 'This is the post Cruzar is publishing to FB right now. Copy it and paste directly into groups.',
  },
  copyCaption:    { es: 'Copiar caption', en: 'Copy caption' },
  couldntLoad:    { es: 'No se pudo cargar la publicación actual.', en: 'Could not load the current post.' },
  fbPageLabel:    { es: 'Página de Cruzar en FB', en: 'Cruzar FB page' },
  fbPageSub: {
    es: 'Compártela pa\' que la gente le dé follow y reciba notificaciones con los tiempos.',
    en: 'Share it so people follow the page and receive notifications with the wait times.',
  },
  copyUrl:        { es: 'Copiar URL', en: 'Copy URL' },
  copyFullPitch:  { es: 'Copiar pitch completo (texto + link)', en: 'Copy full pitch (text + link)' },
  pitchCopied:    { es: 'Pitch copiado', en: 'Pitch copied' },
  shareFooter: {
    es: 'Cada clic se cuenta como un share en tus números. Copia, abre un grupo abajo, pega, y repite.',
    en: 'Every click counts as a share in your stats. Copy, open a group below, paste, repeat.',
  },
  statsPosts:    { es: 'Posts',      en: 'Posts' },
  statsSignups:  { es: 'Signups',    en: 'Signups' },
  statsReports:  { es: 'Reportes',   en: 'Reports' },
  stats7day:     { es: '7 días',     en: '7 days' },
  libraryTitle:  { es: '📝 Textos listos pa\' copiar', en: '📝 Ready-to-copy posts' },
  templatesCount: { es: 'plantillas', en: 'templates' },
  allLabel: { es: 'Todos', en: 'All' },
  englishHint: { es: '', en: 'English translation (not posted):' },
  groupsTitle:  { es: '📘 Grupos para postear', en: '📘 Groups to post in' },
  groupsCount:  { es: 'grupos', en: 'groups' },
  openAllGroups: { es: 'Abrir los grupos en pestañas', en: 'Open groups in tabs' },
  openAllGroupsHint: {
    es: 'Si el navegador bloquea los pop-ups, permítelos para cruzar.app una vez y vuelve a intentar.',
    en: 'If your browser blocks pop-ups, allow them for cruzar.app once and try again.',
  },
  allRegions: { es: '🌎 Todos', en: '🌎 All' },
  notAuthTitle: { es: 'Panel del promotor', en: 'Promoter panel' },
  notAuthSub:   { es: 'Necesitas iniciar sesión con la cuenta de promotor.', en: 'Sign in with your promoter account.' },
  signIn:       { es: 'Iniciar sesión', en: 'Sign in' },
  noAccessTitle: { es: 'Sin acceso', en: 'No access' },
  noAccessSub: {
    es: 'Esta cuenta no es una cuenta de promotor. Contacta a Diego si crees que deberías tener acceso.',
    en: 'This account is not a promoter account. Contact Diego if you think you should have access.',
  },
  back: { es: '← Regresar', en: '← Go back' },
}

export function PromoterDashboard() {
  const { user, loading: authLoading } = useAuth()
  const { lang, toggle: toggleLang } = useLang()
  const en = lang === 'en'
  const t = (key: keyof typeof T) => T[key][en ? 'en' : 'es']
  const [displayName, setDisplayName] = useState('')
  const [stats, setStats] = useState<Stats | null>(null)
  const [accessError, setAccessError] = useState<string | null>(null)
  const [loading, setLoading] = useState(true)
  const [copiedId, setCopiedId] = useState<string | null>(null)
  const [categoryFilter, setCategoryFilter] = useState<TemplateCategory | 'all'>('all')
  const [regionFilter, setRegionFilter] = useState<FbGroupRegion | 'all'>('all')
  const [liveCaption, setLiveCaption] = useState<string | null>(null)
  const [livePeak, setLivePeak] = useState<string | null>(null)
  const [liveLoading, setLiveLoading] = useState(true)
  const [userGroups, setUserGroups] = useState<GroupWithId[]>([])
  const [addPanelOpen, setAddPanelOpen] = useState(false)
  const [bulkText, setBulkText] = useState('')
  const [bulkRegion, setBulkRegion] = useState<FbGroupRegion>('rgv')
  const [adding, setAdding] = useState(false)
  const [addResult, setAddResult] = useState<string | null>(null)

  const refLink = user ? `https://cruzar.app/?ref=${user.id}` : 'https://cruzar.app'
  // cruzar.app/fb is a 302 redirect to our actual FB page — keeps
  // the vanity URL in pasted pitches and routes clicks through our
  // domain for tracking before landing on Facebook.
  const fbPageUrl = 'https://cruzar.app/fb'
  // Page recruitment pitch stays in Spanish — this is what gets
  // pasted into groups. The language toggle only affects chrome.
  const pagePitch = `Raza, síganse a Cruzar en Facebook — publica los tiempos de los puentes 4 veces al día (mañana, mediodía, tarde, noche). Les llega una notificación directo al teléfono, ya no tienen que andar buscando en los grupos 👉 ${fbPageUrl}`

  // Load stats on mount
  useEffect(() => {
    if (authLoading) return
    if (!user) {
      setAccessError('not_signed_in')
      setLoading(false)
      return
    }

    fetch('/api/promoter/stats')
      .then(async (r) => {
        if (r.status === 403) {
          setAccessError('not_promoter')
          return null
        }
        if (!r.ok) {
          setAccessError('error')
          return null
        }
        return r.json()
      })
      .then((data) => {
        if (data) {
          setDisplayName(data.displayName || '')
          setStats(data.stats)
        }
      })
      .catch(() => setAccessError('error'))
      .finally(() => setLoading(false))

    // Fetch the live caption currently being posted to FB. Separate
    // from stats so the dashboard still renders if this endpoint
    // errors out (e.g. CBP outage).
    fetch('/api/promoter/latest-caption')
      .then((r) => r.ok ? r.json() : null)
      .then((data) => {
        if (data) {
          setLiveCaption(data.caption)
          setLivePeak(data.peak)
        }
      })
      .catch(() => { /* silent */ })
      .finally(() => setLiveLoading(false))

    // Fetch user-added groups from the database so they show up
    // alongside the hardcoded core list in lib/facebookGroups.ts.
    fetch('/api/promoter/groups')
      .then((r) => r.ok ? r.json() : null)
      .then((data) => {
        if (data?.groups) setUserGroups(data.groups as GroupWithId[])
      })
      .catch(() => { /* silent */ })
  }, [user, authLoading])

  async function submitBulkGroups() {
    if (!bulkText.trim()) return
    setAdding(true)
    setAddResult(null)
    try {
      const res = await fetch('/api/promoter/groups', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ bulkText, region: bulkRegion }),
      })
      const data = await res.json()
      if (!res.ok) {
        setAddResult(data.error || 'Error')
      } else {
        setAddResult(`✓ ${data.added} agregados${data.skipped > 0 ? ` · ${data.skipped} duplicados` : ''}`)
        setBulkText('')
        // Refetch to update the display
        const refresh = await fetch('/api/promoter/groups')
        if (refresh.ok) {
          const refreshData = await refresh.json()
          if (refreshData?.groups) setUserGroups(refreshData.groups)
        }
      }
    } catch (err) {
      setAddResult(`Error: ${err instanceof Error ? err.message : String(err)}`)
    } finally {
      setAdding(false)
    }
  }

  async function deleteUserGroup(id: string) {
    if (!confirm(en ? 'Delete this group?' : '¿Borrar este grupo?')) return
    try {
      const res = await fetch(`/api/promoter/groups/${id}`, { method: 'DELETE' })
      if (res.ok) {
        setUserGroups((prev) => prev.filter((g) => g.id !== id))
      }
    } catch { /* ignore */ }
  }

  async function logShare(templateId: string, category: string, channel: string, targetGroup?: string) {
    try {
      await fetch('/api/promoter/log-share', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ templateId, category, channel, targetGroup }),
      })
      // Optimistic bump
      setStats((prev) => prev ? { ...prev, shares: prev.shares + 1 } : prev)
    } catch { /* ignore */ }
  }

  async function copyTemplate(templateId: string, category: string, text: string) {
    const rendered = text.replace(/\{\{refLink\}\}/g, refLink)
    try {
      await navigator.clipboard.writeText(rendered)
      setCopiedId(templateId)
      setTimeout(() => setCopiedId(null), 2000)
      logShare(templateId, category, 'copy')
    } catch {
      // clipboard blocked — fall back silently
    }
  }

  async function copyRefLink() {
    try {
      await navigator.clipboard.writeText(refLink)
      setCopiedId('ref-link')
      setTimeout(() => setCopiedId(null), 2000)
    } catch { /* ignore */ }
  }

  async function copyLiveCaption() {
    if (!liveCaption) return
    try {
      await navigator.clipboard.writeText(liveCaption)
      setCopiedId('live-caption')
      setTimeout(() => setCopiedId(null), 2000)
      logShare('live-caption', 'evergreen', 'copy_live_caption')
    } catch { /* ignore */ }
  }

  async function copyPageUrl() {
    try {
      await navigator.clipboard.writeText(fbPageUrl)
      setCopiedId('page-url')
      setTimeout(() => setCopiedId(null), 2000)
      logShare('page-url', 'page_follow', 'copy_page_url')
    } catch { /* ignore */ }
  }

  async function copyPagePitch() {
    try {
      await navigator.clipboard.writeText(pagePitch)
      setCopiedId('page-pitch')
      setTimeout(() => setCopiedId(null), 2000)
      logShare('page-pitch', 'page_follow', 'copy_page_pitch')
    } catch { /* ignore */ }
  }

  // Blast mode: open every visible group in a new tab with one click.
  // Browsers block multiple window.open() calls from a single gesture
  // by default — we stagger them slightly and rely on the user
  // allowing pop-ups for cruzar.app. Each open logs a share event
  // so the stats reflect the blast.
  function bulkOpenGroups() {
    if (visibleGroups.length === 0) return
    visibleGroups.forEach((group, idx) => {
      setTimeout(() => {
        window.open(group.url, `_blank_${group.url}`, 'noopener,noreferrer')
        logShare('bulk-open', 'evergreen', 'bulk_open', group.name)
      }, idx * 150)
    })
  }

  const visibleTemplates = useMemo(() => {
    return categoryFilter === 'all'
      ? PROMOTER_TEMPLATES
      : PROMOTER_TEMPLATES.filter((t) => t.category === categoryFilter)
  }, [categoryFilter])

  // Merge hardcoded core groups with user-added database groups. The
  // hardcoded ones never have an id; the user-added ones do, so the
  // render side can decide whether to show a delete button.
  const allGroups: GroupWithId[] = useMemo(() => {
    const seenUrls = new Set<string>()
    const merged: GroupWithId[] = []
    // Database groups first so their id is preserved if a URL collides
    for (const g of userGroups) {
      if (!seenUrls.has(g.url)) {
        merged.push(g)
        seenUrls.add(g.url)
      }
    }
    // Then core groups (non-deletable, no id)
    for (const g of FACEBOOK_GROUPS) {
      if (!seenUrls.has(g.url)) {
        merged.push(g)
        seenUrls.add(g.url)
      }
    }
    return merged
  }, [userGroups])

  const visibleGroups = useMemo(() => {
    return regionFilter === 'all'
      ? allGroups
      : allGroups.filter((g) => g.region === regionFilter)
  }, [regionFilter, allGroups])

  // ─── Gating states ─────────────────────────────────────────
  if (authLoading || loading) {
    return (
      <main className="min-h-screen bg-gray-50 dark:bg-gray-950 flex items-center justify-center">
        <div className="animate-pulse text-sm text-gray-400">Cargando…</div>
      </main>
    )
  }

  if (accessError === 'not_signed_in') {
    return (
      <main className="min-h-screen bg-gray-50 dark:bg-gray-950 flex items-center justify-center p-6">
        <div className="max-w-sm w-full bg-white dark:bg-gray-900 rounded-2xl border border-gray-200 dark:border-gray-800 p-6 text-center">
          <p className="text-3xl mb-3">🔒</p>
          <h1 className="text-lg font-black text-gray-900 dark:text-gray-100">{t('notAuthTitle')}</h1>
          <p className="text-xs text-gray-500 dark:text-gray-400 mt-1 leading-snug">
            {t('notAuthSub')}
          </p>
          <Link href="/login?next=/promoter" className="mt-4 block w-full bg-blue-600 text-white text-sm font-bold rounded-2xl py-3">
            {t('signIn')}
          </Link>
        </div>
      </main>
    )
  }

  if (accessError === 'not_promoter') {
    return (
      <main className="min-h-screen bg-gray-50 dark:bg-gray-950 flex items-center justify-center p-6">
        <div className="max-w-sm w-full bg-white dark:bg-gray-900 rounded-2xl border border-gray-200 dark:border-gray-800 p-6 text-center">
          <p className="text-3xl mb-3">🚫</p>
          <h1 className="text-lg font-black text-gray-900 dark:text-gray-100">{t('noAccessTitle')}</h1>
          <p className="text-xs text-gray-500 dark:text-gray-400 mt-1 leading-snug">
            {t('noAccessSub')}
          </p>
          <Link href="/" className="mt-4 block w-full bg-gray-100 dark:bg-gray-800 text-gray-700 dark:text-gray-300 text-sm font-bold rounded-2xl py-3">
            {t('back')}
          </Link>
        </div>
      </main>
    )
  }

  // ─── Main dashboard ────────────────────────────────────────
  return (
    <main className="min-h-screen bg-gray-50 dark:bg-gray-950">
      <div className="max-w-2xl mx-auto px-4 pt-6 pb-12">
        <div className="flex items-start justify-between mb-4 gap-3">
          <div className="min-w-0">
            <Link href="/" className="inline-flex items-center gap-1 text-xs text-gray-400 hover:text-gray-700 dark:hover:text-gray-200">
              <ArrowLeft className="w-3 h-3" /> Cruzar
            </Link>
            <h1 className="text-2xl font-black text-gray-900 dark:text-gray-100 mt-1">
              {t('panelTitle')}
            </h1>
            <p className="text-xs text-gray-500 dark:text-gray-400 mt-0.5">
              {displayName && `${displayName} · `}{t('panelSub')}
            </p>
          </div>
          <button
            onClick={toggleLang}
            className="flex-shrink-0 flex items-center gap-1 bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-full px-3 py-1.5 text-[11px] font-bold text-gray-700 dark:text-gray-300 active:scale-95 transition-transform"
            title="Toggle panel language"
          >
            <Languages className="w-3 h-3" />
            {en ? 'EN' : 'ES'}
          </button>
        </div>

        {/* ─── Referral link card ──────────────────────────── */}
        <div className="bg-gradient-to-br from-blue-600 via-indigo-700 to-purple-800 rounded-2xl p-5 shadow-xl text-white mb-4 relative overflow-hidden">
          <div className="absolute -top-16 -right-16 w-48 h-48 bg-white/10 rounded-full blur-3xl" />
          <div className="relative">
            <p className="text-[10px] uppercase tracking-widest font-bold text-blue-100">{t('refLinkLabel')}</p>
            <div className="mt-2 flex items-stretch gap-2">
              <div className="flex-1 min-w-0 bg-white/15 backdrop-blur-sm rounded-xl px-3 py-2.5 border border-white/20">
                <p className="text-xs font-mono text-white truncate">{refLink}</p>
              </div>
              <button
                onClick={copyRefLink}
                className="flex-shrink-0 bg-white text-indigo-700 font-black text-xs px-4 rounded-xl active:scale-95 transition-transform"
              >
                {copiedId === 'ref-link' ? (
                  <span className="flex items-center gap-1"><Check className="w-3 h-3" /> {t('copied')}</span>
                ) : (
                  <span className="flex items-center gap-1"><Copy className="w-3 h-3" /> {t('copy')}</span>
                )}
              </button>
            </div>
            <p className="text-[10px] text-blue-100 mt-2 leading-snug">
              {t('refLinkCaveat')}
            </p>
          </div>
        </div>

        {/* ─── Share Center ────────────────────────────────── */}
        {/* Three copy actions for the manual "post in groups" workflow.
            Live caption = same caption Make.com is posting to FB right
            now. Page URL = recruit followers. Page pitch = ready-made
            intro text for group shares. */}
        <section className="mb-5">
          <h2 className="text-base font-black text-gray-900 dark:text-gray-100 mb-3">
            {t('shareCenter')}
          </h2>

          {/* Live caption — THE current FB post */}
          <div className="bg-white dark:bg-gray-800 border-2 border-amber-300 dark:border-amber-700/50 rounded-2xl p-4 mb-2">
            <div className="flex items-center justify-between gap-2 mb-2">
              <div className="flex items-center gap-1.5 min-w-0">
                <span className="text-sm">📝</span>
                <p className="text-[11px] font-black text-amber-900 dark:text-amber-200 uppercase tracking-wider">
                  {t('currentPostLabel')} {livePeak && `· ${livePeak.slice(0, 20)}...`}
                </p>
              </div>
              <button
                onClick={copyLiveCaption}
                disabled={!liveCaption}
                className={`flex-shrink-0 flex items-center gap-1 text-[10px] font-black px-3 py-1.5 rounded-full transition-colors disabled:opacity-40 ${
                  copiedId === 'live-caption'
                    ? 'bg-green-500 text-white'
                    : 'bg-amber-500 text-white hover:bg-amber-600'
                }`}
              >
                {copiedId === 'live-caption' ? (
                  <><Check className="w-3 h-3" /> {t('copied')}</>
                ) : (
                  <><Copy className="w-3 h-3" /> {t('copyCaption')}</>
                )}
              </button>
            </div>
            <p className="text-[10px] text-amber-700 dark:text-amber-400 leading-snug mb-2">
              {t('currentPostSub')}
            </p>
            {liveLoading ? (
              <div className="h-20 bg-gray-100 dark:bg-gray-700 rounded-xl animate-pulse" />
            ) : liveCaption ? (
              <div className="bg-gray-50 dark:bg-gray-900 rounded-xl p-3 max-h-40 overflow-y-auto">
                <pre className="text-[11px] text-gray-700 dark:text-gray-300 whitespace-pre-wrap leading-snug font-sans">
                  {liveCaption}
                </pre>
              </div>
            ) : (
              <div className="bg-gray-50 dark:bg-gray-900 rounded-xl p-3 text-center">
                <p className="text-[11px] text-gray-400">{t('couldntLoad')}</p>
              </div>
            )}
          </div>

          {/* FB Page URL — recruit followers */}
          <div className="bg-[#1877f2] rounded-2xl p-4 mb-2 text-white">
            <div className="flex items-center justify-between gap-2 mb-2">
              <div className="flex items-center gap-1.5">
                <span className="text-sm">📘</span>
                <p className="text-[11px] font-black uppercase tracking-wider">
                  {t('fbPageLabel')}
                </p>
              </div>
              <button
                onClick={copyPageUrl}
                className={`flex items-center gap-1 text-[10px] font-black px-3 py-1.5 rounded-full transition-colors ${
                  copiedId === 'page-url'
                    ? 'bg-green-500 text-white'
                    : 'bg-white text-[#1877f2] hover:bg-blue-50'
                }`}
              >
                {copiedId === 'page-url' ? (
                  <><Check className="w-3 h-3" /> {t('copied')}</>
                ) : (
                  <><Copy className="w-3 h-3" /> {t('copyUrl')}</>
                )}
              </button>
            </div>
            <p className="text-[11px] text-blue-100 mb-2 leading-snug">
              {t('fbPageSub')}
            </p>
            <div className="bg-white/15 backdrop-blur-sm rounded-xl px-3 py-2 border border-white/20 mb-2">
              <p className="text-xs font-mono text-white truncate">{fbPageUrl}</p>
            </div>
            <button
              onClick={copyPagePitch}
              className={`w-full flex items-center justify-center gap-1 text-[10px] font-black px-3 py-2 rounded-xl transition-colors ${
                copiedId === 'page-pitch'
                  ? 'bg-green-500 text-white'
                  : 'bg-white/20 hover:bg-white/30 text-white border border-white/30'
              }`}
            >
              {copiedId === 'page-pitch' ? (
                <><Check className="w-3 h-3" /> {t('pitchCopied')}</>
              ) : (
                <><Copy className="w-3 h-3" /> {t('copyFullPitch')}</>
              )}
            </button>
          </div>

          <p className="text-[10px] text-gray-400 dark:text-gray-500 leading-snug px-1">
            {t('shareFooter')}
          </p>
        </section>

        {/* ─── Stats row ───────────────────────────────────── */}
        {stats && (
          <div className="grid grid-cols-4 gap-2 mb-6">
            <StatTile icon={<Share2 className="w-4 h-4" />} label={t('statsPosts')} value={stats.shares} color="bg-blue-50 dark:bg-blue-900/20 text-blue-700 dark:text-blue-300" />
            <StatTile icon={<Users className="w-4 h-4" />} label={t('statsSignups')} value={stats.signups} color="bg-green-50 dark:bg-green-900/20 text-green-700 dark:text-green-300" />
            <StatTile icon={<MessageSquare className="w-4 h-4" />} label={t('statsReports')} value={stats.reports} color="bg-amber-50 dark:bg-amber-900/20 text-amber-700 dark:text-amber-300" />
            <StatTile icon={<TrendingUp className="w-4 h-4" />} label={t('stats7day')} value={stats.weeklySignups} color="bg-purple-50 dark:bg-purple-900/20 text-purple-700 dark:text-purple-300" />
          </div>
        )}

        {/* ─── Content library ─────────────────────────────── */}
        <section className="mb-8">
          <div className="flex items-center justify-between mb-3">
            <h2 className="text-base font-black text-gray-900 dark:text-gray-100">
              {t('libraryTitle')}
            </h2>
            <span className="text-[10px] text-gray-400">{visibleTemplates.length} {t('templatesCount')}</span>
          </div>

          {/* Category tabs */}
          <div className="flex flex-wrap gap-1.5 mb-3">
            <button
              onClick={() => setCategoryFilter('all')}
              className={`text-[11px] font-bold px-3 py-1.5 rounded-full border transition-colors ${
                categoryFilter === 'all'
                  ? 'bg-gray-900 dark:bg-gray-100 text-white dark:text-gray-900 border-gray-900 dark:border-gray-100'
                  : 'bg-white dark:bg-gray-800 text-gray-600 dark:text-gray-300 border-gray-200 dark:border-gray-700'
              }`}
            >
              {t('allLabel')}
            </button>
            {ALL_CATEGORIES.map((cat) => {
              const meta = CATEGORY_META[cat]
              return (
                <button
                  key={cat}
                  onClick={() => setCategoryFilter(cat)}
                  className={`text-[11px] font-bold px-3 py-1.5 rounded-full border transition-colors ${
                    categoryFilter === cat
                      ? 'bg-gray-900 dark:bg-gray-100 text-white dark:text-gray-900 border-gray-900 dark:border-gray-100'
                      : 'bg-white dark:bg-gray-800 text-gray-600 dark:text-gray-300 border-gray-200 dark:border-gray-700'
                  }`}
                >
                  {meta.emoji} {en ? meta.en : meta.es}
                </button>
              )
            })}
          </div>

          {/* Templates */}
          <div className="space-y-2">
            {visibleTemplates.map((template) => {
              const rendered = renderTemplate(template, refLink)
              const isCopied = copiedId === template.id
              return (
                <div
                  key={template.id}
                  className="bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-2xl p-3"
                >
                  <div className="flex items-center justify-between gap-2 mb-1.5">
                    <div className="flex items-center gap-1.5 min-w-0">
                      <span className="text-sm leading-none">{CATEGORY_META[template.category].emoji}</span>
                      <span className="text-[11px] font-bold text-gray-900 dark:text-gray-100 truncate">
                        {en ? template.labelEn : template.label}
                      </span>
                    </div>
                    <button
                      onClick={() => copyTemplate(template.id, template.category, template.text)}
                      className={`flex-shrink-0 flex items-center gap-1 text-[10px] font-black px-2.5 py-1 rounded-full transition-colors ${
                        isCopied
                          ? 'bg-green-500 text-white'
                          : 'bg-blue-600 text-white hover:bg-blue-700'
                      }`}
                    >
                      {isCopied ? <><Check className="w-3 h-3" /> {t('copied')}</> : <><Copy className="w-3 h-3" /> {t('copy')}</>}
                    </button>
                  </div>
                  <p className="text-xs text-gray-600 dark:text-gray-300 whitespace-pre-wrap leading-snug">
                    {rendered}
                  </p>
                  {/* English comprehension hint — only rendered when the
                      promoter has flipped the chrome language to English.
                      This is NOT posted. The copy button still grabs
                      the Spanish text above. */}
                  {en && (
                    <div className="mt-2 pt-2 border-t border-dashed border-gray-200 dark:border-gray-700">
                      <p className="text-[9px] font-bold text-gray-400 uppercase tracking-wider leading-none mb-1">
                        {t('englishHint')}
                      </p>
                      <p className="text-[11px] italic text-gray-500 dark:text-gray-400 whitespace-pre-wrap leading-snug">
                        {template.translationEn.replace(/\{\{refLink\}\}/g, refLink)}
                      </p>
                    </div>
                  )}
                </div>
              )
            })}
          </div>
        </section>

        {/* ─── FB group bank ──────────────────────────────── */}
        <section>
          <div className="flex items-center justify-between mb-3">
            <h2 className="text-base font-black text-gray-900 dark:text-gray-100">
              {t('groupsTitle')}
            </h2>
            <span className="text-[10px] text-gray-400">{visibleGroups.length} {t('groupsCount')}</span>
          </div>

          {/* Bulk open button — fires window.open for every visible group
              with a slight stagger so pop-up blockers have a chance to
              allow them through. User still has to paste + post in each
              tab manually (FB API blocks true auto-post to groups), but
              this removes the "hunt for the next group" friction. */}
          <button
            onClick={bulkOpenGroups}
            disabled={visibleGroups.length === 0}
            className="w-full mb-2 flex items-center justify-center gap-2 bg-gradient-to-r from-orange-500 to-red-500 text-white font-black text-sm rounded-2xl py-3 shadow-sm active:scale-[0.98] transition-transform disabled:opacity-40"
          >
            <Zap className="w-4 h-4" />
            {t('openAllGroups')} ({visibleGroups.length})
          </button>
          <p className="text-[10px] text-gray-400 dark:text-gray-500 leading-snug px-1 mb-3">
            {t('openAllGroupsHint')}
          </p>

          {/* Region tabs */}
          <div className="flex flex-wrap gap-1.5 mb-3">
            <button
              onClick={() => setRegionFilter('all')}
              className={`text-[11px] font-bold px-3 py-1.5 rounded-full border transition-colors ${
                regionFilter === 'all'
                  ? 'bg-gray-900 dark:bg-gray-100 text-white dark:text-gray-900 border-gray-900 dark:border-gray-100'
                  : 'bg-white dark:bg-gray-800 text-gray-600 dark:text-gray-300 border-gray-200 dark:border-gray-700'
              }`}
            >
              {t('allRegions')}
            </button>
            {(Object.keys(REGION_LABELS) as FbGroupRegion[]).map((r) => {
              const meta = REGION_LABELS[r]
              const count = FACEBOOK_GROUPS.filter((g) => g.region === r).length
              if (count === 0) return null
              return (
                <button
                  key={r}
                  onClick={() => setRegionFilter(r)}
                  className={`text-[11px] font-bold px-3 py-1.5 rounded-full border transition-colors ${
                    regionFilter === r
                      ? 'bg-gray-900 dark:bg-gray-100 text-white dark:text-gray-900 border-gray-900 dark:border-gray-100'
                      : 'bg-white dark:bg-gray-800 text-gray-600 dark:text-gray-300 border-gray-200 dark:border-gray-700'
                  }`}
                >
                  {meta.emoji} {meta.label.split(' / ')[0]} ({count})
                </button>
              )
            })}
          </div>

          <div className="space-y-1.5">
            {visibleGroups.map((group) => (
              <div
                key={group.url}
                className="flex items-center gap-1 bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-xl pr-1.5"
              >
                <a
                  href={group.url}
                  target="_blank"
                  rel="noopener noreferrer"
                  onClick={() => logShare('group-open', 'evergreen', 'group_open', group.name)}
                  className="flex items-center justify-between gap-2 flex-1 min-w-0 pl-3 py-2.5 hover:bg-gray-50 dark:hover:bg-gray-700 transition-colors rounded-l-xl"
                >
                  <div className="min-w-0 flex-1">
                    <p className="text-xs font-bold text-gray-900 dark:text-gray-100 truncate">
                      {group.name}
                    </p>
                    <p className="text-[10px] text-gray-400 truncate">
                      {REGION_LABELS[group.region].label}
                    </p>
                  </div>
                  <ExternalLink className="w-3 h-3 text-gray-400 flex-shrink-0" />
                </a>
                {group.id && (
                  <button
                    onClick={() => deleteUserGroup(group.id!)}
                    className="flex-shrink-0 w-7 h-7 flex items-center justify-center text-gray-400 hover:text-red-500 hover:bg-red-50 dark:hover:bg-red-900/20 rounded-lg transition-colors"
                    title={en ? 'Delete group' : 'Borrar grupo'}
                  >
                    <Trash2 className="w-3.5 h-3.5" />
                  </button>
                )}
              </div>
            ))}
          </div>

          {/* Bulk add panel — collapsed by default, opens a textarea
              for Diego to paste many URLs at once and save to the DB. */}
          <div className="mt-4 bg-white dark:bg-gray-800 border-2 border-dashed border-gray-300 dark:border-gray-600 rounded-2xl overflow-hidden">
            <button
              onClick={() => setAddPanelOpen((v) => !v)}
              className="w-full flex items-center justify-between px-4 py-3 hover:bg-gray-50 dark:hover:bg-gray-700 transition-colors"
            >
              <div className="flex items-center gap-2">
                <Plus className="w-4 h-4 text-gray-500 dark:text-gray-400" />
                <span className="text-sm font-bold text-gray-700 dark:text-gray-200">
                  {en ? 'Add more groups' : 'Agregar más grupos'}
                </span>
              </div>
              <span className="text-xs text-gray-400">{addPanelOpen ? '▲' : '▼'}</span>
            </button>

            {addPanelOpen && (
              <div className="px-4 pb-4 space-y-3 border-t border-gray-200 dark:border-gray-700">
                <div className="pt-3">
                  <label className="block text-[10px] uppercase tracking-wider font-bold text-gray-500 dark:text-gray-400 mb-1.5">
                    {en ? 'Region for all groups in this batch' : 'Región para todos los grupos en este batch'}
                  </label>
                  <select
                    value={bulkRegion}
                    onChange={(e) => setBulkRegion(e.target.value as FbGroupRegion)}
                    className="w-full text-sm bg-white dark:bg-gray-900 border border-gray-200 dark:border-gray-700 rounded-xl px-3 py-2"
                  >
                    {(Object.keys(REGION_LABELS) as FbGroupRegion[]).map((r) => (
                      <option key={r} value={r}>
                        {REGION_LABELS[r].emoji} {REGION_LABELS[r].label}
                      </option>
                    ))}
                  </select>
                </div>

                <div>
                  <label className="block text-[10px] uppercase tracking-wider font-bold text-gray-500 dark:text-gray-400 mb-1.5">
                    {en ? 'Paste URLs (one per line)' : 'Pega los URLs (uno por línea)'}
                  </label>
                  <textarea
                    value={bulkText}
                    onChange={(e) => setBulkText(e.target.value)}
                    placeholder={en
                      ? 'https://www.facebook.com/groups/123\nGroup name | https://www.facebook.com/groups/456\nAnother name, https://www.facebook.com/groups/789'
                      : 'https://www.facebook.com/groups/123\nNombre del grupo | https://www.facebook.com/groups/456\nOtro nombre, https://www.facebook.com/groups/789'}
                    rows={6}
                    className="w-full text-xs font-mono bg-white dark:bg-gray-900 border border-gray-200 dark:border-gray-700 rounded-xl px-3 py-2 resize-y focus:outline-none focus:ring-2 focus:ring-blue-500"
                  />
                  <p className="text-[10px] text-gray-400 mt-1 leading-snug">
                    {en
                      ? 'Formats supported: plain URL, "Name | URL", or "Name, URL". Duplicates are skipped automatically.'
                      : 'Formatos: URL solo, "Nombre | URL", o "Nombre, URL". Los duplicados se omiten automáticamente.'}
                  </p>
                </div>

                <button
                  onClick={submitBulkGroups}
                  disabled={adding || !bulkText.trim()}
                  className="w-full bg-gray-900 dark:bg-gray-100 dark:text-gray-900 text-white text-sm font-bold py-2.5 rounded-2xl disabled:opacity-40"
                >
                  {adding ? (en ? 'Adding…' : 'Agregando…') : (en ? 'Add groups' : 'Agregar grupos')}
                </button>

                {addResult && (
                  <p className={`text-[11px] text-center font-semibold ${
                    addResult.startsWith('✓') ? 'text-green-600' : 'text-red-500'
                  }`}>
                    {addResult}
                  </p>
                )}
              </div>
            )}
          </div>
        </section>
      </div>
    </main>
  )
}

function StatTile({
  icon,
  label,
  value,
  color,
}: {
  icon: React.ReactNode
  label: string
  value: number
  color: string
}) {
  return (
    <div className={`${color} rounded-xl px-2 py-2.5 text-center`}>
      <div className="flex items-center justify-center mb-0.5 opacity-70">{icon}</div>
      <p className="text-lg font-black tabular-nums leading-none">{value}</p>
      <p className="text-[9px] font-bold uppercase tracking-wider opacity-75 mt-0.5">{label}</p>
    </div>
  )
}
