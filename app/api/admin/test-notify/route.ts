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

type ChannelResult = { ok: boolean; detail: string }

async function testEmail(email: string): Promise<ChannelResult> {
  if (!process.env.RESEND_API_KEY) {
    return { ok: false, detail: 'RESEND_API_KEY not set' }
  }
  const from = process.env.RESEND_FROM_EMAIL || 'Cruzar Alerts <onboarding@resend.dev>'
  const usingFallback = !process.env.RESEND_FROM_EMAIL
  try {
    const res = await fetch('https://api.resend.com/emails', {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${process.env.RESEND_API_KEY}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        from,
        to: [email],
        subject: '🌉 Cruzar test notification',
        html: `
          <div style="font-family:-apple-system,sans-serif;max-width:480px;margin:0 auto;padding:24px;">
            <h2 style="margin:0 0 16px;color:#111827;font-size:20px;">🌉 Cruzar test</h2>
            <p style="color:#374151;font-size:14px;line-height:1.5;">
              This is a test notification sent from the admin panel at ${new Date().toLocaleString()}.
            </p>
            <p style="color:#6b7280;font-size:12px;margin-top:16px;">
              From: <code>${from}</code>
            </p>
          </div>
        `,
      }),
    })
    const body = await res.json().catch(() => null)
    if (!res.ok) {
      return { ok: false, detail: `Resend ${res.status}: ${body?.message || res.statusText}` }
    }
    return {
      ok: true,
      detail: usingFallback
        ? `Sent via onboarding@resend.dev (only delivers to your verified Resend address). Set RESEND_FROM_EMAIL to reach real users.`
        : `Sent via ${from}`,
    }
  } catch (err) {
    return { ok: false, detail: `Network error: ${String(err)}` }
  }
}

async function testPush(userId: string): Promise<ChannelResult> {
  if (!process.env.VAPID_PUBLIC_KEY || !process.env.VAPID_PRIVATE_KEY) {
    return { ok: false, detail: 'VAPID keys not set' }
  }
  const db = getServiceClient()
  // Was .maybeSingle() — returned null whenever the admin had 2+ devices
  // subscribed (iPhone + laptop), falsely reporting "no subscription."
  // Fetch all and attempt delivery to each, matching the send-alerts
  // multi-device fan-out behavior.
  const { data: subs } = await db
    .from('push_subscriptions')
    .select('endpoint, p256dh, auth')
    .eq('user_id', userId)

  if (!subs?.length) {
    return { ok: false, detail: 'No push subscription for admin user. Enable notifications in the app first.' }
  }

  let delivered = 0
  let failed = 0
  const errors: string[] = []
  for (const sub of subs) {
    if (!sub?.endpoint) continue
    try {
      await webpush.sendNotification(
        { endpoint: sub.endpoint, keys: { p256dh: sub.p256dh, auth: sub.auth } },
        JSON.stringify({
          title: '🌉 Cruzar — prueba · test',
          body: `Notificación de prueba · Test notification · ${new Date().toLocaleTimeString()}`,
          url: '/',
          tag: 'admin-test',
          actions: [
            { action: 'view', title: 'Ver · View' },
          ],
        })
      )
      delivered++
    } catch (err: unknown) {
      failed++
      const msg = err && typeof err === 'object' && 'body' in err ? (err as { body?: string }).body : String(err)
      errors.push(String(msg).slice(0, 80))
    }
  }

  if (delivered === 0) {
    return { ok: false, detail: `Push failed on ${failed} device(s): ${errors.join(' | ')}` }
  }
  return {
    ok: true,
    detail: `Push sent to ${delivered} device(s)${failed ? `; ${failed} failed` : ''} — check your device.`,
  }
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

  const { channel } = await req.json().catch(() => ({ channel: 'both' }))

  const results: Record<string, ChannelResult> = {}
  if (channel === 'email' || channel === 'both') {
    results.email = await testEmail(user.email!)
  }
  if (channel === 'push' || channel === 'both') {
    results.push = await testPush(user.id)
  }

  return NextResponse.json({ results })
}
