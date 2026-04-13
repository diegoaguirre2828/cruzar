// Client-side tracking of reports the current device has submitted.
// Used to show "📣 Tú reportaste hace X min" badges on port cards so
// the user sees their own contribution every time they scroll past
// the bridge they reported. Same psychological loop as seeing your
// own FB post in a group feed — visible ownership reinforces the
// feeling of participation.
//
// Intentionally localStorage-only so it works for guests too (no
// auth required to submit a report, so we can't rely on user_id).
// Expires entries older than 2 hours to keep the list clean.

const KEY = 'cruzar_my_reports_v1'
const MAX_AGE_MS = 2 * 60 * 60 * 1000

interface Entry {
  portId: string
  at: number // epoch ms
  reportType?: string
  waitMinutes?: number | null
}

function readAll(): Entry[] {
  if (typeof window === 'undefined') return []
  try {
    const raw = localStorage.getItem(KEY)
    if (!raw) return []
    const parsed = JSON.parse(raw) as Entry[]
    if (!Array.isArray(parsed)) return []
    const cutoff = Date.now() - MAX_AGE_MS
    return parsed.filter((e) => e && typeof e.at === 'number' && e.at > cutoff)
  } catch {
    return []
  }
}

function writeAll(entries: Entry[]): void {
  if (typeof window === 'undefined') return
  try {
    localStorage.setItem(KEY, JSON.stringify(entries))
  } catch { /* quota exceeded or private mode — silent */ }
}

export function saveMyReport(portId: string, reportType?: string, waitMinutes?: number | null): void {
  const entries = readAll()
  const next = [
    { portId, at: Date.now(), reportType, waitMinutes: waitMinutes ?? null },
    ...entries.filter((e) => e.portId !== portId),
  ].slice(0, 20)
  writeAll(next)
  // Fire a custom event so open components can re-render without a
  // full page reload — PortCard + ticker subscribe to this.
  try {
    window.dispatchEvent(new CustomEvent('cruzar:my-reports-updated'))
  } catch { /* ignore */ }
}

export function getMyReportForPort(portId: string): Entry | null {
  const entries = readAll()
  return entries.find((e) => e.portId === portId) || null
}

export function getMyRecentReportAgeMin(portId: string): number | null {
  const entry = getMyReportForPort(portId)
  if (!entry) return null
  return Math.floor((Date.now() - entry.at) / 60000)
}

export function listMyRecentReports(): Entry[] {
  return readAll()
}
