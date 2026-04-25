import { NextRequest, NextResponse } from 'next/server'
import { createServerClient } from '@supabase/ssr'
import { cookies } from 'next/headers'
import { getServiceClient } from '@/lib/supabase'
import Anthropic from '@anthropic-ai/sdk'

export const dynamic = 'force-dynamic'
export const maxDuration = 60

// POST /api/express-cert/generate
//
// After payment is confirmed (status='paid'), Claude expands the
// short questionnaire answers into a fully-fleshed C-TPAT or OEA
// application narrative — section by section, in the format CBP /
// SAT expects, with the user's answers used verbatim where they
// suffice and intelligently inferred / phrased where they need
// expansion. Persists the generated markdown to the row so the
// /express-cert/[id]/print page can render + the user can save as
// PDF in their browser.

const SYSTEM_PROMPT = `You are an expert in US Customs and Border Protection's
Customs-Trade Partnership Against Terrorism (C-TPAT) and Mexico's
Operador Económico Autorizado (OEA) certification programs.

You're given a small set of answers from a US-Mexico cross-border
operator. Your job: expand them into a complete, ready-to-submit
application narrative organized exactly the way CBP (for C-TPAT) or
SAT (for OEA) expects.

Output ONE markdown document. Use H2 headings for each major
section. For C-TPAT include: Company Information, Business
Activity, Trading Partners, Container Security, Physical Security,
Personnel Security, Procedural Security, Information Technology
Security, Security Training and Threat Awareness, Conveyance
Tracking, Risk Assessment. For OEA include: Datos Generales,
Operaciones de Comercio Exterior, Solvencia Financiera,
Cumplimiento Aduanero, Cumplimiento Fiscal, Sistema de
Administración de Riesgos, Estándares Mínimos en Materia de
Seguridad.

Where the user provided no answer, write a SHORT, professional
placeholder beginning with "[TODO — provide:]" so the user can
finish it before submitting. Never fabricate facts.

End with a "## Next Steps" section listing exactly what the user
must do to submit (e.g., "Print this document, sign on page 14,
mail to CBP CTPAT Program Office at [address]" — give the actual
correct office address).`

export async function POST(req: NextRequest) {
  const cookieStore = await cookies()
  const supabase = createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    { cookies: { getAll: () => cookieStore.getAll() } }
  )
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Sign in.' }, { status: 401 })

  let body: { id?: string }
  try { body = await req.json() } catch { return NextResponse.json({ error: 'Invalid JSON' }, { status: 400 }) }
  const id = (body.id || '').trim()
  if (!id) return NextResponse.json({ error: 'Missing application id.' }, { status: 400 })

  const db = getServiceClient()
  const { data: app } = await db
    .from('express_cert_applications')
    .select('id, user_id, program, status, answers, generated_pdf_url')
    .eq('id', id)
    .maybeSingle()
  if (!app || app.user_id !== user.id) return NextResponse.json({ error: 'Not found.' }, { status: 404 })
  if (app.status !== 'paid' && app.status !== 'generated') {
    return NextResponse.json({ error: 'Application must be paid before generation.' }, { status: 402 })
  }

  const apiKey = process.env.ANTHROPIC_API_KEY
  if (!apiKey) return NextResponse.json({ error: 'AI not configured.' }, { status: 500 })
  const client = new Anthropic({ apiKey })

  const completion = await client.messages.create({
    model: 'claude-sonnet-4-6',
    max_tokens: 6000,
    system: SYSTEM_PROMPT,
    messages: [{
      role: 'user',
      content: `Program: ${app.program.toUpperCase()}\n\nAnswers (JSON):\n${JSON.stringify(app.answers, null, 2)}`,
    }],
  })

  const md = completion.content
    .filter((c): c is Anthropic.TextBlock => c.type === 'text')
    .map((c) => c.text)
    .join('\n')
    .trim()

  // Persist as markdown — the print page renders it. We reuse the
  // generated_pdf_url column to store the markdown body inline so we
  // don't need a second column. Adding a real PDF generator can land
  // later if a customer asks.
  await db
    .from('express_cert_applications')
    .update({ status: 'generated', generated_pdf_url: md, generated_at: new Date().toISOString(), updated_at: new Date().toISOString() })
    .eq('id', id)

  return NextResponse.json({ ok: true, body_md: md })
}
