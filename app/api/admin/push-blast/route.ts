import { NextRequest, NextResponse } from 'next/server'
import { createServerClient } from '@supabase/ssr'
import { cookies } from 'next/headers'
import { getServiceClient } from '@/lib/supabase'
import webpush from 'web-push'

export const dynamic = 'force-dynamic'

const ADMIN_EMAIL = 'cruzabusiness@gmail.com'

if (process.env.VAPID_PUBLIC_KEY && process.env.VAPID_PRIVATE_KEY) {
  webpush.setVapidDetails(
    'mailto:cruzabusiness@gmail.com',
    process.env.VAPID_PUBLIC_KEY,
    process.env.VAPID_PRIVATE_KEY
  )
}

export async function POST(req: NextRequest) {
  const cookieStore = await cookies()
  const supabase = createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    { cookies: { getAll: () => cookieStore.getAll() } }
  )
  const { data: { user } } = await supabase.auth.getUser()
  if (!user || user.email !== ADMIN_EMAIL) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  const { title, body, url } = await req.json()
  if (!title || !body) {
    return NextResponse.json({ error: 'title and body required' }, { status: 400 })
  }

  const db = getServiceClient()
  const { data: subs } = await db
    .from('push_subscriptions')
    .select('endpoint, p256dh, auth')

  if (!subs || subs.length === 0) {
    return NextResponse.json({ sent: 0, failed: 0 })
  }

  const payload = JSON.stringify({
    title,
    body,
    url: url || 'https://cruzar.app',
    icon: '/icon-192.png',
    badge: '/icon-192.png',
  })

  let sent = 0
  let failed = 0

  await Promise.allSettled(
    subs.map(async sub => {
      if (!sub.endpoint || !sub.p256dh || !sub.auth) { failed++; return }
      try {
        await webpush.sendNotification(
          { endpoint: sub.endpoint, keys: { p256dh: sub.p256dh, auth: sub.auth } },
          payload
        )
        sent++
      } catch {
        failed++
      }
    })
  )

  return NextResponse.json({ sent, failed, total: subs.length })
}
