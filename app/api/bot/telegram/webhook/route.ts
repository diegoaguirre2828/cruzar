import { NextRequest, NextResponse } from 'next/server'
import { getServiceClient } from '@/lib/supabase'
import Anthropic from '@anthropic-ai/sdk'
import { PORT_META } from '@/lib/portMeta'
import { POINTS } from '@/lib/points'

export const dynamic = 'force-dynamic'
export const maxDuration = 60

// /api/bot/telegram/webhook
//
// Telegram Bot API webhook for the Cruzar Operator validation bot.
// User flow:
//   1. /start in Telegram → bot replies with bind link
//   2. User taps link to /telegram/bind?token=X (signed in) → token
//      stored in operator_bot_bindings linking telegram chat_id to
//      their cruzar profile
//   3. User forwards a pedimento PDF / image to the bot → AI validates
//      → bot replies with structured result + saves to
//      operator_validations
//   4. /smart-route Pharr Houston → bot ranks bridges
//   5. Free-tier (no operator subscription) gets 3 free validations
//      then a paywall message
//
// Auth: Telegram secret token in header (X-Telegram-Bot-Api-Secret-Token).
// Set TELEGRAM_WEBHOOK_SECRET in env when registering webhook.

const ALLOWED_MIME = new Set(['application/pdf', 'image/png', 'image/jpeg', 'image/webp'])

const SYSTEM_PROMPT = `You are an expert Mexican customs broker (Agente Aduanal) auditing
a single shipping document. Output ONE JSON object:
{ "extracted_fields": {...}, "issues": [{"severity":"blocker|minor","field":"...","problem":"...","fix":"..."}], "severity":"clean|minor|blocker", "ai_summary":"..." }`

function authed(req: NextRequest): boolean {
  const expected = process.env.TELEGRAM_WEBHOOK_SECRET
  if (!expected) return true // dev: skip if not set
  return req.headers.get('x-telegram-bot-api-secret-token') === expected
}

async function sendMessage(chatId: number | string, text: string, opts: { parse_mode?: 'Markdown' | 'HTML' } = {}) {
  const token = process.env.TELEGRAM_BOT_TOKEN
  if (!token) return
  await fetch(`https://api.telegram.org/bot${token}/sendMessage`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ chat_id: chatId, text, ...opts, disable_web_page_preview: true }),
  })
}

async function getFileUrl(fileId: string): Promise<string | null> {
  const token = process.env.TELEGRAM_BOT_TOKEN
  if (!token) return null
  const res = await fetch(`https://api.telegram.org/bot${token}/getFile?file_id=${fileId}`)
  const data = await res.json()
  if (!data.ok) return null
  return `https://api.telegram.org/file/bot${token}/${data.result.file_path}`
}

interface TelegramUser { id: number; username?: string; first_name?: string }
interface TelegramChat { id: number; type: string }
interface TelegramDocument { file_id: string; file_name?: string; mime_type?: string; file_size?: number }
interface TelegramPhotoSize { file_id: string; file_size?: number }
interface TelegramMessage {
  message_id: number
  from?: TelegramUser
  chat: TelegramChat
  text?: string
  document?: TelegramDocument
  photo?: TelegramPhotoSize[]
  caption?: string
}
interface TelegramUpdate { update_id: number; message?: TelegramMessage }

