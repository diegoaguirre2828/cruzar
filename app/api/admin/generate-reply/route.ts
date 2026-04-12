import { NextRequest, NextResponse } from 'next/server'
import { createServerClient } from '@supabase/ssr'
import { cookies } from 'next/headers'
import { fetchRgvWaitTimes } from '@/lib/cbp'
import { getServiceClient } from '@/lib/supabase'

const ADMIN_EMAIL = 'cruzabusiness@gmail.com'
const APP_URL = 'cruzar.app'

// Port IDs mapped to the local names people use in Facebook groups
const PORT_NAMES: Record<string, string> = {
  '230501': 'Puente Hidalgo',
  '230502': 'Puente Pharr–Reynosa',
  '230503': 'Puente Anzaldúas',
  '230901': 'Puente Progreso',
  '230902': 'Puente Donna',
  '535501': 'Puente B&M',
  '535502': 'Puente Los Tomates',
  '535503': 'Puente Los Indios',
  '535504': 'Puente Gateway',
  '230401': 'Puente Laredo I',
  '230402': 'Puente Laredo II',
  '230301': 'Puente Eagle Pass',
  '240201': 'Puente El Paso',
}

function pick<T>(arr: T[]): T {
  return arr[Math.floor(Math.random() * arr.length)]
}

// ── Wait time templates ────────────────────────────────────────────────────────
// No emojis — sounds more like a real person, less like a bot
const WAIT_TEMPLATES_ES = [
  (name: string, wait: string | number, url: string) =>
    `ahorita ${name} = ${wait} min. ${url}`,
  (name: string, wait: string | number, url: string) =>
    `${name} tiene ${wait} min ahorita. ${url} pa ver todos`,
  (name: string, wait: string | number, url: string) =>
    `${wait} min en ${name}. checa ${url}`,
  (name: string, wait: string | number, url: string) =>
    `le checké, ${name} está en ${wait} min. ${url}`,
  (name: string, wait: string | number, url: string) =>
    `${name} ahorita ${wait} min. ${url} pa los demás puentes`,
  (name: string, wait: string | number, url: string) =>
    `${wait} min en ${name} ahorita, acabo de checar. ${url}`,
]

const WAIT_TEMPLATES_EN = [
  (name: string, wait: string | number, url: string) =>
    `${name} is at ${wait} min rn. ${url}`,
  (name: string, wait: string | number, url: string) =>
    `just checked, ${name} showing ${wait} min. ${url} for all bridges`,
  (name: string, wait: string | number, url: string) =>
    `${wait} min at ${name} right now. ${url}`,
  (name: string, wait: string | number, url: string) =>
    `${name} = ${wait} min. ${url} to check the rest`,
]

// ── Exchange rate templates ────────────────────────────────────────────────────
const EXCHANGE_TEMPLATES_ES = [
  (rate: string, community: string) =>
    `dólar en ${rate} MXN ahorita. ${community}${APP_URL}`,
  (rate: string, community: string) =>
    `ahorita ${rate} MXN por dólar. ${community}${APP_URL} pa ver lo que pagan las casas de cambio`,
  (rate: string, community: string) =>
    `le checké, ${rate} MXN por dólar. ${community}${APP_URL}`,
  (rate: string, community: string) =>
    `${rate} MXN el dólar ahorita. ${community}${APP_URL}`,
]

