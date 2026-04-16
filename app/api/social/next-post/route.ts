import { NextResponse } from 'next/server'
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

function emoji(wait: number | null): string {
  if (wait == null) return ''
  if (wait <= 20) return '🟢'
  if (wait <= 45) return '🟡'
  return '🔴'
}

export async function GET(): Promise<Response> {
  const apiBase = process.env.NEXT_PUBLIC_APP_URL || 'https://cruzar.app'

  let lines: string[] = []
  let fastestLine = ''
  try {
    // Fetch directly from CBP instead of self-fetching /api/ports,
    // which fails silently on Vercel due to the cruzar.app → www redirect.
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
    const db = getServiceClient()
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

  return NextResponse.json({
    caption,
    videoUrl,
    imageUrl: `${apiBase}/opengraph-image`,
    landingUrl: utmUrl,
    hashtags,
    generatedAt: now.toISOString(),
  }, {
    headers: { 'Cache-Control': 'public, s-maxage=300, stale-while-revalidate=600' },
  })
}