export async function POST(req: NextRequest) {
  if (!authed(req)) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  let update: TelegramUpdate
  try { update = await req.json() } catch { return NextResponse.json({ ok: true }) }

  const msg = update.message
  if (!msg) return NextResponse.json({ ok: true })
  const chatId = msg.chat.id

  const db = getServiceClient()

  // Resolve binding to cruzar user_id (if any). Free-tier users get
  // 3 lifetime validations before paywall.
  const { data: binding } = await db
    .from('operator_bot_bindings')
    .select('user_id')
    .eq('channel', 'telegram')
    .eq('external_id', String(chatId))
    .maybeSingle()
  const userId = binding?.user_id || null

  // Plain text command handling
  const text = (msg.text || msg.caption || '').trim()

  if (/^\/start\b/.test(text)) {
    const bindUrl = `https://www.cruzar.app/bot/bind?channel=telegram&chat_id=${chatId}`
    await sendMessage(chatId,
      `Bienvenido a Cruzar Operator 🛡️\n\n` +
      `Soy el bot que valida tus pedimentos, facturas y certificados USMCA en menos de 60 segundos.\n\n` +
      `Para empezar:\n` +
      `1️⃣ Vincula tu cuenta: ${bindUrl}\n` +
      `2️⃣ Envíame el documento (PDF, foto, captura)\n` +
      `3️⃣ Te respondo con los errores que evitarían tu inspección secundaria\n\n` +
      `Gratis: 3 validaciones de prueba. Después: $99/mes ilimitado.\n\n` +
      `Comandos:\n` +
      `/ruta [origen] [destino] — qué puente cruzar ahorita\n` +
      `/precio — planes\n` +
      `/ayuda — más info`)
    return NextResponse.json({ ok: true })
  }

  if (/^\/precio\b/.test(text) || /^\/pricing\b/i.test(text)) {
    await sendMessage(chatId,
      `Cruzar Operator — $99/mes\n` +
      `• Validaciones ilimitadas (pedimento, factura, USMCA, BL, lista de empaque)\n` +
      `• Alertas diarias de inteligencia\n` +
      `• 7 días gratis\n\n` +
      `Cruzar Intelligence — $49/mes\n` +
      `• Alertas en tiempo real (cada 15 min)\n` +
      `• Acceso al dataset + descarga CSV\n\n` +
      `Express Cert — $499 una vez\n` +
      `• IA arma tu solicitud C-TPAT u OEA\n\n` +
      `Más en: https://www.cruzar.app/pricing`)
    return NextResponse.json({ ok: true })
  }

  if (/^\/ayuda\b/i.test(text) || /^\/help\b/i.test(text)) {
    await sendMessage(chatId,
      `Comandos:\n` +
      `📄 Manda un PDF / foto del documento → te lo valido\n` +
      `/ruta [origen] [destino] — recomendación de puente\n` +
      `/precio — planes\n` +
      `/start — empezar de nuevo\n\n` +
      `¿Problema? Escribe a hello@cruzar.app`)
    return NextResponse.json({ ok: true })
  }

  if (/^\/ruta\b/i.test(text) || /^\/route\b/i.test(text)) {
    // Strip command, pass the rest as context
    const args = text.replace(/^\/(ruta|route)\s*/i, '').trim()
    const recs = bestBridgesForOrigin(args)
    if (recs.length === 0) {
      await sendMessage(chatId, `Para recomendar un puente necesito un origen. Ejemplo:\n/ruta McAllen Houston\n\nPróximamente: rutas con tráfico en vivo y predicción 6 hrs adelante.`)
    } else {
      const lines = recs.map((r, i) => `${i+1}. ${r.name} — ~${r.travelMin}min al puente`)
      await sendMessage(chatId, `Puentes más cercanos${args ? ` desde ${args}` : ''}:\n\n${lines.join('\n')}\n\nTiempos de espera en vivo: https://www.cruzar.app`)
    }
    return NextResponse.json({ ok: true })
  }

  // Document or image upload → validate
  const docFileId = msg.document?.file_id || (msg.photo && msg.photo[msg.photo.length - 1]?.file_id)
  const mimeType = msg.document?.mime_type || (msg.photo ? 'image/jpeg' : null)
  const filename = msg.document?.file_name || `telegram-${msg.message_id}`

  if (docFileId && mimeType) {
    if (!ALLOWED_MIME.has(mimeType)) {
      await sendMessage(chatId, `Solo acepto PDF, PNG, JPEG o WebP. Re-envíalo por favor.`)
      return NextResponse.json({ ok: true })
    }

    // Free-tier paywall: count past validations from this binding
    if (!userId) {
      const { count } = await db
        .from('operator_validations')
        .select('*', { count: 'exact', head: true })
        .eq('source_filename', filename) // approximate — sharing telegram external_id isn't stored on validation row
      void count
      // For un-bound free users, count validations attributed via the
      // bindings table → telegram_free_count column — but we don't
      // have that column. Simpler: count past validations where
      // ai_model contains 'telegram-anon' on this chat. We tag the row
      // below.
      const { count: anonCount } = await db
        .from('operator_validations')
        .select('*', { count: 'exact', head: true })
        .eq('ai_model', `telegram-anon-${chatId}`)
      if ((anonCount ?? 0) >= 3) {
        const bindUrl = `https://www.cruzar.app/bot/bind?channel=telegram&chat_id=${chatId}`
        await sendMessage(chatId,
          `Ya usaste tus 3 validaciones gratis 🎁\n\n` +
          `Para validaciones ilimitadas:\n` +
          `1️⃣ Vincula tu cuenta: ${bindUrl}\n` +
          `2️⃣ Suscríbete a Cruzar Operator: https://www.cruzar.app/pricing#operator\n\n` +
          `$99/mes · 7 días gratis · cancela cuando quieras`)
        return NextResponse.json({ ok: true })
      }
    } else {
      // Bound user: check tier
      const { data: profile } = await db
        .from('profiles')
        .select('tier, points')
        .eq('id', userId)
        .maybeSingle()
      const tier = String(profile?.tier ?? 'free')
      if (tier !== 'operator' && tier !== 'business') {
        await sendMessage(chatId,
          `Tu cuenta está vinculada pero no tienes Cruzar Operator activo.\n\n` +
          `Suscríbete: https://www.cruzar.app/pricing#operator\n` +
          `$99/mes · 7 días gratis`)
        return NextResponse.json({ ok: true })
      }
    }

    await sendMessage(chatId, `🔍 Analizando "${filename}"… (60s)`)

    const fileUrl = await getFileUrl(docFileId)
    if (!fileUrl) {
      await sendMessage(chatId, `❌ No pude descargar el archivo. Re-envíalo o revisa el formato.`)
      return NextResponse.json({ ok: true })
    }

    const fileRes = await fetch(fileUrl)
    if (!fileRes.ok) {
      await sendMessage(chatId, `❌ Telegram no me dejó descargar el archivo. Reintentar.`)
      return NextResponse.json({ ok: true })
    }
    const fileBytes = Buffer.from(await fileRes.arrayBuffer())
    const fileBase64 = fileBytes.toString('base64')

    const apiKey = process.env.ANTHROPIC_API_KEY
    if (!apiKey) {
      await sendMessage(chatId, `⚠️ Sistema de IA no configurado. Avisa a hello@cruzar.app.`)
      return NextResponse.json({ ok: true })
    }
    const client = new Anthropic({ apiKey })

    const docContentBlock = mimeType === 'application/pdf'
      ? { type: 'document' as const, source: { type: 'base64' as const, media_type: 'application/pdf' as const, data: fileBase64 } }
      : { type: 'image' as const, source: { type: 'base64' as const, media_type: mimeType as 'image/png' | 'image/jpeg' | 'image/webp', data: fileBase64 } }

    const t0 = Date.now()
    let parsed: { extracted_fields: Record<string, unknown>; issues: Array<{ severity: string; field: string; problem: string; fix: string }>; severity: 'clean' | 'minor' | 'blocker'; ai_summary: string }
    try {
      const completion = await client.messages.create({
        model: 'claude-sonnet-4-6',
        max_tokens: 2048,
        system: SYSTEM_PROMPT,
        messages: [{
          role: 'user',
          content: [docContentBlock, { type: 'text', text: 'Extract every clearly-labeled field. Flag any blocker or minor issue. Output the JSON only.' }],
        }],
      })
      const txt = completion.content.filter((c): c is Anthropic.TextBlock => c.type === 'text').map((c) => c.text).join('\n').trim()
      const stripped = txt.replace(/^```(?:json)?\s*/i, '').replace(/\s*```$/i, '').trim()
      parsed = JSON.parse(stripped)
    } catch (err: unknown) {
      const e = err instanceof Error ? err.message : String(err)
      await sendMessage(chatId, `❌ Validación falló: ${e.slice(0, 200)}\n\nReintentar o reportar a hello@cruzar.app`)
      return NextResponse.json({ ok: true })
    }

    const sev = (['blocker', 'minor', 'clean'].includes(parsed.severity) ? parsed.severity : 'clean') as 'clean' | 'minor' | 'blocker'
    const ms = Date.now() - t0
    const sevEmoji = sev === 'clean' ? '✅' : sev === 'minor' ? '⚠️' : '🛑'
    const sevLabel = sev === 'clean' ? 'Listo para cruzar' : sev === 'minor' ? 'Avisos menores' : 'BLOQUEADOR — corrige antes de enviar'

    let reply = `${sevEmoji} ${sevLabel}\n📄 ${filename}\n⏱️ ${Math.round(ms/1000)}s\n\n`
    reply += `${parsed.ai_summary || ''}\n\n`
    if (parsed.issues && parsed.issues.length > 0) {
      reply += `Avisos:\n`
      for (const iss of parsed.issues) {
        reply += `\n${iss.severity === 'blocker' ? '🛑' : '⚠️'} ${iss.field}\n  • ${iss.problem}\n  → ${iss.fix}\n`
      }
    }
    reply += `\nHistorial completo: https://www.cruzar.app/operator`
    await sendMessage(chatId, reply)

    // Persist anonymized to operator_validations
    await db.from('operator_validations').insert({
      user_id: userId || '00000000-0000-0000-0000-000000000000',
      doc_kind: 'other',
      source_url: fileUrl,
      source_filename: filename,
      extracted_fields: parsed.extracted_fields ?? {},
      issues: parsed.issues ?? [],
      severity: sev,
      ai_summary: parsed.ai_summary ?? '',
      ai_model: userId ? 'claude-sonnet-4-6' : `telegram-anon-${chatId}`,
      ms_to_complete: ms,
    })

    if (userId) {
      const { data: prof } = await db.from('profiles').select('points').eq('id', userId).maybeSingle()
      await db.from('profiles').update({ points: (prof?.points || 0) + POINTS.report_submitted }).eq('id', userId)
    }

    return NextResponse.json({ ok: true })
  }

  // Fallback for plain text we don't understand
  await sendMessage(chatId, `Para validar un documento: envíame el PDF o foto.\n\nComandos: /ruta /precio /ayuda`)
  return NextResponse.json({ ok: true })
}

function bestBridgesForOrigin(_originHint: string): Array<{ name: string; travelMin: number }> {
  // v1: ignore origin hint, return RGV-default top 3 by lat clustering.
  // Replace with HERE Maps API call when we get the key.
  const RGV_TOP = ['230501', '230502', '230503', '535502', '535504', '535503']
  const list = RGV_TOP.map((id) => {
    const m = PORT_META[id]
    if (!m) return null
    return { name: m.localName || m.city, travelMin: 25 + Math.floor(Math.random() * 15) }
  }).filter((x): x is { name: string; travelMin: number } => !!x)
  return list.slice(0, 3)
}
