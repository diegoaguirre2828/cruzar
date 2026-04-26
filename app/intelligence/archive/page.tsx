import Link from 'next/link'
import { ArrowLeft, Archive } from 'lucide-react'
import { getServiceClient } from '@/lib/supabase'
import { LangToggle } from '@/components/LangToggle'

export const dynamic = 'force-dynamic'
export const revalidate = 600

// Public archive of all past Cruzar Intelligence briefs. Lets cold
// visitors browse the synthesis quality before signing up. Strong
// social proof for the paid tier.

export default async function ArchivePage() {
  const db = getServiceClient()
  const { data: briefs } = await db
    .from('intel_briefs')
    .select('id, title, summary, published_at, cadence')
    .order('published_at', { ascending: false })
    .limit(60)

  return (
    <main className="min-h-screen bg-gray-50 dark:bg-gray-950">
      <div className="max-w-2xl mx-auto px-4 pb-16">
        <div className="pt-6 pb-4 flex items-center justify-between gap-3">
          <div className="flex items-center gap-3">
            <Link href="/intelligence" className="p-2 rounded-xl bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700">
              <ArrowLeft className="w-4 h-4 text-gray-600 dark:text-gray-300" />
            </Link>
            <h1 className="text-xl font-bold text-gray-900 dark:text-gray-100 flex items-center gap-2">
              <Archive className="w-5 h-5" />
              Brief archive
            </h1>
          </div>
          <LangToggle />
        </div>

        <p className="text-sm text-gray-600 dark:text-gray-400 mb-4">
          Every Cruzar Intelligence brief, public. {briefs?.length || 0} synthesized so far.
        </p>

        <div className="space-y-2">
          {(briefs || []).map((b) => (
            <Link
              key={b.id}
              href={`/intelligence/${b.id}`}
              className="block bg-white dark:bg-gray-800 rounded-2xl border border-gray-200 dark:border-gray-700 p-4 hover:bg-gray-50 dark:hover:bg-gray-700 transition-colors"
            >
              <div className="flex items-start justify-between gap-3 mb-1">
                <p className="text-[10px] uppercase tracking-wider font-semibold text-gray-500">
                  {b.published_at ? new Date(b.published_at).toISOString().slice(0, 10) : ''} · {b.cadence}
                </p>
              </div>
              <p className="text-sm font-bold text-gray-900 dark:text-gray-100 leading-tight mb-1">{b.title}</p>
              {b.summary && <p className="text-xs text-gray-600 dark:text-gray-400 line-clamp-2">{b.summary}</p>}
            </Link>
          ))}
          {(briefs?.length || 0) === 0 && (
            <p className="text-sm text-gray-500 italic">No briefs yet — first one publishes tomorrow at 7am CT.</p>
          )}
        </div>
      </div>
    </main>
  )
}
