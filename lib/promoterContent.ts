// Promoter content templates. Each template is a ready-to-paste
// Spanish Facebook post. Copy button always copies the Spanish text
// regardless of the chrome language — border-crossing FB group
// culture is 99% Spanish.
//
// ─── IMPORTANT: no links in template text ────────────────────────
//
// Facebook group admins reject posts that contain URLs, especially
// short/ref links. Every template here uses the phrasing
// "cruzar punto app en tu navegador" (or similar) so users read
// the app name, type it manually, and the post survives admin
// review. This costs us per-template ref attribution but the
// trade-off is acceptance — zero rejected posts > perfect tracking.
//
// ─── Tone rules ──────────────────────────────────────────────────
//
//   - Sounds like a neighbor, NOT a tech company
//   - "ahorita", "chequen", "chance", local register
//   - Never markety language ("revolutionary", "game-changer")
//   - Short — people scroll past anything longer than 4 lines
//   - NO URLs, ever — phrase as "busca cruzar punto app"
//   - Emojis sparingly
//
// ─── Categories ──────────────────────────────────────────────────
//
//   - morning     : 5-8am commute push
//   - midday      : 11am-1pm
//   - afternoon   : 3-5pm school/work end
//   - evening     : 7-9pm
//   - heads_up    : incident / weather / long-line commiseration
//   - tip         : educational — SENTRI, best times, time wasted
//   - ask         : reply-to-question format (rates, which bridge, etc)
//   - evergreen   : any time
//   - page_follow : FB page follow recruitment

export type TemplateCategory =
  | 'morning' | 'midday' | 'afternoon' | 'evening'
  | 'heads_up' | 'tip' | 'ask' | 'evergreen' | 'page_follow'

export interface ContentTemplate {
  id: string
  category: TemplateCategory
  label: string       // Spanish label
  labelEn: string     // English label for chrome toggle
  text: string        // Spanish body — what the copy button copies
  translationEn: string  // English translation shown as comprehension hint
}

export const CATEGORY_META: Record<TemplateCategory, { es: string; en: string; emoji: string }> = {
  morning:     { es: 'Mañana',             en: 'Morning',        emoji: '🌅' },
  midday:      { es: 'Mediodía',           en: 'Midday',         emoji: '☀️' },
  afternoon:   { es: 'Tarde',              en: 'Afternoon',      emoji: '🌤️' },
  evening:     { es: 'Noche',              en: 'Evening',        emoji: '🌙' },
  heads_up:    { es: 'Aviso',              en: 'Heads up',       emoji: '⚠️' },
  tip:         { es: 'Consejo',            en: 'Tip',            emoji: '💡' },
  ask:         { es: 'Respuesta',          en: 'Reply',          emoji: '💬' },
  evergreen:   { es: 'Siempre',            en: 'Evergreen',      emoji: '♾️' },
  page_follow: { es: 'Seguir FB',          en: 'Follow FB',      emoji: '📘' },
}

