import { NextRequest, NextResponse } from 'next/server'

export const dynamic = 'force-dynamic'
export const maxDuration = 30

// Peak-hour aware caption generator for the Cruzar FB page.
//
// Called by Make.com on a cron schedule. The `peak` query param tunes
// the tone and opener for the commute window so each post feels
// time-relevant instead of a generic data dump. Defaults to the
// nearest peak window based on CST if `peak` isn't passed.
//
// Pipeline:
//   Make.com cron (4x/day at 6am/11am/3pm/7pm CST) →
//   GET /api/social/next-post?secret=X&peak=morning →
//   Returns { caption, regions, peak } →
//   Make.com pipes caption into FB Page "Create a Post" module
//
// Every caption ends with a page-follow CTA — the whole point of
// frequent posts is to train FB's push-notification algorithm so
// followers get pinged when the page posts. That only works if
// people follow the page, so every post asks for it.

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

type PeakWindow = 'morning' | 'midday' | 'afternoon' | 'evening'

const PEAK_COPY: Record<PeakWindow, {
  opener: string
  followHook: string
  hashtag: string
}> = {
  morning: {
    opener: '🌅 BUENOS DÍAS RAZA — tiempos de la mañana',
    followHook: '👉 Dale follow a la página y te avisamos cada mañana antes de que salgas al puente',
    hashtag: '#madrugada #commute',
  },
  midday: {
    opener: '☀️ MEDIODÍA — así anda el puente ahorita',
    followHook: '👉 Síguenos para que te llegue una notificación cuando publiquemos los tiempos — ya no andes buscando',
    hashtag: '#mediodia',
  },
  afternoon: {
    opener: '🌤️ TARDE — tiempos antes de la salida de escuela y trabajo',
    followHook: '👉 Síguenos y te avisamos cada tarde ANTES de que salgas — te ahorras horas',
    hashtag: '#tarde #commute',
  },
  evening: {
    opener: '🌙 NOCHE — cómo anda el puente para los que cruzan al final del día',
    followHook: '👉 Dale follow a la página — publicamos los tiempos 4 veces al día en los momentos clave',
    hashtag: '#noche',
  },
}

// Pick the nearest peak window based on current time in CST — used
// as a fallback when Make.com doesn't pass ?peak explicitly.
function defaultPeak(): PeakWindow {
  const cstHour = parseInt(
    new Date().toLocaleString('en-US', { hour: '2-digit', hour12: false, timeZone: 'America/Chicago' }),
    10,
  )
  if (cstHour < 10) return 'morning'
  if (cstHour < 13) return 'midday'
  if (cstHour < 17) return 'afternoon'
  return 'evening'
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

export async function GET(req: NextRequest) {
  const secret = req.nextUrl.searchParams.get('secret')
  if (secret !== process.env.CRON_SECRET) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  // Pick the peak window either from the query param or auto-detect
  // from current CST hour. Make.com scenarios should pass ?peak=X
  // explicitly so each scheduled post has a stable identity.
  const peakParam = req.nextUrl.searchParams.get('peak') as PeakWindow | null
  const peak: PeakWindow = peakParam && peakParam in PEAK_COPY ? peakParam : defaultPeak()
  const peakMeta = PEAK_COPY[peak]

  const portsRes = await fetch('https://cruzar.app/api/ports', { cache: 'no-store' })
  const { ports } = await portsRes.json()

  const now = new Date()
  const regionBlocks: string[] = []

  for (const region of REGIONS) {
    if (region.ports.length === 0) continue

    const crossings = region.ports.map(portId => {
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
    return NextResponse.json({ caption: null, peak, message: 'No crossings with data right now' })
  }

  const timeStrCST = now.toLocaleTimeString('es-MX', {
    hour: 'numeric', minute: '2-digit', hour12: true, timeZone: 'America/Chicago',
  })
  const dateStrFB = now.toLocaleDateString('es-MX', {
    weekday: 'long', month: 'long', day: 'numeric', timeZone: 'America/Chicago',
  })

  const caption = `${peakMeta.opener} — ${timeStrCST.toUpperCase()}
${dateStrFB.charAt(0).toUpperCase() + dateStrFB.slice(1)}

${regionBlocks.join('\n\n─────────────────\n\n')}

📱 Tiempos en vivo → cruzar.app
Reporta tu tiempo y ayuda a todos en la fila 🙌

${peakMeta.followHook}

#border #frontera #cruzar #espera #tiemposdeespera ${peakMeta.hashtag}`

  return NextResponse.json({ caption, regions: regionBlocks.length, peak })
}
