// Cruzar affiliates registry.
//
// Central list of every partner/affiliate link surfaced on /servicios
// AND the contextual inline placements on /port/[id], /camaras,
// /welcome, and HomeClient.
//
// The /servicios hub is the retention + monetization layer surrounding
// the wait-time wedge: insurance, eSIM, dental, money transfer, credit
// cards, VPN, travel, shopping — everything border crossers regularly
// ask about in Facebook groups. One page, hyperfocused, geo-scoped to
// the user's home region when available.
//
// Every href carries UTM params so we can attribute clicks per category
// and per partner from our own analytics without relying on the
// partner's dashboard alone. Outbound <a> tags on the page MUST carry
// rel="sponsored noopener" — this is SEO best practice for monetized
// links and keeps us clean with Google.
//
// NOTE ON SCHEMA: the interface exposes BOTH the new /servicios naming
// (name / tagline / blurb / href) AND the legacy naming that port-detail
// + welcome already consume (partner / headline / sub / url) so inline
// placements don't break. New code should prefer the /servicios names.

import type { MegaRegion } from './portMeta'

export type AffiliateCategory =
  | 'insurance'
  | 'esim'
  | 'dental'
  | 'money'
  | 'travel'
  | 'credit'
  | 'vpn'
  | 'shopping'
  // Legacy categories kept for backwards compatibility with any
  // consumer that may still reference them.
  | 'credit-cards'
  | 'lawyers'
  | 'other'

export type AffiliateRegion = MegaRegion | 'all'

export interface Affiliate {
  id: string
  category: AffiliateCategory
  /** MegaRegion hints — 'all' means border-wide */
  regions: AffiliateRegion[]
  /** lucide name or emoji */
  icon?: string
  /** Primary display name (new /servicios naming) */
  name: string
  /** Short, bilingual one-liner (new /servicios naming) */
  tagline: { es: string; en: string }
  /** Supporting sentence — price, timing, proof (new /servicios naming) */
  blurb: { es: string; en: string }
  /** CTA button copy */
  cta: { es: string; en: string }
  /** Outbound affiliate URL with UTM params */
  href: string
  /** Approved by the partner (false = pending but link still works) */
  approved: boolean
  /** Higher = show first within its category */
  priority: number

  // ─── Legacy aliases (read-only convenience for existing consumers) ──
  /** @deprecated use `name` */
  partner: string
  /** @deprecated use `tagline` */
  headline: { es: string; en: string }
  /** @deprecated use `blurb` */
  sub: { es: string; en: string }
  /** @deprecated use `href` */
  url: string
}

// Internal factory — lets us write each entry once in the new shape and
// auto-populate the legacy aliases so existing call sites keep working.
type AffiliateInput = Omit<Affiliate, 'partner' | 'headline' | 'sub' | 'url'>

function mk(a: AffiliateInput): Affiliate {
  return {
    ...a,
    partner: a.name,
    headline: a.tagline,
    sub: a.blurb,
    url: a.href,
  }
}

