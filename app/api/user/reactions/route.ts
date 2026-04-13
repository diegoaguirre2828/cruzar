import { NextResponse } from 'next/server'
import { createServerClient } from '@supabase/ssr'
import { cookies } from 'next/headers'
import { getServiceClient } from '@/lib/supabase'

// Returns the current user's recent reports with their current upvote
// counts. The client compares these totals against a cached "last
// seen" snapshot in localStorage to detect new upvotes since the
// user's last visit, then surfaces them in a welcome-back toast:
//
//   "🙌 3 personas te agradecieron tu reporte de Hidalgo"
//
// This gives reporters the reaction-feedback loop that makes FB
// posting feel satisfying, without requiring push notifications
// (which depend on the PWA being installed).

export async function GET() {
  const cookieStore = await cookies()
  const supabase = createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    { cookies: { getAll: () => cookieStore.getAll() } },
  )
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const db = getServiceClient()
  const since = new Date(Date.now() - 3 * 24 * 60 * 60 * 1000).toISOString()

  const { data, error } = await db
    .from('crossing_reports')
    .select('id, port_id, report_type, upvotes, created_at')
    .eq('user_id', user.id)
    .gte('created_at', since)
    .order('created_at', { ascending: false })
    .limit(20)

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })

  return NextResponse.json(
    { reports: data || [] },
    { headers: { 'Cache-Control': 'private, no-store' } },
  )
}
