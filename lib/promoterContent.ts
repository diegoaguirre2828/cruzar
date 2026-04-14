// Promoter content templates. Each template is a ready-to-paste
// Spanish Facebook post. When rendered in the promoter dashboard,
// {{refLink}} is replaced with the promoter's unique referral URL.
//
// Tone rules (the single most important thing):
//   - Sounds like a neighbor, NOT a tech company
//   - Uses "ahorita", "chequen", "chance", local register
//   - Never markety language ("revolutionary", "game-changer", etc.)
//   - Short — people scroll past anything longer than 4 lines
//   - Exactly ONE link, always at the end
//   - Emojis allowed but sparing
//
// Categories:
//   - morning     : 5-8am commute push
//   - midday      : 11am-1pm
//   - afternoon   : 3-5pm school/work end
//   - evening     : 7-9pm
//   - heads_up    : incident / weather / event
//   - tip         : educational — SENTRI, best times, etc.
//   - ask         : reply-to-question format
//   - evergreen   : any time

export type TemplateCategory =
  | 'morning' | 'midday' | 'afternoon' | 'evening'
  | 'heads_up' | 'tip' | 'ask' | 'evergreen' | 'page_follow'

export interface ContentTemplate {
  id: string
  category: TemplateCategory
  label: string
  text: string
  // Human-readable English translation of `text`. Shown to English-
  // reading promoters as a comprehension hint under the Spanish body.
  // IMPORTANT: this is NOT posted anywhere — 99% of border-crossing
  // group culture is Spanish. The copy button always copies `text`
  // (the Spanish). translationEn exists so a non-Spanish-speaking
  // promoter (future Raul replacement, English-dominant recruiter)
  // knows what they're about to paste.
  translationEn: string
}

export const CATEGORY_META: Record<TemplateCategory, { es: string; en: string; emoji: string }> = {
  morning:     { es: 'Mañana',             en: 'Morning',        emoji: '🌅' },
  midday:      { es: 'Mediodía',           en: 'Midday',         emoji: '☀️' },
  afternoon:   { es: 'Tarde',              en: 'Afternoon',      emoji: '🌤️' },
  evening:     { es: 'Noche',              en: 'Evening',        emoji: '🌙' },
  heads_up:    { es: 'Aviso',              en: 'Heads up',       emoji: '⚠️' },
  tip:         { es: 'Consejo',            en: 'Tip',            emoji: '💡' },
  ask:         { es: 'Respuesta pregunta', en: 'Reply to ask',   emoji: '💬' },
  evergreen:   { es: 'Siempre',            en: 'Evergreen',      emoji: '♾️' },
  page_follow: { es: 'Seguir FB',          en: 'Follow FB',      emoji: '📘' },
}

