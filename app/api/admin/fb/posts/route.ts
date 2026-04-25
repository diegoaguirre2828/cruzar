import { NextResponse } from 'next/server'
import { createServerClient } from '@supabase/ssr'
import { cookies } from 'next/headers'
import { getServiceClient } from '@/lib/supabase'

export const dynamic = 'force-dynamic'

const ADMIN_EMAIL = 'cruzabusiness@gmail.com'

// Returns the last 30 social_posts rows so /admin/fb can render the
// publish log: caption preview, fb_post_id link, error if any, time.

export async function GET() {
  const cookieStore = await cookies()
  const supabase = createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    { cookies: { getAll: () => cookieStore.getAll() } }
  )
  const { data: { user } } = await supabase.auth.getUser()
  if (!user || user.email !== ADMIN_EMAIL) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  const db = getServiceClient()
  const { data, error } = await db
    .from('social_posts')
    .select('id, posted_at, caption, fb_post_id, fb_posted_at, fb_post_error, image_url, image_kind')
    .eq('platform', 'facebook_page')
    .order('posted_at', { ascending: false })
    .limit(30)

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 })
  }

  const fbEnvOk = Boolean(process.env.FACEBOOK_PAGE_ID && process.env.FACEBOOK_PAGE_ACCESS_TOKEN)

  return NextResponse.json({
    posts: data || [],
    fbEnvOk,
    pageIdSet: Boolean(process.env.FACEBOOK_PAGE_ID),
    tokenSet: Boolean(process.env.FACEBOOK_PAGE_ACCESS_TOKEN),
  })
}
