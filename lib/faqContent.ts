// Bilingual FAQ content for Cruzar's port detail pages and /city/[slug]
// rollup pages. Hand-written Spanish-first (casual RGV / border voice),
// with English translations used for the `en` lang state.
//
// Each FAQ entry gets rendered inside `components/PortFAQ.tsx` AND
// emitted as Schema.org FAQPage JSON-LD. Google rewards FAQPage
// markup with the "People also ask" rich result — this is the SEO
// move stolen from bordergarita.com (see memory/project_cruzar_competitor_bordergarita.md).
//
// Voice rules: match the feedback_cruzar_fb_reply_voice.md voice —
// casual, direct, no emojis inside answers, no "cruzar.app" links
// inside the text (the page itself is the CTA). Answers short
// (2-4 sentences max) so Google parses them cleanly.

export type FAQEntry = {
  q: { es: string; en: string }
  a: { es: string; en: string }
}

// ─── Shared FAQs — apply to every port and every city ──────────────
// These are the questions every border-crosser asks at least once.
// Bordergarita ranks on most of these; Cruzar should too.
export const SHARED_FAQS: FAQEntry[] = [
  {
    q: {
      es: '¿Cuál es el mejor horario para cruzar el puente?',
      en: "What's the best time to cross the bridge?",
    },
    a: {
      es: 'Los días entre semana cruzando muy temprano (antes de las 6am) o a media mañana (entre 10am y 11am) suelen ser los más rápidos. Los viernes por la tarde y los domingos por la noche son los peores. El historial de cada puente en Cruzar te dice la hora exacta con menos espera para el puente específico que vas a cruzar.',
      en: 'Weekdays very early (before 6am) or mid-morning (10-11am) tend to be fastest. Friday afternoons and Sunday evenings are the worst. Cruzar\'s historical patterns tell you the exact hour with the shortest wait for the specific bridge you\'re crossing.',
    },
  },
  {
    q: {
      es: '¿Qué documentos necesito como ciudadano estadounidense?',
      en: 'What documents do I need as a US citizen?',
    },
    a: {
      es: 'Pasaporte estadounidense, tarjeta de pasaporte estadounidense, licencia REAL ID compatible (pero no todas las licencias sirven para cruzar — verifica la tuya), o una tarjeta Global Entry / SENTRI / NEXUS / FAST. Los menores de 16 años pueden cruzar con acta de nacimiento original.',
      en: 'US passport, US passport card, a REAL ID-compliant driver\'s license (not every state license works for the border — verify yours), or a Global Entry / SENTRI / NEXUS / FAST card. Minors under 16 can cross with an original birth certificate.',
    },
  },
  {
    q: {
      es: '¿Qué documentos necesito como residente permanente (green card)?',
      en: 'What documents do I need as a permanent resident (green card holder)?',
    },
    a: {
      es: 'Tu tarjeta de residencia permanente (I-551 / green card) vigente y no vencida, junto con una identificación oficial con foto. Si tu green card está por vencer, solicita la renovación antes de viajar para evitar problemas.',
      en: 'Your valid unexpired permanent resident card (I-551 / green card) plus a government-issued photo ID. If your green card is close to expiring, renew it before traveling to avoid complications.',
    },
  },
  {
    q: {
      es: '¿Qué documentos necesitan los menores de edad?',
      en: 'What documents do minors need?',
    },
    a: {
      es: 'Menores de 16 años pueden cruzar con acta de nacimiento original (no copia). Si el menor viaja con un solo padre o con otro adulto, CBP recomienda traer una carta notariada del padre ausente autorizando el viaje, especialmente si hay preguntas de custodia. Menores de 16 a 18 años deben traer documento con foto como pasaporte o ID escolar.',
      en: 'Under 16 can cross with an original birth certificate (not a copy). If the minor is traveling with only one parent or with another adult, CBP recommends a notarized letter from the absent parent authorizing the trip, especially where custody questions may arise. 16-18 year-olds should carry a photo ID like a passport or school ID.',
    },
  },
  {
    q: {
      es: '¿Qué documentos necesita un ciudadano mexicano para cruzar a Estados Unidos?',
      en: 'What documents does a Mexican citizen need to cross into the US?',
    },
    a: {
      es: 'Visa de turista B1/B2 válida en su pasaporte mexicano, o una tarjeta BCC (Border Crossing Card, también conocida como "la láser"). Los ciudadanos mexicanos con SENTRI cruzan por el carril rápido sin esperar tanto. Verifica que tu visa no esté próxima a vencer antes del viaje.',
      en: 'A valid B1/B2 tourist visa in your Mexican passport, or a BCC (Border Crossing Card, "la láser"). Mexican citizens with SENTRI cross in the fast lane with much shorter waits. Verify your visa isn\'t close to expiring before your trip.',
    },
  },
  {
    q: {
      es: '¿Qué es SENTRI y vale la pena pagarlo?',
      en: 'What is SENTRI and is it worth paying for?',
    },
    a: {
      es: 'SENTRI (Secure Electronic Network for Travelers Rapid Inspection) es un programa para cruzar por carril rápido con una espera promedio de 5-15 minutos, incluso cuando el carril general trae 2 horas. Cuesta $122.25 USD por 5 años y requiere entrevista en CBP. Si cruzas más de una vez por semana, se paga solo el primer mes.',
      en: 'SENTRI (Secure Electronic Network for Travelers Rapid Inspection) is a trusted-traveler program that lets you use a fast lane with average wait of 5-15 min, even when the general lane is 2 hours deep. Costs $122.25 USD for 5 years and requires a CBP interview. If you cross more than once a week, it pays for itself in the first month.',
    },
  },
  {
    q: {
      es: '¿Cuál es la diferencia entre los carriles SENTRI, Ready Lane y general?',
      en: 'What\'s the difference between SENTRI, Ready Lane, and general lanes?',
    },
    a: {
      es: 'SENTRI es el carril más rápido, solo para miembros del programa con transpondedor RFID en el vehículo. Ready Lane es para cruzadores con documentos compatibles con RFID (pasaporte, pasaporte card, BCC, green card) — más rápido que el general pero más lento que SENTRI. El carril general acepta todos los documentos pero es el más lento.',
      en: 'SENTRI is the fastest lane, members-only with an RFID transponder in the vehicle. Ready Lane is for crossers with RFID-enabled documents (passport card, BCC, green card) — faster than general but slower than SENTRI. The general lane accepts all documents but is the slowest.',
    },
  },
  {
    q: {
      es: '¿Cómo puedo acelerar el tiempo de espera en el puente?',
      en: 'How can I speed up my wait time at the bridge?',
    },
    a: {
      es: 'Ten tus documentos listos en la mano antes de llegar a la caseta, no uses el celular al llegar al oficial, quítate los lentes de sol, baja la música y responde las preguntas claro y directo. Si llevas mercancía, declárala desde el principio. Y lo más importante: usa los tiempos en vivo y el historial de Cruzar para salir a la hora correcta, no cuando ya es tarde.',
      en: 'Have your documents in hand before reaching the booth, put away your phone as you approach the officer, take off sunglasses, turn down the music, and answer clearly and directly. If you\'re carrying goods, declare them upfront. Most important: use Cruzar\'s live wait times and historical patterns to leave at the right hour, not after it\'s already backed up.',
    },
  },
  {
    q: {
      es: '¿Qué pasa si me mandan a inspección secundaria?',
      en: 'What happens if I get sent to secondary inspection?',
    },
    a: {
      es: 'Mantén la calma y sigue las instrucciones del oficial. La inspección secundaria no significa que hiciste algo mal — muchas veces es aleatoria. Puede durar de 10 minutos a varias horas. No firmes ni aceptes nada que no entiendas, y si necesitas un traductor, pídelo. Tienes derecho a preguntar por qué te están deteniendo.',
      en: 'Stay calm and follow the officer\'s instructions. Secondary inspection doesn\'t mean you did anything wrong — a lot of it is random. It can take 10 minutes to several hours. Don\'t sign or accept anything you don\'t understand, and if you need a translator, ask for one. You have the right to ask why you\'re being held.',
    },
  },
  {
    q: {
      es: '¿Qué pasa si llevo comida, plantas, animales o medicinas?',
      en: 'What about food, plants, animals, or medications?',
    },
    a: {
      es: 'Carne, frutas, verduras y plantas generalmente NO pueden cruzar a EEUU — pueden confiscarte y multarte si no las declaras. Las medicinas recetadas sí pueden cruzar en cantidad personal, de preferencia en su envase original con tu nombre. Animales requieren vacuna contra la rabia. Siempre declara todo al oficial — el castigo por no declarar es mucho peor que el de declarar.',
      en: 'Meat, fruits, vegetables, and plants generally CANNOT cross into the US — they can be confiscated and you can be fined if you don\'t declare them. Prescription medications can cross in personal quantities, preferably in original labeled packaging. Pets require rabies vaccination. Always declare everything to the officer — the penalty for not declaring is far worse than for declaring.',
    },
  },
]

