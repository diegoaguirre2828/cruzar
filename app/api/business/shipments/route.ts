import { NextRequest, NextResponse } from 'next/server'
import { createServerClient } from '@supabase/ssr'
import { cookies } from 'next/headers'
import { getServiceClient } from '@/lib/supabase'

export const dynamic = 'force-dynamic'

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

async function checkBusinessTier(userId: string) {
  const db = getServiceClient()
  const { data } = await db.from('profiles').select('tier').eq('id', userId).single()
  return data?.tier === 'business'
}

export async function GET(req: NextRequest) {
  const user = await getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  if (!await checkBusinessTier(user.id)) return NextResponse.json({ error: 'Business plan required' }, { status: 403 })

  const db = getServiceClient()
  const status = req.nextUrl.searchParams.get('status')

  let query = db
    .from('shipments')
    .select('*')
    .eq('user_id', user.id)
    .order('expected_crossing_at', { ascending: true })
    .limit(100)

  if (status && status !== 'all') query = query.eq('status', status)

  const { data, error } = await query
  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json({ shipments: data || [] })
}

export async function POST(req: NextRequest) {
  const user = await getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  if (!await checkBusinessTier(user.id)) return NextResponse.json({ error: 'Business plan required' }, { status: 403 })

  const body = await req.json()
  const {
    reference_id, description, origin, destination, port_id,
    carrier, driver_name, driver_phone, expected_crossing_at, notes
  } = body

  if (!reference_id) return NextResponse.json({ error: 'reference_id required' }, { status: 400 })

  const db = getServiceClient()
  const { data, error } = await db.from('shipments').insert({
    user_id: user.id,
    reference_id,
    description: description?.slice(0, 500),
    origin: origin?.slice(0, 200),
    destination: destination?.slice(0, 200),
    port_id,
    carrier: carrier?.slice(0, 200),
    driver_name: driver_name?.slice(0, 200),
    driver_phone: driver_phone?.slice(0, 50),
    expected_crossing_at: expected_crossing_at || null,
    notes: notes?.slice(0, 2000),
    status: 'scheduled',
  }).select('id').single()

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json({ success: true, id: data?.id })
}

export async function PATCH(req: NextRequest) {
  const user = await getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  if (!await checkBusinessTier(user.id)) return NextResponse.json({ error: 'Business plan required' }, { status: 403 })

  const body = await req.json()
  const { id, ...updates } = body
  if (!id) return NextResponse.json({ error: 'id required' }, { status: 400 })

  const allowed = ['status', 'delay_minutes', 'actual_crossing_at', 'notes', 'driver_name', 'driver_phone', 'port_id', 'expected_crossing_at']
  const safe: Record<string, unknown> = { updated_at: new Date().toISOString() }
  for (const key of allowed) {
    if (updates[key] !== undefined) safe[key] = updates[key]
  }

  const db = getServiceClient()
  const { error } = await db.from('shipments').update(safe).eq('id', id).eq('user_id', user.id)
  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json({ success: true })
}

export async function DELETE(req: NextRequest) {
  const user = await getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  if (!await checkBusinessTier(user.id)) return NextResponse.json({ error: 'Business plan required' }, { status: 403 })

  const id = req.nextUrl.searchParams.get('id')
  if (!id) return NextResponse.json({ error: 'id required' }, { status: 400 })

  const db = getServiceClient()
  await db.from('shipments').delete().eq('id', id).eq('user_id', user.id)
  return NextResponse.json({ success: true })
}
