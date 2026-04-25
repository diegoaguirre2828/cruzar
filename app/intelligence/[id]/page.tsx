import Link from 'next/link'
import { notFound } from 'next/navigation'
import { ArrowLeft } from 'lucide-react'
import { getServiceClient } from '@/lib/supabase'

export const dynamic = 'force-dynamic'
export const revalidate = 300

// Public single-brief view. Same renderer as the Express Cert print
// page (kept inline here to avoid cross-page coupling).

export default async function BriefPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params
  const db = getServiceClient()
  const { data: brief } = await db
    .from('intel_briefs')
    .select('id, title, summary, body_md, published_at')
    .eq('id', id)
    .maybeSingle()
  if (!brief) notFound()

  return (
    <main className="min-h-screen bg-gray-50 dark:bg-gray-950">
      <div className="max-w-2xl mx-auto px-4 pb-16">
        <div className="pt-6 pb-4 flex items-center gap-3">
          <Link href="/intelligence" className="p-2 rounded-xl bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 text-gray-600 dark:text-gray-300">
            <ArrowLeft className="w-4 h-4" />
          </Link>
          <p className="text-xs text-gray-500 dark:text-gray-400">
            Cruzar Intelligence · {brief.published_at ? new Date(brief.published_at).toISOString().slice(0, 16).replace('T', ' ') : ''} UTC
          </p>
        </div>
        <article
          className="prose prose-sm dark:prose-invert max-w-none bg-white dark:bg-gray-800 rounded-2xl border border-gray-200 dark:border-gray-700 p-6 shadow-sm"
          dangerouslySetInnerHTML={{ __html: render(brief.body_md as string) }}
        />
      </div>
    </main>
  )
}

function render(md: string): string {
  const escape = (s: string) => s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;')
  const lines = md.split(/\r?\n/)
  const out: string[] = []
  let listType: 'ul' | 'ol' | null = null
  const closeList = () => { if (listType) { out.push(`</${listType}>`); listType = null } }
  const inline = (s: string) => escape(s)
    .replace(/\*\*(.+?)\*\*/g, '<strong>$1</strong>')
    .replace(/\*(.+?)\*/g, '<em>$1</em>')
    .replace(/`([^`]+)`/g, '<code>$1</code>')
  for (const raw of lines) {
    const line = raw.trimEnd()
    if (!line.trim()) { closeList(); continue }
    let m: RegExpMatchArray | null
    if ((m = line.match(/^###\s+(.*)$/))) { closeList(); out.push(`<h3>${inline(m[1])}</h3>`); continue }
    if ((m = line.match(/^##\s+(.*)$/)))  { closeList(); out.push(`<h2>${inline(m[1])}</h2>`); continue }
    if ((m = line.match(/^[-*]\s+(.*)$/))) {
      if (listType !== 'ul') { closeList(); out.push('<ul>'); listType = 'ul' }
      out.push(`<li>${inline(m[1])}</li>`); continue
    }
    if ((m = line.match(/^\d+\.\s+(.*)$/))) {
      if (listType !== 'ol') { closeList(); out.push('<ol>'); listType = 'ol' }
      out.push(`<li>${inline(m[1])}</li>`); continue
    }
    closeList()
    out.push(`<p>${inline(line)}</p>`)
  }
  closeList()
  return out.join('\n')
}
