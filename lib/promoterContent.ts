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
  | 'heads_up' | 'tip' | 'ask' | 'evergreen'

export interface ContentTemplate {
  id: string
  category: TemplateCategory
  label: string
  text: string
}

export const CATEGORY_META: Record<TemplateCategory, { es: string; en: string; emoji: string }> = {
  morning:    { es: 'Mañana',             en: 'Morning',        emoji: '🌅' },
  midday:     { es: 'Mediodía',           en: 'Midday',         emoji: '☀️' },
  afternoon:  { es: 'Tarde',              en: 'Afternoon',      emoji: '🌤️' },
  evening:    { es: 'Noche',              en: 'Evening',        emoji: '🌙' },
  heads_up:   { es: 'Aviso',              en: 'Heads up',       emoji: '⚠️' },
  tip:        { es: 'Consejo',            en: 'Tip',            emoji: '💡' },
  ask:        { es: 'Respuesta pregunta', en: 'Reply to ask',   emoji: '💬' },
  evergreen:  { es: 'Siempre',            en: 'Evergreen',      emoji: '♾️' },
}

export const PROMOTER_TEMPLATES: ContentTemplate[] = [
  // ─── Morning ──────────────────────────────────────────────
  {
    id: 'morning-01',
    category: 'morning',
    label: '¿Quién va pa\' el puente hoy?',
    text: 'Buenos días raza. ¿Quién va pa\' el puente hoy? Yo siempre chequeo los tiempos antes de salir. En vivo y gratis: {{refLink}}',
  },
  {
    id: 'morning-02',
    category: 'morning',
    label: 'Para los madrugadores',
    text: 'Para los que cruzan temprano — aquí les paso los tiempos en vivo de todos los puentes. Se actualiza solito: {{refLink}}',
  },
  {
    id: 'morning-03',
    category: 'morning',
    label: 'Antes de salir',
    text: 'Antes de salir, chequen cómo anda el puente 👉 {{refLink}} (es gratis y muestra el número al instante, sin buscarle)',
  },

  // ─── Midday ──────────────────────────────────────────────
  {
    id: 'midday-01',
    category: 'midday',
    label: 'Mediodía — los tiempos',
    text: '¿Cómo anda el puente ahorita? Aquí sale en vivo: {{refLink}} — es más rápido que andar buscando en los grupos.',
  },
  {
    id: 'midday-02',
    category: 'midday',
    label: 'Para no perder la tarde',
    text: 'Si van a cruzar esta tarde, chequen primero los tiempos. Yo uso esta app y me ha salvado: {{refLink}}',
  },

  // ─── Afternoon ───────────────────────────────────────────
  {
    id: 'afternoon-01',
    category: 'afternoon',
    label: 'Salida de escuela/trabajo',
    text: 'A esta hora se pone pesado el puente. Si no quieren esperar de más, chequen los tiempos primero: {{refLink}}',
  },
  {
    id: 'afternoon-02',
    category: 'afternoon',
    label: 'Tiempos de la tarde',
    text: 'Tiempos de puentes en vivo para la tarde 👉 {{refLink}}. Muestra Hidalgo, Pharr, Anzaldúas, Progreso, Matamoros, y todos los demás.',
  },

  // ─── Evening ─────────────────────────────────────────────
  {
    id: 'evening-01',
    category: 'evening',
    label: 'Cruzando en la noche',
    text: '¿Van a cruzar de noche? Aquí los tiempos en vivo pa\' que no se sorprendan: {{refLink}}',
  },
  {
    id: 'evening-02',
    category: 'evening',
    label: 'Noche — espera',
    text: 'A esta hora el puente cambia rápido. Esta app me avisa cuando baja la espera: {{refLink}}',
  },

  // ─── Heads up / incidents ────────────────────────────────
  {
    id: 'headsup-01',
    category: 'heads_up',
    label: 'Aviso general',
    text: 'OJO raza — si van a cruzar, chequen primero los tiempos en vivo. Así saben cuál puente está más fluido: {{refLink}}',
  },
  {
    id: 'headsup-02',
    category: 'heads_up',
    label: 'Clima / lluvia',
    text: 'Con la lluvia el puente se pone lento. Chequen el tiempo en vivo antes de salir 👉 {{refLink}}',
  },
  {
    id: 'headsup-03',
    category: 'heads_up',
    label: 'Fin de semana',
    text: 'Este finde se pone pesado el puente. Pa\' los que van a cruzar, aquí los tiempos en vivo: {{refLink}}',
  },

  // ─── Tips ────────────────────────────────────────────────
  {
    id: 'tip-01',
    category: 'tip',
    label: 'SENTRI',
    text: 'Un consejo: SENTRI te puede ahorrar hasta 2 horas en días pesados. Y aquí pueden ver los tiempos en vivo de SENTRI vs filas normales: {{refLink}}',
  },
  {
    id: 'tip-02',
    category: 'tip',
    label: 'Mejor hora para cruzar',
    text: 'La mejor hora pa\' cruzar no es la misma todos los días. Esta app te muestra cuál puente está mejor AHORITA: {{refLink}}',
  },
  {
    id: 'tip-03',
    category: 'tip',
    label: 'Varios puentes',
    text: 'Si Hidalgo está pesado, a veces Anzaldúas o Pharr está más fluido. Aquí los pueden comparar todos al mismo tiempo: {{refLink}}',
  },

  // ─── Reply to questions ──────────────────────────────────
  {
    id: 'ask-01',
    category: 'ask',
    label: 'Responder "¿cómo anda el puente?"',
    text: 'Mira, aquí sale en vivo ahorita 👉 {{refLink}} — así no andas esperando a que alguien conteste.',
  },
  {
    id: 'ask-02',
    category: 'ask',
    label: 'Responder "¿cuál puente está mejor?"',
    text: 'Todos los puentes en vivo aquí, pa\' que compares 👉 {{refLink}}',
  },
  {
    id: 'ask-03',
    category: 'ask',
    label: 'Responder con educación',
    text: 'Aquí pueden verlo en vivo sin tener que preguntar: {{refLink}} (se actualiza solito cada 15 min)',
  },

  // ─── Evergreen ───────────────────────────────────────────
  {
    id: 'evergreen-01',
    category: 'evergreen',
    label: 'Presentación general',
    text: 'Raza, acabo de encontrar esta app que muestra los tiempos de todos los puentes EN VIVO. Les va a servir mucho: {{refLink}}',
  },
  {
    id: 'evergreen-02',
    category: 'evergreen',
    label: 'Recomendación personal',
    text: 'Yo ya la uso y me ha ahorrado mucho tiempo en el puente. La comparto por si a alguien más le sirve: {{refLink}}',
  },
  {
    id: 'evergreen-03',
    category: 'evergreen',
    label: 'Notificaciones',
    text: 'Lo mejor de todo es que te puede avisar cuando baja la espera de tu puente. Es gratis: {{refLink}}',
  },
]

// Replace {{refLink}} with the actual referral URL
export function renderTemplate(template: ContentTemplate, refLink: string): string {
  return template.text.replace(/\{\{refLink\}\}/g, refLink)
}
