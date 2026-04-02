import Stripe from 'stripe'

export function getStripe() {
  return new Stripe(process.env.STRIPE_SECRET_KEY!, {
    apiVersion: '2026-03-25.dahlia',
  })
}

export const PLANS = {
  pro: {
    name: 'Pro',
    price: 299, // cents
    priceId: process.env.STRIPE_PRO_PRICE_ID!,
    features: [
      'No ads',
      'AI wait time predictions',
      'Custom alerts',
      'Full route optimizer',
      'Save unlimited crossings',
    ],
  },
  business: {
    name: 'Business',
    price: 4999, // cents
    priceId: process.env.STRIPE_BUSINESS_PRICE_ID!,
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
}
