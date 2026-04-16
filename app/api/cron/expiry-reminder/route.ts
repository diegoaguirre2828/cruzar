import { NextRequest, NextResponse } from 'next/server'
import { getServiceClient } from '@/lib/supabase'

export const dynamic = 'force-dynamic'

/*
 * GET /api/cron/expiry-reminder?secret=CRON_SECRET
 *
 * Runs daily. Finds users whose promo expires within 30 days or
 * expired within the last 7 days. Sends a personalized retention
 * email with usage stats, time saved, ANNUAL projection, and a
 * $1.99/mo discount offer.
 */

export async function GET(req: NextRequest) {
  const secret = req.nextUrl.searchParams.get('secret')
  const auth = req.headers.get('authorization')
  if (secret !== process.env.CRON_SECRET && auth !== `Bearer ${process.env.CRON_SECRET}`) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  const db = getServiceClient()
  const now = new Date()
  const in30days = new Date(now.getTime() + 30 * 24 * 60 * 60 * 1000).toISOString()
  const sevenDaysAgo = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000).toISOString()

  const { data: expiring } = await db
    .from('profiles')
    .select('id, display_name, promo_first_1000_until, tier')
    .not('promo_first_1000_until', 'is', null)
    .gte('promo_first_1000_until', sevenDaysAgo)
    .lte('promo_first_1000_until', in30days)

  if (!expiring || expiring.length === 0) {
    return NextResponse.json({ sent: 0, candidates: 0 })
  }

  const { data: authData } = await db.auth.admin.listUsers({ page: 1, perPage: 1000 })
  const emailById = new Map((authData?.users || []).map((u) => [u.id, u.email]))

  const userIds = expiring.map((u) => u.id)

  const { data: digestEvents } = await db
    .from('app_events')
    .select('user_id')
    .eq('event_name', 'daily_digest_sent')
    .in('user_id', userIds)
  const digestCountByUser = new Map<string, number>()
  for (const e of digestEvents || []) {
    digestCountByUser.set(e.user_id, (digestCountByUser.get(e.user_id) || 0) + 1)
  }

  const { data: alertEvents } = await db
    .from('app_events')
    .select('user_id')
    .eq('event_name', 'alert_fired')
    .in('user_id', userIds)
  const alertCountByUser = new Map<string, number>()
  for (const e of alertEvents || []) {
    alertCountByUser.set(e.user_id, (alertCountByUser.get(e.user_id) || 0) + 1)
  }

  const { data: reportRows } = await db
    .from('crossing_reports')
    .select('user_id')
    .in('user_id', userIds)
  const reportCountByUser = new Map<string, number>()
  for (const r of reportRows || []) {
    if (!r.user_id) continue
    reportCountByUser.set(r.user_id, (reportCountByUser.get(r.user_id) || 0) + 1)
  }

  const resendKey = process.env.RESEND_API_KEY
  const from = process.env.RESEND_FROM_EMAIL || 'alerts@cruzar.app'
  if (!resendKey) return NextResponse.json({ error: 'RESEND_API_KEY not set' }, { status: 500 })

  let sent = 0
  const errors: string[] = []

  for (const user of expiring) {
    const email = emailById.get(user.id)
    if (!email) continue

    const firstName = user.display_name?.split(' ')[0] || ''
    const digestCount = digestCountByUser.get(user.id) || 0
    const alertCount = alertCountByUser.get(user.id) || 0
    const reportCount = reportCountByUser.get(user.id) || 0

    const monthlyMinSaved = (digestCount * 10) + (alertCount * 15)
    const monthlyHrs = (monthlyMinSaved / 60).toFixed(1)
    const annualHrs = ((monthlyMinSaved * 12) / 60).toFixed(0)
    const annualMin = monthlyMinSaved * 12

    const expiryDate = new Date(user.promo_first_1000_until).toLocaleDateString('es-MX', {
      month: 'long', day: 'numeric', year: 'numeric',
    })

    const daysLeft = Math.max(0, Math.ceil(
      (new Date(user.promo_first_1000_until).getTime() - now.getTime()) / (1000 * 60 * 60 * 24)
    ))

    const hasUsage = digestCount > 0 || alertCount > 0 || reportCount > 0
    const greeting = firstName ? `Hola ${firstName},` : 'Hola,'
    const subjectLine = daysLeft > 0
      ? `Tu Pro gratis se acaba en ${daysLeft} dias`
      : 'Tu Pro gratis se acabo — oferta especial adentro'

    const statsRows = [
      digestCount > 0 ? `<tr><td style="padding:6px 0;font-size:14px;color:#374151">Avisos matutinos antes de cruzar</td><td style="padding:6px 0;font-size:20px;font-weight:900;color:#111;text-align:right">${digestCount}</td></tr>` : '',
      alertCount > 0 ? `<tr><td style="padding:6px 0;font-size:14px;color:#374151">Alertas cuando bajo la fila</td><td style="padding:6px 0;font-size:20px;font-weight:900;color:#111;text-align:right">${alertCount}</td></tr>` : '',
      reportCount > 0 ? `<tr><td style="padding:6px 0;font-size:14px;color:#374151">Reportes que compartiste</td><td style="padding:6px 0;font-size:20px;font-weight:900;color:#111;text-align:right">${reportCount}</td></tr>` : '',
    ].filter(Boolean).join('')

    const timeSavedBlock = monthlyMinSaved > 0 ? `
<div style="background:#f0fdf4;border:2px solid #22c55e;border-radius:14px;padding:20px;margin:24px 0;text-align:center">
  <p style="font-size:13px;font-weight:800;color:#166534;letter-spacing:1px;text-transform:uppercase;margin:0 0 8px 0">Tiempo estimado que ahorraste</p>
  <p style="font-size:42px;font-weight:900;color:#111;margin:0;line-height:1">~${monthlyHrs} hrs</p>
  <p style="font-size:14px;color:#166534;margin:4px 0 0 0">este mes</p>
  <div style="margin-top:16px;padding-top:16px;border-top:1px solid #bbf7d0">
    <p style="font-size:13px;color:#166534;font-weight:700;margin:0 0 4px 0">Eso compila a:</p>
    <p style="font-size:28px;font-weight:900;color:#111;margin:0">~${annualHrs} horas al ano</p>
    <p style="font-size:13px;color:#6b7280;margin:4px 0 0 0">(${annualMin.toLocaleString()} minutos menos esperando en la fila cada ano)</p>
  </div>
</div>` : ''

    const usageBlock = hasUsage ? `
<div style="background:#eff6ff;border:2px solid #3b82f6;border-radius:14px;padding:20px;margin:24px 0">
  <p style="font-size:13px;font-weight:800;color:#1e40af;letter-spacing:1px;text-transform:uppercase;margin:0 0 14px 0">Lo que Cruzar hizo por ti</p>
  <table style="width:100%;border-collapse:collapse">${statsRows}</table>
</div>
${timeSavedBlock}` : `
<p style="font-size:15px;color:#6b7280;line-height:1.5">
  Todavia no has aprovechado las alertas ni los avisos matutinos. Activar tu primera alerta toma 30 segundos y te puede ahorrar horas al mes.
</p>`

    const html = `
<div style="font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',sans-serif;max-width:520px;margin:0 auto;padding:20px">
  <div style="background:linear-gradient(135deg,#1e40af,#7c3aed);border-radius:16px;padding:28px;color:white;text-align:center;margin-bottom:24px">
    <h1 style="font-size:28px;font-weight:900;margin:0 0 8px 0">cruzar</h1>
    <p style="font-size:13px;opacity:0.85;margin:0">Tu asistente de cruce personal</p>
  </div>

  <p style="font-size:16px;color:#111;line-height:1.5">${greeting}</p>
  <p style="font-size:16px;color:#111;line-height:1.5">${daysLeft > 0
    ? `Tu acceso Pro gratis se acaba el <strong>${expiryDate}</strong> (en ${daysLeft} dias).`
    : `Tu acceso Pro gratis se acabo el <strong>${expiryDate}</strong>.`}</p>

  ${usageBlock}

  <div style="background:#fef3c7;border:2px solid #f59e0b;border-radius:14px;padding:20px;margin:24px 0">
    <p style="font-size:14px;font-weight:800;color:#92400e;margin:0 0 8px 0">Lo que pierdes sin Pro:</p>
    <ul style="font-size:14px;color:#92400e;margin:0;padding-left:20px;line-height:1.8">
      <li>Avisos matutinos personalizados antes de cruzar</li>
      <li>Alertas cuando baja la fila en tu puente</li>
      <li>Camaras en vivo del puente</li>
      <li>Mejor hora pa cruzar cada dia</li>
      <li>Resumen semanal por email</li>
    </ul>
  </div>

  <div style="background:linear-gradient(135deg,#059669,#10b981);border-radius:14px;padding:24px;margin:24px 0;text-align:center">
    <p style="font-size:13px;font-weight:800;color:rgba(255,255,255,0.85);letter-spacing:1px;text-transform:uppercase;margin:0 0 8px 0">Oferta especial pa ti</p>
    <p style="font-size:36px;font-weight:900;color:white;margin:0">$1.99/mes</p>
    <p style="font-size:14px;color:rgba(255,255,255,0.9);margin:4px 0 16px 0">primeros 3 meses (despues $2.99/mes)</p>
    <a href="https://cruzar.app/pricing?promo=expiry&utm_source=email&utm_medium=expiry_reminder&utm_campaign=first_1000"
       style="display:inline-block;background:white;color:#059669;font-size:16px;font-weight:900;padding:14px 36px;border-radius:12px;text-decoration:none">
      Renovar Pro
    </a>
  </div>

  <p style="font-size:13px;color:#9ca3af;line-height:1.5;margin-top:24px">
    Si no renuevas, los tiempos en vivo siguen gratis para siempre. Solo pierdes las funciones Pro de arriba.
  </p>
  <hr style="border:none;border-top:1px solid #e5e7eb;margin:24px 0">
  <p style="font-size:11px;color:#9ca3af;text-align:center">cruzar.app</p>
</div>`

    try {
      const res = await fetch('https://api.resend.com/emails', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${resendKey}`,
        },
        body: JSON.stringify({ from, to: email, subject: subjectLine, html }),
      })
      if (res.ok) sent++
      else errors.push(`${email}: ${res.status}`)
    } catch (err) {
      errors.push(`${email}: ${err instanceof Error ? err.message : 'unknown'}`)
    }
    await new Promise((r) => setTimeout(r, 500))
  }

  return NextResponse.json({ sent, candidates: expiring.length, errors: errors.slice(0, 5) })
}
