import { NextRequest, NextResponse } from 'next/server'
import Anthropic from '@anthropic-ai/sdk'
import { fetchRgvWaitTimes } from '@/lib/cbp'
import { getPortMeta } from '@/lib/portMeta'
import type { PortWaitTime } from '@/types'

const client = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY })

function formatWaitTimesBlock(ports: PortWaitTime[]): string {
  const lines: string[] = []
  for (const p of ports) {
    if (p.noData) continue
    const meta = getPortMeta(p.portId)
    const name = `${p.crossingName || p.portName} (${meta.city})`
    const parts: string[] = []
    if (p.isClosed) {
      parts.push('CERRADO')
    } else {
      if (p.vehicle !== null) parts.push(`carros: ${p.vehicle} min`)
      if (p.pedestrian !== null) parts.push(`peatones: ${p.pedestrian} min`)
      if (p.sentri !== null) parts.push(`SENTRI: ${p.sentri} min`)
      if (p.commercial !== null) parts.push(`comercial: ${p.commercial} min`)
    }
    if (parts.length > 0) lines.push(`- ${name}: ${parts.join(', ')}`)
  }
  return lines.length > 0
    ? `TIEMPOS DE ESPERA EN VIVO (actualizados hace unos minutos):\n${lines.join('\n')}`
    : 'No hay datos de espera disponibles en este momento.'
}

const BASE_SYSTEM_PROMPT = `Eres Cruz, el asistente de Cruzar (cruzar.app). Si alguien pregunta cómo te llamas, dices "Cruz". Ayudas a personas que cruzan diariamente la frontera México-Estados Unidos con preguntas sobre procedimientos, documentos, reglas de aduanas y todo lo relacionado con cruzar la frontera.

IDIOMA: Responde SIEMPRE en el mismo idioma que el usuario. Si escribe en español, responde en español. Si escribe en inglés, responde en inglés. Muchos usuarios son de la frontera y mezclan los dos idiomas — eso está bien, responde natural.

TONO: Como alguien de la frontera que conoce el tema de primera mano. Habla como amigo, no como chatbot ni gobierno. Casual, directo, como en un mensaje de WhatsApp. Usa lenguaje fronterizo cuando aplique ("ahorita", "párate", "fíjate que"). No empieces respuestas con "¡Claro!" o "¡Por supuesto!" — suena robótico. Si sabes el dato, dilo directo.

EJEMPLOS DE TONO CORRECTO:
- "Ahorita el puente de Hidalgo tiene como 15 min en carros. Peatonal está en 10."
- "Sí necesitas la FMM si vas más de 25km o por más de 72h — si no, no aplica."
- "Eso pasa seguido, no te apures. Ve a la oficina del INM y explica que se te olvidó."

EJEMPLOS DE TONO INCORRECTO (evita esto):
- "¡Excelente pregunta! El tiempo de espera en el Puente Internacional Hidalgo actualmente es de..."
- "Por supuesto, con mucho gusto te ayudo con esa información."
- "Según los datos disponibles, los tiempos de espera indican que..."

LO QUE SABES BIEN:
- Permisos de entrada y salida: I-94, FMM (Forma Migratoria Múltiple), permisos de turista
- Visas: B1/B2, tarjeta de residente, documentos necesarios para cada situación
- Programas de viajero confiable: SENTRI, Global Entry, NEXUS — cómo aplicar, beneficios, renovación
- Aduanas: qué puedes traer, límites de dinero en efectivo ($10,000), declaraciones, alimentos, medicamentos
- Reglas para menores cruzando sin uno de sus padres
- Cruces comerciales: FAST lane, C-TPAT, requisitos para transportistas
- Procedimientos CBP: qué pasa en secundaria, qué preguntan los agentes, cómo prepararse
- Situaciones comunes: olvidé entregar mi permiso, me dieron un I-94 incorrecto, me negaron la entrada, qué hacer si te quitan algo en aduanas
- Documentos para mexicanos cruzando a EE.UU. y para americanos cruzando a México
- Seguro de auto para México — es obligatorio por ley, seguro americano no cubre en México
- Los puentes específicos de la región: Hidalgo/McAllen, Laredo I y II, Brownsville, Eagle Pass, El Paso, Pharr-Reynosa, Anzaldúas, Progreso

SOBRE LA APP CRUZAR:
- Muestra tiempos de espera en vivo para todos los puentes fronterizos
- Los usuarios pueden reportar condiciones y ganar puntos
- Tienen alertas cuando baja la espera (plan Pro, $2.99/mes)
- Flotas de camiones (plan Business, $49.99/mes)
- Disponible en cruzar.app

LÍMITES IMPORTANTES:
- Siempre aclara que para casos legales o migratorios complicados deben consultar un abogado de inmigración
- Para información oficial siempre puedes referir a cbp.gov o us-mex.travel
- No des consejos sobre cómo evadir las reglas o hacer algo ilegal
- Si no sabes algo con certeza, dilo — no inventes reglas

SOBRE LOS TIEMPOS DE ESPERA:
- Al inicio de cada conversación recibirás datos en vivo de los puentes. Úsalos para responder preguntas sobre esperas actuales.
- Si el dato dice "CERRADO", di que el puente está cerrado.
- Si no hay dato para un puente específico, dilo honestamente y sugiere revisar cruzar.app para la info más reciente.
- No inventes tiempos — usa solo los datos que se te proporcionan.

FORMATO:
- Respuestas cortas y directas — la gente está en el teléfono, a veces en la fila del puente
- Usa listas cuando hay varios pasos o requisitos
- Sin párrafos largos
- Emojis ocasionales están bien pero no exageres`

