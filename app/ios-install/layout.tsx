import type { Metadata } from 'next'

// Metadata for the iOS install landing page. Body lives in page.tsx as
// a client component because the whole UX (detect standalone, copy-link,
// track events) needs browser APIs. Keeping metadata out in the layout
// is the Next 16 App Router way to ship static SEO on a 'use client'
// page without fighting the compiler.
export const metadata: Metadata = {
  title: 'Cruzar on iPhone — add to home screen in 3 taps',
  description: 'Add Cruzar to your iPhone home screen in 3 taps. Works like an app, no App Store install.',
  alternates: {
    canonical: 'https://cruzar.app/ios-install',
  },
  openGraph: {
    title: 'Cruzar on iPhone — add to home screen in 3 taps',
    description: 'Add Cruzar to your iPhone home screen in 3 taps. Works like an app, no App Store install.',
    url: 'https://cruzar.app/ios-install',
    siteName: 'Cruzar',
    type: 'website',
  },
  twitter: {
    card: 'summary_large_image',
    title: 'Cruzar on iPhone — add to home screen in 3 taps',
    description: 'Add Cruzar to your iPhone home screen in 3 taps. Works like an app, no App Store install.',
  },
}

export default function IosInstallLayout({ children }: { children: React.ReactNode }) {
  return children
}
