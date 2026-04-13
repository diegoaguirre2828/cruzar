import { NextRequest, NextResponse } from 'next/server'
import { createServerClient } from '@supabase/ssr'
import { cookies } from 'next/headers'

export const dynamic = 'force-dynamic'

const ADMIN_EMAIL = 'cruzabusiness@gmail.com'

// Quick-reply generator for Diego's FB group workflow.
//
// Input: a pasted FB post or comment (raw text) + optional tone hint.
// Output: 3 casual RGV-Spanish reply variants that mention cruzar punto
// app without being salesy. No emojis. Ready to paste back into FB.
//
// Uses Claude Haiku for natural-sounding variation across variants. Falls
// back to a simple "sorry I can't generate right now" message if the API
// isn't configured.

type Variant = { text: string; tone: 'empathetic' | 'practical' | 'community' }

const SYSTEM_PROMPT = `You generate replies for a Facebook border-crossing group (US-Mexico border, Spanish-speaking RGV/Matamoros audience). The user pastes a post or comment, you return THREE short casual replies in Spanish they can paste back into Facebook.

STRICT RULES:
- Write in casual RGV border Spanish (not textbook Spanish). Use "ahorita", "checa", "pa'", "uff", "caramba", "gente", "compas" etc. — same register as the original post.
- NO EMOJIS. Zero. The user is trying to avoid looking like a bot.
- Mention "cruzar punto app" (NOT cruzar.app — Facebook blocks links, so always verbal spelling). Sometimes mention it in a sentence, sometimes as an instruction "tecleen cruzar punto app en su navegador".
- Each reply must be 1-3 sentences. NOT a paragraph.
- Each reply must acknowledge or respond to the specific content of the post — don't just drop a generic Cruzar mention.
- Never be salesy. Never say "check out my app". Frame Cruzar as "the thing I use" or "the thing the community uses" or "pa la próxima" advice.
- Three tones:
    Variant 1: empathetic + validating (acknowledge their experience first, then the tip)
    Variant 2: practical / tip-forward (addresses what would help others in the same situation)
    Variant 3: community-first (frames it as something everyone uses / helpful to the group)
- NEVER use salesy phrases like "prueba", "descargala", "echenle un ojo a nuestra app".
- Don't start with "Hola" — FB replies don't need greetings.
- Don't use exclamation marks unless the original post used them.

Output ONLY valid JSON in this exact shape, no markdown:
{
  "variants": [
    { "text": "...", "tone": "empathetic" },
    { "text": "...", "tone": "practical" },
    { "text": "...", "tone": "community" }
  ]
}`

export async function POST(req: NextRequest) {
  const cookieStore = await cookies()
  const supabase = createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    { cookies: { getAll: () => cookieStore.getAll() } }
  )
  const { data: { user } } = await supabase.auth.getUser()
  if (!user || user.email !== ADMIN_EMAIL) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  const apiKey = process.env.ANTHROPIC_API_KEY
  if (!apiKey) {
    return NextResponse.json({ error: 'ANTHROPIC_API_KEY not set' }, { status: 500 })
  }

  let body: { context?: string }
  try { body = await req.json() } catch { return NextResponse.json({ error: 'Invalid JSON' }, { status: 400 }) }

  const context = (body.context || '').trim()
  if (!context) return NextResponse.json({ error: 'Missing context' }, { status: 400 })
  if (context.length > 4000) return NextResponse.json({ error: 'Context too long' }, { status: 400 })

  try {
    const res = await fetch('https://api.anthropic.com/v1/messages', {
      method: 'POST',
      headers: {
        'x-api-key': apiKey,
        'anthropic-version': '2023-06-01',
        'content-type': 'application/json',
      },
      body: JSON.stringify({
        model: 'claude-haiku-4-5-20251001',
        max_tokens: 900,
        system: SYSTEM_PROMPT,
        messages: [{
          role: 'user',
          content: `Post/comment from the FB group:\n"""\n${context}\n"""\n\nGenerate 3 variants.`,
        }],
      }),
    })
    if (!res.ok) {
      const errText = await res.text().catch(() => '')
      console.error('Anthropic API error:', res.status, errText)
      return NextResponse.json({ error: `Anthropic ${res.status}` }, { status: 502 })
    }
    const data = await res.json()
    const raw = data?.content?.[0]?.text?.trim() || ''
    const jsonStr = raw.replace(/^```json\s*/, '').replace(/\s*```$/, '').trim()
    const parsed = JSON.parse(jsonStr) as { variants: Variant[] }

    if (!parsed?.variants || !Array.isArray(parsed.variants) || parsed.variants.length === 0) {
      return NextResponse.json({ error: 'Malformed response' }, { status: 502 })
    }

    return NextResponse.json({ variants: parsed.variants })
  } catch (err) {
    console.error('quick-reply error:', err)
    return NextResponse.json({ error: err instanceof Error ? err.message : String(err) }, { status: 500 })
  }
}
