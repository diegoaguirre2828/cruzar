// Global capture of the Android Chrome `beforeinstallprompt` event.
//
// Why this file exists: the browser fires `beforeinstallprompt` EXACTLY
// ONCE per page load (on whichever page the user lands on). If the only
// listener is mounted inside a specific React component (InstallGuide,
// FirstVisitInstallSheet's expanded state, DashboardInstallBanner),
// visitors who land on `/camaras` or `/` never reach a page where that
// listener is active. The prompt fires, nobody catches it, Android
// silently discards it, and the user never sees a native install
// button. The pre-surgery install rate was 8.3% (17/204) and this is
// the single biggest mechanical leak.
//
// Shape: tiny module-level store (no zustand dep). A single BIPEvent
// reference + a Set of subscriber callbacks. Any component can:
//   - `subscribe(fn)` to get live updates (fires immediately with
//     current state)
//   - `getPrompt()` for a synchronous read
//   - `consume()` to take the event + clear the store (call this right
//     before `event.prompt()` so no other component reuses it)
//
// Lives above React's tree so it survives route changes.

export type BIPEvent = Event & {
  prompt: () => Promise<void>
  userChoice: Promise<{ outcome: 'accepted' | 'dismissed' }>
}

let deferredPrompt: BIPEvent | null = null
const listeners = new Set<(e: BIPEvent | null) => void>()

export function capture(e: BIPEvent): void {
  deferredPrompt = e
  listeners.forEach((fn) => fn(e))
}

export function consume(): BIPEvent | null {
  const e = deferredPrompt
  deferredPrompt = null
  listeners.forEach((fn) => fn(null))
  return e
}

export function getPrompt(): BIPEvent | null {
  return deferredPrompt
}

export function subscribe(fn: (e: BIPEvent | null) => void): () => void {
  listeners.add(fn)
  return () => {
    listeners.delete(fn)
  }
}
