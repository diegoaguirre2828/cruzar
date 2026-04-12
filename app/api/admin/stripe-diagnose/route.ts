import { NextResponse } from 'next/server'
import { createServerClient } from '@supabase/ssr'
import { cookies } from 'next/headers'
import Stripe from 'stripe'

export const dynamic = 'force-dynamic'

const ADMIN_EMAIL = 'cruzabusiness@gmail.com'

/**
 * Stripe diagnostic — admin only.
 *
 * Reads the Stripe env vars, reports their shape (not the secrets), and
 * makes a minimal live call to Stripe to surface the actual error instead
 * of the generic "connection to Stripe" SDK message the checkout route
 * throws.
 *
 * Visit /api/admin/stripe-diagnose while signed in as admin.
 */
export async function GET() {
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

  const envReport: Record<string, unknown> = {}

  const rawSecret = process.env.STRIPE_SECRET_KEY
  envReport.STRIPE_SECRET_KEY = describeSecret(rawSecret)

  const rawPubKey = process.env.NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY
  envReport.NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY = describeSecret(rawPubKey)

  const proPriceId = process.env.STRIPE_PRO_PRICE_ID
  envReport.STRIPE_PRO_PRICE_ID = describePriceId(proPriceId)

  const bizPriceId = process.env.STRIPE_BUSINESS_PRICE_ID
  envReport.STRIPE_BUSINESS_PRICE_ID = describePriceId(bizPriceId)

  const webhookSecret = process.env.STRIPE_WEBHOOK_SECRET
  envReport.STRIPE_WEBHOOK_SECRET = describeSecret(webhookSecret)

  // Modes must match — if secret is sk_live but publishable is pk_test, stripe will fail
  const secretMode  = rawSecret?.startsWith('sk_live_')  ? 'live' : rawSecret?.startsWith('sk_test_')  ? 'test' : 'unknown'
  const pubMode     = rawPubKey?.startsWith('pk_live_')   ? 'live' : rawPubKey?.startsWith('pk_test_')  ? 'test' : 'unknown'
  envReport.mode_match = secretMode === pubMode ? `✓ both ${secretMode}` : `✗ secret=${secretMode} pub=${pubMode}`

  if (!rawSecret) {
    return NextResponse.json({
      ok: false,
      env: envReport,
      error: 'STRIPE_SECRET_KEY is not set in env',
    })
  }

  // Actually call Stripe with a trivial request to surface the real error.
  // /v1/balance is the cheapest account-level read.
  let liveCall: Record<string, unknown> = {}
  try {
    const stripe = new Stripe(rawSecret)
    const balance = await stripe.balance.retrieve()
    liveCall = {
      ok: true,
      currency: balance.available?.[0]?.currency || null,
      note: 'Stripe accepts the secret key and returned an account balance.',
    }
  } catch (err: unknown) {
    const e = err as {
      type?: string
      code?: string
      statusCode?: number
      message?: string
      raw?: { message?: string; code?: string }
    }
    liveCall = {
      ok: false,
      type: e.type || 'unknown',
      code: e.code || e.raw?.code || null,
      statusCode: e.statusCode || null,
      message: e.message || null,
      rawMessage: e.raw?.message || null,
    }
  }

  // Try to load each plan's price too, in case the secret is OK but the
  // price IDs are wrong (a common post-test-mode gotcha)
  const priceChecks: Record<string, unknown> = {}
  try {
    const stripe = new Stripe(rawSecret)
    for (const [name, pid] of [['pro', proPriceId], ['business', bizPriceId]] as const) {
      if (!pid) { priceChecks[name] = 'missing env var'; continue }
      try {
        const price = await stripe.prices.retrieve(pid)
        priceChecks[name] = {
          ok: true,
          id: price.id,
          active: price.active,
          unit_amount: price.unit_amount,
          currency: price.currency,
          recurring: price.recurring ? { interval: price.recurring.interval } : null,
        }
      } catch (err: unknown) {
        const e = err as { message?: string; code?: string; raw?: { message?: string } }
        priceChecks[name] = {
          ok: false,
          error: e.message || e.raw?.message || 'unknown',
          code: e.code || null,
        }
      }
    }
  } catch {
    /* already reported in liveCall */
  }

  return NextResponse.json({
    ok: liveCall.ok === true,
    env: envReport,
    liveCall,
    priceChecks,
  })
}

function describeSecret(v: string | undefined): Record<string, unknown> {
  if (!v) return { set: false }
  const trimmed = v.trim()
  const hasLeadingSpace = v.length !== v.trimStart().length
  const hasTrailingSpace = v.length !== v.trimEnd().length
  const hasNewline = /[\r\n]/.test(v)
  return {
    set: true,
    length: v.length,
    prefix: v.slice(0, 8),
    suffix: v.slice(-4),
    hasLeadingSpace,
    hasTrailingSpace,
    hasNewline,
    trimmedLength: trimmed.length,
    matches_trimmed: trimmed === v,
  }
}

function describePriceId(v: string | undefined): Record<string, unknown> {
  if (!v) return { set: false }
  return {
    set: true,
    value: v,
    looksLikePriceId: /^price_/.test(v),
    hasWhitespace: /\s/.test(v),
  }
}
