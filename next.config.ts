import type { NextConfig } from "next";
import { withSentryConfig } from "@sentry/nextjs";

const nextConfig: NextConfig = {
  // Redirects for typo URLs Diego has been pasting in FB groups.
  // /mapas (plural) → /mapa (singular, the real route). Without this
  // every FB post that uses the plural form 404s, killing inbound clicks.
  async redirects() {
    return [
      { source: '/mapas', destination: '/mapa', permanent: true },
      { source: '/mapas/:path*', destination: '/mapa', permanent: true },
      // Common other typos people guess
      { source: '/cameras', destination: '/camaras', permanent: true },
      { source: '/cameras/:path*', destination: '/camaras', permanent: true },
    ]
  },
  // Bundle the ffmpeg-static binary with the camera-analysis cron so it
  // can extract a single JPEG frame from HLS streams (Heroica Nogales
  // pedestrian platforms, El Paso zoocams, etc.) and feed them to Claude
  // Haiku just like the snapshot-able image/iframe feeds. Without this
  // include, Vercel's NFT tracer ships the JS but not the linux-x64
  // binary that ffmpeg-static drops at install time.
  outputFileTracingIncludes: {
    '/api/cron/analyze-bridge-cameras': ['./node_modules/ffmpeg-static/**'],
  },
};

export default withSentryConfig(nextConfig, {
  // Suppresses source map uploading logs during build
  silent: !process.env.CI,

  org: "cruzar",
  project: "javascript-nextjs",

  // Upload source maps for readable stack traces. Requires
  // SENTRY_AUTH_TOKEN on Vercel — set in Vercel → Settings →
  // Environment Variables. Diego can grab the token from the
  // Sentry dashboard at Settings → Account → Auth Tokens.
  authToken: process.env.SENTRY_AUTH_TOKEN,

  // Upload a larger set of source maps for prettier stack traces (increases build time)
  widenClientFileUpload: true,

  // Route browser requests to Sentry through a Next.js rewrite to
  // bypass ad-blockers that would otherwise silently drop error
  // events. Critical for a border-commuter audience where ad blockers
  // are common on mobile PWA installs.
  tunnelRoute: "/monitoring",
});
