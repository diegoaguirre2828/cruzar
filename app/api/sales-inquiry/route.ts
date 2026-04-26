import { NextRequest, NextResponse } from 'next/server'
import { getServiceClient } from '@/lib/supabase'
import { checkRateLimit, keyFromRequest } from '@/lib/ratelimit'

export const dynamic = 'force-dynamic'

// POST /api/sales-inquiry
//
// Captures Enterprise/B2B leads from the /pricing "Talk to sales"
// CTA. Writes to sales_inquiries + emails Diego via Resend so he
// can follow up manually.

const VALID_TIERS = new Set(['intelligence_enterprise', 'business', 'operator', 'custom'])

export async function POST(req: NextRequest) {
  const rl = await checkRateLimit(keyFromRequest(req), 5, 2)
  if (!rl.ok) return NextResponse.json({ error: 'Too many submissions.' }, { status: 429 })

  let body: { email?: string; company?: string; fleet_size?: string; use_case?: string; tier?: string }
  try { body = await req.json() } catch { return NextResponse.json({ error: 'Invalid JSON' }, { status: 400 }) }

  const email = (body.email || '').trim().toLowerCase()
  if (!email || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
    return NextResponse.json({ error: 'Valid email required.' }, { status: 400 })
  }
  const company = String(body.company || '').slice(0, 200) || null
  const fleetSize = String(body.fleet_size || '').slice(0, 60) || null
  const useCase = String(body.use_case || '').slice(0, 1000) || null
  const tierRaw = String(body.tier || 'intelligence_enterprise')
  const tier = VALID_TIERS.has(tierRaw) ? tierRaw : 'intelligence_enterprise'

  const db = getServiceClient()
  const { error } = await db.from('sales_inquiries').insert({
    email, company, fleet_size: fleetSize, use_case: useCase, tier_interest: tier,
  })
  if (error) return NextResponse.json({ error: error.message }, { status: 500 })

  // Notify Diego via Resend (best-effort; don't block the user response)
  const resendKey = process.env.RESEND_API_KEY
  if (resendKey) {
    fetch('https://api.resend.com/emails', {
      method: 'POST',
      headers: { 'Authorization': `Bearer ${resendKey}`, 'Content-Type': 'application/json' },
      body: JSON.stringify({
        from: process.env.RESEND_FROM_EMAIL || 'Cruzar <hello@cruzar.app>',
        to: 'cruzabusiness@gmail.com',
        subject: `[Cruzar lead] ${email}${company ? ` from ${company}` : ''} · ${tier}`,
        html: `<h2>New ${tier} lead</h2>
          <p><strong>Email:</strong> ${email}</p>
          ${company ? `<p><strong>Company:</strong> ${company}</p>` : ''}
          ${fleetSize ? `<p><strong>Fleet size:</strong> ${fleetSize}</p>` : ''}
          ${useCase ? `<p><strong>Use case:</strong><br>${useCase.replace(/\n/g, '<br>')}</p>` : ''}
          <p><a href="https://www.cruzar.app/admin/system-audit">→ admin</a></p>`,
      }),
    }).catch(() => { /* swallow */ })
  }

  return NextResponse.json({ ok: true })
}
