// Client-side detection helpers for device, OS, browser, and install state.
// Used by useSessionPing → /api/user/touch to populate the new
// profiles.last_seen_* columns so the admin panel can slice users by
// device and PWA status. All of this runs purely in the browser — no
// server-side UA sniffing, which is unreliable after edge caches.

export type Device = 'mobile' | 'tablet' | 'desktop'
export type Os = 'ios' | 'android' | 'windows' | 'macos' | 'linux' | 'other'
export type Browser = 'safari' | 'chrome' | 'firefox' | 'edge' | 'samsung' | 'other'
export type InstallState = 'web' | 'pwa' | 'twa' | 'capacitor'

export function detectOs(): Os {
  if (typeof navigator === 'undefined') return 'other'
  const ua = navigator.userAgent.toLowerCase()
  // iOS detection — iPadOS 13+ identifies as Mac + touch, so we check
  // maxTouchPoints as a tiebreaker.
  if (/iphone|ipad|ipod/.test(ua)) return 'ios'
  if (/mac/.test(ua) && navigator.maxTouchPoints > 1) return 'ios'
  if (/android/.test(ua)) return 'android'
  if (/windows/.test(ua)) return 'windows'
  if (/mac/.test(ua)) return 'macos'
  if (/linux/.test(ua)) return 'linux'
  return 'other'
}

export function detectDevice(): Device {
  if (typeof window === 'undefined') return 'desktop'
  const ua = navigator.userAgent.toLowerCase()
  const width = window.innerWidth
  // iPad reports as desktop Mac but has touch — catch it first.
  const isTablet = /ipad/.test(ua) || (/android/.test(ua) && !/mobile/.test(ua)) || (width >= 768 && width < 1024 && navigator.maxTouchPoints > 1)
  if (isTablet) return 'tablet'
  const isMobile = /mobile|iphone|ipod|android/.test(ua) || (width < 768 && navigator.maxTouchPoints > 0)
  return isMobile ? 'mobile' : 'desktop'
}

export function detectBrowser(): Browser {
  if (typeof navigator === 'undefined') return 'other'
  const ua = navigator.userAgent.toLowerCase()
  // Order matters — Edge and Chrome both say "chrome" in their UA, so
  // check Edge before Chrome. Same for Samsung Internet.
  if (/edg\//.test(ua)) return 'edge'
  if (/samsungbrowser/.test(ua)) return 'samsung'
  if (/firefox/.test(ua)) return 'firefox'
  if (/chrome|crios/.test(ua)) return 'chrome'
  if (/safari/.test(ua)) return 'safari'
  return 'other'
}

export function detectInstallState(): InstallState {
  if (typeof window === 'undefined') return 'web'
  // Capacitor injects a global — catches iOS App Store installs (future)
  if ((window as Window & { Capacitor?: unknown }).Capacitor) return 'capacitor'
  // Android TWA exposes a referrer of `android-app://` when launched
  // from Play Store. Also respects the Digital Asset Links verified
  // `navigator.getInstalledRelatedApps` future API.
  if (typeof document !== 'undefined' && document.referrer.startsWith('android-app://')) return 'twa'
  // Standalone display-mode → PWA installed (both iOS Add to Home Screen
  // and Android Chrome PWA install resolve here).
  const mql = window.matchMedia?.('(display-mode: standalone)')
  if (mql?.matches) return 'pwa'
  // iOS Safari legacy standalone detection
  if ((window.navigator as Navigator & { standalone?: boolean }).standalone === true) return 'pwa'
  return 'web'
}

export interface ClientFingerprint {
  device: Device
  os: Os
  browser: Browser
  install_state: InstallState
}

export function captureFingerprint(): ClientFingerprint {
  return {
    device: detectDevice(),
    os: detectOs(),
    browser: detectBrowser(),
    install_state: detectInstallState(),
  }
}
