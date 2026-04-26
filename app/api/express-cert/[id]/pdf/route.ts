import { NextRequest, NextResponse } from 'next/server'
import { createServerClient } from '@supabase/ssr'
import { cookies } from 'next/headers'
import { getServiceClient } from '@/lib/supabase'
import { PDFDocument, StandardFonts, rgb } from 'pdf-lib'

export const dynamic = 'force-dynamic'
export const maxDuration = 30

// GET /api/express-cert/[id]/pdf
//
// Server-side PDF generation for the Express Cert generated
// narrative. Replaces the browser-print path with a real
// downloadable PDF that looks the same on every device.
// Owner-only: only the user who created the application can fetch.

export async function GET(req: NextRequest, ctx: { params: Promise<{ id: string }> }) {
  const { id } = await ctx.params
  const cookieStore = await cookies()
  const supabase = createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    { cookies: { getAll: () => cookieStore.getAll() } }
  )
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Sign in.' }, { status: 401 })

  const db = getServiceClient()
  const { data: app } = await db
    .from('express_cert_applications')
    .select('id, user_id, program, status, generated_pdf_url, generated_at')
    .eq('id', id)
    .maybeSingle()
  if (!app || app.user_id !== user.id) return NextResponse.json({ error: 'Not found' }, { status: 404 })
  if (app.status !== 'generated' || !app.generated_pdf_url) {
    return NextResponse.json({ error: 'Application not generated yet' }, { status: 409 })
  }

  const md = String(app.generated_pdf_url)
  const programLabel = app.program === 'ctpat'
    ? 'C-TPAT (US Customs and Border Protection)'
    : 'OEA (SAT — Operador Económico Autorizado)'

  const pdf = await PDFDocument.create()
  pdf.setTitle(`Cruzar Express Cert · ${programLabel}`)
  pdf.setAuthor('Cruzar')
  pdf.setProducer('Cruzar Express Cert')
  pdf.setCreationDate(app.generated_at ? new Date(app.generated_at) : new Date())

  const helv = await pdf.embedFont(StandardFonts.Helvetica)
  const helvBold = await pdf.embedFont(StandardFonts.HelveticaBold)
  const helvOblique = await pdf.embedFont(StandardFonts.HelveticaOblique)

  // Letter portrait: 612 × 792
  const PAGE_W = 612
  const PAGE_H = 792
  const MARGIN = 54
  const LINE = 14

  let page = pdf.addPage([PAGE_W, PAGE_H])
  let cursorY = PAGE_H - MARGIN

  function newPage() {
    page = pdf.addPage([PAGE_W, PAGE_H])
    cursorY = PAGE_H - MARGIN
  }

  function spaceFor(pixels: number) {
    if (cursorY - pixels < MARGIN) newPage()
  }

  // Wrap text by max line width in chars (rough estimate per font metric)
  function wrap(text: string, font: typeof helv, size: number, maxWidth: number): string[] {
    const words = text.split(/\s+/)
    const lines: string[] = []
    let line = ''
    for (const w of words) {
      const test = line ? `${line} ${w}` : w
      const width = font.widthOfTextAtSize(test, size)
      if (width <= maxWidth) line = test
      else {
        if (line) lines.push(line)
        line = w
      }
    }
    if (line) lines.push(line)
    return lines
  }

  function drawLine(text: string, opts: { font?: typeof helv; size?: number; color?: ReturnType<typeof rgb>; gapAfter?: number; indent?: number } = {}) {
    const font = opts.font || helv
    const size = opts.size || 10
    const color = opts.color || rgb(0.1, 0.1, 0.15)
    const gapAfter = opts.gapAfter ?? LINE
    const indent = opts.indent || 0
    const lines = wrap(text, font, size, PAGE_W - MARGIN * 2 - indent)
    for (const l of lines) {
      spaceFor(size + 2)
      page.drawText(l, { x: MARGIN + indent, y: cursorY, size, font, color })
      cursorY -= size + 4
    }
    cursorY -= gapAfter - (size + 4)
  }

  // Header
  drawLine('CRUZAR EXPRESS CERT', { font: helvBold, size: 9, color: rgb(0.4, 0.45, 0.55), gapAfter: 4 })
  drawLine(programLabel, { font: helvBold, size: 18, color: rgb(0.06, 0.09, 0.16), gapAfter: 6 })
  drawLine(`Generated: ${app.generated_at ? new Date(app.generated_at).toISOString().slice(0, 16).replace('T', ' ') : '—'} UTC`, {
    font: helvOblique, size: 9, color: rgb(0.4, 0.45, 0.55), gapAfter: 18,
  })
  // Divider
  page.drawLine({ start: { x: MARGIN, y: cursorY + 6 }, end: { x: PAGE_W - MARGIN, y: cursorY + 6 }, thickness: 0.5, color: rgb(0.8, 0.82, 0.86) })
  cursorY -= 6

  // Markdown rendering — handles ## H2, ### H3, list bullets, plain paragraphs
  const lines = md.split(/\r?\n/)
  for (const raw of lines) {
    const line = raw.trim()
    if (!line) { cursorY -= 6; continue }

    const h2 = line.match(/^##\s+(.*)$/)
    if (h2) {
      cursorY -= 6
      drawLine(h2[1], { font: helvBold, size: 13, color: rgb(0.06, 0.09, 0.16), gapAfter: 6 })
      page.drawLine({ start: { x: MARGIN, y: cursorY + 4 }, end: { x: PAGE_W - MARGIN, y: cursorY + 4 }, thickness: 0.4, color: rgb(0.85, 0.88, 0.92) })
      cursorY -= 6
      continue
    }
    const h3 = line.match(/^###\s+(.*)$/)
    if (h3) {
      drawLine(h3[1], { font: helvBold, size: 11, color: rgb(0.18, 0.22, 0.32), gapAfter: 6 })
      continue
    }
    const bullet = line.match(/^[-*]\s+(.*)$/)
    if (bullet) {
      drawLine(`• ${bullet[1]}`, { indent: 12, gapAfter: 6 })
      continue
    }
    const num = line.match(/^\d+\.\s+(.*)$/)
    if (num) {
      drawLine(line, { indent: 12, gapAfter: 6 })
      continue
    }
    drawLine(line, { gapAfter: 8 })
  }

  // Footer on last page
  spaceFor(40)
  cursorY -= 12
  page.drawLine({ start: { x: MARGIN, y: cursorY + 6 }, end: { x: PAGE_W - MARGIN, y: cursorY + 6 }, thickness: 0.4, color: rgb(0.85, 0.88, 0.92) })
  cursorY -= 6
  drawLine('This document was AI-generated by Cruzar Express Cert from your submitted answers. Review every section, complete any [TODO — provide:] placeholders, and follow the "Next Steps" instructions before submitting to the certifying agency.', {
    font: helvOblique, size: 8, color: rgb(0.4, 0.45, 0.55), gapAfter: 4,
  })

  const bytes = await pdf.save()

  return new NextResponse(Buffer.from(bytes), {
    status: 200,
    headers: {
      'Content-Type': 'application/pdf',
      'Content-Disposition': `attachment; filename="cruzar-express-cert-${app.program}-${id.slice(0, 8)}.pdf"`,
      'Cache-Control': 'private, no-store',
    },
  })
}
