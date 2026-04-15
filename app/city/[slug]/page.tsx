import type { Metadata } from 'next'
import { notFound } from 'next/navigation'
import { CITY_META, ALL_CITY_SLUGS, getCityMeta } from '@/lib/cityMeta'
import { CityDetailClient } from './CityDetailClient'

// Static params for all known city slugs. Next.js pre-renders each
// one at build time and serves it as a static page, with client-side
// hydration for the live wait-time fetch.
export function generateStaticParams() {
  return ALL_CITY_SLUGS.map((slug) => ({ slug }))
}

// Per-city metadata (title, description, OG) — the critical SEO move
// cloned from bordergarita. Each city URL is optimized for the
// "como esta la linea {city}" / "{city} border wait times" queries.
export async function generateMetadata({
  params,
}: {
  params: Promise<{ slug: string }>
}): Promise<Metadata> {
  const { slug } = await params
  const city = getCityMeta(slug)
  if (!city) return { title: 'Cruzar' }

  const titleEs = `${city.mxName} ↔ ${city.usName} — Tiempos de espera en vivo · Cruzar`
  const descEs = city.blurb.es

  return {
    title: titleEs,
    description: descEs,
    alternates: {
      canonical: `https://cruzar.app/city/${slug}`,
    },
    openGraph: {
      title: titleEs,
      description: descEs,
      url: `https://cruzar.app/city/${slug}`,
      siteName: 'Cruzar',
      locale: 'es_MX',
      type: 'website',
    },
    twitter: {
      card: 'summary_large_image',
      title: titleEs,
      description: descEs,
    },
  }
}

export default async function CityPage({
  params,
}: {
  params: Promise<{ slug: string }>
}) {
  const { slug } = await params
  const city = getCityMeta(slug)
  if (!city) notFound()

  // LocalBusiness + Place JSON-LD — the SEO move bordergarita uses to
  // get aggregateRating stars in search results. We use Place with
  // geo coordinates since border crossings aren't businesses per se.
  const localBusinessJsonLd = {
    '@context': 'https://schema.org',
    '@type': 'Place',
    name: `${city.mxName} ↔ ${city.usName} Border Crossings`,
    description: city.blurb.en,
    url: `https://cruzar.app/city/${slug}`,
    address: {
      '@type': 'PostalAddress',
      addressLocality: city.mxName,
      addressCountry: 'MX',
    },
  }

  return (
    <>
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: JSON.stringify(localBusinessJsonLd) }}
      />
      <CityDetailClient city={city} />
    </>
  )
}
