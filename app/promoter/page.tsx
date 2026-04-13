import { PromoterDashboard } from '@/components/PromoterDashboard'
import type { Metadata } from 'next'

export const metadata: Metadata = {
  title: 'Panel del promotor · Cruzar',
  description: 'Dashboard for Cruzar promoters — content library, referral link, and share stats.',
  robots: { index: false, follow: false },
}

export default function PromoterPage() {
  return <PromoterDashboard />
}