// ─── Per-city FAQs — specific to each border city ───────────────────
// Each city's extra questions capture the nuance between its
// individual crossings (which bridge is fastest, which has SENTRI,
// which is pedestrian-only, etc.).
export const CITY_FAQS: Record<string, FAQEntry[]> = {
  tijuana: [
    {
      q: {
        es: '¿Cuál es la diferencia entre San Ysidro, Otay Mesa, PedWest y Cross Border Xpress?',
        en: 'What\'s the difference between San Ysidro, Otay Mesa, PedWest, and Cross Border Xpress?',
      },
      a: {
        es: 'San Ysidro es "La Línea" — el puerto de entrada más transitado del mundo, para autos y peatones. PedWest es el cruce peatonal al oeste de San Ysidro. Otay Mesa es el cruce comercial y para residentes del este de Tijuana, con menos tráfico turístico. Cross Border Xpress (CBX) es un puente peatonal que conecta directo al Aeropuerto de Tijuana — solo para quienes tienen boleto de avión.',
        en: 'San Ysidro is "La Línea" — the busiest land port of entry in the world, for vehicles and pedestrians. PedWest is the pedestrian crossing west of San Ysidro. Otay Mesa is the commercial and east-Tijuana residential crossing, with less tourist traffic. Cross Border Xpress (CBX) is a pedestrian skybridge that connects directly to Tijuana Airport — for ticketed airline passengers only.',
      },
    },
    {
      q: {
        es: '¿Cuál es el puente más rápido en Tijuana a esta hora?',
        en: 'Which Tijuana crossing is fastest right now?',
      },
      a: {
        es: 'Depende de la hora y el día — por eso Cruzar te muestra los tiempos en vivo de los 4 cruces en la misma página. En general Otay Mesa suele ser más rápido los fines de semana y San Ysidro más rápido entre semana por la mañana, pero el patrón cambia. Revisa el comparativo de arriba.',
        en: 'Depends on the hour and the day — which is why Cruzar shows you live times for all 4 crossings on the same page. Generally Otay Mesa is faster on weekends and San Ysidro is faster on weekday mornings, but the pattern shifts. Check the live comparison above.',
      },
    },
    {
      q: {
        es: '¿Puedo cruzar caminando por PedWest?',
        en: 'Can I cross on foot through PedWest?',
      },
      a: {
        es: 'Sí, PedWest es exclusivamente peatonal y está ubicado en el lado oeste de San Ysidro. Los tiempos peatonales suelen ser diferentes a los de autos — a veces mucho más rápidos, a veces más lentos si hay eventos especiales. Cruzar muestra los tiempos peatonales por separado.',
        en: 'Yes — PedWest is pedestrian-only and located on the west side of San Ysidro. Pedestrian wait times are different from vehicle times — sometimes much faster, sometimes slower during special events. Cruzar shows pedestrian times separately.',
      },
    },
  ],

  reynosa: [
    {
      q: {
        es: '¿Cuál es la diferencia entre Hidalgo, Pharr y Anzaldúas?',
        en: 'What\'s the difference between Hidalgo, Pharr, and Anzaldúas bridges?',
      },
      a: {
        es: 'Hidalgo (McAllen) es el más céntrico y tradicionalmente el más transitado — bueno para vehículos y peatones. Pharr es principalmente comercial, ideal si llevas remolque o quieres evitar el tráfico turístico. Anzaldúas es el más nuevo de los tres, suele tener menos espera entre semana pero cierra antes por la noche. Cruzar muestra los tres lado a lado para que compares.',
        en: 'Hidalgo (McAllen) is the most central and traditionally the busiest — good for vehicles and pedestrians. Pharr is mostly commercial, ideal if you\'re towing or want to skip tourist traffic. Anzaldúas is the newest of the three, usually has less wait during the week but closes earlier at night. Cruzar shows all three side-by-side for comparison.',
      },
    },
    {
      q: {
        es: '¿Anzaldúas es más rápido que Hidalgo?',
        en: 'Is Anzaldúas faster than Hidalgo?',
      },
      a: {
        es: 'Muchas veces sí, especialmente entre semana y en horas que no son pico. Anzaldúas es más pequeño y menos conocido, así que la fila es generalmente más corta. La desventaja: cierra antes por la noche (revisa horarios). Usa los tiempos en vivo de Cruzar para comparar los dos antes de salir de casa.',
        en: 'Often yes, especially on weekdays during off-peak hours. Anzaldúas is smaller and less well-known, so the line is generally shorter. The tradeoff: it closes earlier at night (check hours). Use Cruzar\'s live times to compare the two before leaving home.',
      },
    },
    {
      q: {
        es: '¿Dónde puedo ver cámaras en vivo de los puentes de Reynosa?',
        en: 'Where can I see live cameras of the Reynosa bridges?',
      },
      a: {
        es: 'Dentro de cada página de puente en Cruzar, abajo de los tiempos en vivo, encuentras las cámaras del lado mexicano y del lado estadounidense cuando están disponibles. Algunos puentes de Reynosa todavía no tienen cámara pública, pero estamos agregando más cada semana. Mientras tanto, los reportes de la comunidad en la app te dicen cómo está la fila en tiempo real.',
        en: 'Inside each bridge page on Cruzar, below the live times, you\'ll find Mexican-side and US-side cameras when they\'re available. Some Reynosa bridges don\'t yet have public cameras, but we\'re adding more every week. In the meantime, community reports in the app tell you how the line looks in real time.',
      },
    },
  ],

  matamoros: [
    {
      q: {
        es: '¿Cuál es la diferencia entre Puente Nuevo, Puente Viejo, Los Tomates y Los Indios?',
        en: 'What\'s the difference between the Matamoros bridges?',
      },
      a: {
        es: 'Puente Nuevo (Gateway) es el más transitado, en el centro de Matamoros. Puente Viejo (B&M) es el antiguo del centro, más cercano al mercado. Los Tomates (Veterans International) está al este, por la carretera a Bagdad — generalmente más rápido porque está menos céntrico. Los Indios (Free Trade Bridge) está al oeste y es principalmente para carga comercial. Cruzar compara los cuatro en tiempo real.',
        en: 'Puente Nuevo (Gateway) is the busiest, in downtown Matamoros. Puente Viejo (B&M) is the old downtown bridge, closer to the market. Los Tomates (Veterans International) is east, on the Bagdad highway — usually faster because it\'s less central. Los Indios (Free Trade Bridge) is west and mostly commercial cargo. Cruzar compares all four in real time.',
      },
    },
    {
      q: {
        es: '¿Cuál es el puente más rápido para ir a Brownsville?',
        en: 'Which bridge is fastest to get to Brownsville?',
      },
      a: {
        es: 'Los Tomates suele ser más rápido fuera de hora pico porque no está en el centro, pero Puente Nuevo puede ser más rápido los domingos por la tarde si Los Tomates trae retenes. Cruzar muestra el tiempo actual de los cuatro — compara antes de salir.',
        en: 'Los Tomates is often faster off-peak because it\'s not downtown, but Puente Nuevo can be faster on Sunday afternoons if Los Tomates has checkpoints. Cruzar shows current times for all four — compare before you leave.',
      },
    },
  ],

  'nuevo-laredo': [
    {
      q: {
        es: '¿Cuál es la diferencia entre los 4 puentes de Laredo?',
        en: 'What\'s the difference between the 4 Laredo bridges?',
      },
      a: {
        es: 'Puente I (Gateway to the Americas) es el más céntrico, principalmente peatonal y autos locales. Puente II (Juárez-Lincoln) es el más transitado para autos particulares y es bueno para turistas. Colombia (Puente III) está al noroeste, en territorio de Nuevo León, y suele ser muy rápido porque está lejos. World Trade (Puente IV) es exclusivamente comercial — trailers y carga.',
        en: 'Bridge I (Gateway to the Americas) is the most central, mostly pedestrian and local vehicles. Bridge II (Juárez-Lincoln) is the busiest for private vehicles and the best for tourists. Colombia (Bridge III) is northwest in Nuevo León territory and is usually very fast because it\'s remote. World Trade (Bridge IV) is commercial only — trucks and freight.',
      },
    },
    {
      q: {
        es: '¿Vale la pena desviarse al puente de Colombia?',
        en: 'Is it worth detouring to the Colombia bridge?',
      },
      a: {
        es: 'Si tu destino está al norte de Laredo (Dallas, San Antonio) y los otros puentes traen 2+ horas, sí puede valer la pena — Colombia casi nunca trae fila. El problema: son unos 35 km extra de manejo en Nuevo León. Si los otros puentes están en verde, quédate en el más cercano. Cruzar compara los cuatro para que veas cuándo Colombia realmente ahorra tiempo.',
        en: 'If your destination is north of Laredo (Dallas, San Antonio) and the other bridges are 2+ hours, yes it can be worth it — Colombia almost never has a line. The downside: an extra ~22 miles of driving in Nuevo León. If the other bridges are green, stay with the closest one. Cruzar compares all four so you see when Colombia actually saves time.',
      },
    },
  ],

  juarez: [
    {
      q: {
        es: '¿Cuál es la diferencia entre BOTA, Paso del Norte, Stanton e Ysleta/Zaragoza?',
        en: 'What\'s the difference between BOTA, Paso del Norte, Stanton, and Ysleta/Zaragoza?',
      },
      a: {
        es: 'Paso del Norte (Santa Fe) es el más céntrico de los 4 puentes, bueno para peatones al centro de El Paso. Stanton es de un solo sentido (norte hacia EEUU). BOTA (Bridge of the Americas) es gratis (no cobra peaje) y conecta a la I-10 directamente. Ysleta/Zaragoza está al este y suele ser el más rápido en hora pico. Cruzar compara los cuatro en vivo.',
        en: 'Paso del Norte (Santa Fe) is the most central of the 4 bridges, good for pedestrians into downtown El Paso. Stanton is one-way northbound (into the US). BOTA (Bridge of the Americas) is free (no toll) and connects directly to I-10. Ysleta/Zaragoza is east and often fastest during rush hour. Cruzar compares all four live.',
      },
    },
    {
      q: {
        es: '¿BOTA tiene peaje?',
        en: 'Does BOTA have a toll?',
      },
      a: {
        es: 'No — el Bridge of the Americas es el único puente internacional en El Paso-Juárez que NO cobra peaje, por eso a veces tiene más fila. Los otros (PDN, Stanton, Ysleta) cobran entre $3-4 USD por auto hacia el lado estadounidense.',
        en: 'No — the Bridge of the Americas is the only international bridge in El Paso-Juárez that is toll-free, which is why it sometimes has longer lines. The others (PDN, Stanton, Ysleta) charge $3-4 USD per vehicle to the US side.',
      },
    },
  ],

  mexicali: [
    {
      q: {
        es: '¿Cuál es la diferencia entre Calexico Este y Calexico Oeste?',
        en: 'What\'s the difference between Calexico East and Calexico West?',
      },
      a: {
        es: 'Calexico Oeste (Centro) es el cruce tradicional del centro — bueno para peatones y autos al centro de Calexico. Calexico Este es más nuevo, cercano a la I-8, mejor para quien va directo hacia San Diego, Yuma o Phoenix. Este suele ser más rápido para tráfico de autopista, Oeste más rápido para tráfico local. Cruzar muestra los dos lado a lado.',
        en: 'Calexico West (Centro) is the traditional downtown crossing — good for pedestrians and vehicles heading to downtown Calexico. Calexico East is newer, closer to I-8, better if you\'re going directly to San Diego, Yuma, or Phoenix. East tends to be faster for highway traffic, West faster for local traffic. Cruzar shows both side-by-side.',
      },
    },
  ],

  nogales: [
    {
      q: {
        es: '¿Cuál es la diferencia entre DeConcini, Mariposa y Morley Gate?',
        en: 'What\'s the difference between DeConcini, Mariposa, and Morley Gate?',
      },
      a: {
        es: 'DeConcini es el cruce principal del centro para autos y peatones — el más transitado. Mariposa es el cruce comercial al oeste, para trailers y autos particulares que quieren evitar el centro. Morley Gate es exclusivamente peatonal, cercano a la zona comercial del centro de Nogales. Cruzar muestra cámaras en vivo del lado mexicano de DeConcini y Mariposa gracias a la alianza con el municipio de Heroica Nogales y El Imparcial.',
        en: 'DeConcini is the main downtown crossing for vehicles and pedestrians — the busiest. Mariposa is the commercial crossing to the west, for trucks and private vehicles wanting to skip downtown. Morley Gate is pedestrian-only, near the downtown Nogales shopping district. Cruzar shows Mexican-side live cameras for DeConcini and Mariposa thanks to the Heroica Nogales municipal and El Imparcial feed.',
      },
    },
    {
      q: {
        es: '¿Mariposa es más rápido que DeConcini?',
        en: 'Is Mariposa faster than DeConcini?',
      },
      a: {
        es: 'A menudo sí, especialmente si llevas remolque o si cruzas en hora pico del centro. Mariposa está diseñado para tráfico comercial, así que tiene más carriles y la fila rota más rápido. La desventaja es que está 5-7 km al oeste del centro, así que le agrega tiempo de manejo. Compara los dos tiempos en Cruzar antes de decidir.',
        en: 'Often yes, especially if you\'re towing or crossing during downtown rush hour. Mariposa is built for commercial traffic with more lanes and faster rotation. The tradeoff is it\'s 3-4 miles west of downtown, so it adds drive time. Compare both wait times in Cruzar before choosing.',
      },
    },
  ],
}

// Returns the merged FAQ list for a given city (shared + per-city).
export function getCityFAQs(citySlug: string): FAQEntry[] {
  const cityExtras = CITY_FAQS[citySlug] ?? []
  return [...cityExtras, ...SHARED_FAQS]
}

// Returns just the shared FAQs for a port page (without per-city extras).
// Port pages can also use getCityFAQs(citySlug) if the port belongs to
// a known city, but default is the shared set.
export function getPortFAQs(): FAQEntry[] {
  return SHARED_FAQS
}
