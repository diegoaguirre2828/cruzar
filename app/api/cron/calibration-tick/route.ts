// Live calibration loop — thin wrapper around runCalibrationTick().
// Auth: shared CRON_SECRET, accepts ?secret= or Authorization: Bearer.
//
// Logic lives in lib/calibrationTick.ts so it can also be called inline
// from /api/cron/fetch-wait-times (no public-domain HTTP round trip,
// avoids Vercel Attack Challenge Mode).

import { NextRequest, NextResponse } from 'next/server'
import { runCalibrationTick } from '@/lib/calibrationTick'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'
export const maxDuration = 60

function authorized(req: NextRequest): boolean {
  const expected = process.env.CRON_SECRET
  if (!expected) return false
  const url = new URL(req.url)
  if (url.searchParams.get('secret') === expected) return true
  const auth = req.headers.get('authorization') ?? ''
  if (auth.toLowerCase().startsWith('bearer ') && auth.slice(7).trim() === expected) {
    return true
  }
  return false
}

export async function GET(req: NextRequest) {
  if (!authorized(req)) {
    return NextResponse.json({ error: 'unauthorized' }, { status: 401 })
  }
  try {
    const result = await runCalibrationTick()
    return NextResponse.json(result)
  } catch (err) {
    console.error('[calibration-tick] error:', err)
    return NextResponse.json({ error: String(err) }, { status: 500 })
  }
}