export const PROMOTER_TEMPLATES: ContentTemplate[] = [
  // ─── Morning ──────────────────────────────────────────────
  {
    id: 'morning-01',
    category: 'morning',
    label: '¿Quién va pa\' el puente?',
    labelEn: "Who's going to the bridge?",
    text: 'Buenos días raza. ¿Quién va pa\' el puente hoy? Yo siempre chequeo los tiempos antes de salir. Busca "cruzar punto app" en tu navegador — sale al instante, en vivo y gratis.',
    translationEn: 'Morning everyone. Who\'s heading to the bridge today? I always check the wait times before I leave. Search "cruzar dot app" in your browser — shows instantly, live and free.',
  },
  {
    id: 'morning-02',
    category: 'morning',
    label: 'Pa\' los madrugadores',
    labelEn: 'For early risers',
    text: 'Para los que cruzan temprano — hay una app que muestra los tiempos en vivo de todos los puentes, se actualiza solita. Entra a cruzar punto app en tu navegador, es gratis.',
    translationEn: 'For the early crossers — there\'s an app that shows live wait times for every bridge, updates automatically. Go to cruzar dot app in your browser, it\'s free.',
  },
  {
    id: 'morning-03',
    category: 'morning',
    label: 'Antes de salir',
    labelEn: 'Before you leave',
    text: 'Antes de salir de la casa, chequen cómo anda el puente. Busca cruzar punto app — muestra el número al instante, sin tener que buscarle en los grupos.',
    translationEn: 'Before you leave the house, check how the bridge is looking. Search cruzar dot app — shows the number instantly, without digging through groups.',
  },

  // ─── Midday ──────────────────────────────────────────────
  {
    id: 'midday-01',
    category: 'midday',
    label: 'Tiempos ahorita',
    labelEn: 'Wait times right now',
    text: '¿Cómo anda el puente ahorita? Hay una app gratis que te lo dice en vivo — es más rápido que andar buscando en los grupos. Se llama cruzar, entra a cruzar punto app.',
    translationEn: 'How\'s the bridge looking right now? There\'s a free app that tells you live — faster than scrolling through groups. It\'s called cruzar, go to cruzar dot app.',
  },
  {
    id: 'midday-02',
    category: 'midday',
    label: 'No pierdas la tarde',
    labelEn: "Don't waste your afternoon",
    text: 'Si van a cruzar esta tarde, chequen primero los tiempos. Yo uso cruzar punto app y me ha ahorrado horas — compara todos los puentes al mismo tiempo pa\' que sepas cuál está más fluido.',
    translationEn: 'If you\'re crossing this afternoon, check the wait times first. I use cruzar dot app and it\'s saved me hours — compares every bridge at once so you know which is moving best.',
  },

  // ─── Afternoon ───────────────────────────────────────────
  {
    id: 'afternoon-01',
    category: 'afternoon',
    label: 'Salida escuela / trabajo',
    labelEn: 'School / work end',
    text: 'A esta hora se pone pesado el puente. Si no quieren esperar de más, hay una app gratis que te muestra los tiempos en vivo — entra a cruzar punto app en tu navegador.',
    translationEn: 'The bridge gets heavy around this hour. If you don\'t want to wait extra, there\'s a free app that shows you live wait times — go to cruzar dot app in your browser.',
  },
  {
    id: 'afternoon-02',
    category: 'afternoon',
    label: 'Tiempos de la tarde',
    labelEn: 'Afternoon times',
    text: 'Tiempos de puentes en vivo para la tarde — entra a cruzar punto app en tu navegador. Muestra todos los puentes de la frontera, no nomás uno. Es gratis.',
    translationEn: 'Live bridge wait times for the afternoon — go to cruzar dot app in your browser. Shows every bridge on the border, not just one. Free.',
  },

  // ─── Evening ─────────────────────────────────────────────
  {
    id: 'evening-01',
    category: 'evening',
    label: 'Cruzando en la noche',
    labelEn: 'Crossing at night',
    text: '¿Van a cruzar de noche? Chequen primero los tiempos en cruzar punto app pa\' que no se sorprendan. A esta hora el puente cambia rápido y vale la pena saber.',
    translationEn: 'Crossing at night? Check the wait times first at cruzar dot app so nothing catches you off guard. The bridge changes fast at this hour and it\'s worth knowing.',
  },
  {
    id: 'evening-02',
    category: 'evening',
    label: 'Espera nocturna',
    labelEn: 'Night wait',
    text: 'Hay una app que te avisa cuando baja la espera de tu puente, incluso de noche. Entra a cruzar punto app en tu navegador, es gratis.',
    translationEn: 'There\'s an app that alerts you when the wait at your bridge drops, even at night. Go to cruzar dot app in your browser, it\'s free.',
  },

  // ─── Heads up / incidents ────────────────────────────────
  {
    id: 'headsup-01',
    category: 'heads_up',
    label: 'Aviso general',
    labelEn: 'General heads up',
    text: 'OJO raza — si van a cruzar, chequen primero los tiempos en vivo. Hay una app gratis llamada cruzar, entra a cruzar punto app en tu navegador y sabes al instante cuál puente está más fluido.',
    translationEn: 'Heads up everyone — if you\'re crossing, check the live wait times first. There\'s a free app called cruzar, go to cruzar dot app in your browser and you\'ll instantly know which bridge is moving best.',
  },
  {
    id: 'headsup-02',
    category: 'heads_up',
    label: 'Clima / lluvia',
    labelEn: 'Weather / rain',
    text: 'Con la lluvia el puente se pone lento. Chequen cruzar punto app antes de salir — muestra los tiempos en vivo y los reportes de la gente en la fila.',
    translationEn: 'The bridge slows way down in the rain. Check cruzar dot app before leaving — shows live wait times and reports from people already in line.',
  },
  {
    id: 'headsup-03',
    category: 'heads_up',
    label: 'Fin de semana',
    labelEn: 'Weekend',
    text: 'Este finde se pone pesado el puente. Pa\' los que van a cruzar, chequen los tiempos en cruzar punto app — te ayuda a escoger la mejor hora.',
    translationEn: 'The bridge gets heavy this weekend. For anyone crossing, check the wait times at cruzar dot app — helps you pick the best hour.',
  },
  {
    id: 'headsup-04',
    category: 'heads_up',
    label: 'Fila larga (commiseration)',
    labelEn: 'Long line reply',
    text: 'Qué fila más pesada 😩. La próxima vez, antes de salir de casa, entra a cruzar punto app y chequea los tiempos — muestra todos los puentes al instante. ¿Cuántas horas de tu vida piensas seguir esperando así?',
    translationEn: 'That\'s a brutal line 😩. Next time, before you leave home, go to cruzar dot app and check the wait times — shows every bridge instantly. How many hours of your life are you willing to keep spending like this?',
  },

  // ─── Tips ────────────────────────────────────────────────
  {
    id: 'tip-01',
    category: 'tip',
    label: 'SENTRI',
    labelEn: 'SENTRI',
    text: 'Un consejo: SENTRI te puede ahorrar hasta 2 horas en días pesados. En cruzar punto app pueden ver los tiempos en vivo de SENTRI vs filas normales pa\' saber cuándo vale la pena.',
    translationEn: 'Tip: SENTRI can save you up to 2 hours on heavy days. On cruzar dot app you can see live times for SENTRI vs regular lanes to know when it\'s worth it.',
  },
  {
    id: 'tip-02',
    category: 'tip',
    label: 'Mejor hora para cruzar',
    labelEn: 'Best hour to cross',
    text: 'La mejor hora pa\' cruzar no es la misma todos los días. Cruzar punto app te muestra cuál puente está mejor AHORITA y cuál es la mejor hora pa\' mañana basado en datos.',
    translationEn: 'The best hour to cross isn\'t the same every day. Cruzar dot app shows you which bridge is best RIGHT NOW and what\'s the best hour tomorrow based on data.',
  },
  {
    id: 'tip-03',
    category: 'tip',
    label: 'Compara puentes',
    labelEn: 'Compare bridges',
    text: 'Cuando un puente está pesado, otros a veces están fluidos. En cruzar punto app los pueden comparar todos al mismo tiempo, no nomás uno. Te ahorra andar probando.',
    translationEn: 'When one bridge is heavy, others are sometimes flowing. On cruzar dot app you can compare them all at the same time, not just one. Saves you from trying each one.',
  },
  {
    id: 'tip-04',
    category: 'tip',
    label: 'Vida en el puente',
    labelEn: 'Life at the bridge',
    text: '¿Alguna vez has calculado cuánto tiempo de tu vida pasas esperando en el puente? Cruzar punto app te ayuda a reducir eso — te muestra cuál puente está más rápido y te avisa cuando baja la espera de tu cruce.',
    translationEn: 'Ever calculated how much of your life you spend waiting at the bridge? Cruzar dot app helps you cut that down — shows you which bridge is fastest and alerts you when your crossing\'s wait drops.',
  },

  // ─── Reply to questions ──────────────────────────────────
  {
    id: 'ask-01',
    category: 'ask',
    label: '"¿Cómo anda el puente?"',
    labelEn: '"How\'s the bridge?"',
    text: 'En cruzar punto app sale en vivo, no tienes que esperar a que alguien conteste. Muestra todos los puentes al instante. Es gratis.',
    translationEn: 'It\'s on cruzar dot app live, you don\'t have to wait for someone to answer. Shows every bridge instantly. Free.',
  },
  {
    id: 'ask-02',
    category: 'ask',
    label: '"¿Cuál puente está mejor?"',
    labelEn: '"Which bridge is best?"',
    text: 'En cruzar punto app los puedes comparar todos al mismo tiempo. Se actualiza cada pocos minutos y tiene reportes de la gente que ya cruzó.',
    translationEn: 'On cruzar dot app you can compare all of them at once. Updates every few minutes and has reports from people who already crossed.',
  },
  {
    id: 'ask-03',
    category: 'ask',
    label: '"¿Tipo de cambio hoy?"',
    labelEn: '"Exchange rate today?"',
    text: 'Cruzar punto app tiene esa info también. Además de los tiempos de los puentes muestra el tipo de cambio del día y los reportes de las mejores casas de cambio en cada ciudad. Todo en un solo lugar, gratis.',
    translationEn: 'Cruzar dot app has that info too. Besides bridge wait times it shows today\'s exchange rate and reports on the best casas de cambio in each city. All in one place, free.',
  },
  {
    id: 'ask-04',
    category: 'ask',
    label: '"¿Dónde hay mejor cambio?"',
    labelEn: '"Where\'s the best exchange?"',
    text: 'En cruzar punto app tienen una lista de casas de cambio con los reportes de la gente sobre las mejores tasas. Gratis y se actualiza con los reportes de la comunidad.',
    translationEn: 'On cruzar dot app they have a list of casas de cambio with people\'s reports on the best rates. Free and updates with community reports.',
  },
  {
    id: 'ask-05',
    category: 'ask',
    label: '"¿A qué hora bajan los tiempos?"',
    labelEn: '"When do wait times drop?"',
    text: 'En cruzar punto app hay una gráfica de patrones por hora pa\' cada puente. Te muestra cuándo suelen bajar los tiempos basado en los datos de las semanas pasadas. Así planeas tu cruce con cabeza.',
    translationEn: 'On cruzar dot app there\'s an hourly pattern chart for each bridge. Shows you when wait times usually drop based on data from past weeks. That way you plan your crossing smart.',
  },
  {
    id: 'ask-06',
    category: 'ask',
    label: 'Recomendación educada',
    labelEn: 'Educated recommendation',
    text: 'Sin ofender, pero ya hay una app gratis que muestra todo esto en vivo. Se llama cruzar — entra a cruzar punto app en tu navegador. Es más rápido que esperar a que alguien conteste en el grupo.',
    translationEn: 'No offense, but there\'s already a free app that shows all this live. It\'s called cruzar — go to cruzar dot app in your browser. Faster than waiting for someone to reply in the group.',
  },

  // ─── Evergreen ───────────────────────────────────────────
  {
    id: 'evergreen-01',
    category: 'evergreen',
    label: 'Presentación general',
    labelEn: 'General intro',
    text: 'Raza, les paso el dato: hay una app que muestra los tiempos de todos los puentes EN VIVO, gratis. Se llama cruzar — entra a cruzar punto app en tu navegador. Les va a servir mucho si cruzan seguido.',
    translationEn: 'Everyone, here\'s the tip: there\'s an app that shows LIVE wait times for every bridge, free. It\'s called cruzar — go to cruzar dot app in your browser. It\'ll help you a lot if you cross often.',
  },
  {
    id: 'evergreen-02',
    category: 'evergreen',
    label: 'Recomendación personal',
    labelEn: 'Personal recommendation',
    text: 'Yo ya la uso y me ha ahorrado mucho tiempo. Se llama cruzar, entra a cruzar punto app en tu navegador. Muestra todos los puentes en vivo, tiene alertas, y es totalmente gratis. La comparto por si a alguien más le sirve.',
    translationEn: 'I already use it and it\'s saved me a lot of time. It\'s called cruzar, go to cruzar dot app in your browser. Shows every bridge live, has alerts, and it\'s completely free. Sharing in case it helps someone else.',
  },
  {
    id: 'evergreen-03',
    category: 'evergreen',
    label: 'Notificaciones',
    labelEn: 'Notifications',
    text: 'Lo mejor de cruzar punto app es que te puede avisar cuando baja la espera de tu puente. Ya no tienes que andar chequeando cada rato. Es gratis, pruébenlo.',
    translationEn: 'The best part of cruzar dot app is that it can alert you when the wait at your bridge drops. No more checking every few minutes. It\'s free, try it.',
  },

  // ─── FB page follow push ──────────────────────────────────
  {
    id: 'page-01',
    category: 'page_follow',
    label: 'Notificaciones diarias',
    labelEn: 'Daily notifications',
    text: 'Raza, les dejo esta página de FB — publica los tiempos de los puentes 4 veces al día (mañana, mediodía, tarde, noche). Si le dan follow les llega notificación cada vez, ya no andan buscando. Búsquenla como "Cruzar - Tiempos de Puentes" en FB.',
    translationEn: 'Everyone, here\'s an FB page — posts bridge wait times 4 times a day (morning, midday, afternoon, evening). If you follow it you get a notification each time, no more searching. Look it up as "Cruzar - Tiempos de Puentes" on FB.',
  },
  {
    id: 'page-02',
    category: 'page_follow',
    label: '4 horas clave',
    labelEn: '4 key hours',
    text: 'Sigan la página "Cruzar - Tiempos de Puentes" en Facebook. Publica los tiempos en 4 horas clave: mañana, mediodía, tarde y noche. La notificación te llega directo al teléfono.',
    translationEn: 'Follow the "Cruzar - Tiempos de Puentes" page on Facebook. Posts wait times at 4 key hours: morning, midday, afternoon and evening. Notification comes straight to your phone.',
  },
  {
    id: 'page-03',
    category: 'page_follow',
    label: 'Pa\' los olvidadizos',
    labelEn: 'For the forgetful',
    text: 'Si siempre se les olvida chequear el puente antes de salir, sigan la página "Cruzar - Tiempos de Puentes" en FB. Publican los tiempos cuatro veces al día y FB te avisa directo al teléfono. Ahorra horas de fila.',
    translationEn: 'If you always forget to check the bridge before leaving, follow "Cruzar - Tiempos de Puentes" on FB. They post wait times four times a day and FB notifies you directly. Saves hours in line.',
  },
  {
    id: 'page-04',
    category: 'page_follow',
    label: 'Recomendación directa',
    labelEn: 'Direct recommendation',
    text: 'Si cruzan seguido, vale la pena seguir la página "Cruzar - Tiempos de Puentes" en FB. Publica los tiempos de TODOS los puentes en vivo, cuatro veces al día. Yo ya le di follow y no me arrepiento.',
    translationEn: 'If you cross often, worth following the "Cruzar - Tiempos de Puentes" page on FB. Posts LIVE wait times for EVERY bridge, four times a day. I already followed and don\'t regret it.',
  },
  {
    id: 'page-05',
    category: 'page_follow',
    label: 'Doble recomendación',
    labelEn: 'Double recommendation',
    text: 'Dos cosas que les van a servir si cruzan seguido:\n\n1️⃣ La app: entra a cruzar punto app en tu navegador — tiempos en vivo de todos los puentes\n2️⃣ La página de FB "Cruzar - Tiempos de Puentes" — notificaciones cuatro veces al día\n\nLas dos son gratis.',
    translationEn: 'Two things that will help if you cross often:\n\n1️⃣ The app: go to cruzar dot app in your browser — live wait times for every bridge\n2️⃣ The FB page "Cruzar - Tiempos de Puentes" — notifications four times a day\n\nBoth are free.',
  },
]

// Replace {{refLink}} with the actual referral URL. Kept for
// backwards compat even though the current templates don't use
// it — future templates might, and the existing renderTemplate
// call in PromoterDashboard.tsx still calls this.
export function renderTemplate(template: ContentTemplate, refLink: string): string {
  return template.text.replace(/\{\{refLink\}\}/g, refLink)
}
