import type { Metadata } from 'next'

// Title + description tuned to pull clicks from FB feed scroll.
// The OG image itself lives at app/camaras/opengraph-image.tsx —
// Next auto-wires it; no explicit `images:` entry needed.
export const metadata: Metadata = {
  title: 'Cámaras + tiempo en vivo de los puentes · Cruzar',
  description:
    '15 puentes US-México con cámara en vivo y tiempo de espera en minutos. Todos en una sola página, gratis. Sin andarle scrolleando al grupo.',
  alternates: {
    canonical: 'https://cruzar.app/camaras',
  },
  openGraph: {
    title: '15 puentes · Cámaras + tiempo en vivo',
    description:
      'Mira las filas ahorita y el tiempo de espera en minutos. Todos los puentes US-México en una sola página, gratis.',
    url: 'https://cruzar.app/camaras',
    siteName: 'Cruzar',
    type: 'website',
  },
  twitter: {
    card: 'summary_large_image',
    title: '15 puentes · Cámaras + tiempo en vivo',
    description:
      'Mira las filas ahorita y el tiempo de espera en minutos. Todos los puentes US-México en una sola página, gratis.',
  },
}

export default function CamarasLayout({ children }: { children: React.ReactNode }) {
  return children
}
