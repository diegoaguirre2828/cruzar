import { NextRequest, NextResponse } from 'next/server'
import { createServerClient } from '@supabase/ssr'
import { cookies } from 'next/headers'
import { getServiceClient } from '@/lib/supabase'
import { checkRateLimit, keyFromRequest } from '@/lib/ratelimit'

export const dynamic = 'force-dynamic'

// POST /api/express-cert/save
//
// Upsert the user's draft application. Idempotent on user_id +
// program. Returns the application id so the client can navigate to
// /express-cert/[id] for review/payment.

const ALLOWED_PROGRAMS = new Set(['ctpat', 'oea'])

export async function POST(req: NextRequest) {
  const cookieStore = await cookies()
  const supabase = createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    { cookies: { getAll: () => cookieStore.getAll() } }
  )
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Sign in to save your application.' }, { status: 401 })

  const rl = await checkRateLimit(keyFromRequest(req, user.id), 60, 5)
  if (!rl.ok) return NextResponse.json({ error: 'Too many saves.' }, { status: 429 })

  let body: { program?: string; answers?: Record<string, unknown> }
  try { body = await req.json() } catch { return NextResponse.json({ error: 'Invalid JSON' }, { status: 400 }) }

  const program = (body.program || '').trim().toLowerCase()
  const answers = body.answers && typeof body.answers === 'object' ? body.answers : {}
  if (!ALLOWED_PROGRAMS.has(program)) return NextResponse.json({ error: 'program must be ctpat or oea' }, { status: 400 })

  const db = getServiceClient()

  // Look for an existing draft for this (user, program)
  const { data: existing } = await db
    .from('express_cert_applications')
    .select('id, status')
    .eq('user_id', user.id)
    .eq('program', program)
    .in('status', ['draft', 'paid'])
    .order('created_at', { ascending: false })
    .limit(1)
    .maybeSingle()

  if (existing?.id) {
    await db
      .from('express_cert_applications')
      .update({ answers, updated_at: new Date().toISOString() })
      .eq('id', existing.id)
    return NextResponse.json({ ok: true, id: existing.id, status: existing.status })
  }

  const { data: row, error } = await db.from('express_cert_applications').insert({
    user_id: user.id,
    program,
    status: 'draft',
    answers,
  }).select('id, status').single()

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json({ ok: true, id: row.id, status: row.status })
}
