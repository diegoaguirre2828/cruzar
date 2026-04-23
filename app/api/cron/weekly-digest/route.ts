import { NextRequest, NextResponse } from 'next/server'

// Weekly digest — disabled 2026-04-23 as part of the app-store pivot.
// User-facing email notifications are removed in favor of native push
// notifications. The endpoint is kept as a no-op so any scheduled cron
// that still targets it returns a clean 200 without attempting to send
// email. Safe to delete entirely once vercel.json crons[] is trimmed.

export async function GET(req: NextRequest) {
  const authHeader = req.headers.get('authorization')
  const secret = req.nextUrl.searchParams.get('secret')
  const isAuthed =
    secret === process.env.CRON_SECRET ||
    authHeader === `Bearer ${process.env.CRON_SECRET}`
  if (!isAuthed) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  return NextResponse.json({
    skipped: true,
    reason: 'weekly-digest email disabled 2026-04-23 (app-store pivot to push-only notifications)',
  })
}
