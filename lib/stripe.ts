import Stripe from 'stripe'

// Trim every Stripe env var. Vercel's env UI silently preserves trailing
// newlines when you copy-paste from a terminal or dashboard, and the Stripe
// SDK puts STRIPE_SECRET_KEY into the Authorization header verbatim — a
// stray \n there breaks HTTP header formatting and Stripe returns a generic
// "connection error" after two retries, which is nearly impossible to
// diagnose without a dedicated tool. Trim defensively at the source.
const STRIPE_SECRET_KEY = process.env.STRIPE_SECRET_KEY?.trim()
const STRIPE_PRO_PRICE_ID = process.env.STRIPE_PRO_PRICE_ID?.trim()
const STRIPE_BUSINESS_PRICE_ID = process.env.STRIPE_BUSINESS_PRICE_ID?.trim()
const STRIPE_OPERATOR_PRICE_ID = process.env.STRIPE_OPERATOR_PRICE_ID?.trim()
const STRIPE_EXPRESS_CERT_PRICE_ID = process.env.STRIPE_EXPRESS_CERT_PRICE_ID?.trim()
const STRIPE_INTELLIGENCE_PRICE_ID = process.env.STRIPE_INTELLIGENCE_PRICE_ID?.trim()
const STRIPE_INTELLIGENCE_ENTERPRISE_PRICE_ID = process.env.STRIPE_INTELLIGENCE_ENTERPRISE_PRICE_ID?.trim()

// Intentionally do NOT pin apiVersion — mismatched pins cause fake
// "connection" errors on every request. Let the SDK use its own default.
export function getStripe() {
  return new Stripe(STRIPE_SECRET_KEY!)
}

export const PLANS = {
  pro: {
    name: 'Pro',
    price: 499, // cents
    priceId: STRIPE_PRO_PRICE_ID!,
    mode: 'subscription' as const,
    features: [
      'No ads',
      'Historical wait time patterns',
      'Custom alerts',
      'Full route optimizer',
      'Save unlimited crossings',
    ],
  },
  business: {
    name: 'Business',
    price: 4999, // cents
    priceId: STRIPE_BUSINESS_PRICE_ID!,
    mode: 'subscription' as const,
    features: [
      'Everything in Pro',
      'Fleet manager panel',
      'Commercial lane focus',
      'Historical data exports (CSV)',
      'API access',
      '90-day trend analysis',
      'Priority support',
    ],
  },
  operator: {
    name: 'Operator',
    price: 9900,
    priceId: STRIPE_OPERATOR_PRICE_ID!,
    mode: 'subscription' as const,
    features: [
      'Unlimited AI paperwork validations',
      'Pedimento + invoice + USMCA cert',
      'Cuts 2-hour prep to 3 minutes',
      'Up to 34% faster border clearance',
      'Daily border intelligence alerts',
    ],
  },
  express_cert: {
    name: 'Express Cert (one-time)',
    price: 49900,
    priceId: STRIPE_EXPRESS_CERT_PRICE_ID!,
    mode: 'payment' as const,
    features: [
      'AI-assisted C-TPAT or OEA application',
      'Generated submission-ready PDF',
      'Permanent green-lane status once approved',
      'Saves $50k+/yr in delays for an active fleet',
    ],
  },
  intelligence: {
    name: 'Intelligence',
    price: 4900,
    priceId: STRIPE_INTELLIGENCE_PRICE_ID!,
    mode: 'subscription' as const,
    features: [
      'Real-time push alerts when border events fire',
      'Per-impact + per-corridor alert filters',
      'Daily synthesized brief by 7am CT',
      'Full event dataset access + CSV export',
      'Bilingual MX-source ingestion',
      'Subscriber dashboard w/ history + filters',
    ],
  },
  intelligence_enterprise: {
    name: 'Intelligence Enterprise',
    price: 49900,
    priceId: STRIPE_INTELLIGENCE_ENTERPRISE_PRICE_ID!,
    mode: 'subscription' as const,
    features: [
      'Everything in Intelligence',
      'Slack channel with direct analyst access',
      'Custom corridor reports on demand',
      'SLA on alert latency',
      'Bespoke onboarding + integration support',
    ],
  },
}
