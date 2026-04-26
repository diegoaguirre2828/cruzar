import { NextRequest, NextResponse } from 'next/server'
import { createServerClient } from '@supabase/ssr'
import { cookies } from 'next/headers'
import { getServiceClient } from '@/lib/supabase'

export const dynamic = 'force-dynamic'

const VALID_CHANNELS = new Set(['telegram', 'email', 'whatsapp', 'sms'])

export async function POST(req: NextRequest) {
  const cookieStore = await cookies()
  const supabase = createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    { cookies: { getAll: () => cookieStore.getAll() } }
  )
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Sign in.' }, { status: 401 })

  let body: { channel?: string; external_id?: string }
  try { body = await req.json() } catch { return NextResponse.json({ error: 'Invalid JSON' }, { status: 400 }) }
  const channel = (body.channel || '').toLowerCase()
  const externalId = String(body.external_id || '').trim()
  if (!VALID_CHANNELS.has(channel) || !externalId) {
    return NextResponse.json({ error: 'Bad channel or external_id' }, { status: 400 })
  }

  const db = getServiceClient()
  const { error } = await db.from('operator_bot_bindings').upsert({
    user_id: user.id,
    channel,
    external_id: externalId,
    bound_at: new Date().toISOString(),
  }, { onConflict: 'channel,external_id' })

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json({ ok: true })
}
