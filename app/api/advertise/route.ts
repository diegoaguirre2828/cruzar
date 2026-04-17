import { NextRequest, NextResponse } from 'next/server'
import { getServiceClient } from '@/lib/supabase'
import { keyFromRequest, checkRateLimit } from '@/lib/ratelimit'

async function notifyOwner(businessName: string, email: string, phone: string, crossing: string) {
  if (!process.env.RESEND_API_KEY) return
  await fetch('https://api.resend.com/emails', {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${process.env.RESEND_API_KEY}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      from: process.env.RESEND_FROM_EMAIL || 'Cruzar <onboarding@resend.dev>',
      to: [process.env.OWNER_EMAIL || 'hello@cruzar.app'],
      subject: `New advertiser inquiry: ${businessName}`,
      html: `
        <div style="font-family:-apple-system,sans-serif;max-width:480px;margin:0 auto;padding:24px;">
          <h2 style="margin:0 0 16px;color:#111827;">New Advertiser Inquiry</h2>
          <table style="width:100%;border-collapse:collapse;font-size:14px;">
            <tr><td style="padding:8px 0;color:#6b7280;width:120px;">Business</td><td style="padding:8px 0;font-weight:600;color:#111827;">${businessName}</td></tr>
            <tr><td style="padding:8px 0;color:#6b7280;">Email</td><td style="padding:8px 0;color:#111827;"><a href="mailto:${email}">${email}</a></td></tr>
            <tr><td style="padding:8px 0;color:#6b7280;">Phone</td><td style="padding:8px 0;color:#111827;">${phone || '—'}</td></tr>
            <tr><td style="padding:8px 0;color:#6b7280;">Crossing</td><td style="padding:8px 0;color:#111827;">${crossing || '—'}</td></tr>
          </table>
          <a href="https://cruzar.app/admin" style="display:inline-block;margin-top:20px;background:#111827;color:white;text-decoration:none;padding:10px 20px;border-radius:8px;font-size:14px;">View in Admin</a>
        </div>
      `,
    }),
  })
}

export async function POST(req: NextRequest) {
  const body = await req.json()
  const { businessName, email, phone, nearestCrossing } = body

  if (!businessName || !email) {
    return NextResponse.json({ error: 'Name and email required' }, { status: 400 })
  }

  // Rate limit — previously unguarded, each submission fires a Resend
  // email to the owner inbox, so spam here = spam Diego's inbox +
  // burn Resend free-tier quota (100 emails/day). Hourly cap 5, burst
  // cap 3 — enough for legitimate advertiser inquiries, not enough to
  // abuse.
  const rlKey = keyFromRequest(req)
  const rl = checkRateLimit(rlKey, 5, 3)
  if (!rl.ok) {
    return NextResponse.json(
      { error: 'Too many submissions. Try again later.' },
      { status: 429, headers: { 'Retry-After': String(rl.retryAfterSeconds) } },
    )
  }

  const supabase = getServiceClient()
  const { error } = await supabase.from('advertisers').insert({
    business_name: businessName,
    contact_email: email,
    contact_phone: phone || null,
    description: nearestCrossing ? `Nearest crossing: ${nearestCrossing}` : null,
    status: 'pending',
  })

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })

  await notifyOwner(businessName, email, phone, nearestCrossing)

  return NextResponse.json({ success: true })
}