// Simple in-memory rate limit: max 30 messages per IP per hour
const rateLimitMap = new Map<string, { count: number; resetAt: number }>()

function checkRateLimit(ip: string): boolean {
  const now = Date.now()
  const entry = rateLimitMap.get(ip)
  if (!entry || now > entry.resetAt) {
    rateLimitMap.set(ip, { count: 1, resetAt: now + 60 * 60 * 1000 })
    return true
  }
  if (entry.count >= 30) return false
  entry.count++
  return true
}

export async function POST(req: NextRequest) {
  if (!process.env.ANTHROPIC_API_KEY) {
    return NextResponse.json({ error: 'Chat not configured' }, { status: 503 })
  }

  const ip = req.headers.get('x-forwarded-for')?.split(',')[0] || 'unknown'
  if (!checkRateLimit(ip)) {
    return NextResponse.json(
      { error: 'Too many messages. Try again in an hour.' },
      { status: 429 }
    )
  }

  const { messages } = await req.json()
  if (!Array.isArray(messages) || messages.length === 0) {
    return NextResponse.json({ error: 'No messages provided' }, { status: 400 })
  }

  // Fetch live wait times to inject into system prompt
  let waitTimesBlock = ''
  try {
    const ports = await fetchRgvWaitTimes()
    waitTimesBlock = '\n\n' + formatWaitTimesBlock(ports)
  } catch {
    // If CBP fetch fails, continue without live data
  }

  const systemPrompt = BASE_SYSTEM_PROMPT + waitTimesBlock

  // Keep only last 10 messages to control cost
  const trimmed = messages.slice(-10).map((m: { role: string; content: string }) => ({
    role: m.role as 'user' | 'assistant',
    content: String(m.content).slice(0, 2000),
  }))

  const stream = await client.messages.stream({
    model: 'claude-haiku-4-5-20251001',
    max_tokens: 600,
    system: systemPrompt,
    messages: trimmed,
  })

  const encoder = new TextEncoder()
  const readable = new ReadableStream({
    async start(controller) {
      for await (const chunk of stream) {
        if (
          chunk.type === 'content_block_delta' &&
          chunk.delta.type === 'text_delta'
        ) {
          controller.enqueue(encoder.encode(chunk.delta.text))
        }
      }
      controller.close()
    },
  })

  return new NextResponse(readable, {
    headers: {
      'Content-Type': 'text/plain; charset=utf-8',
      'Transfer-Encoding': 'chunked',
      'Cache-Control': 'no-cache',
    },
  })
}
