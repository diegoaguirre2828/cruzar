// Random handle generator for Cruzar profiles. Called at signup via
// Supabase trigger + backfill + as a client-side fallback. Output is
// border-cultural (Spanish adjective + noun + 2-4 digit number)
// instead of corporate ("user12345") or offensive-prone (random
// words from a dictionary). Examples:
//
//   cruzante_norte_42
//   guardian_libre_789
//   viajante_veloz_12
//   conductor_rapido_321
//
// Used to replace email-prefix fallbacks — showing diegoaguirre@... →
// "diegoaguirre" on the public leaderboard was leaking PII. Every
// signed-up user now has a random handle by default; they can
// customize it via /mas Account settings.

const ADJECTIVES = [
  'norte',    'sur',      'libre',    'fuerte',   'rapido',   'veloz',
  'silente',  'alerta',   'sabio',    'tranquilo', 'audaz',    'feliz',
  'claro',    'dorado',   'azul',     'rojo',     'verde',    'plateado',
  'nocturno', 'diurno',   'solitario', 'valiente', 'sereno',   'firme',
  'agil',     'brillante', 'leal',    'certero',  'noble',    'amable',
]

const NOUNS = [
  'cruzante',  'viajante',  'guardian',   'vecino',   'compa',    'conductor',
  'lucero',    'puente',    'rio',        'frontera', 'bordero',  'rancher',
  'raza',      'peregrino', 'explorador', 'centinela', 'faro',    'halcon',
  'aguila',    'lobo',      'tigre',      'zorro',    'coyote',   'caballo',
  'camino',    'sendero',   'horizonte',  'mapa',     'brujula',  'estrella',
]

// Produce a 2-4 digit suffix — long enough for uniqueness at our scale,
// short enough to remember.
function randomSuffix(): string {
  return String(Math.floor(Math.random() * 9000) + 100) // 100-9099 = 3 or 4 digits
}

function randomFrom<T>(arr: readonly T[]): T {
  return arr[Math.floor(Math.random() * arr.length)]
}

export function generateHandle(): string {
  const adj = randomFrom(ADJECTIVES)
  const noun = randomFrom(NOUNS)
  const num = randomSuffix()
  return `${noun}_${adj}_${num}`
}

// Validate a user-submitted handle. Allowed: lowercase letters, digits,
// underscore, hyphen. Length 3-30. No leading/trailing separators.
// Returns null if valid, error message if not.
export function validateHandle(handle: string): string | null {
  if (typeof handle !== 'string') return 'Handle must be a string'
  const trimmed = handle.trim().toLowerCase()
  if (trimmed.length < 3) return 'Handle must be at least 3 characters'
  if (trimmed.length > 30) return 'Handle must be at most 30 characters'
  if (!/^[a-z0-9][a-z0-9_-]*[a-z0-9]$/.test(trimmed)) {
    return 'Handle can only contain lowercase letters, digits, underscore, hyphen'
  }
  return null
}

// Normalize a user-submitted handle for storage. Applies the same
// rules as validateHandle — call validateHandle first, then normalize.
export function normalizeHandle(handle: string): string {
  return handle.trim().toLowerCase()
}
