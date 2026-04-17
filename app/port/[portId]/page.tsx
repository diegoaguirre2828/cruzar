import { fetchRgvWaitTimes } from '@/lib/cbp'
import { PortDetailClient } from './PortDetailClient'
import { notFound } from 'next/navigation'
import Link from 'next/link'
import { ArrowLeft } from 'lucide-react'
import type { Metadata } from 'next'
import { getPortMeta } from '@/lib/portMeta'

interface Props {
  params: Promise<{ portId: string }>
}

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { portId } = await params
  const decodedId = decodeURIComponent(portId)
  const ports = await fetchRgvWaitTimes()
  const port = ports.find((p) => p.portId === decodedId)
  if (!port) return {}

  const wait = port.vehicle
  const waitStr = wait && wait > 0 ? `${wait} min` : 'Live'
  const level = !wait || wait === 0 ? 'green' : wait <= 20 ? 'green' : wait <= 45 ? 'yellow' : 'red'
  const emoji = level === 'green' ? '🟢' : level === 'yellow' ? '🟡' : '🔴'

  const title = `${emoji} ${port.portName} — ${waitStr} wait | Cruzar`
  const description = `Live border crossing wait at ${port.portName}${wait && wait > 0 ? ` — ${wait} min right now` : ''}. Updated every 15 min. Free for commuters and truckers.`

  return {
    title,
    description,
    openGraph: {
      title: `${emoji} ${port.portName} — ${waitStr} wait`,
      description,
      url: `https://cruzar.app/port/${decodedId}`,
      siteName: 'Cruzar',
      type: 'website',
    },
    twitter: {
      card: 'summary',
      title: `${emoji} ${port.portName} — ${waitStr} wait`,
      description,
    },
  }
}

export default async function PortDetailPage({ params }: Props) {
  const { portId } = await params
  const decodedId = decodeURIComponent(portId)

  const ports = await fetchRgvWaitTimes()
  const port = ports.find((p) => p.portId === decodedId)

  if (!port) notFound()

  // JSON-LD structured data for Google rich results. Emits a WebPage
  // whose mainEntity is a Place with geo coords — Google uses this
  // to show the port in map-style SERP features and to associate our
  // wait-time updates with the correct real-world crossing. Emitting
  // the current wait as text inside `description` means our page can
  // show up in featured snippets for queries like "hidalgo bridge
  // wait time".
  const meta = getPortMeta(decodedId)
  const waitMin = port.vehicle
  const waitText = waitMin && waitMin > 0 ? `${waitMin} min wait` : 'live wait times available'
  const jsonLd: Record<string, unknown> = {
    '@context': 'https://schema.org',
    '@type': 'WebPage',
    name: `${port.portName} — ${waitText} | Cruzar`,
    description: `Live US-Mexico border crossing wait time at ${port.portName}. ${waitText}. Updated every 15 min from CBP + community reports.`,
    url: `https://cruzar.app/port/${decodedId}`,
    inLanguage: ['en', 'es'],
    mainEntity: {
      '@type': 'Place',
      name: port.portName,
      ...(port.crossingName ? { alternateName: port.crossingName } : {}),
      ...(meta?.lat && meta?.lng
        ? {
            geo: {
              '@type': 'GeoCoordinates',
              latitude: meta.lat,
              longitude: meta.lng,
            },
            address: {
              '@type': 'PostalAddress',
              addressCountry: 'US',
              addressLocality: meta.city,
            },
          }
        : {}),
    },
    publisher: {
      '@type': 'Organization',
      name: 'Cruzar',
      url: 'https://cruzar.app',
    },
  }

  return (
    <>
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: JSON.stringify(jsonLd) }}
      />
      <main className="min-h-screen bg-gray-50 dark:bg-gray-950">
        <div className="max-w-lg mx-auto px-4 pb-10">
          <div className="pt-6 pb-4">
            <Link href="/" className="flex items-center gap-1 text-sm text-gray-500 dark:text-gray-400 hover:text-gray-900 dark:hover:text-gray-100 mb-4">
              <ArrowLeft className="w-4 h-4" /> All crossings · Todos los cruces
            </Link>
            <h1 className="text-xl font-bold text-gray-900 dark:text-gray-100">{port.portName}</h1>
            <p className="text-sm text-gray-400">{port.crossingName}</p>
          </div>

          <PortDetailClient port={port} portId={decodedId} />
        </div>
      </main>
    </>
  )
}
