// Four paraphrased caption variants so each group sees different text
// instead of identical copies. This is one of the most important
// hardening layers — FB's bot detection pattern-matches on identical
// post content across groups within short time windows.
//
// Each variant pulls the same live data (fastest bridge, current wait)
// but frames the message differently. The rotation is deterministic:
// the variant used in a given post is derived from (groupUrl + dayOfYear)
// so a group sees the SAME variant if the script runs twice, but
// different groups see different variants.

export interface LiveData {
  fastest: { name: string; wait: number } | null
  timeStr: string
  dowStr: string
  videoUrl: string
}

export function pickVariantIndex(groupUrl: string, date: Date = new Date()): number {
  const dayOfYear = Math.floor((date.getTime() - new Date(date.getFullYear(), 0, 0).getTime()) / 86400000)
  let hash = 0
  for (let i = 0; i < groupUrl.length; i++) hash = (hash * 31 + groupUrl.charCodeAt(i)) | 0
  return Math.abs(hash + dayOfYear) % 4
}

export function buildCaption(variantIndex: number, data: LiveData): string {
  const v = variantIndex % 4
  const { fastest, timeStr, dowStr, videoUrl } = data
  const fastestLine = fastest
    ? `${fastest.name} está en ${fastest.wait} min ahorita.`
    : 'Checa los tiempos ahorita.'

  switch (v) {
    case 0:
      return `Buenas ${dowStr}, ¿cómo anda el puente?

${fastestLine}

Los tiempos en vivo de todos los puentes del valle los pueden ver aquí:
cruzar.app

Gratis, sin tener que andar preguntando en los grupos.`

    case 1:
      return `Alguien cruzando ahorita (${timeStr})?

${fastestLine}

Cruzar muestra los tiempos en vivo de TODOS los puentes (McAllen, Brownsville, Laredo, Eagle Pass, El Paso). Reportes de la raza + datos oficiales.

Está en cruzar.app, funciona desde el navegador.`

    case 2:
      return `Pa' los que van a cruzar hoy:

${fastestLine}

Cansado de andar preguntando "cómo está el puente" en los grupos?

cruzar.app te muestra los tiempos en vivo de cada puente del valle + reportes de la gente que acaba de cruzar. Gratis.`

    case 3:
      return `Tiempos de espera actualizados — ${timeStr} ${dowStr}

${fastestLine}

cruzar.app tiene todos los puentes en vivo, reportes de la comunidad sobre qué carril está moviendo, y alertas cuando baja la fila. Sin descargar app, funciona en el navegador.

Pa' los primeros 1000 cuentas, 3 meses de Pro gratis.`
  }
  return ''
}

export function buildLiveData(videoUrl: string): Promise<LiveData> {
  return fetchCruzarData(videoUrl)
}

async function fetchCruzarData(videoUrl: string): Promise<LiveData> {
  const apiBase = process.env.CRUZAR_API_URL || 'https://www.cruzar.app'
  let fastest: { name: string; wait: number } | null = null
  try {
    const res = await fetch(`${apiBase}/api/ports`)
    const json = await res.json() as { ports?: { portId: string; portName?: string; vehicle?: number | null }[] }
    const rgvIds = ['230501', '230502', '230503', '535501', '535502', '230401']
    const ports = (json.ports || [])
      .filter((p) => rgvIds.includes(p.portId) && p.vehicle != null && (p.vehicle as number) >= 0)
      .sort((a, b) => (a.vehicle as number) - (b.vehicle as number))
    if (ports.length > 0) {
      const p = ports[0]
      fastest = { name: p.portName || 'tu puente', wait: p.vehicle as number }
    }
  } catch {
    /* use null fastest */
  }

  const now = new Date()
  const timeStr = now.toLocaleTimeString('es-MX', {
    hour: 'numeric',
    minute: '2-digit',
    hour12: true,
    timeZone: 'America/Chicago',
  })
  const dowStr = new Intl.DateTimeFormat('es-MX', { weekday: 'long', timeZone: 'America/Chicago' }).format(now)

  return { fastest, timeStr, dowStr, videoUrl }
}
