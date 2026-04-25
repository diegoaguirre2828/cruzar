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
    id: 'el-financiero-economia',
    url: 'https://www.elfinanciero.com.mx/rss/economia/',
    language: 'es',
    defaultImpact: 'tariff',
    impactKeywords: [
      { tag: 'tariff',   words: ['arancel', 'comercio'] },
      { tag: 'policy',   words: ['t-mec', 'sat'] },
      { tag: 'cartel',   words: ['cártel', 'narco'] },
      { tag: 'protest',  words: ['bloqueo', 'manifestación'] },
      { tag: 'vucem',    words: ['vucem', 'aduanas'] },
    ],
  },
  {
    id: 'el-financiero-empresas',
    url: 'https://www.elfinanciero.com.mx/rss/empresas/',
    language: 'es',
    defaultImpact: 'other',
    impactKeywords: [
      { tag: 'tariff', words: ['arancel'] },
      { tag: 'infra',  words: ['puerto', 'logística', 'transporte'] },
    ],
  },
  {
    id: 'borderreport',
    url: 'https://www.borderreport.com/feed/',
    language: 'en',
    defaultImpact: 'other',
    defaultCorridor: 'rgv-laredo-elpaso',
    impactKeywords: [
      { tag: 'cartel',  words: ['cartel', 'sinaloa', 'cjng', 'fentanyl', 'narcotics', 'kidnap'] },
      { tag: 'protest', words: ['blockade', 'protest', 'shutdown'] },
      { tag: 'vucem',   words: ['vucem', 'aduanas', 'sat'] },
      { tag: 'tariff',  words: ['tariff', 'duty', 'usmca'] },
      { tag: 'infra',   words: ['bridge', 'port of entry', 'lane closure', 'inspection'] },
      { tag: 'policy',  words: ['title 42', 'asylum', 'border policy'] },
    ],
  },
  {
    id: 'freightwaves',
    url: 'https://www.freightwaves.com/news/feed',
    language: 'en',
    defaultImpact: 'other',
    impactKeywords: [
      { tag: 'cartel',  words: ['cartel', 'narco', 'mexico violence'] },
      { tag: 'tariff',  words: ['tariff', 'usmca', 'duty', 'trade war'] },
      { tag: 'protest', words: ['blockade', 'protest', 'shutdown', 'strike'] },
      { tag: 'infra',   words: ['port of entry', 'bridge', 'lane closure', 'border crossing'] },
      { tag: 'policy',  words: ['cbp', 'aduanas', 'sat', 'cfr'] },
      { tag: 'vucem',   words: ['vucem', 'system outage'] },
    ],
  },
  {
    id: 'bbc-mundo',
    url: 'https://feeds.bbci.co.uk/mundo/rss.xml',
    language: 'es',
    defaultImpact: 'other',
    impactKeywords: [
      { tag: 'cartel',  words: ['cártel', 'narco', 'sinaloa', 'cjng', 'cdg', 'cdn', 'enfrentamiento', 'balacera'] },
      { tag: 'protest', words: ['bloqueo', 'manifestación', 'paro', 'huelga'] },
      { tag: 'tariff',  words: ['arancel', 't-mec', 'comercio'] },
      { tag: 'policy',  words: ['sheinbaum', 'amlo', 'frontera'] },
    ],
  },
  {
    id: 'lopez-doriga',
    url: 'https://lopezdoriga.com/feed/',
    language: 'es',
    defaultImpact: 'other',
    impactKeywords: [
      { tag: 'cartel',  words: ['cártel', 'narco', 'enfrentamiento', 'balacera'] },
      { tag: 'protest', words: ['bloqueo', 'manifestación'] },
      { tag: 'tariff',  words: ['arancel', 't-mec'] },
      { tag: 'vucem',   words: ['vucem', 'aduanas', 'sat'] },
      { tag: 'infra',   words: ['puente', 'cruce', 'aduana'] },
    ],
  },
]
