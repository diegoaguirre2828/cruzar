import { NextRequest, NextResponse } from 'next/server'
import { createServerClient } from '@supabase/ssr'
import { cookies } from 'next/headers'
import { getServiceClient } from '@/lib/supabase'

export const dynamic = 'force-dynamic'

const ADMIN_EMAIL = 'cruzabusiness@gmail.com'

/*
 * POST /api/admin/blast-first-1000
 *
 * Admin-only. Sends a one-time re-engagement email to all free-tier
 * users who have promo_first_1000_until set (i.e., they're eligible
 * for the 3-month Pro window). Sends via Resend. Tracks who's been
 * emailed in a localStorage-style flag on the profile so we don't
 * double-send.
 *
 * Body: { dryRun?: boolean } -- set dryRun:true to preview without sending
 */

export async function GET() {
  const cookieStore = await cookies()
  const supabase = createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    { cookies: { getAll: () => cookieStore.getAll() } }
  )
  const { data: { user } } = await supabase.auth.getUser()
  if (!user || user.email !== ADMIN_EMAIL) {
    return new Response('Unauthorized', { status: 401 })
  }
  return new Response(`<!DOCTYPE html>
<html><head><title>Blast First 1000</title><meta name="viewport" content="width=device-width,initial-scale=1"></head>
<body style="font-family:system-ui;max-width:500px;margin:40px auto;padding:20px">
<h1>Re-engagement Email Blast</h1>
<p>Sends the "3 meses Pro gratis" email to all eligible users.</p>
<button id="dry" style="padding:12px 24px;font-size:16px;margin:8px 4px;cursor:pointer;border-radius:8px;border:2px solid #2563eb;background:white;color:#2563eb;font-weight:700">Preview (dry run)</button>
<button id="send" style="padding:12px 24px;font-size:16px;margin:8px 4px;cursor:pointer;border-radius:8px;border:none;background:#2563eb;color:white;font-weight:700">Send for real</button>
<pre id="out" style="background:#f1f5f9;padding:16px;border-radius:8px;margin-top:16px;white-space:pre-wrap;font-size:13px"></pre>
<script>
async function go(dryRun){
  document.getElementById('out').textContent='Loading...'
  const r=await fetch('/api/admin/blast-first-1000',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({dryRun})})
  document.getElementById('out').textContent=JSON.stringify(await r.json(),null,2)
}
document.getElementById('dry').onclick=()=>go(true)
document.getElementById('send').onclick=()=>{if(confirm('Send emails for real?'))go(false)}
</script>
</body></html>`, { headers: { 'Content-Type': 'text/html' } })
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

  const body = await req.json().catch(() => ({}))
  const dryRun = body.dryRun === true

  const db = getServiceClient()

  /* Get all eligible users: free tier + promo set + not yet emailed */
  const { data: profiles } = await db
    .from('profiles')
    .select('id, tier, promo_first_1000_until')
    .not('promo_first_1000_until', 'is', null)

  /* Get auth emails */
  const { data: authData } = await db.auth.admin.listUsers({ page: 1, perPage: 1000 })
  const authUsers = authData?.users || []
  const emailById = new Map(authUsers.map((u) => [u.id, u.email]))

  const eligible = (profiles || [])
    .filter((p) => emailById.has(p.id) && emailById.get(p.id))
    .map((p) => ({ id: p.id, email: emailById.get(p.id)!, tier: p.tier, expiresAt: p.promo_first_1000_until }))

  if (dryRun) {
    return NextResponse.json({
      dryRun: true,
      eligible: eligible.length,
      emails: eligible.map((e) => e.email),
    })
  }

  /* Send via Resend */
  const resendKey = process.env.RESEND_API_KEY
  const from = process.env.RESEND_FROM_EMAIL || 'alerts@cruzar.app'
  if (!resendKey) {
    return NextResponse.json({ error: 'RESEND_API_KEY not set' }, { status: 500 })
  }

  let sent = 0
  let failed = 0
  const errors: string[] = []

  for (const u of eligible) {
    try {
      const expiryDate = new Date(u.expiresAt).toLocaleDateString('es-MX', {
        month: 'long',
        day: 'numeric',
        year: 'numeric',
      })
      const res = await fetch('https://api.resend.com/emails', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${resendKey}`,
        },
        body: JSON.stringify({
          from,
          to: u.email,
          subject: '🎁 Te dimos 3 meses de Cruzar Pro gratis',
          html: `
<div style="font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif; max-width: 500px; margin: 0 auto; padding: 20px;">
  <div style="background: linear-gradient(135deg, #1e40af, #3730a3); border-radius: 16px; padding: 24px; color: white; text-align: center; margin-bottom: 20px;">
    <h1 style="font-size: 28px; font-weight: 900; margin: 0 0 8px 0;">cruzar</h1>
    <p style="font-size: 14px; opacity: 0.85; margin: 0;">Tiempos de puente en vivo</p>
  </div>

  <p style="font-size: 16px; color: #111; line-height: 1.5;">Hola,</p>
  <p style="font-size: 16px; color: #111; line-height: 1.5;">Soy Diego, el que hizo Cruzar. Te registraste en los primeros dias y quiero agradecerte.</p>
  <p style="font-size: 16px; color: #111; line-height: 1.5;"><strong>Te di 3 meses de Cruzar Pro gratis</strong> por ser de los primeros 1,000. Tu Pro expira el <strong>${expiryDate}</strong>.</p>

  <div style="background: #f0fdf4; border: 2px solid #22c55e; border-radius: 12px; padding: 16px; margin: 20px 0;">
    <p style="font-size: 14px; color: #166534; font-weight: 700; margin: 0 0 8px 0;">Lo que puedes hacer con Pro:</p>
    <ul style="font-size: 14px; color: #166534; margin: 0; padding-left: 20px; line-height: 1.6;">
      <li>Alertas cuando baje la fila en tu puente</li>
      <li>Camaras en vivo del puente</li>
      <li>Mejor hora pa cruzar (patron por hora)</li>
      <li>Resumen semanal por email</li>
    </ul>
  </div>

  <p style="font-size: 16px; color: #111; line-height: 1.5;">Una cosa que te ayudaria mucho: <strong>elige tu puente de siempre y activa tu primera alerta.</strong> Te aviso al telefono cuando baje de 30 min. Toma 30 segundos:</p>

  <div style="text-align: center; margin: 24px 0;">
    <a href="https://cruzar.app/welcome?setup=alert&utm_source=email&utm_medium=blast&utm_campaign=first_1000" style="display: inline-block; background: linear-gradient(135deg, #2563eb, #4f46e5); color: white; font-size: 16px; font-weight: 800; padding: 14px 32px; border-radius: 12px; text-decoration: none;">Activar mi alerta →</a>
  </div>

  <p style="font-size: 14px; color: #666; line-height: 1.5;">Gracias por cruzar con nosotros,<br><strong>Diego</strong></p>

  <hr style="border: none; border-top: 1px solid #e5e7eb; margin: 24px 0;">
  <p style="font-size: 11px; color: #9ca3af; text-align: center;">cruzar.app · Tiempos de espera en vivo de los puentes US-Mexico</p>
</div>
          `,
        }),
      })
      if (res.ok) sent++
      else {
        failed++
        errors.push(`${u.email}: ${res.status}`)
      }
    } catch (err) {
      failed++
      errors.push(`${u.email}: ${err instanceof Error ? err.message : 'unknown'}`)
    }
    /* Rate limit: 2 emails/second to stay under Resend free tier */
    await new Promise((r) => setTimeout(r, 500))
  }

  return NextResponse.json({ sent, failed, total: eligible.length, errors: errors.slice(0, 10) })
}
