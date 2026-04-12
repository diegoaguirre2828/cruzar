import { NextRequest, NextResponse } from 'next/server'
import { getServiceClient } from '@/lib/supabase'

export const dynamic = 'force-dynamic'

const negociosRateLimit = new Map<string, { count: number; resetAt: number }>()

function checkNegociosRateLimit(ip: string): boolean {
  const now = Date.now()
  const entry = negociosRateLimit.get(ip)
  if (!entry || now > entry.resetAt) {
    negociosRateLimit.set(ip, { count: 1, resetAt: now + 60 * 60 * 1000 })
    return true
  }
  if (entry.count >= 5) return false
  entry.count++
  return true
}

export async function GET(req: NextRequest) {
  const category = req.nextUrl.searchParams.get('category')
  const portId = req.nextUrl.searchParams.get('portId')

  const db = getServiceClient()
  let query = db
    .from('rewards_businesses')
    .select('id, name, description, address, port_ids, category, logo_emoji, phone, whatsapp, website, hours, claimed, listing_tier, notes_es, instagram, facebook')
    .eq('approved', true)
    .order('listing_tier', { ascending: false }) // featured first
    .order('claimed', { ascending: false })       // claimed second
    .order('name', { ascending: true })

  if (category && category !== 'all') {
    query = query.eq('category', category)
  }
  if (portId) {
    query = query.contains('port_ids', [portId])
  }

  const { data, error } = await query.limit(100)
  if (error) return NextResponse.json({ error: error.message }, { status: 500 })

  return NextResponse.json({ businesses: data || [] })
}

export async function POST(req: NextRequest) {
  const ip = req.headers.get('x-forwarded-for')?.split(',')[0] || 'unknown'
  if (!checkNegociosRateLimit(ip)) {
    return NextResponse.json({ error: 'Too many submissions. Try again later.' }, { status: 429 })
  }

  const body = await req.json()
  const { name, description, address, category, phone, whatsapp, port_ids, submitted_by_email, hours, notes_es } = body

  if (!name?.trim()) return NextResponse.json({ error: 'name required' }, { status: 400 })
  if (!category) return NextResponse.json({ error: 'category required' }, { status: 400 })

  const EMOJI_MAP: Record<string, string> = {
    exchange: '💱', dental: '🦷', pharmacy: '💊', restaurant: '🌮',
    cafe: '☕', gas: '⛽', tire: '🔧', taxi: '🚕', other: '🏪',
  }

  const VALID_CATEGORIES = ['exchange', 'dental', 'pharmacy', 'restaurant', 'cafe', 'gas', 'tire', 'taxi', 'other']
  if (!VALID_CATEGORIES.includes(category)) {
    return NextResponse.json({ error: 'Invalid category' }, { status: 400 })
  }

  const db = getServiceClient()
  const { data, error } = await db.from('rewards_businesses').insert({
    name: name.trim().slice(0, 200),
    description: description?.trim().slice(0, 500) || null,
    address: address?.trim().slice(0, 300) || null,
    category,
    logo_emoji: EMOJI_MAP[category] || '🏪',
    phone: phone?.trim().slice(0, 50) || null,
    whatsapp: whatsapp?.trim().slice(0, 50) || null,
    port_ids: Array.isArray(port_ids) ? port_ids.slice(0, 10) : [],
    submitted_by_email: submitted_by_email?.trim().slice(0, 200) || null,
    hours: hours?.trim().slice(0, 300) || null,
    notes_es: notes_es?.trim().slice(0, 500) || null,
    approved: true,   // free listings go live immediately
    claimed: false,
    listing_tier: 'free',
  }).select('id').single()

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })

  return NextResponse.json({ ok: true, id: data.id })
}