export const AFFILIATES: Affiliate[] = [
  // ─── INSURANCE ─────────────────────────────────────────────────────────
  mk({
    id: 'oscar-padilla-auto',
    name: 'Oscar Padilla',
    category: 'insurance',
    regions: ['all'],
    href: 'https://www.mexicanautoinsurance.com/?utm_source=cruzar&utm_medium=servicios&utm_campaign=insurance&utm_content=oscar_padilla',
    tagline: {
      es: '¿Cruzando en carro? Necesitas seguro mexicano',
      en: 'Crossing by car? You need Mexican insurance',
    },
    blurb: {
      es: 'El más antiguo y grande en seguros mexicanos. Cotiza en 60 segundos desde $12/día.',
      en: 'The oldest and largest exclusive Mexican insurance provider. Quote in 60 seconds from $12/day.',
    },
    cta: { es: 'Cotizar →', en: 'Get a quote →' },
    approved: true,
    priority: 100,
    icon: '🛡️',
  }),
  mk({
    id: 'baja-bound-auto',
    name: 'Baja Bound',
    category: 'insurance',
    regions: ['baja', 'sonora-az'],
    href: 'https://www.bajabound.com/?utm_source=cruzar&utm_medium=servicios&utm_campaign=insurance&utm_content=baja_bound',
    tagline: {
      es: 'Especialista en Baja · cotización en línea',
      en: 'Baja specialist · online quotes',
    },
    blurb: {
      es: 'Perfecto si cruzas a Baja California. Soporte 24/7 en español e inglés desde $10/día.',
      en: 'Perfect if you cross into Baja. 24/7 support in English and Spanish from $10/day.',
    },
    cta: { es: 'Cotizar Baja →', en: 'Quote Baja →' },
    approved: false,
    priority: 90,
    icon: '🌊',
  }),
  mk({
    id: 'mexpro-auto',
    name: 'MexPro',
    category: 'insurance',
    regions: ['all'],
    href: 'https://www.mexpro.com/?utm_source=cruzar&utm_medium=servicios&utm_campaign=insurance&utm_content=mexpro',
    tagline: {
      es: 'Seguro anual o por día · cobertura total',
      en: 'Annual or daily · full coverage',
    },
    blurb: {
      es: 'Alternativa a Oscar Padilla. Bueno si cruzas seguido y quieres tarifa anual.',
      en: 'Alternative to Oscar Padilla. Good if you cross often and want annual pricing.',
    },
    cta: { es: 'Ver precios →', en: 'See pricing →' },
    approved: false,
    priority: 80,
    icon: '🛡️',
  }),

  // ─── eSIM / ROAMING ────────────────────────────────────────────────────
  mk({
    id: 'holafly-mexico-esim',
    name: 'Holafly eSIM',
    category: 'esim',
    regions: ['all'],
    href: 'https://esim.holafly.com/esim-mexico/?utm_source=cruzar&utm_medium=servicios&utm_campaign=esim&utm_content=holafly',
    tagline: {
      es: '¿Tu celular va a funcionar del otro lado?',
      en: 'Will your phone work on the other side?',
    },
    blurb: {
      es: 'eSIM pa\' México · datos sin roaming · se instala en 2 min.',
      en: 'Mexico eSIM · data with no roaming · installs in 2 min.',
    },
    cta: { es: 'Ver planes →', en: 'See plans →' },
    approved: true,
    priority: 100,
    icon: '📱',
  }),
  mk({
    id: 'airalo-esim',
    name: 'Airalo',
    category: 'esim',
    regions: ['all'],
    href: 'https://www.airalo.com/mx-esim?utm_source=cruzar&utm_medium=servicios&utm_campaign=esim&utm_content=airalo',
    tagline: {
      es: 'eSIM · global, funciona en México y US',
      en: 'eSIM · global, works in Mexico + US',
    },
    blurb: {
      es: 'Más países cubiertos. Útil si viajas seguido fuera de la frontera.',
      en: 'More countries covered. Useful if you travel beyond the border.',
    },
    cta: { es: 'Ver planes →', en: 'See plans →' },
    approved: false,
    priority: 80,
    icon: '🌎',
  }),

  // ─── MONEY TRANSFER ────────────────────────────────────────────────────
  mk({
    id: 'wise-transfer',
    name: 'Wise',
    category: 'money',
    regions: ['all'],
    // Diego's real personal Wise referral — pays when friends send their first transfer.
    href: 'https://wise.com/invite/dhx/diegoa5193?utm_source=cruzar&utm_medium=servicios&utm_campaign=money&utm_content=wise',
    tagline: {
      es: 'Manda dinero a México · tipo real del mercado',
      en: 'Send money to Mexico · real exchange rate',
    },
    blurb: {
      es: 'Sin comisión escondida. Mejor tasa que los bancos y que Western Union.',
      en: 'No hidden fees. Better rate than banks and Western Union.',
    },
    cta: { es: 'Enviar con Wise →', en: 'Send with Wise →' },
    approved: true,
    priority: 100,
    icon: '💸',
  }),
  mk({
    id: 'remitly-transfer',
    name: 'Remitly',
    category: 'money',
    regions: ['all'],
    href: 'https://www.remitly.com/us/en/mexico?utm_source=cruzar&utm_medium=servicios&utm_campaign=money&utm_content=remitly',
    tagline: {
      es: 'Envío rápido · primer envío sin comisión',
      en: 'Fast transfers · first send fee-free',
    },
    blurb: {
      es: 'Entregas a banco, efectivo en OXXO o Elektra. Buena alternativa pa\' la familia.',
      en: 'Bank deposit, cash pickup at OXXO or Elektra. Good alternative for family.',
    },
    cta: { es: 'Enviar ahora →', en: 'Send now →' },
    approved: false,
    priority: 85,
    icon: '💵',
  }),

  // ─── CREDIT CARDS ──────────────────────────────────────────────────────
  mk({
    id: 'bankrate-travel-cards',
    name: 'Chase Sapphire / Capital One Venture',
    category: 'credit',
    regions: ['all'],
    href: 'https://www.bankrate.com/credit-cards/travel/?utm_source=cruzar&utm_medium=servicios&utm_campaign=credit',
    tagline: {
      es: 'Tarjetas sin cargo por transacción extranjera',
      en: 'No-foreign-transaction-fee travel cards',
    },
    blurb: {
      es: 'Pa\' que no te cobren 3% extra al cruzar. Bonos de $500-800 al abrir.',
      en: 'So you don\'t get charged 3% extra when crossing. $500-800 sign-up bonuses.',
    },
    cta: { es: 'Comparar →', en: 'Compare →' },
    approved: false,
    priority: 70,
    icon: '💳',
  }),

  // ─── VPN ───────────────────────────────────────────────────────────────
  mk({
    id: 'nordvpn',
    name: 'NordVPN',
    category: 'vpn',
    regions: ['all'],
    href: 'https://nordvpn.com/?utm_source=cruzar&utm_medium=servicios&utm_campaign=vpn&utm_content=nordvpn',
    tagline: {
      es: 'Netflix US desde México (y al revés)',
      en: 'US Netflix from Mexico (and vice versa)',
    },
    blurb: {
      es: 'Pa\' ver tus shows del otro lado. También protege tu conexión en WiFi público.',
      en: 'Watch shows from either side. Also secures your connection on public WiFi.',
    },
    cta: { es: 'Prueba 30 días →', en: 'Try 30 days →' },
    approved: false,
    priority: 60,
    icon: '🔒',
  }),
  mk({
    id: 'expressvpn',
    name: 'ExpressVPN',
    category: 'vpn',
    regions: ['all'],
    href: 'https://www.expressvpn.com/?utm_source=cruzar&utm_medium=servicios&utm_campaign=vpn&utm_content=expressvpn',
    tagline: {
      es: 'VPN rápido · servidores en México y US',
      en: 'Fast VPN · servers in Mexico + US',
    },
    blurb: {
      es: 'Alternativa a NordVPN. Más rápido pero un poco más caro.',
      en: 'Alternative to NordVPN. Faster but a bit pricier.',
    },
    cta: { es: 'Ver planes →', en: 'See plans →' },
    approved: false,
    priority: 55,
    icon: '🔐',
  }),

  // ─── TRAVEL ────────────────────────────────────────────────────────────
  mk({
    id: 'booking',
    name: 'Booking.com',
    category: 'travel',
    regions: ['all'],
    href: 'https://www.booking.com/?aid=cruzar&utm_source=cruzar&utm_medium=servicios&utm_campaign=travel',
    tagline: {
      es: 'Hoteles en ambos lados del puente',
      en: 'Hotels on both sides of the bridge',
    },
    blurb: {
      es: 'RGV · Reynosa · Matamoros · Tijuana · Monterrey · cualquier parte.',
      en: 'RGV · Reynosa · Matamoros · Tijuana · Monterrey · anywhere.',
    },
    cta: { es: 'Buscar hoteles →', en: 'Search hotels →' },
    approved: false,
    priority: 70,
    icon: '🏨',
  }),
  mk({
    id: 'airbnb',
    name: 'Airbnb',
    category: 'travel',
    regions: ['all'],
    href: 'https://www.airbnb.com/?utm_source=cruzar&utm_medium=servicios&utm_campaign=travel&utm_content=airbnb',
    tagline: {
      es: 'Casas en Rocky Point, Puerto Peñasco, Cabo',
      en: 'Rentals in Rocky Point, Puerto Peñasco, Cabo',
    },
    blurb: {
      es: 'Pa\' fines de semana o viajes familiares. A veces sale más barato que hotel.',
      en: 'For weekends or family trips. Often cheaper than a hotel.',
    },
    cta: { es: 'Ver casas →', en: 'Browse rentals →' },
    approved: false,
    priority: 65,
    icon: '🏡',
  }),
  mk({
    id: 'discover-cars',
    name: 'Discover Cars',
    category: 'travel',
    regions: ['all'],
    href: 'https://www.discovercars.com/?a_aid=cruzar&utm_source=cruzar&utm_medium=servicios&utm_campaign=travel',
    tagline: {
      es: 'Renta de autos en México · comparador',
      en: 'Rental cars in Mexico · price compare',
    },
    blurb: {
      es: 'Compara todas las agencias de golpe. Incluye opción de seguro completo.',
      en: 'Compares every agency at once. Includes full-coverage option.',
    },
    cta: { es: 'Comparar →', en: 'Compare →' },
    approved: false,
    priority: 55,
    icon: '🚗',
  }),

  // ─── DENTAL ────────────────────────────────────────────────────────────
  mk({
    id: 'tijuana-dental-spa',
    name: 'Tijuana Dental Spa',
    category: 'dental',
    regions: ['baja'],
    href: 'https://www.tijuanadentalspa.com/?utm_source=cruzar&utm_medium=servicios&utm_campaign=dental&utm_content=tijuana_dental_spa',
    tagline: {
      es: 'Dentista en Tijuana · 70% más barato',
      en: 'Tijuana dentist · 70% cheaper',
    },
    blurb: {
      es: 'Limpieza, coronas, implantes a 5 min del puente de San Ysidro.',
      en: 'Cleanings, crowns, implants 5 min from the San Ysidro bridge.',
    },
    cta: { es: 'Agendar →', en: 'Book →' },
    approved: false,
    priority: 90,
    icon: '🦷',
  }),
  mk({
    id: 'dental-algodones',
    name: 'Dentistas en Los Algodones',
    category: 'dental',
    regions: ['sonora-az'],
    href: 'https://www.dentaldepartures.com/dentist/los-algodones?utm_source=cruzar&utm_medium=servicios&utm_campaign=dental&utm_content=algodones',
    tagline: {
      es: 'Dentistas certificados en Los Algodones',
      en: 'Certified dentists in Los Algodones',
    },
    blurb: {
      es: 'La capital dental del mundo. Precios 70% menos que USA y tratamientos el mismo día.',
      en: 'The dental capital of the world. 70% cheaper than US and same-day treatments.',
    },
    cta: { es: 'Ver dentistas →', en: 'Browse dentists →' },
    approved: false,
    priority: 85,
    icon: '🦷',
  }),
  mk({
    id: 'dental-tijuana',
    name: 'Dentistas en Tijuana',
    category: 'dental',
    regions: ['baja'],
    href: 'https://www.dentaldepartures.com/dentist/tijuana?utm_source=cruzar&utm_medium=servicios&utm_campaign=dental&utm_content=tijuana',
    tagline: {
      es: 'Dentistas certificados en Tijuana',
      en: 'Certified dentists in Tijuana',
    },
    blurb: {
      es: 'Implantes, endodoncias, limpiezas. A minutos de San Ysidro.',
      en: 'Implants, root canals, cleanings. Minutes from San Ysidro.',
    },
    cta: { es: 'Ver dentistas →', en: 'Browse dentists →' },
    approved: false,
    priority: 80,
    icon: '🦷',
  }),
  mk({
    id: 'dental-juarez',
    name: 'Dentistas en Ciudad Juárez',
    category: 'dental',
    regions: ['el-paso'],
    href: 'https://www.dentaldepartures.com/dentist/ciudad-juarez?utm_source=cruzar&utm_medium=servicios&utm_campaign=dental&utm_content=juarez',
    tagline: {
      es: 'Dentistas certificados en Cd. Juárez',
      en: 'Certified dentists in Juárez',
    },
    blurb: {
      es: 'Cruza el puente y ahorra miles. A minutos de El Paso.',
      en: 'Cross the bridge and save thousands. Minutes from El Paso.',
    },
    cta: { es: 'Ver dentistas →', en: 'Browse dentists →' },
    approved: false,
    priority: 80,
    icon: '🦷',
  }),
  mk({
    id: 'dental-nuevo-progreso',
    name: 'Dentistas en Nuevo Progreso',
    category: 'dental',
    regions: ['rgv'],
    href: 'https://www.dentaldepartures.com/dentist/nuevo-progreso?utm_source=cruzar&utm_medium=servicios&utm_campaign=dental&utm_content=nuevo_progreso',
    tagline: {
      es: 'Dentistas en Nuevo Progreso, Tamaulipas',
      en: 'Dentists in Nuevo Progreso',
    },
    blurb: {
      es: 'La "capital dental" del RGV. Muchos winter Texans ya van ahí.',
      en: 'The RGV "dental capital." Popular with winter Texans.',
    },
    cta: { es: 'Ver dentistas →', en: 'Browse dentists →' },
    approved: false,
    priority: 80,
    icon: '🦷',
  }),

  // ─── SHOPPING ──────────────────────────────────────────────────────────
  mk({
    id: 'amazon-us',
    name: 'Amazon US',
    category: 'shopping',
    regions: ['all'],
    href: 'https://www.amazon.com/?tag=cruzar-20&utm_source=cruzar&utm_medium=servicios&utm_campaign=shopping',
    tagline: {
      es: 'Pa\' que te llegue a tu casa en USA',
      en: 'Delivered to your US address',
    },
    blurb: {
      es: 'Electrónicos, ropa, herramientas. Si vas a cruzar, tráetelo del otro lado.',
      en: 'Electronics, clothing, tools. If you\'re crossing, bring it back.',
    },
    cta: { es: 'Abrir Amazon →', en: 'Open Amazon →' },
    approved: false,
    priority: 50,
    icon: '📦',
  }),
  mk({
    id: 'amazon-mx',
    name: 'Amazon México',
    category: 'shopping',
    regions: ['all'],
    href: 'https://www.amazon.com.mx/?tag=cruzar-20&utm_source=cruzar&utm_medium=servicios&utm_campaign=shopping&utm_content=mx',
    tagline: {
      es: 'Envío directo en México · paga en pesos',
      en: 'Shipped in Mexico · pay in pesos',
    },
    blurb: {
      es: 'Pa\' que te llegue a tu casa del lado mexicano sin cruzar.',
      en: 'Delivered to your Mexican address without crossing.',
    },
    cta: { es: 'Abrir Amazon MX →', en: 'Open Amazon MX →' },
    approved: false,
    priority: 45,
    icon: '📦',
  }),
]

