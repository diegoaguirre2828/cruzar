import { NextRequest, NextResponse } from 'next/server'

function getLevel(wait: number | null): 'low' | 'medium' | 'high' {
  if (wait === null) return 'low'
  if (wait <= 20) return 'low'
  if (wait <= 45) return 'medium'
  return 'high'
}

function formatWait(wait: number): string {
  return wait === 0 ? '< 1 min' : `${wait} min`
}

function emoji(level: string) {
  if (level === 'low') return '🟢'
  if (level === 'medium') return '🟡'
  return '🔴'
}

const RGV_PORTS = [
  { portId: '230501', name: 'Hidalgo', fullName: 'Hidalgo / McAllen' },
  { portId: '230502', name: 'Pharr',   fullName: 'Pharr–Reynosa' },
  { portId: '230503', name: 'Anzaldúas', fullName: 'Anzaldúas' },
  { portId: '230901', name: 'Progreso',  fullName: 'Progreso' },
  { portId: '230902', name: 'Donna',     fullName: 'Donna' },
]

const ALL_PORTS = [
  ...RGV_PORTS,
  { portId: '535501', name: 'Brownsville Gateway',  fullName: 'Brownsville Gateway',  region: 'brownsville' },
  { portId: '535502', name: 'B\'ville Veterans',    fullName: 'Brownsville Veterans', region: 'brownsville' },
  { portId: '535503', name: 'Los Tomates',           fullName: 'Los Tomates',          region: 'brownsville' },
  { portId: '230401', name: 'Laredo I',  fullName: 'Laredo I',           region: 'laredo' },
  { portId: '230402', name: 'Laredo II', fullName: 'Laredo II',          region: 'laredo' },
  { portId: '230301', name: 'Eagle Pass', fullName: 'Eagle Pass',        region: 'eagle_pass' },
  { portId: '240201', name: 'El Paso',   fullName: 'El Paso / Juárez',   region: 'el_paso' },
]

type Tone = 'morning' | 'midday' | 'afternoon' | 'evening' | 'other'

function getTone(cstHour: number): Tone {
  if (cstHour >= 5  && cstHour < 10) return 'morning'
  if (cstHour >= 10 && cstHour < 14) return 'midday'
  if (cstHour >= 14 && cstHour < 19) return 'afternoon'
  if (cstHour >= 19 && cstHour < 23) return 'evening'
  return 'other'
}

function pick<T>(arr: T[]): T {
  return arr[Math.floor(Math.random() * arr.length)]
}

