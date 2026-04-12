import { NextRequest, NextResponse } from 'next/server'

export const dynamic = 'force-dynamic'
export const maxDuration = 30

function getLevel(wait: number | null): 'low' | 'medium' | 'high' {
  if (!wait || wait === 0) return 'low'
  if (wait <= 20) return 'low'
  if (wait <= 45) return 'medium'
  return 'high'
}

function emoji(level: string) {
  if (level === 'low') return '🟢'
  if (level === 'medium') return '🟡'
  return '🔴'
}

const REGIONS = [
  {
    key: 'rgv', label: '🌵 RGV / McAllen', tz: 'America/Chicago',
    hashtags: '#RGV #McAllen #Hidalgo #Pharr #Progreso #Donna #Anzalduas #Reynosa',
    ports: ['230501','230502','230503','230901','230902'],
  },
  {
    key: 'brownsville', label: '🏙️ Matamoros / Brownsville', tz: 'America/Chicago',
    hashtags: '#Brownsville #Matamoros #ValleDeTexas',
    ports: ['535501','535502','535503'],
  },
  {
    key: 'laredo', label: '🛣️ Laredo / Nuevo Laredo', tz: 'America/Chicago',
    hashtags: '#Laredo #NuevoLaredo #Tamaulipas',
    ports: ['230401','230402'],
  },
  {
    key: 'eagle_pass', label: '🦅 Eagle Pass / Piedras Negras', tz: 'America/Chicago',
    hashtags: '#EaglePass #PiedrasNegras #Coahuila',
    ports: ['230301'],
  },
  {
    key: 'el_paso', label: '⛰️ El Paso / Juárez', tz: 'America/Denver',
    hashtags: '#ElPaso #Juarez #Chihuahua #JRZELP',
    ports: ['240201'],
  },
  {
    key: 'san_luis', label: '🌵 San Luis RC / Arizona', tz: 'America/Phoenix',
    hashtags: '#SanLuisRC #Sonora #Arizona',
    ports: [],
  },
]

const PORT_NAMES: Record<string, string> = {
  '230501': 'Hidalgo / McAllen',
  '230502': 'Pharr–Reynosa',
  '230503': 'Anzaldúas',
  '230901': 'Progreso',
  '230902': 'Donna',
  '535501': 'Brownsville Gateway',
  '535502': 'Brownsville Veterans',
  '535503': 'Los Tomates',
  '230401': 'Laredo I',
  '230402': 'Laredo II',
  '230301': 'Eagle Pass',
  '240201': 'El Paso / Juárez',
}

const PEAK_LABELS: { hour: number; label: string }[] = [
  { hour: 5,  label: 'Mañana — Morning commute' },
  { hour: 11, label: 'Mediodía — Midday' },
  { hour: 15, label: 'Tarde — Afternoon rush' },
  { hour: 19, label: 'Noche — Evening crossing' },
]

export async function GET(req: NextRequest) {
  const secret = req.nextUrl.searchParams.get('secret')
  if (secret !== process.env.CRON_SECRET) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  const portsRes = await fetch('https://cruzar.app/api/ports', { cache: 'no-store' })
  const { ports } = await portsRes.json()

  const now = new Date()

  // Build a caption block per region
  const regionBlocks: string[] = []

  for (const region of REGIONS) {
    if (region.ports.length === 0) continue

    const crossings = region.ports
      .map(portId => {
        const port = ports?.find((p: { portId: string; isClosed?: boolean; noData?: boolean }) => p.portId === portId)
        const wait = port?.vehicle ?? null
        const isClosed = port?.isClosed ?? false
        const noData = port?.noData ?? (wait === null)
        return { name: PORT_NAMES[portId] || portId, wait, level: getLevel(wait), isClosed, noData }
      })

    if (crossings.length === 0) continue

    const timeStr = now.toLocaleTimeString('es-MX', {
      hour: 'numeric', minute: '2-digit', hour12: true, timeZone: region.tz,
    })

    const lines = crossings.map(c => {
      if (c.isClosed) return `  ⚫ ${c.name}: Cerrado`
      if (c.noData || c.wait === null) return `  ⚪ ${c.name}: Sin datos`
      return `  ${emoji(c.level)} ${c.name}: ${c.wait === 0 ? '<1' : c.wait} min`
    })
    const fastest = crossings.find(c => c.level === 'low' && !c.isClosed && !c.noData)

    regionBlocks.push(
      `${region.label} — ${timeStr.toUpperCase()}\n` +
      lines.join('\n') +
      (fastest ? `\n  ✅ Más rápido: ${fastest.name}` : '') +
      `\n  ${region.hashtags}`
    )
  }

  if (regionBlocks.length === 0) {
    return NextResponse.json({ success: true, message: 'No crossings with data right now' })
  }

  // Determine peak label based on CST hour
  const cstHour = parseInt(now.toLocaleString('en-US', { hour: 'numeric', hour12: false, timeZone: 'America/Chicago' }), 10)
  const peak = PEAK_LABELS.find(p => p.hour === cstHour) || { label: 'Scheduled post' }

  const dateStr = now.toLocaleDateString('es-MX', {
    weekday: 'long', month: 'long', day: 'numeric', timeZone: 'America/Chicago',
  })

  if (process.env.RESEND_API_KEY && process.env.OWNER_EMAIL) {
    await fetch('https://api.resend.com/emails', {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${process.env.RESEND_API_KEY}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        from: process.env.RESEND_FROM_EMAIL || 'Cruzar <onboarding@resend.dev>',
        to: [process.env.OWNER_EMAIL],
        subject: `📱 ${peak.label} — Todos los puentes — ${dateStr}`,
        html: `
          <div style="font-family:-apple-system,sans-serif;max-width:600px;margin:0 auto;padding:24px;">
            <h2 style="margin:0 0 4px;color:#111827;">📱 Tiempos de Espera — Todos los Puentes</h2>
            <p style="color:#6b7280;font-size:14px;margin:0 0 24px;">${peak.label} · ${dateStr}</p>
            ${regionBlocks.map(block => `
              <div style="background:#f9fafb;border:1px solid #e5e7eb;border-radius:12px;padding:16px;margin-bottom:16px;">
                <pre style="font-size:13px;color:#374151;white-space:pre-wrap;margin:0;font-family:-apple-system,sans-serif;">${block}</pre>
              </div>
            `).join('')}
            <a href="https://cruzar.app/admin" style="display:inline-block;background:#111827;color:white;text-decoration:none;padding:10px 20px;border-radius:8px;font-size:14px;margin-top:8px;">
              Open Admin Panel →
            </a>
          </div>
        `,
      }),
    })
  }

  return NextResponse.json({ success: true, regions: regionBlocks.length })
}
