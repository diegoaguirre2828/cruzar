import { NextRequest, NextResponse } from 'next/server';
import { createServerClient } from '@supabase/ssr';
import { cookies } from 'next/headers';
import { TIER_LIMITS, type InsightsTier } from '@/lib/insights/stripe-tiers';

export const runtime = 'nodejs';

async function authedClient() {
  const cookieStore = await cookies();
  return createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    { cookies: { getAll: () => cookieStore.getAll() } }
  );
}

export async function GET() {
  const supabase = await authedClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: 'unauthenticated' }, { status: 401 });

  // Whitelist of fields safe to expose to the frontend. Excludes the
  // raw Stripe customer + subscription IDs (least-privilege — those
  // belong server-side only; the frontend only needs to know whether
  // a Stripe row exists, not the actual ID).
  const { data, error } = await supabase
    .from('insights_subscribers')
    .select(
      'id, tier, status, watched_port_ids, port_thresholds, briefing_enabled, briefing_local_hour, briefing_tz, language, channel_email, channel_sms, channel_whatsapp, recipient_emails, recipient_phones, anomaly_threshold_default, last_briefing_sent_at, last_anomaly_fired_at, stripe_subscription_id'
    )
    .eq('user_id', user.id)
    .maybeSingle();
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  // Convert stripe_subscription_id to a boolean flag — the frontend
  // only needs to know whether to show the billing-portal button, not
  // the actual ID.
  const subscriber = data
    ? {
        ...data,
        has_stripe_subscription: !!data.stripe_subscription_id,
        stripe_subscription_id: undefined,
      }
    : null;
  return NextResponse.json({ subscriber });
}

interface PrefsBody {
  tier?: InsightsTier;
  watched_port_ids?: string[];
  port_thresholds?: Record<string, number>;
  briefing_enabled?: boolean;
  briefing_local_hour?: number;
  briefing_tz?: string;
  language?: 'en' | 'es';
  channel_email?: boolean;
  channel_sms?: boolean;
  channel_whatsapp?: boolean;
  recipient_emails?: string[];
  recipient_phones?: string[];
  anomaly_threshold_default?: number;
}

export async function PUT(req: NextRequest) {
  const supabase = await authedClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: 'unauthenticated' }, { status: 401 });

  const body = (await req.json()) as PrefsBody;

  const { data: current } = await supabase
    .from('insights_subscribers')
    .select('tier')
    .eq('user_id', user.id)
    .maybeSingle();
  const tier: InsightsTier = (current?.tier as InsightsTier) ?? 'free';
  const limits = TIER_LIMITS[tier];

  if (body.watched_port_ids && body.watched_port_ids.length > limits.maxWatchedPorts) {
    return NextResponse.json({ error: `tier_${tier}_max_${limits.maxWatchedPorts}_ports` }, { status: 400 });
  }
  if (body.recipient_emails && body.recipient_emails.length > limits.maxRecipientEmails) {
    return NextResponse.json({ error: `tier_${tier}_max_${limits.maxRecipientEmails}_emails` }, { status: 400 });
  }
  if (body.recipient_phones && body.recipient_phones.length > limits.maxRecipientPhones) {
    return NextResponse.json({ error: `tier_${tier}_max_${limits.maxRecipientPhones}_phones` }, { status: 400 });
  }
  if (body.channel_sms && !limits.channels.sms) {
    return NextResponse.json({ error: `tier_${tier}_no_sms` }, { status: 400 });
  }
  if (body.channel_whatsapp && !limits.channels.whatsapp) {
    return NextResponse.json({ error: `tier_${tier}_no_whatsapp` }, { status: 400 });
  }
  if (body.briefing_local_hour !== undefined && (body.briefing_local_hour < 0 || body.briefing_local_hour > 23)) {
    return NextResponse.json({ error: 'briefing_local_hour_out_of_range' }, { status: 400 });
  }

  const update = { ...body, user_id: user.id, updated_at: new Date().toISOString() };
  const { data, error } = await supabase
    .from('insights_subscribers')
    .upsert(update, { onConflict: 'user_id' })
    .select('*')
    .single();
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ subscriber: data });
}
