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
  const { error } = await db
    .from('intel_subscribers')
    .update({ active: false })
    .eq('unsubscribe_token', token)
  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return new NextResponse(
    `<!doctype html><html><body style="font:14px system-ui;padding:48px;text-align:center;background:#f8fafc;">
      <h1 style="font-size:18px;color:#0f172a;">Unsubscribed</h1>
      <p style="color:#64748b;">You won't receive any more Cruzar Intelligence briefs. <a href="/intelligence" style="color:#2563eb;">Re-subscribe</a> anytime.</p>
    </body></html>`,
    { status: 200, headers: { 'Content-Type': 'text/html; charset=utf-8' } },
  )
}
