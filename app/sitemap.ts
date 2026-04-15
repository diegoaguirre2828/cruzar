import { MetadataRoute } from 'next'
import { PORT_META } from '@/lib/portMeta'
import { ALL_CITY_SLUGS } from '@/lib/cityMeta'

export default function sitemap(): MetadataRoute.Sitemap {
  const base = 'https://cruzar.app'
  const now = new Date()

  const staticPages: MetadataRoute.Sitemap = [
    { url: base, lastModified: now, changeFrequency: 'hourly', priority: 1 },
    { url: `${base}/login`, lastModified: now, changeFrequency: 'monthly', priority: 0.5 },
    { url: `${base}/signup`, lastModified: now, changeFrequency: 'monthly', priority: 0.7 },
    { url: `${base}/pricing`, lastModified: now, changeFrequency: 'monthly', priority: 0.6 },
    { url: `${base}/advertise`, lastModified: now, changeFrequency: 'monthly', priority: 0.5 },
    { url: `${base}/terms`, lastModified: now, changeFrequency: 'yearly', priority: 0.3 },
    { url: `${base}/privacy`, lastModified: now, changeFrequency: 'yearly', priority: 0.3 },
  ]

  // City rollup SEO landings — highest priority after home since
  // these rank on "como esta la linea {city}" and similar queries.
  const cityPages: MetadataRoute.Sitemap = ALL_CITY_SLUGS.map((slug) => ({
    url: `${base}/city/${slug}`,
    lastModified: now,
    changeFrequency: 'hourly' as const,
    priority: 0.9,
  }))

  // Per-port deep pages. Lower priority than city pages since they
  // target longer-tail queries, but still indexed frequently.
  const portPages: MetadataRoute.Sitemap = Object.keys(PORT_META).map((portId) => ({
    url: `${base}/port/${portId}`,
    lastModified: now,
    changeFrequency: 'hourly' as const,
    priority: 0.7,
  }))

  return [...staticPages, ...cityPages, ...portPages]
}