// ── Static topic templates — no emojis, casual tone ───────────────────────────
const STATIC_TOPICS: Record<string, { es: string[]; en: string[] }> = {
  documents: {
    es: [
      `pa cruzar en carro necesitas pasaporte (o visa), licencia, y papeles del carro. si llevas menores sin uno de los papás necesitas carta notariada. ${APP_URL}/chat si tienen más dudas`,
      `los básicos: pasaporte o visa vigente, licencia, tarjeta de circulación. si el carro no está a tu nombre lleva carta del dueño. para más info: ${APP_URL}/chat`,
      `documentos para cruzar a EE.UU.: pasaporte o visa, licencia, y placas del carro. menores solos o con un solo papá: carta notariada obligatoria. ${APP_URL}/chat pa más dudas`,
    ],
    en: [
      `to cross into the US by car you need a passport or valid visa, driver's license, and vehicle registration. minors without both parents need a notarized letter. ${APP_URL}/chat for more questions`,
    ],
  },
  sentri: {
    es: [
      `sentri vale la pena si cruzas seguido. aplicas en goes.dhs.gov, haces una entrevista, y si te aprueban tienes carril exclusivo en todos los puentes. cuesta $122 y dura 5 años. el proceso tarda 2-3 meses. ${APP_URL}/chat pa más info`,
      `si cruzas diario o varias veces a la semana sentri es de los mejores $122 que puedes gastar. aplica en goes.dhs.gov y agenda tu entrevista. ${APP_URL}/chat si tienes dudas del proceso`,
      `sentri te puede ahorrar 1-2 horas en días de mucha espera. aplicas en línea, haces entrevista, y listo. $122 por 5 años. ${APP_URL}/chat para el proceso completo`,
    ],
    en: [
      `sentri is worth it if you cross often. apply at goes.dhs.gov, do a quick interview, and you get dedicated lanes at all crossings. $122.25 for 5 years, process takes 2-3 months. ${APP_URL}/chat for more`,
    ],
  },
  insurance: {
    es: [
      `el seguro americano no cubre en México, es obligatorio por ley llevar seguro mexicano. lo puedes sacar en línea antes de cruzar, desde $10-20 USD por día. qualitas y axa son las más usadas. ${APP_URL}/chat pa más info`,
      `sí necesitas seguro mexicano si entras en carro a México. el tuyo americano no aplica allá. lo sacas en línea antes de cruzar o en las casetas junto al puente. ${APP_URL}/chat si tienes dudas`,
      `seguro mexicano obligatorio. sin él si hay accidente pueden detenerte. lo sacas en línea en minutos, desde $10 USD/día. qualitas, axa, mapfre son opciones. ${APP_URL}/chat`,
    ],
    en: [
      `your US insurance doesn't cover you in Mexico, you're required by law to have mexican coverage. buy it online before crossing for around $10/day. qualitas and axa are common options. ${APP_URL}/chat`,
    ],
  },
  fmm: {
    es: [
      `la fmm la necesitas si vas más de 25km de la frontera o te quedas más de 72 horas. si solo vas a la zona fronteriza por el día no necesitas nada. se saca en el puente o en inm.gob.mx, cuesta ~$700 MXN. ${APP_URL}/chat pa más dudas`,
      `si vas más allá de 25km o por más de 3 días necesitas fmm. la tramitas en la caseta del inm en el puente. ${APP_URL}/chat si tienes más preguntas`,
      `fmm de turista: solo la necesitas si vas lejos de la frontera o por más de 72 horas. en el puente te dan el formulario. ${APP_URL}/chat`,
    ],
    en: [
      `you need an fmm (tourist permit) if you're going more than 25km from the border or staying more than 72 hours. get it at the bridge or at inm.gob.mx. ${APP_URL}/chat for more`,
    ],
  },
  best_time: {
    es: [
      `los mejores horarios para cruzar: martes a jueves en la mañana (5-7am) o al mediodía entre semana. los peores: viernes en la tarde y domingo en la noche. días festivos de los dos lados = mucho tráfico. puedes checar el historial en ${APP_URL}`,
      `regla general: entre semana y en la mañana = menos espera. viernes tarde y domingos en la noche son lo peor. días de quincena también se ponen lentos. ${APP_URL} tiene el historial de esperas`,
      `pa cruzar rápido: martes o miércoles temprano. pa cruzar lento: viernes tarde o domingo noche. días festivos americanos y mexicanos evítalos si puedes. ${APP_URL} pa ver los patrones`,
    ],
    en: [
      `best times to cross: tuesday to thursday mornings 5-7am or midday. worst: friday evenings and sunday nights. holidays on either side are always packed. check historical patterns at ${APP_URL}`,
    ],
  },
  secondary: {
    es: [
      `si te mandan a secundaria no te desesperes, es rutinario. te piden que pases a inspección, revisan documentos y a veces el carro, y te hacen preguntas sobre tu viaje. mantén la calma y responde honestamente. la mayoría pasa en 15-30 min. ${APP_URL}/chat pa más info`,
      `secundaria es una revisión más a fondo, no significa que hiciste algo mal. ten tus documentos a la mano, sé honesto, y no te pongas nervioso. normalmente 20-45 minutos. ${APP_URL}/chat`,
    ],
    en: [
      `secondary is routine — it doesn't mean you did anything wrong. stay calm, be honest, have your documents ready. usually 20-45 minutes. ${APP_URL}/chat for more`,
    ],
  },
  items: {
    es: [
      `puedes traer hasta $800 USD sin pagar impuesto (por persona). alcohol: 1 litro. cigarros: 200. frutas, verduras y carnes frescas de México generalmente no pasan. más de $10,000 en efectivo hay que declararlo, no es ilegal pero sí obligatorio. ${APP_URL}/chat pa más dudas`,
      `la regla básica: $800 USD por persona sin impuesto. efectivo de $10k o más hay que declararlo. carnes y frutas frescas de México generalmente no. medicamentos con receta están bien. ${APP_URL}/chat`,
      `sin pagar: hasta $800 en compras, 1 litro de alcohol, 1 cartón de cigarros. todo lo que llevas decláralo si te preguntan, mentir es el error más caro. ${APP_URL}/chat`,
    ],
    en: [
      `you can bring up to $800 per person duty-free. 1 liter of alcohol, 1 carton of cigarettes. fresh fruits, meats, and vegetables from mexico are generally not allowed. over $10k cash must be declared. ${APP_URL}/chat`,
    ],
  },
  legal: {
    es: [
      `checa ${APP_URL}/negocios, hay abogados de inmigración de la zona ahí`,
      `en ${APP_URL}/negocios encuentras abogados de la frontera. también puedes preguntar en el chat: ${APP_URL}/chat`,
      `${APP_URL}/negocios tiene un directorio de negocios locales, ahí hay abogados de inmigración`,
    ],
    en: [
      `check ${APP_URL}/negocios for local immigration lawyers in the area`,
    ],
  },
  mechanic: {
    es: [
      `checa ${APP_URL}/negocios, hay talleres y mecánicos de la zona listados ahí`,
      `en ${APP_URL}/negocios encuentras mecánicos locales. la comunidad los recomienda ahí`,
      `${APP_URL}/negocios tiene talleres de la frontera, dale un vistazo`,
    ],
    en: [
      `check ${APP_URL}/negocios for local mechanics and auto shops`,
    ],
  },
  negocios: {
    es: [
      `checa ${APP_URL}/negocios, ahí hay negocios locales recomendados por la comunidad`,
      `en ${APP_URL}/negocios encuentras negocios de la zona — restaurants, abogados, talleres, y más`,
      `${APP_URL}/negocios tiene un directorio de negocios fronterizos. la comunidad los recomienda ahí`,
    ],
    en: [
      `check ${APP_URL}/negocios for local businesses recommended by the community`,
    ],
  },
}

