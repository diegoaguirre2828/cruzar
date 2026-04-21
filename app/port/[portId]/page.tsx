import { fetchRgvWaitTimes } from '@/lib/cbp'
import { PortDetailClient } from './PortDetailClient'
import { notFound } from 'next/navigation'
import { PageHeader } from '@/components/PageHeader'
import type { Metadata } from 'next'
import { getPortMeta } from '@/lib/portMeta'
import { slugForPort } from '@/lib/portSlug'

// Live wait times must not be Next-cached. Without this, the `port`
// object passed into PortDetailClient can go stale for minutes after a
// deploy, and the hero shows a wait time that disagrees with anything
// the client-side SW/fetcher loads afterwards. Users read that as "the
// app is lying about the number." Force-dynamic guarantees the CBP
// fetch runs on every request. Already what /api/ports does.
export const dynamic = 'force-dynamic'
export const revalidate = 0

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

  const canonicalSlug = slugForPort(decodedId)

  return {
    title,
    description,
    alternates: {
      canonical: `https://cruzar.app/cruzar/${canonicalSlug}`,
    },
    openGraph: {
      title: `${emoji} ${port.portName} — ${waitStr} wait`,
      description,
      url: `https://cruzar.app/cruzar/${canonicalSlug}`,
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
          <PageHeader
            title={port.portName}
            subtitle={port.crossingName || undefined}
            backHref="/"
            backLabelEs="Todos los puentes"
            backLabelEn="All bridges"
          />

          <PortDetailClient port={port} portId={decodedId} />
        </div>
      </main>
    </>
  )
}