export const CATEGORY_LABELS: Record<AffiliateCategory, { es: string; en: string }> = {
  insurance:     { es: 'Seguro Mexicano',     en: 'Mexican Insurance' },
  esim:          { es: 'eSIM · Roaming',      en: 'eSIM · Roaming' },
  money:         { es: 'Envío de Dinero',     en: 'Money Transfer' },
  dental:        { es: 'Dentistas · Salud',   en: 'Dental · Health' },
  travel:        { es: 'Viajes · Hoteles',    en: 'Travel · Hotels' },
  credit:        { es: 'Tarjetas de Crédito', en: 'Credit Cards' },
  vpn:           { es: 'VPN · Streaming',     en: 'VPN · Streaming' },
  shopping:      { es: 'Compras',             en: 'Shopping' },
  // Legacy aliases — not shown on /servicios but keep the type complete.
  'credit-cards': { es: 'Tarjetas de Crédito', en: 'Credit Cards' },
  lawyers:        { es: 'Abogados',            en: 'Lawyers' },
  other:          { es: 'Otro',                en: 'Other' },
}

// Order categories appear on /servicios. Insurance + eSIM first because
// those are the two every crosser genuinely needs before the bridge.
export const CATEGORY_ORDER: AffiliateCategory[] = [
  'insurance',
  'esim',
  'money',
  'dental',
  'travel',
  'credit',
  'vpn',
  'shopping',
]

/** Lookup by id. Returns undefined if missing. */
export function getAffiliate(id: string): Affiliate | undefined {
  return AFFILIATES.find((a) => a.id === id)
}

/**
 * Filter affiliates to those relevant to a region. Pass 'all' or null
 * to get everything. Affiliates tagged 'all' always pass through.
 * Results preserve AFFILIATES order so callers get a stable ranking.
 */
export function affiliatesForRegion(region: AffiliateRegion | null): Affiliate[] {
  if (!region || region === 'all') return AFFILIATES
  return AFFILIATES.filter(
    (a) => a.regions.includes('all') || a.regions.includes(region),
  )
}

/**
 * Identical behavior to affiliatesForRegion but accepts a loose string
 * so callers who already have an arbitrary profile.home_region value
 * don't need to narrow the type first. Unknown regions return all.
 */
export function filterByRegion(affiliates: Affiliate[], region: string | null): Affiliate[] {
  if (!region || region === 'all') return affiliates
  return affiliates.filter(
    (a) => a.regions.includes('all') || a.regions.includes(region as AffiliateRegion),
  )
}
