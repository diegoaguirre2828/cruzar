import { NextResponse } from 'next/server'
import { createHash } from 'node:crypto'
import { getServiceClient } from '@/lib/supabase'

export const dynamic = 'force-dynamic'

const FEATURED = [
  { portId: '230501', name: 'Hidalgo' },
  { portId: '230502', name: 'Pharr' },
  { portId: '230503', name: 'Anzalduas' },
  { portId: '535501', name: 'Gateway Brownsville' },
  { portId: '535502', name: 'Veterans B&M' },
  { portId: '230401', name: 'Laredo I' },
]

// Minimum gap between posts on the same platform. Make.com is supposed to
// fire 4×/day (~4h apart); 3h is a safe floor that catches double-firings
// without blocking the next legitimate scheduled run.
const MIN_GAP_MINUTES = 180

function emoji(wait: number | null): string {
  if (wait == null) return ''
  if (wait <= 20) return '🟢'
  if (wait <= 45) return '🟡'
  return '🔴'
}

function captionHash(caption: string): string {
  // Strip the timestamp + date lines so reruns within the same scheduled
  // slot collapse to the same hash even if the minute ticked over.
  const stripped = caption
    .split('\n')
    .filter((line) => !/TIEMPOS EN LOS PUENTES/i.test(line))
    .filter((line) => !/^(Lunes|Martes|Miercoles|Miércoles|Jueves|Viernes|Sabado|Sábado|Domingo)/i.test(line))
    .join('\n')
  return createHash('sha256').update(stripped).digest('hex').slice(0, 16)
}

export async function GET(request: Request): Promise<Response> {
  const apiBase = process.env.NEXT_PUBLIC_APP_URL || 'https://cruzar.app'
  const url = new URL(request.url)
  const force = url.searchParams.get('force') === '1'

  const db = getServiceClient()

  // Dedupe: if a facebook_page post went out within MIN_GAP_MINUTES, skip.
  if (!force) {
    const since = new Date(Date.now() - MIN_GAP_MINUTES * 60_000).toISOString()
    const { data: recent } = await db
      .from('social_posts')
      .select('id, posted_at, caption_hash')
      .eq('platform', 'facebook_page')
      .gte('posted_at', since)
      .order('posted_at', { ascending: false })
      .limit(1)
    if (recent && recent.length > 0) {
      return NextResponse.json({
        skip: true,
        reason: 'recent_post_exists',
        lastPostedAt: recent[0].posted_at,
        minGapMinutes: MIN_GAP_MINUTES,
      }, { status: 200, headers: { 'Cache-Control': 'no-store' } })
    }
  }

  let lines: string[] = []
  let fastestLine = ''
  try {
    const res = await fetch('https://www.cruzar.app/api/ports', {
      cache: 'no-store',
      headers: { 'User-Agent': 'Cruzar-Social/1.0' },
    })
    const json = (await res.json()) as { ports?: { portId: string; portName?: string; vehicle?: number | null }[] }
    const ports = json.ports || []
    for (const f of FEATURED) {
      const p = ports.find((x: { portId: string }) => x.portId === f.portId)
      const w = p?.vehicle
      if (w != null && w >= 0) lines.push(`${emoji(w)} ${f.name}: ${w} min`)
    }
    const fastest = FEATURED
      .map((f) => ({ ...f, wait: ports.find((p: { portId: string }) => p.portId === f.portId)?.vehicle ?? null }))
      .filter((x): x is typeof x & { wait: number } => x.wait != null && x.wait >= 0)
      .sort((a, b) => a.wait - b.wait)[0]
    if (fastest) fastestLine = `\n✅ Mas rapido: ${fastest.name} (${fastest.wait} min)`
  } catch (err) {
    console.error('[next-post] Failed to fetch ports:', err)
  }

  let videoUrl: string | null = null
  try {
    const { data } = await db
      .from('public_assets')
      .select('value')
      .eq('name', 'video_manifest')
      .single()
    const manifest = data?.value as { videos?: { url: string; compositionId: string }[] } | null
    const organic = manifest?.videos?.find((v) => v.compositionId === 'WaitTimes')
    if (organic?.url) videoUrl = organic.url
  } catch { /* no video yet */ }

  const now = new Date()
  const timeStr = now.toLocaleTimeString('es-MX', {
    hour: 'numeric',
    minute: '2-digit',
    hour12: true,
    timeZone: 'America/Chicago',
  })
  const dowStr = new Intl.DateTimeFormat('es-MX', { weekday: 'long', timeZone: 'America/Chicago' }).format(now)
  const dowCap = dowStr.charAt(0).toUpperCase() + dowStr.slice(1)

  const utmUrl = `https://cruzar.app/?utm_source=facebook&utm_medium=page_post&utm_campaign=organic_${now.toISOString().split('T')[0]}`
  const hashtags = '#cruzar #frontera #tiemposdeespera #RGV #Brownsville #McAllen #Laredo #puente'

  const caption = `🌉 TIEMPOS EN LOS PUENTES — ${timeStr.toUpperCase()}
${dowCap}

${lines.join('\n')}
${fastestLine}

Ve todos los puentes en vivo
📱 cruzar.app

Gratis · En vivo · Sin grupos
🎁 Primeros 1,000 se llevan 3 meses de Pro gratis

${hashtags}`

  const imageUrl = `${apiBase}/opengraph-image`
  const hash = captionHash(caption)

  // Record this post BEFORE returning so the next call dedupes against it.
  // If the row insert fails we still return the caption (don't block posting),
  // but log so we can fix the dedupe gap.
  // force=1 is reserved for read-only probes (e.g. the promoter dashboard
  // preview) — don't record those, or they'd fake out the dedupe window.
  if (!force) {
    try {
      await db.from('social_posts').insert({
        platform: 'facebook_page',
        caption,
        caption_hash: hash,
        video_url: videoUrl,
        image_url: imageUrl,
        landing_url: utmUrl,
      })
    } catch (err) {
      console.error('[next-post] Failed to record social_posts row:', err)
    }
  }

  return NextResponse.json({
    caption,
    videoUrl,
    imageUrl,
    landingUrl: utmUrl,
    hashtags,
    generatedAt: now.toISOString(),
  }, {
    headers: { 'Cache-Control': 'no-store' },
  })
}
