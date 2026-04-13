import { NextRequest, NextResponse } from 'next/server'
import { createServerClient } from '@supabase/ssr'
import { cookies } from 'next/headers'
import { getServiceClient } from '@/lib/supabase'

export const dynamic = 'force-dynamic'

const VALID_REGIONS = new Set([
  'rgv', 'laredo', 'coahuila-tx', 'el-paso', 'sonora-az', 'baja', 'other',
])

async function getUser() {
  const cookieStore = await cookies()
  const supabase = createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    { cookies: { getAll: () => cookieStore.getAll() } }
  )
  const { data: { user } } = await supabase.auth.getUser()
  return user
}

export async function POST(req: NextRequest) {
  const user = await getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const body = await req.json().catch(() => ({}))
  const { homeRegion } = body

  if (homeRegion !== null && !VALID_REGIONS.has(homeRegion)) {
    return NextResponse.json({ error: 'Invalid region' }, { status: 400 })
  }

  const db = getServiceClient()
  const { error } = await db
    .from('profiles')
    .update({ home_region: homeRegion })
    .eq('id', user.id)

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json({ ok: true, homeRegion })
}
