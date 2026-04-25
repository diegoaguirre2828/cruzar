import Link from 'next/link'
import { ArrowLeft, Mail, Zap } from 'lucide-react'
import { getServiceClient } from '@/lib/supabase'
import { SubscribeForm } from './SubscribeForm'
import { LangToggle } from '@/components/LangToggle'

export const dynamic = 'force-dynamic'
export const revalidate = 300

// Public landing page for Cruzar Intelligence.
// Shows the most recent brief (proof) + a free signup form + a
// pointer to the paid $499/mo Pro tier.

export default async function IntelligencePage() {
  const db = getServiceClient()
  const { data: latest } = await db
    .from('intel_briefs')
    .select('id, title, summary, published_at')
    .order('published_at', { ascending: false })
    .limit(1)
    .maybeSingle()

  return (
    <main className="min-h-screen bg-gray-50 dark:bg-gray-950">
      <div className="max-w-2xl mx-auto px-4 pb-16">
        <div className="pt-6 pb-4 flex items-center justify-between gap-3">
          <div className="flex items-center gap-3">
            <Link href="/" className="p-2 rounded-xl bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 text-gray-600 dark:text-gray-300">
              <ArrowLeft className="w-4 h-4" />
            </Link>
            <h1 className="text-xl font-bold text-gray-900 dark:text-gray-100 flex items-center gap-2">
              <Zap className="w-5 h-5" />
              Cruzar Intelligence
            </h1>
          </div>
          <LangToggle />
        </div>

        <div className="bg-white dark:bg-gray-800 rounded-2xl border border-gray-200 dark:border-gray-700 p-6 shadow-sm mb-4">
          <h2 className="text-lg font-bold text-gray-900 dark:text-gray-100 mb-2">
            Every other tool tells you where your truck got stuck.
          </h2>
          <p className="text-sm text-gray-700 dark:text-gray-300 mb-3">
            We tell you where it&apos;s about to get stuck — 6 hours before it
            happens. Specialist for US-Mexico, bilingual, built by RGV.
          </p>
          <ul className="text-sm text-gray-700 dark:text-gray-300 space-y-1.5 mb-4">
            <li>• Border disruption alerts — blockades, system outages, security events, infrastructure incidents</li>
            <li>• VUCEM / SAT / SAAI uptime tracking</li>
            <li>• Tariff / USMCA / trade-policy whiplash</li>
            <li>• Corridor-level impact tagging (Laredo, Pharr, Otay Mesa, Cd. Juárez)</li>
            <li>• Bilingual MX-source synthesis (no other tool processes Spanish-language signals)</li>
            <li>• Daily brief in your inbox by 7am CT</li>
          </ul>
          <SubscribeForm />
        </div>

        {latest && (
          <div className="bg-white dark:bg-gray-800 rounded-2xl border border-gray-200 dark:border-gray-700 p-5 shadow-sm mb-4">
            <p className="text-[11px] uppercase tracking-wide font-semibold text-gray-500">
              Most recent brief · {latest.published_at ? new Date(latest.published_at).toISOString().slice(0, 10) : ''}
            </p>
            <Link href={`/intelligence/${latest.id}`} className="block mt-1">
              <h3 className="text-base font-bold text-gray-900 dark:text-gray-100 hover:underline">{latest.title}</h3>
              <p className="text-sm text-gray-600 dark:text-gray-400 mt-1">{latest.summary}</p>
              <p className="text-xs text-blue-600 dark:text-blue-400 mt-2">Read full brief →</p>
            </Link>
          </div>
        )}

        <div className="bg-blue-50 dark:bg-blue-900/20 border border-blue-200 dark:border-blue-800 rounded-2xl p-5 mb-3">
          <p className="text-sm font-bold text-blue-800 dark:text-blue-300 mb-1 flex items-center gap-2">
            <Mail className="w-4 h-4" /> Cruzar Intelligence — $49/mo
          </p>
          <p className="text-xs text-blue-700 dark:text-blue-400 mb-3">
            Real-time push alerts when border events fire. Per-category
            and per-corridor filters. Full event dataset + CSV export.
            Subscriber dashboard with searchable history. Daily brief
            included. 7-day free trial.
          </p>
          <Link href="/pricing#intelligence" className="inline-block text-xs font-bold px-4 py-2 rounded-xl bg-blue-600 text-white">
            Subscribe — $49/mo
          </Link>
        </div>

        <div className="bg-violet-50 dark:bg-violet-900/20 border border-violet-200 dark:border-violet-800 rounded-2xl p-5">
          <p className="text-sm font-bold text-violet-800 dark:text-violet-300 mb-1">
            Intelligence Enterprise — $499/mo
          </p>
          <p className="text-xs text-violet-700 dark:text-violet-400 mb-3">
            For supply chain VPs, underwriters, and government. Adds
            direct analyst access via Slack, custom corridor reports
            on demand, SLA on alert latency, and bespoke onboarding.
          </p>
          <Link href="/pricing#intelligence_enterprise" className="inline-block text-xs font-bold px-4 py-2 rounded-xl bg-violet-700 text-white">
            Talk to sales
          </Link>
        </div>
      </div>
    </main>
  )
}