export const PROMOTER_TEMPLATES: ContentTemplate[] = [
  // ─── Morning ──────────────────────────────────────────────
  {
    id: 'morning-01',
    category: 'morning',
    label: '¿Quién va pa\' el puente hoy?',
    text: 'Buenos días raza. ¿Quién va pa\' el puente hoy? Yo siempre chequeo los tiempos antes de salir. En vivo y gratis: {{refLink}}',
    translationEn: "Morning everyone. Who's heading to the bridge today? I always check the wait times before I leave. Live and free: {{refLink}}",
  },
  {
    id: 'morning-02',
    category: 'morning',
    label: 'Para los madrugadores',
    text: 'Para los que cruzan temprano — aquí les paso los tiempos en vivo de todos los puentes. Se actualiza solito: {{refLink}}',
    translationEn: 'For the early crossers — here are the live wait times for every bridge. Updates automatically: {{refLink}}',
  },
  {
    id: 'morning-03',
    category: 'morning',
    label: 'Antes de salir',
    text: 'Antes de salir, chequen cómo anda el puente 👉 {{refLink}} (es gratis y muestra el número al instante, sin buscarle)',
    translationEn: "Before you head out, check how the bridge is looking 👉 {{refLink}} (it's free and shows you the number instantly, no searching)",
  },

  // ─── Midday ──────────────────────────────────────────────
  {
    id: 'midday-01',
    category: 'midday',
    label: 'Mediodía — los tiempos',
    text: '¿Cómo anda el puente ahorita? Aquí sale en vivo: {{refLink}} — es más rápido que andar buscando en los grupos.',
    translationEn: "How's the bridge looking right now? Here it is live: {{refLink}} — faster than scrolling through groups.",
  },
  {
    id: 'midday-02',
    category: 'midday',
    label: 'Para no perder la tarde',
    text: 'Si van a cruzar esta tarde, chequen primero los tiempos. Yo uso esta app y me ha salvado: {{refLink}}',
    translationEn: "If you're crossing this afternoon, check the wait times first. I use this app and it's saved me a lot: {{refLink}}",
  },

  // ─── Afternoon ───────────────────────────────────────────
  {
    id: 'afternoon-01',
    category: 'afternoon',
    label: 'Salida de escuela/trabajo',
    text: 'A esta hora se pone pesado el puente. Si no quieren esperar de más, chequen los tiempos primero: {{refLink}}',
    translationEn: "The bridge gets heavy around this hour. If you don't want to wait extra, check the times first: {{refLink}}",
  },
  {
    id: 'afternoon-02',
    category: 'afternoon',
    label: 'Tiempos de la tarde',
    text: 'Tiempos de puentes en vivo para la tarde 👉 {{refLink}}. Muestra Hidalgo, Pharr, Anzaldúas, Progreso, Matamoros, y todos los demás.',
    translationEn: 'Live bridge wait times for the afternoon 👉 {{refLink}}. Shows Hidalgo, Pharr, Anzaldúas, Progreso, Matamoros, and all the rest.',
  },

  // ─── Evening ─────────────────────────────────────────────
  {
    id: 'evening-01',
    category: 'evening',
    label: 'Cruzando en la noche',
    text: '¿Van a cruzar de noche? Aquí los tiempos en vivo pa\' que no se sorprendan: {{refLink}}',
    translationEn: "Crossing at night? Live wait times here so nothing catches you off guard: {{refLink}}",
  },
  {
    id: 'evening-02',
    category: 'evening',
    label: 'Noche — espera',
    text: 'A esta hora el puente cambia rápido. Esta app me avisa cuando baja la espera: {{refLink}}',
    translationEn: 'The bridge changes fast at this hour. This app pings me when the wait drops: {{refLink}}',
  },

  // ─── Heads up / incidents ────────────────────────────────
  {
    id: 'headsup-01',
    category: 'heads_up',
    label: 'Aviso general',
    text: 'OJO raza — si van a cruzar, chequen primero los tiempos en vivo. Así saben cuál puente está más fluido: {{refLink}}',
    translationEn: "Heads up everyone — if you're crossing, check the live wait times first. That way you know which bridge is moving better: {{refLink}}",
  },
  {
    id: 'headsup-02',
    category: 'heads_up',
    label: 'Clima / lluvia',
    text: 'Con la lluvia el puente se pone lento. Chequen el tiempo en vivo antes de salir 👉 {{refLink}}',
    translationEn: 'The bridge slows way down in the rain. Check the live wait time before leaving 👉 {{refLink}}',
  },
  {
    id: 'headsup-03',
    category: 'heads_up',
    label: 'Fin de semana',
    text: 'Este finde se pone pesado el puente. Pa\' los que van a cruzar, aquí los tiempos en vivo: {{refLink}}',
    translationEn: "Bridge gets heavy this weekend. For anyone crossing, here are the live wait times: {{refLink}}",
  },

  // ─── Tips ────────────────────────────────────────────────
  {
    id: 'tip-01',
    category: 'tip',
    label: 'SENTRI',
    text: 'Un consejo: SENTRI te puede ahorrar hasta 2 horas en días pesados. Y aquí pueden ver los tiempos en vivo de SENTRI vs filas normales: {{refLink}}',
    translationEn: 'Tip: SENTRI can save you up to 2 hours on heavy days. And here you can see live times for SENTRI vs regular lanes: {{refLink}}',
  },
  {
    id: 'tip-02',
    category: 'tip',
    label: 'Mejor hora para cruzar',
    text: 'La mejor hora pa\' cruzar no es la misma todos los días. Esta app te muestra cuál puente está mejor AHORITA: {{refLink}}',
    translationEn: "The best hour to cross isn't the same every day. This app shows you which bridge is best RIGHT NOW: {{refLink}}",
  },
  {
    id: 'tip-03',
    category: 'tip',
    label: 'Varios puentes',
    text: 'Si Hidalgo está pesado, a veces Anzaldúas o Pharr está más fluido. Aquí los pueden comparar todos al mismo tiempo: {{refLink}}',
    translationEn: 'If Hidalgo is heavy, sometimes Anzaldúas or Pharr is moving better. You can compare them all at the same time here: {{refLink}}',
  },

  // ─── Reply to questions ──────────────────────────────────
  {
    id: 'ask-01',
    category: 'ask',
    label: 'Responder "¿cómo anda el puente?"',
    text: 'Mira, aquí sale en vivo ahorita 👉 {{refLink}} — así no andas esperando a que alguien conteste.',
    translationEn: "Look, it's right here live 👉 {{refLink}} — that way you're not waiting for someone to reply.",
  },
  {
    id: 'ask-02',
    category: 'ask',
    label: 'Responder "¿cuál puente está mejor?"',
    text: 'Todos los puentes en vivo aquí, pa\' que compares 👉 {{refLink}}',
    translationEn: 'Every bridge live here so you can compare 👉 {{refLink}}',
  },
  {
    id: 'ask-03',
    category: 'ask',
    label: 'Responder con educación',
    text: 'Aquí pueden verlo en vivo sin tener que preguntar: {{refLink}} (se actualiza solito cada 15 min)',
    translationEn: 'You can see it live here without having to ask: {{refLink}} (updates automatically every 15 min)',
  },

  // ─── Evergreen ───────────────────────────────────────────
  {
    id: 'evergreen-01',
    category: 'evergreen',
    label: 'Presentación general',
    text: 'Raza, acabo de encontrar esta app que muestra los tiempos de todos los puentes EN VIVO. Les va a servir mucho: {{refLink}}',
    translationEn: "Everyone, I just found this app that shows wait times for every bridge LIVE. It'll help you a lot: {{refLink}}",
  },
  {
    id: 'evergreen-02',
    category: 'evergreen',
    label: 'Recomendación personal',
    text: 'Yo ya la uso y me ha ahorrado mucho tiempo en el puente. La comparto por si a alguien más le sirve: {{refLink}}',
    translationEn: "I already use it and it's saved me a lot of time at the bridge. Sharing in case it helps anyone else: {{refLink}}",
  },
  {
    id: 'evergreen-03',
    category: 'evergreen',
    label: 'Notificaciones',
    text: 'Lo mejor de todo es que te puede avisar cuando baja la espera de tu puente. Es gratis: {{refLink}}',
    translationEn: 'Best part is it can ping you when the wait at your bridge drops. Free: {{refLink}}',
  },

  // ─── FB page follow push ──────────────────────────────────
  // These point people at the Cruzar FB page, not the app. Purpose:
  // build a page-following audience so peak-hour auto-posts reach
  // them via FB push notifications. Separate funnel from the signup
  // templates above — both matter, they just do different things.
  {
    id: 'page-01',
    category: 'page_follow',
    label: 'Notificaciones cada mañana',
    text: 'Raza, les dejo la página de Cruzar — publica los tiempos de los puentes 4 veces al día. Si le dan follow, les llega notificación cada mañana antes de salir: facebook.com/cruzar',
    translationEn: "Everyone, here's the Cruzar FB page — it posts bridge wait times 4 times a day. If you follow it, you get a notification every morning before you leave: facebook.com/cruzar",
  },
  {
    id: 'page-02',
    category: 'page_follow',
    label: '4 horas clave del día',
    text: 'Sigan la página de Cruzar en FB, publica los tiempos en las 4 horas clave: mañana, mediodía, tarde y noche. Les llega notificación directo al teléfono 👉 facebook.com/cruzar',
    translationEn: 'Follow the Cruzar FB page — it posts wait times at the 4 key hours: morning, midday, afternoon, and evening. Notifications go straight to your phone 👉 facebook.com/cruzar',
  },
  {
    id: 'page-03',
    category: 'page_follow',
    label: 'Para los que se olvidan',
    text: 'Si siempre se les olvida chequear el puente antes de salir, sigan a Cruzar en FB y FB les avisa cuando publican los tiempos. Ahorra horas de fila: facebook.com/cruzar',
    translationEn: "If you always forget to check the bridge before leaving, follow Cruzar on FB and FB will notify you when they post the times. Saves you hours in line: facebook.com/cruzar",
  },
  {
    id: 'page-04',
    category: 'page_follow',
    label: 'Recomendación directa',
    text: 'Si cruzan seguido, síganse la página de Cruzar. Publica los tiempos de TODOS los puentes, en vivo, cuatro veces al día. Yo ya le di follow y no me arrepiento 👉 facebook.com/cruzar',
    translationEn: "If you cross often, follow the Cruzar page. It posts live wait times for EVERY bridge, four times a day. I already followed and I don't regret it 👉 facebook.com/cruzar",
  },
  {
    id: 'page-05',
    category: 'page_follow',
    label: 'Doble recomendación (app + página)',
    text: 'Dos cosas que les van a servir si cruzan seguido:\n\n1️⃣ La app: {{refLink}} — tiempos en vivo de todos los puentes\n2️⃣ La página de FB: facebook.com/cruzar — notificaciones en las horas clave\n\nLas dos son gratis.',
    translationEn: 'Two things that will help if you cross often:\n\n1️⃣ The app: {{refLink}} — live wait times for every bridge\n2️⃣ The FB page: facebook.com/cruzar — notifications at the key hours\n\nBoth are free.',
  },
]

// Replace {{refLink}} with the actual referral URL
export function renderTemplate(template: ContentTemplate, refLink: string): string {
  return template.text.replace(/\{\{refLink\}\}/g, refLink)
}