async function handleWaitReply(portId: string, lang: 'es' | 'en', variant: number): Promise<NextResponse> {
  if (!PORT_NAMES[portId]) {
    return NextResponse.json({ error: 'Invalid portId' }, { status: 400 })
  }

  const ports = await fetchRgvWaitTimes()
  const port = ports.find(p => p.portId === portId)
  const wait: number | null = port?.vehicle ?? port?.pedestrian ?? null
  const portName = PORT_NAMES[portId]

  if (wait === null || port?.isClosed) {
    if (port?.isClosed) {
      const reply = lang === 'en'
        ? `${portName} is closed rn. ${APP_URL}`
        : `${portName} está cerrado ahorita. ${APP_URL}`
      return NextResponse.json({ reply, wait: null, portName, variant: -1 })
    }
    const reply = lang === 'en'
      ? `no data for ${portName} rn. ${APP_URL}`
      : `no tengo datos ahorita pa ${portName}. ${APP_URL}`
    return NextResponse.json({ reply, wait: null, portName, variant: -1 })
  }

  const displayWait = wait === 0 ? '<1' : wait
  const templates = lang === 'en' ? WAIT_TEMPLATES_EN : WAIT_TEMPLATES_ES
  const idx = variant >= 0 && variant < templates.length
    ? variant
    : Math.floor(Math.random() * templates.length)
  const reply = templates[idx](portName, displayWait, APP_URL)

  return NextResponse.json({ reply, wait, portName, variant: idx })
}

