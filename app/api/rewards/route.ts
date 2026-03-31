import { NextRequest, NextResponse } from 'next/server'
import { getServiceClient } from '@/lib/supabase'

export const dynamic = 'force-dynamic'

export async function GET(req: NextRequest) {
  const portId = req.nextUrl.searchParams.get('portId')
  const db = getServiceClient()

  // Get approved businesses — optionally filter by portId
  let bizQuery = db
    .from('rewards_businesses')
    .select('*')
    .eq('approved', true)
    .order('name')

  const { data: businesses, error: bizErr } = await bizQuery
  if (bizErr) return NextResponse.json({ error: bizErr.message }, { status: 500 })

  // Filter by portId if provided
  const filtered = portId
    ? (businesses || []).filter((b: { port_ids?: string[] }) => b.port_ids?.includes(portId))
    : (businesses || [])

  if (filtered.length === 0) return NextResponse.json({ businesses: [], deals: [] })

  const bizIds = filtered.map((b: { id: string }) => b.id)
  const { data: deals } = await db
    .from('rewards_deals')
    .select('*')
    .in('business_id', bizIds)
    .eq('active', true)
    .or('expires_at.is.null,expires_at.gt.' + new Date().toISOString())
    .order('points_required')

  return NextResponse.json({ businesses: filtered, deals: deals || [] })
}

// Business signup submission
export async function POST(req: NextRequest) {
  const body = await req.json()
  const { name, description, address, portIds, category, phone, website, email } = body
  if (!name || !email) return NextResponse.json({ error: 'name and email required' }, { status: 400 })

  const db = getServiceClient()
  const { error } = await db.from('rewards_businesses').insert({
    name: name.slice(0, 200),
    description: description?.slice(0, 500),
    address: address?.slice(0, 300),
    port_ids: portIds || [],
    category: category || 'other',
    phone: phone?.slice(0, 50),
    website: website?.slice(0, 300),
    submitted_by_email: email.slice(0, 255),
    approved: false,
  })

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json({ success: true })
}
