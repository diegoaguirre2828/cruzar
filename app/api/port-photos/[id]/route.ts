import { NextRequest, NextResponse } from 'next/server'
import { createServerClient } from '@supabase/ssr'
import { cookies } from 'next/headers'
import { getServiceClient } from '@/lib/supabase'

export const dynamic = 'force-dynamic'

// DELETE /api/port-photos/[id]
//
// Allowed when the requester is the owner of the photo OR the admin
// email. Deletes both the storage object and the DB row. Used by the
// user's own "delete this photo" action in CommunityBridgePhotos.tsx.

const ADMIN_EMAIL = 'cruzabusiness@gmail.com'

export async function DELETE(
  _req: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  const { id } = await params
  if (!id) return NextResponse.json({ error: 'id required' }, { status: 400 })

  const cookieStore = await cookies()
  const supabase = createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    { cookies: { getAll: () => cookieStore.getAll() } },
  )
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const db = getServiceClient()

  // Fetch the row so we can verify ownership and know the storage path
  const { data: row, error: fetchError } = await db
    .from('port_photos')
    .select('id, user_id, storage_path')
    .eq('id', id)
    .maybeSingle()
  if (fetchError) return NextResponse.json({ error: fetchError.message }, { status: 500 })
  if (!row) return NextResponse.json({ error: 'Not found' }, { status: 404 })

  const isOwner = row.user_id === user.id
  const isAdmin = user.email === ADMIN_EMAIL
  if (!isOwner && !isAdmin) {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
  }

  // Remove the storage object first — if it fails we can retry via the
  // cleanup cron later; the DB row removal is authoritative.
  await db.storage.from('port-photos').remove([row.storage_path]).catch(() => {})

  const { error: deleteError } = await db.from('port_photos').delete().eq('id', id)
  if (deleteError) return NextResponse.json({ error: deleteError.message }, { status: 500 })

  return NextResponse.json({ ok: true })
}