async function handleExchangeReply(lang: 'es' | 'en', variant: number): Promise<NextResponse> {
  let officialRate: string | null = null
  try {
    const res = await fetch('https://api.frankfurter.app/latest?from=USD&to=MXN', { next: { revalidate: 3600 } })
    if (res.ok) {
      const data = await res.json()
      const r = data.rates?.MXN
      if (r) officialRate = Number(r).toFixed(2)
    }
  } catch { /* ignore */ }

  let communityNote = ''
  try {
    const db = getServiceClient()
    const since = new Date(Date.now() - 6 * 60 * 60 * 1000).toISOString()
    const { data } = await db
      .from('exchange_rate_reports')
      .select('house_name, sell_rate, city')
      .gte('reported_at', since)
      .order('reported_at', { ascending: false })
      .limit(3)
    if (data && data.length > 0) {
      const avg = data.reduce((s, r) => s + Number(r.sell_rate), 0) / data.length
      communityNote = lang === 'es'
        ? `Vecinos reportan casas de cambio pagando ~${avg.toFixed(2)} MXN. `
        : `Community reports: local exchange houses around ${avg.toFixed(2)} MXN. `
    }
  } catch { /* ignore */ }

  if (!officialRate) {
    const reply = lang === 'es'
      ? `No tengo el tipo de cambio exacto ahorita, pero en ${APP_URL} reportan tasas de casas de cambio en la frontera 🙌`
      : `Don't have the exact rate right now, but ${APP_URL} has community-reported casa de cambio rates 🙌`
    return NextResponse.json({ reply, rate: null, type: 'exchange', variant: -1 })
  }

  const templates = lang === 'en' ? EXCHANGE_TEMPLATES_ES : EXCHANGE_TEMPLATES_ES
  const idx = variant >= 0 && variant < templates.length
    ? variant
    : Math.floor(Math.random() * templates.length)
  const reply = templates[idx](officialRate, communityNote)

  return NextResponse.json({ reply, rate: officialRate, type: 'exchange', variant: idx })
}

function handleStaticReply(topic: string, lang: 'es' | 'en', variant: number): NextResponse {
  const topicData = STATIC_TOPICS[topic]
  if (!topicData) {
    return NextResponse.json({ error: 'Unknown topic' }, { status: 400 })
  }

  const templates = lang === 'en' && topicData.en.length > 0 ? topicData.en : topicData.es
  const idx = variant >= 0 && variant < templates.length
    ? variant
    : Math.floor(Math.random() * templates.length)

  return NextResponse.json({ reply: templates[idx], type: topic, variant: idx })
}

export async function GET(req: NextRequest) {
  const cookieStore = await cookies()
  const supabase = createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    { cookies: { getAll: () => cookieStore.getAll() } }
  )
  const { data: { user } } = await supabase.auth.getUser()
  if (!user || user.email !== ADMIN_EMAIL) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  const type = req.nextUrl.searchParams.get('type') || 'wait'
  const variantParam = req.nextUrl.searchParams.get('variant')
  const variant = variantParam !== null ? parseInt(variantParam, 10) : -1
  const lang = req.nextUrl.searchParams.get('lang') === 'en' ? 'en' : 'es'

  if (type === 'wait') {
    const portId = req.nextUrl.searchParams.get('portId') || '230501'
    return handleWaitReply(portId, lang, variant)
  }

  if (type === 'exchange') {
    return handleExchangeReply(lang, variant)
  }

  if (STATIC_TOPICS[type]) {
    return handleStaticReply(type, lang, variant)
  }

  return NextResponse.json({ error: 'Unknown type' }, { status: 400 })
}
