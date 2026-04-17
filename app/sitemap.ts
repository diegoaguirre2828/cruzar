import { MetadataRoute } from 'next'
import { PORT_META } from '@/lib/portMeta'
import { ALL_CITY_SLUGS } from '@/lib/cityMeta'
import { slugForPort } from '@/lib/portSlug'

export default function sitemap(): MetadataRoute.Sitemap {
  const base = 'https://cruzar.app'
  const now = new Date()

  const staticPages: MetadataRoute.Sitemap = [
    { url: base, lastModified: now, changeFrequency: 'hourly', priority: 1 },
    { url: `${base}/camaras`, lastModified: now, changeFrequency: 'hourly', priority: 0.95 },
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

  // Per-port deep pages. The canonical URL is /cruzar/[slug] (human-
  // readable, FB-pastable); the numeric /port/[portId] still works as
  // an alias for existing backlinks but doesn't need to be in the
  // sitemap since /cruzar/[slug] carries the indexable copy.
  const portPages: MetadataRoute.Sitemap = Object.keys(PORT_META).map((portId) => ({
    url: `${base}/cruzar/${slugForPort(portId)}`,
    lastModified: now,
    changeFrequency: 'hourly' as const,
    priority: 0.7,
  }))

  // Daily border report pages — last 30 days. These target date-specific
  // long-tail queries like "hidalgo bridge wait time april 16" and
  // "brownsville border crossing [date]". High priority because they
  // capture daily search intent that refreshes constantly.
  const dailyReportPages: MetadataRoute.Sitemap = []
  for (let i = 0; i < 30; i++) {
    const d = new Date(now)
    d.setDate(d.getDate() - i)
    const dateStr = d.toISOString().split('T')[0]
    dailyReportPages.push({
      url: `${base}/data/${dateStr}`,
      lastModified: i === 0 ? now : new Date(dateStr + 'T23:59:59Z'),
      changeFrequency: i === 0 ? 'hourly' as const : 'daily' as const,
      priority: i === 0 ? 0.9 : 0.8,
    })
  }

  return [...staticPages, ...cityPages, ...portPages, ...dailyReportPages]
}
