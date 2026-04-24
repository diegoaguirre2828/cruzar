// Platform detection for native-vs-web differences.
//
// Cruzar's iOS App Store build is a Capacitor wrap loading cruzar.app
// inside a WKWebView. The Capacitor config appends `CruzarIOS/1.0` to
// the User-Agent so we can differentiate iOS-app users from web users
// in BOTH server and client code paths.
//
// Why this matters: Apple guideline 3.1.1 prohibits Stripe (or any
// non-Apple-IAP) for digital subscriptions inside iOS apps. So the Pro
// upgrade button needs to be hidden / replaced on iOS until Apple IAP
// is wired. Anti-steering rules (post-Epic) allow a one-line "subscribe
// at our website" pointer, which is what we show instead.

const IOS_APP_UA_TOKEN = 'CruzarIOS'

export function isIOSAppUserAgent(userAgent: string | null | undefined): boolean {
  if (!userAgent) return false
  return userAgent.includes(IOS_APP_UA_TOKEN)
}

// Server-side: read the request UA from Next.js headers().
// Use in Server Components or route handlers.
export async function isIOSAppServer(): Promise<boolean> {
  try {
    const { headers } = await import('next/headers')
    const h = await headers()
    return isIOSAppUserAgent(h.get('user-agent'))
  } catch {
    return false
  }
}

// Client-side: read from navigator.userAgent OR Capacitor object.
// Use in Client Components.
export function isIOSAppClient(): boolean {
  if (typeof window === 'undefined') return false
  const w = window as unknown as { Capacitor?: { getPlatform?: () => string } }
  if (w.Capacitor?.getPlatform?.() === 'ios') return true
  return isIOSAppUserAgent(navigator.userAgent)
}
