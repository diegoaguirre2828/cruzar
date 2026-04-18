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

// Teaser-format peak copy — short, follow-centric, feature-rotating.
// The FB caption only shows the top 2 fastest crossings across ALL
// regions. Readers who want their own bridge have to follow the page
// (to catch the next drop) or go to cruzar.app. The full per-region
// digest still appears in Diego's email for his own visibility.
const PEAK_COPY: { hour: number; opener: string; featurePitch: string; followHook: string; hashtag: string }[] = [
  {
    hour: 5,
    opener: '🌅 BUENOS DÍAS',
    featurePitch: '🔔 La app también te avisa cuando baja la espera de TU puente',
    followHook: "👉 Dale seguir 👆 pa' la notificación cada mañana",
    hashtag: '#cruzar #madrugada #commute',
  },
  {
    hour: 11,
    opener: '☀️ MEDIODÍA',
    featurePitch: "📊 La app tiene historial por hora pa\' saber cuándo cruzar",
    followHook: "👉 Dale seguir 👆 pa' los updates 4 veces al día",
    hashtag: '#cruzar #mediodia',
  },
  {
    hour: 15,
    opener: '🌤️ TARDE',
    featurePitch: '📹 La app tiene cámaras en vivo + reportes de la gente en la fila',
    followHook: "👉 Dale seguir 👆 pa' la notificación directo a tu feed",
    hashtag: '#cruzar #tarde #commute',
  },
  {
    hour: 19,
    opener: '🌙 NOCHE',
    featurePitch: '⚠️ La app te alerta cuando hay accidentes o inspecciones fuertes',
    followHook: "👉 Dale seguir 👆 pa' no perderte ningún update",
    hashtag: '#cruzar #noche',
  },
]

export async function GET(req: NextRequest) {
  // Accept either ?secret=<CRON_SECRET> query param or
  // Authorization: Bearer <CRON_SECRET> header. Matches the pattern
  // every sibling cron route uses, so Vercel Scheduled + cron-job.org
  // + curl smoke tests all succeed against the same endpoint.
  const secret = req.nextUrl.searchParams.get('secret')
  const authHeader = req.headers.get('authorization')
  const isAuthed =
    secret === process.env.CRON_SECRET ||
    authHeader === `Bearer ${process.env.CRON_SECRET}`
  if (!isAuthed) {
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

  // Determine peak window from the current CST hour. Cron fires at
  // 5:30 / 11:30 / 15:30 / 19:30 CDT so the hour when this runs is
  // 5 / 11 / 15 / 19 — matches PEAK_COPY. DST is handled by toLocaleString.
  const cstHour = parseInt(now.toLocaleString('en-US', { hour: 'numeric', hour12: false, timeZone: 'America/Chicago' }), 10)
  const peak = PEAK_COPY.find(p => p.hour === cstHour) || {
    opener: '🌉 TIEMPOS DE ESPERA',
    featurePitch: '📱 Tiempos en vivo + cámaras + alertas',
    followHook: '👉 Dale seguir 👆 pa\' los updates',
    hashtag: '#cruzar',
  }

  const timeStrCST = now.toLocaleTimeString('es-MX', {
    hour: 'numeric', minute: '2-digit', hour12: true, timeZone: 'America/Chicago',
  })
  const dateStr = now.toLocaleDateString('es-MX', {
    weekday: 'long', month: 'long', day: 'numeric', timeZone: 'America/Chicago',
  })

  // Build a per-region breakdown. Someone in Brownsville doesn't care
  // that Tijuana is fast — they want to see their region's bridges.
  // Matches /api/social/next-post exactly so both pipelines produce
  // the same caption format.
  const TOP_PER_REGION = 3
  interface RegionSection { key: string; label: string; lines: string[] }
  const sections: RegionSection[] = []
  for (const region of REGIONS) {
    const regionCrossings: Array<{ name: string; wait: number; level: string }> = []
    for (const portId of region.ports) {
      const port = ports?.find((p: { portId: string; isClosed?: boolean; vehicle?: number | null }) => p.portId === portId)
      if (!port || port.isClosed) continue
      const wait = port.vehicle
      if (wait == null || wait < 0) continue
      regionCrossings.push({
        name: PORT_NAMES[portId] || portId,
        wait,
        level: getLevel(wait),
      })
    }
    regionCrossings.sort((a, b) => a.wait - b.wait)
    if (regionCrossings.length === 0) continue
    const top = regionCrossings.slice(0, TOP_PER_REGION)
    const lines = top.map((c) => {
      const waitStr = c.wait === 0 ? '<1' : String(c.wait)
      return `  ${emoji(c.level)} ${c.name} · ${waitStr} min`
    })
    sections.push({ key: region.key, label: region.label, lines })
  }

  // Per-region caption — goes at the TOP of the email AND is what
  // Make.com / Diego pastes into FB. Ends with the follow hook +
  // pitch + hashtags tail so growth mechanics don't change.
  const sectionBlocks = sections
    .map((s) => `${s.label}\n${s.lines.join('\n')}`)
    .join('\n\n')
  const fbCaption = sections.length > 0
    ? `${peak.opener} · ${timeStrCST.toUpperCase()}

⚡ Tiempos por región ahorita:

${sectionBlocks}

${peak.featurePitch} — cruzar.app

${peak.followHook}

${peak.hashtag}`
    : `${peak.opener} · ${timeStrCST.toUpperCase()}

CBP no está reportando datos en vivo ahorita — vuelven solos en pocos minutos.

📱 Mientras tanto, los reportes de la comunidad siguen en vivo — cruzar.app

${peak.followHook}

${peak.hashtag}`

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
        subject: `📱 ${peak.opener} — ${dateStr}`,
        html: `
          <div style="font-family:-apple-system,sans-serif;max-width:640px;margin:0 auto;padding:24px;">
            <h2 style="margin:0 0 4px;color:#111827;">📱 ${peak.opener}</h2>
            <p style="color:#6b7280;font-size:14px;margin:0 0 24px;">${dateStr}</p>

            <div style="background:#eff6ff;border:2px solid #3b82f6;border-radius:12px;padding:16px;margin-bottom:16px;">
              <p style="margin:0 0 8px;font-size:11px;font-weight:bold;color:#1e40af;text-transform:uppercase;letter-spacing:0.05em;">
                📋 Listo pa' copiar y pegar a Facebook
              </p>
              <pre style="font-size:13px;color:#111827;white-space:pre-wrap;margin:0;font-family:-apple-system,sans-serif;line-height:1.45;">${fbCaption}</pre>
            </div>

            <p style="color:#6b7280;font-size:12px;margin:0 0 8px;">Vista por región:</p>
            ${regionBlocks.map(block => `
              <div style="background:#f9fafb;border:1px solid #e5e7eb;border-radius:12px;padding:16px;margin-bottom:12px;">
                <pre style="font-size:12px;color:#374151;white-space:pre-wrap;margin:0;font-family:-apple-system,sans-serif;">${block}</pre>
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

  return NextResponse.json({ success: true, regions: regionBlocks.length, peak: peak.opener, caption: fbCaption })
}
