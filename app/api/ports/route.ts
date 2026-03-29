import { NextResponse } from 'next/server'
import { fetchRgvWaitTimes } from '@/lib/cbp'

export const revalidate = 300 // cache 5 minutes

export async function GET() {
  try {
    const ports = await fetchRgvWaitTimes()
    return NextResponse.json({ ports, fetchedAt: new Date().toISOString() })
  } catch (err) {
    console.error('CBP fetch error:', err)
    return NextResponse.json({ error: 'Failed to fetch wait times' }, { status: 502 })
  }
}
