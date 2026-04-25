import { NextRequest, NextResponse } from 'next/server'
import { getServiceClient } from '@/lib/supabase'

export const dynamic = 'force-dynamic'

// GET /api/intelligence/unsubscribe?token=...
// One-click unsubscribe link from any sent brief. The token is the
// per-row unsubscribe_token generated at row insertion.

export async function GET(req: NextRequest) {
  const token = new URL(req.url).searchParams.get('token')
  if (!token) {
    return NextResponse.json({ error: 'Missing token.' }, { status: 400 })
  }
  const db = getServiceClient()
  // Look up the row first so we can distinguish "valid token, now off"
  // from "fake/expired token, nothing happened" — Pacer caught that
  // we were returning a confirmation page either way.
  const { data: existing } = await db
    .from('intel_subscribers')
    .select('id, active')
    .eq('unsubscribe_token', token)
    .maybeSingle()
  if (!existing) {
    return new NextResponse(
      `<!doctype html><html><body style="font:14px system-ui;padding:48px;text-align:center;background:#f8fafc;">
        <h1 style="font-size:18px;color:#dc2626;">Link not recognized</h1>
        <p style="color:#64748b;">This unsubscribe link is invalid or expired. <a href="mailto:hello@cruzar.app" style="color:#2563eb;">Email us</a> if you keep getting briefs you don't want.</p>
      </body></html>`,
      { status: 404, headers: { 'Content-Type': 'text/html; charset=utf-8' } },
    )
  }
  if (existing.active === false) {
    return new NextResponse(
      `<!doctype html><html><body style="font:14px system-ui;padding:48px;text-align:center;background:#f8fafc;">
        <h1 style="font-size:18px;color:#0f172a;">Already unsubscribed</h1>
        <p style="color:#64748b;">You weren't getting any briefs. <a href="/intelligence" style="color:#2563eb;">Re-subscribe</a> anytime.</p>
      </body></html>`,
      { status: 200, headers: { 'Content-Type': 'text/html; charset=utf-8' } },
    )
  }
  const { error } = await db
    .from('intel_subscribers')
    .update({ active: false })
    .eq('id', existing.id)
  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return new NextResponse(
    `<!doctype html><html><body style="font:14px system-ui;padding:48px;text-align:center;background:#f8fafc;">
      <h1 style="font-size:18px;color:#0f172a;">Unsubscribed</h1>
      <p style="color:#64748b;">You won't receive any more Cruzar Intelligence briefs. <a href="/intelligence" style="color:#2563eb;">Re-subscribe</a> anytime.</p>
    </body></html>`,
    { status: 200, headers: { 'Content-Type': 'text/html; charset=utf-8' } },
  )
}
