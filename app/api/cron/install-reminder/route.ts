import { NextRequest, NextResponse } from 'next/server'

export const dynamic = 'force-dynamic'

// Install-reminder — disabled 2026-04-23 as part of the app-store pivot.
// The PWA-install email nudge is no longer relevant now that the native
// mobile app is the primary distribution path. Endpoint kept as a no-op
// so any scheduled cron or internal call returns cleanly.

export async function GET(req: NextRequest) {
  const secret = req.nextUrl.searchParams.get('secret')
  const authHeader = req.headers.get('authorization')
  const isAuthed =
    secret === process.env.CRON_SECRET ||
    authHeader === `Bearer ${process.env.CRON_SECRET}`
  if (!isAuthed) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  return NextResponse.json({
    skipped: true,
    reason: 'install-reminder email disabled 2026-04-23 (app-store pivot)',
  })
}
