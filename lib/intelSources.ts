// Curated list of public sources the Cruzar Intelligence ingestion
// cron pulls every hour. Each source is a RSS / Atom feed URL with
// metadata we use to tag events. Add new sources here — the ingest
// cron picks them up automatically on the next run.
//
// Bilingual focus on US-MX cross-border freight signals: cartel /
// security, tariff / policy, VUCEM / SAT / SAAI uptime, blockades,
// infrastructure incidents.

export interface IntelSource {
  id: string
  url: string
  language: 'es' | 'en'
  defaultImpact: 'cartel' | 'protest' | 'vucem' | 'tariff' | 'weather' | 'infra' | 'policy' | 'other'
  defaultCorridor?: string
  // If a headline contains any of these substrings (case-insensitive),
  // the ingest pipeline overrides the default impact.
  impactKeywords?: Array<{ tag: 'cartel' | 'protest' | 'vucem' | 'tariff' | 'weather' | 'infra' | 'policy' | 'other'; words: string[] }>
}

export const INTEL_SOURCES: IntelSource[] = [
  {
    id: 'cbp-newsroom',
    url: 'https://www.cbp.gov/newsroom/rss/all/feed',
    language: 'en',
    defaultImpact: 'policy',
    impactKeywords: [
      { tag: 'cartel',  words: ['cartel', 'sinaloa', 'cjng', 'fentanyl', 'narcotics'] },
      { tag: 'tariff',  words: ['tariff', 'duty', 'trade enforcement'] },
      { tag: 'infra',   words: ['port of entry', 'lane closure', 'bridge'] },
    ],
  },
  {
    id: 'ustr-press',
    url: 'https://ustr.gov/about-us/policy-offices/press-office/press-releases/rss.xml',
    language: 'en',
    defaultImpact: 'tariff',
    impactKeywords: [
      { tag: 'policy', words: ['usmca', 'agreement', 'consultation', 'dispute'] },
    ],
  },
  {
    id: 'milenio-frontera',
    url: 'https://www.milenio.com/rss/frontera',
    language: 'es',
    defaultImpact: 'other',
    defaultCorridor: 'rgv-laredo',
    impactKeywords: [
      { tag: 'cartel',  words: ['cdg', 'cdn', 'cártel', 'narco', 'sicarios', 'enfrentamiento', 'balacera'] },
      { tag: 'protest', words: ['bloqueo', 'manifestación', 'cierre', 'huelga', 'paro'] },
      { tag: 'vucem',   words: ['vucem', 'aduanas', 'sat', 'caída del sistema'] },
      { tag: 'infra',   words: ['puente', 'cruce', 'inspección'] },
    ],
  },
  {
    id: 'reforma-frontera',
    url: 'https://www.reforma.com/rss/frontera.xml',
    language: 'es',
    defaultImpact: 'other',
    defaultCorridor: 'rgv-laredo',
    impactKeywords: [
      { tag: 'cartel',  words: ['cártel', 'narco', 'enfrentamiento'] },
      { tag: 'protest', words: ['bloqueo', 'manifestación'] },
      { tag: 'vucem',   words: ['vucem', 'aduanas'] },
    ],
  },
  {
    id: 'el-financiero-economia',
    url: 'https://www.elfinanciero.com.mx/rss/economia/',
    language: 'es',
    defaultImpact: 'tariff',
    impactKeywords: [
      { tag: 'tariff',  words: ['arancel', 'comercio'] },
      { tag: 'policy',  words: ['t-mec', 'sat'] },
    ],
  },
]
