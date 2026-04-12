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
    return NextResponse.json({ caption: null, message: 'No crossings with data right now' })
  }

  const timeStrCST = now.toLocaleTimeString('es-MX', {
    hour: 'numeric', minute: '2-digit', hour12: true, timeZone: 'America/Chicago',
  })
  const dateStrFB = now.toLocaleDateString('es-MX', {
    weekday: 'long', month: 'long', day: 'numeric', timeZone: 'America/Chicago',
  })

  const caption = `🌉 TIEMPOS DE ESPERA — ${timeStrCST.toUpperCase()}
${dateStrFB.charAt(0).toUpperCase() + dateStrFB.slice(1)}

${regionBlocks.join('\n\n─────────────────\n\n')}

📱 Tiempos en vivo → cruzar.app
Reporta tu tiempo y ayuda a todos en la fila 🙌

#border #frontera #cruzar #espera #tiemposdeespera`

  return NextResponse.json({ caption, regions: regionBlocks.length })
}
