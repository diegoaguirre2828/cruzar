import { NextRequest, NextResponse } from 'next/server'
import { createServerClient } from '@supabase/ssr'
import { cookies } from 'next/headers'
import { getServiceClient } from '@/lib/supabase'
import { PORT_META } from '@/lib/portMeta'

export const dynamic = 'force-dynamic'

const ADMIN_EMAIL = 'cruzabusiness@gmail.com'

async function requireAdmin() {
  const cookieStore = await cookies()
  const supabase = createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    { cookies: { getAll: () => cookieStore.getAll() } }
  )
  const { data: { user } } = await supabase.auth.getUser()
  if (!user || user.email !== ADMIN_EMAIL) return null
  return user
}

// GET — list every port with its current name (static default + any override)
export async function GET() {
  const user = await requireAdmin()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const db = getServiceClient()
  const { data: overrides } = await db
    .from('port_overrides')
    .select('port_id, local_name, notes, updated_at')

  const overrideMap = new Map<string, { local_name: string | null; notes: string | null; updated_at: string | null }>()
  for (const o of overrides || []) {
    overrideMap.set(o.port_id, {
      local_name: o.local_name ?? null,
      notes: o.notes ?? null,
      updated_at: o.updated_at ?? null,
    })
  }

  const rows = Object.entries(PORT_META)
    .map(([portId, meta]) => {
      const ov = overrideMap.get(portId)
      return {
        port_id: portId,
        city: meta.city,
        region: meta.region,
        mega_region: meta.megaRegion,
        static_local_name: meta.localName ?? null,
        override_local_name: ov?.local_name ?? null,
        effective_local_name: ov?.local_name ?? meta.localName ?? null,
        notes: ov?.notes ?? null,
        updated_at: ov?.updated_at ?? null,
      }
    })
    .sort((a, b) => a.region.localeCompare(b.region) || a.port_id.localeCompare(b.port_id))

  return NextResponse.json({ ports: rows })
}

// PATCH — upsert a single port override
export async function PATCH(req: NextRequest) {
  const user = await requireAdmin()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  let body: { port_id?: string; local_name?: string | null; notes?: string | null }
  try { body = await req.json() } catch { return NextResponse.json({ error: 'Invalid JSON' }, { status: 400 }) }

  const portId = (body.port_id || '').trim()
  if (!portId || !PORT_META[portId]) {
    return NextResponse.json({ error: 'Invalid port_id' }, { status: 400 })
  }

  const localName = typeof body.local_name === 'string'
    ? body.local_name.trim().slice(0, 100)
    : null
  const notes = typeof body.notes === 'string'
    ? body.notes.trim().slice(0, 500)
    : null

  const db = getServiceClient()

  // Empty local_name + empty notes = delete the override (reset to default)
  if (!localName && !notes) {
    await db.from('port_overrides').delete().eq('port_id', portId)
    return NextResponse.json({ ok: true, cleared: true, port_id: portId })
  }

  const { error } = await db.from('port_overrides').upsert(
    {
      port_id: portId,
      local_name: localName,
      notes: notes,
      updated_at: new Date().toISOString(),
      updated_by: user.id,
    },
    { onConflict: 'port_id' }
  )

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json({ ok: true, port_id: portId, local_name: localName })
}
