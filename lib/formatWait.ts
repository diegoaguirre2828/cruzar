// Shared wait-time label formatter. Anything ≥ 60 min reads as
// "1h 47m" instead of "107 min" — users scan hours/minutes much
// faster than 3-digit minute counts, and "107 min" reads as
// uncomfortably abstract ("wait, is that almost 2 hours?").

export function formatWaitLabel(
  min: number | null | undefined,
  lang: 'es' | 'en' = 'es',
): string {
  if (min == null) return '—'
  if (min === 0) return lang === 'es' ? '<1 min' : '<1 min'
  if (min < 60) return `${min} min`
  const h = Math.floor(min / 60)
  const m = min % 60
  if (m === 0) return `${h}h`
  return `${h}h ${m}m`
}

// For places that render the number + unit separately (e.g. a giant
// headline with a smaller "min" suffix). Returns { value, unit }.
export function splitWaitLabel(min: number | null | undefined): { value: string; unit: string } {
  if (min == null) return { value: '--', unit: 'min' }
  if (min === 0) return { value: '<1', unit: 'min' }
  if (min < 60) return { value: String(min), unit: 'min' }
  const h = Math.floor(min / 60)
  const m = min % 60
  if (m === 0) return { value: String(h), unit: 'h' }
  return { value: `${h}h ${m}`, unit: 'm' }
}
