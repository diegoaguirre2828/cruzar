// Client-side Sentry init — Next.js 15.3+ pattern. This file used to
// be sentry.client.config.ts and lived at the repo root; the new
// convention is instrumentation-client.ts so Next.js can hook it
// into the same instrumentation lifecycle as the server/edge
// register() function.
import * as Sentry from '@sentry/nextjs'

Sentry.init({
  dsn: process.env.NEXT_PUBLIC_SENTRY_DSN,

  // Ignore benign / third-party noise that buries real bugs:
  //  - "Lock broken/stolen" fires from Supabase auth's Web-Locks API
  //    whenever a user has two tabs open; it's how Supabase hands off
  //    the auth lock between tabs. Not actionable.
  //  - "Load failed" on iOS Safari is a fetch network hiccup, not a
  //    code bug. The app already retries where it matters.
  ignoreErrors: [
    /Lock broken by another request with the 'steal' option/,
    /Lock was stolen by another request/,
    /^TypeError: Load failed$/,
    // Facebook / Instagram in-app-browser injects these. Not from our
    // code, pure platform noise. ~3-5 false alerts/day until filtered.
    /window\.webkit\.messageHandlers/,
    /enableButtonsClickedMetaDataLogging/,
    /enableDidUserTypeOnKeyboardLogging/,
    /Java object is gone/,
    /Non-Error promise rejection captured with value: undefined/,
  ],

  // Performance monitoring — 10% of transactions. Enough to catch
  // patterns, low enough to stay well under the free tier's 10k
  // transactions/month ceiling.
  tracesSampleRate: 0.1,

  // Session replay on errors ONLY — 100% of error sessions get a
  // replay so we can see exactly what the user clicked before the
  // crash. Regular sessions aren't recorded to stay under the free
  // tier's replay quota.
  replaysOnErrorSampleRate: 1.0,
  replaysSessionSampleRate: 0.0,

  integrations: [
    Sentry.replayIntegration({
      maskAllText: false,
      blockAllMedia: false,
    }),
  ],

  // Silence the SDK's internal logs in production so we don't pollute
  // users' devtools consoles. Leave on in dev so Diego can tell when
  // something is firing.
  debug: false,
})

// Re-export the router transition hook so Next.js can connect page
// navigations to Sentry traces. Required for Next.js 15+ app router.
export const onRouterTransitionStart = Sentry.captureRouterTransitionStart
