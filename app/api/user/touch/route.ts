import { NextRequest, NextResponse } from 'next/server'
import { createServerClient } from '@supabase/ssr'
import { cookies } from 'next/headers'

// /api/user/touch — called once per signed-in session on app boot by
// useSessionPing. Upserts device/os/browser/install_state + last_seen_at
// on the user's profile row so the admin panel can later slice users by
// device type, PWA install state, and activity recency.
//
// Guests get a 200 + noop — we don't store anything about anonymous
// visitors here; Plausible handles that case.

const ALLOWED_DEVICES = new Set(['mobile', 'tablet', 'desktop'])
const ALLOWED_OS = new Set(['ios', 'android', 'windows', 'macos', 'linux', 'other'])
const ALLOWED_BROWSERS = new Set(['safari', 'chrome', 'firefox', 'edge', 'samsung', 'other'])
const ALLOWED_INSTALL = new Set(['web', 'pwa', 'twa', 'capacitor'])

function sanitize<T extends string>(value: unknown, allowed: Set<T>, fallback: T): T {
  return typeof value === 'string' && (allowed as Set<string>).has(value) ? (value as T) : fallback
}

export async function POST(req: NextRequest) {
  const cookieStore = await cookies()
  const supabase = createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    { cookies: { getAll: () => cookieStore.getAll() } }
  )

  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ ok: true, guest: true })

  let body: Record<string, unknown> = {}
  try {
    body = await req.json()
  } catch {
    // Empty or malformed body — still update last_seen_at even if we
    // don't know the device context, so an admin still sees they're alive.
  }

  const patch = {
    last_seen_at: new Date().toISOString(),
    last_seen_device: sanitize(body.device, ALLOWED_DEVICES, 'desktop'),
    last_seen_os: sanitize(body.os, ALLOWED_OS, 'other'),
    last_seen_browser: sanitize(body.browser, ALLOWED_BROWSERS, 'other'),
    install_state: sanitize(body.install_state, ALLOWED_INSTALL, 'web'),
  }

  // first_seen_at sticks on first touch only. Users created before v27
  // migration got it backfilled from profiles.created_at.
  const { data: existing } = await supabase
    .from('profiles')
    .select('first_seen_at')
    .eq('id', user.id)
    .single()

  const { error } = await supabase
    .from('profiles')
    .update({
      ...patch,
      first_seen_at: existing?.first_seen_at ?? new Date().toISOString(),
    })
    .eq('id', user.id)

  if (error) return NextResponse.json({ ok: false, error: error.message }, { status: 500 })
  return NextResponse.json({ ok: true })
}
