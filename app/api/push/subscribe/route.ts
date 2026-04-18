import { NextRequest, NextResponse } from 'next/server'
import { createServerClient } from '@supabase/ssr'
import { cookies } from 'next/headers'
import { getServiceClient } from '@/lib/supabase'

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

  const subscription = await req.json()
  const db = getServiceClient()

  // Conflict on endpoint, not user_id. Endpoint is globally unique per
  // browser/device, so this lets a single user have multiple active
  // subscriptions (iPhone + laptop + Android tablet, etc). Previously
  // upserting on user_id capped each user at one device. See migration
  // v38-push-subscriptions-multi-device.sql for the constraint swap.
  await db.from('push_subscriptions').upsert({
    user_id: user.id,
    endpoint: subscription.endpoint,
    p256dh: subscription.keys?.p256dh,
    auth: subscription.keys?.auth,
    updated_at: new Date().toISOString(),
  }, { onConflict: 'endpoint' })

  return NextResponse.json({ ok: true })
}

export async function DELETE() {
  const user = await getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const db = getServiceClient()
  await db.from('push_subscriptions').delete().eq('user_id', user.id)

  return NextResponse.json({ ok: true })
}