function buildCaptions(
  crossings: { name: string; fullName: string; wait: number; level: string }[],
  tone: Tone,
  timeStr: string,
  region: string,
) {
  const fastest = crossings.filter(c => c.level === 'low')[0] || null
  const allSlow = crossings.every(c => c.level === 'high')

  // Lines for the body — short name in group caption, full name in page post
  const groupLines = crossings.map(c => `${emoji(c.level)} ${c.name}: ${formatWait(c.wait)}`)
  const pageLines  = crossings.map(c => `${emoji(c.level)} ${c.fullName}: ${formatWait(c.wait)}`)

  // ── Group caption openers by tone ────────────────────────────────────────
  const openers: Record<Tone, string[]> = {
    morning: [
      'Buenos días 🌅 Ahorita en los puentes del RGV:',
      'Para los que van a cruzar en la mañana 👇',
      '¿Cómo están los puentes ahorita? 🌅',
      'Mañana en los puentes del RGV:',
    ],
    midday: [
      '¿Van a cruzar al mediodía? Así están los puentes:',
      'Mediodía en los puentes del RGV 🌞',
      'Al mediodía así están los tiempos:',
      'Puentes al mediodía — por si van a cruzar:',
    ],
    afternoon: [
      '¿Van a cruzar esta tarde? Así están ahorita 👇',
      'Tarde en los puentes del RGV:',
      'Para los que salen del trabajo — puentes ahorita:',
      '¿Cómo están los puentes esta tarde? 👇',
    ],
    evening: [
      'Esta noche en los puentes del RGV 🌙',
      '¿Van a cruzar ahorita en la noche? Tiempos:',
      'Noche en los puentes — así están ahorita:',
      'Para los que van a cruzar esta noche 👇',
    ],
    other: [
      'Así están los puentes del RGV ahorita:',
      'Tiempos en los puentes del RGV:',
    ],
  }

  // ── Group caption closers ─────────────────────────────────────────────────
  const closers = [
    'Tiempos en vivo → cruzar.app',
    'Checar en vivo: cruzar.app',
    'Datos en vivo de cruzar.app — actualizado cada 15 min',
    'cruzar.app para checar antes de salir',
  ]

  const endings = [
    'Buen cruce a todos 🌉',
    'Suerte a los que van a cruzar 🙏',
    '',
    'Cuídense 🙏',
  ]

  const opener = pick(openers[tone])
  const closer = pick(closers)
  const ending = pick(endings)

  const bestLine = fastest
    ? `✅ Más rápido: ${fastest.name}`
    : allSlow
      ? '⚠️ Todo lento ahorita — ten paciencia'
      : ''

  // ── Group caption (casual, short) ─────────────────────────────────────────
  const groupCaption = [
    opener,
    '',
    groupLines.join('\n'),
    bestLine,
    '',
    closer,
    ending,
  ].filter(l => l !== undefined && l !== null && !(l === '' && !bestLine && l === bestLine))
   .join('\n')
   .replace(/\n{3,}/g, '\n\n')
   .trim()

  // ── Page post (slightly more structured) ─────────────────────────────────
  const pageHashtags = region === 'rgv' || region === 'all'
    ? '#RGV #McAllen #Hidalgo #Pharr #Progreso #Donna #Anzalduas #Reynosa #puente #tiemposdeespera'
    : '#puente #tiemposdeespera #frontera'

  const pageCaption = [
    `🌉 ESPERA EN EL RGV — ${timeStr.toUpperCase()}`,
    '',
    pageLines.join('\n'),
    bestLine ? `\n${bestLine}` : '',
    '',
    '📱 Tiempos actualizados → cruzar.app',
    'Reporta tu cruce y ayuda a los demás 🙌',
    '',
    pageHashtags,
  ].filter(l => l !== undefined)
   .join('\n')
   .replace(/\n{3,}/g, '\n\n')
   .trim()

  return { groupCaption, pageCaption }
}

export const dynamic = 'force-dynamic'
export const maxDuration = 30

export async function GET(req: NextRequest) {
  const secret = req.nextUrl.searchParams.get('secret')
  if (secret !== process.env.CRON_SECRET) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  const regionFilter = req.nextUrl.searchParams.get('region') || 'rgv'

  const portsRes = await fetch('https://cruzar.app/api/ports', { cache: 'no-store' })
  const { ports } = await portsRes.json()

  const portList = regionFilter === 'all' ? ALL_PORTS : RGV_PORTS
  const crossings = portList
    .map(p => {
      const port = ports?.find((x: { portId: string }) => x.portId === p.portId)
      // Use vehicle wait, fall back to pedestrian if vehicle has no data
      const wait = port?.vehicle ?? port?.pedestrian ?? null
      return { ...p, wait, level: getLevel(wait), isClosed: port?.isClosed ?? false }
    })
    // Include 0-min waits (no delay) — only exclude truly missing data (null)
    .filter(c => c.wait !== null && !c.isClosed) as { name: string; fullName: string; wait: number; level: string }[]

  if (crossings.length === 0) {
    return NextResponse.json({ success: true, message: 'No data right now' })
  }

  const now = new Date()
  const timeStr = now.toLocaleTimeString('es-MX', {
    hour: 'numeric', minute: '2-digit', hour12: true, timeZone: 'America/Chicago',
  })
  const cstHour = parseInt(
    now.toLocaleString('en-US', { hour: 'numeric', hour12: false, timeZone: 'America/Chicago' }), 10
  )
  const tone = getTone(cstHour)
  const { groupCaption, pageCaption } = buildCaptions(crossings, tone, timeStr, regionFilter)

  return NextResponse.json({
    success: true,
    caption: groupCaption,
    pageCaption,
    groupCaption,
    crossings: crossings.length,
    tone,
  })
}
