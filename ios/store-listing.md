# Cruzar — App Store (iOS) listing copy

Everything App Store Connect will ask for, ES + EN, ready to paste.
Primary locale: Spanish (Mexico). Secondary: English (U.S.).

Audit status 2026-04-20: NOT submission-ready yet. See
`ios/pre-submission-blockers.md` for the Apple hard-rejects that
must land before paying the $99 and enrolling.

---

## App name (30 chars max)

- **ES-MX / EN-US:** `Cruzar`  (6 chars — brand only)

The "Border Wait Times" tagline was undersell: app also does cameras,
reports, alerts, exchange rates, trucker tools, negocios. Name is
pure brand; scope lives in the subtitle where it gets indexed for
search.

## Subtitle (30 chars max — heavily indexed for ASO)

- **ES-MX:** `Puentes, cámaras y reportes`  (27)
- **EN-US:** `Border: waits, cams, reports`  (28)

## Promotional text (170 chars max — editable without review)

- **ES-MX:** `Tiempos de espera en vivo de los puentes US–México. Cámaras, reportes de la banda, alertas push y tipo de cambio real. Hecho en el Valle.`
- **EN-US:** `Live US–Mexico border wait times. Bridge cameras, community reports, push alerts, and real casa de cambio rates. Built in the RGV.`

## Keywords (100 chars max, comma-separated, NO spaces after comma)

- **ES-MX:** `frontera,puente,espera,tiempos,cbp,reynosa,matamoros,mcallen,laredo,cruzar,sentri,cambio`
- **EN-US:** `border,bridge,wait,times,cbp,mexico,matamoros,mcallen,laredo,crossing,sentri,sentry,fx`

## Description (4000 chars max)

Reuse from `android/store-listing.md` Full description section. Same
copy works on both stores. Only diff: remove any Android-specific
store references.

## What's New — Version 1.0.0

- **ES-MX:** `Primera versión de Cruzar. Tiempos de espera en vivo de los puentes US–México, reportes de la banda, cámaras en vivo, alertas push, y tipo de cambio reportado por la comunidad.`
- **EN-US:** `First release of Cruzar. Live US–Mexico border wait times, community reports, live bridge cameras, push alerts, and community-reported exchange rates.`

---

## Category

- **Primary:** Navigation
- **Secondary:** Travel

(Play Store uses "Maps & Navigation" + "Travel & Local" — same intent.)

## Age Rating

**12+** — Apple's questionnaire triggers 12+ because we have moderated
user-generated text (community reports). All other categories =
None. Do NOT claim 4+: user-submitted text is the trigger.

Play Store was declared 18+ for Stripe subscription flow reasons —
not an Apple concern since iOS paywall path (if any) uses Apple IAP,
not external checkout.

## Pricing

- **App price:** Free
- **In-App Purchases:**
  - `Cruzar Pro — Monthly` — $2.99/month auto-renewing subscription
    (Pro tier: alerts, predictions, weekly digest, route optimizer)
- Business tier ($49.99/mo) is **hidden on iOS** — B2B dispatcher
  product, handled on web only. iOS build must not link to or mention
  the Business tier pricing page.

## Contact URLs

- **Support URL:** https://cruzar.app/support
- **Marketing URL:** https://cruzar.app
- **Privacy Policy URL:** https://cruzar.app/privacy

Contact email: **hello@cruzar.app** (normalized 2026-04-20 away from
cruzabusiness@gmail.com across Footer, Privacy, Terms, data-deletion,
signup error, business page. VAPID push internal mailto is
unchanged — that's protocol contact, not user-facing.)

---

## App Privacy — nutrition labels

Declare in App Store Connect → App Privacy. Apple wants specific
data types per category, whether linked to identity, and whether
used for tracking.

### Data Linked to You

| Data Type | Purpose | Tracking? |
|---|---|---|
| Email Address | Account, alerts, customer support | No |
| Name (display_name) | Product personalization, leaderboard | No |
| User ID (Supabase `user.id`) | App functionality | No |
| Purchase History | App functionality (subscription state) | No |
| Precise Location | App functionality (nearest crossing, geofence) | No |
| Coarse Location | App functionality (region default) | No |
| Push Token | Alert delivery | No |
| User-Generated Content (crossing reports, exchange reports) | Product personalization, App functionality | No |
| Crash Data | Diagnostics (Sentry) | No |
| Performance Data | Diagnostics (Sentry) | No |

### Data Not Linked to You

| Data Type | Purpose |
|---|---|
| Product Interaction | Analytics (Vercel Speed Insights) |

### Data Used to Track You

**None.** Cruzar does not share any identifier with data brokers,
advertisers, or third-party SDKs for cross-app/site tracking. No
IDFA request; no Facebook SDK; no AppsFlyer; no Mixpanel. AdSense
is placeholder-only and not live in the app build.

### PrivacyInfo.xcprivacy

Required by Apple since Q1 2024. Include in the iOS project at
`App/App/PrivacyInfo.xcprivacy`. Declares: NSPrivacyCollectedDataTypes
(mirroring the table above), NSPrivacyAccessedAPITypes (file
timestamp, user defaults — standard for Capacitor).

---

## Permission usage strings (Info.plist)

iOS prompts the user the first time an API is used. Strings must
explain WHY. Bilingual fallback handled via `InfoPlist.strings`
files — `es.lproj/InfoPlist.strings` and `en.lproj/InfoPlist.strings`.

| Key | ES | EN |
|---|---|---|
| `NSLocationWhenInUseUsageDescription` | Cruzar usa tu ubicación para mostrarte el puente más cercano y reconocer cuando llegas al cruce. | Cruzar uses your location to show the nearest crossing and recognize when you arrive at the bridge. |
| `NSLocationAlwaysAndWhenInUseUsageDescription` | Para avisarte cuando baje la espera en tu cruce favorito, incluso con la app cerrada. | To notify you when wait times drop at your favorite crossing, even when the app is closed. |
| `NSUserNotificationsUsageDescription` | Para enviarte alertas cuando la espera baje de tu umbral en los puentes que sigues. | To send you alerts when wait times drop below your threshold at crossings you follow. |

Camera/Photos/Contacts/Mic: **not requested.** Cruzar does not use
these APIs. If `port-photos` upload ever becomes user-driven on iOS,
add `NSPhotoLibraryUsageDescription` at that point.

---

## Review notes (App Store Connect → App Review Information)

```
Cruzar is a real-time US–Mexico border crossing wait time app. All
wait time data comes from the official U.S. Customs and Border
Protection public API (https://bwt.cbp.gov/api/bwtnew), refreshed
every 15 minutes. Cruzar is not affiliated with, endorsed by, or
operated on behalf of CBP or any government agency — this is
prominently disclaimed on the home screen and in the privacy policy.

Community features (crossing reports, exchange rate reports, negocios
directory) are user-generated text content. Reports are moderated by
an automatic text-quality cron job that flags and auto-dismisses
abusive language. A manual admin review queue handles edge cases.
Users can report any other user's report or business listing via a
one-tap flag button; flagged content is hidden immediately pending
admin review.

There is a one-tap "Delete My Account" button on the Data Deletion
screen for any logged-in user (Guideline 5.1.1(v)). Deletion is
immediate and cannot be undone.

Pro subscription ($2.99/month) unlocks: custom wait-time alerts,
historical patterns, route optimizer, weekly email digest. All Pro
features work offline after first sync and do not require external
purchases. Subscription uses Apple's In-App Purchase, not external
checkout (Guideline 3.1.1).

Sign in with Apple is offered alongside email/password and Google
OAuth (Guideline 4.8).

TEST ACCOUNT
Email:    apple-review@cruzar.app
Password: [TO BE GENERATED BEFORE SUBMISSION]
Pro tier: provisioned on this account — reviewer can exercise Pro
          features without making a real purchase.

DEMO VIDEO
Optional walkthrough: https://cruzar.app/walkthrough
(Bilingual 90-second recording of every Pro feature.)

CONTACT
hello@cruzar.app — monitored daily.
```

## Screenshots — shot list

Required: 6.7" (1290×2796 — iPhone 16 Pro Max / 15 Pro Max / 14 Pro
Max). Recommended: also 6.5" (1284×2778 — iPhone 11 Pro Max) for
older devices.

Min 3, max 10. 4 is the sweet spot — Apple displays first 3 without
swipe.

Shot order (ES locale; EN version swaps overlay text):

1. **Home — live crossings list**
   - ES: "Todos los puentes en vivo"
   - EN: "All crossings, live"
2. **Map view**
   - ES: "Mapa en tiempo real"
   - EN: "Real-time map"
3. **Port detail — history + best time**
   - ES: "Historial y mejor hora"
   - EN: "History + best time to cross"
4. **Alert setup**
   - ES: "Alertas cuando baja la espera"
   - EN: "Alerts when wait drops"
5. **Live bridge cameras**
   - ES: "Cámaras del puente en vivo"
   - EN: "Live bridge cameras"
6. **Community reports feed**
   - ES: "Reportes de la banda"
   - EN: "Community reports"
7. **Exchange rate widget**
   - ES: "Tipo de cambio real"
   - EN: "Live exchange rates"

Capture method: TestFlight build on a physical iPhone 15/16 Pro Max,
use the device screenshot button. Do NOT use screen recordings or
mocked marketing images — Apple catches and rejects.

## App Previews (video, optional)

15–30 second silent video, portrait, in app/on device. Skip for v1.0;
revisit after first 100 installs.

---

## Bundle ID + project metadata (for Capacitor iOS project)

- **Bundle ID:** `app.cruzar.ios`  (proposed — confirm before Apple enrollment)
- **App version:** `1.0.0`
- **Build number:** `1` (increment every TestFlight upload)
- **Minimum iOS version:** `15.0`
- **Device family:** iPhone primary, iPad compatible (not iPad-optimized v1)
- **Orientation:** Portrait only (match manifest.json `portrait-primary`)
- **Copyright:** `© 2026 Cruzar`

---

## Export Compliance

- **Uses encryption:** Yes (HTTPS only, standard TLS)
- **Exempt from export requirements:** Yes — uses only standard
  encryption exempted under ECCN 5D992. Apple auto-approves with
  `ITSAppUsesNonExemptEncryption=false` in Info.plist.

---

## Pre-submission blockers (must ship before paying $99)

These are blockers identified in the 2026-04-20 audit. Full detail
in the memory file `project_cruzar_appstore_readiness_audit_20260420.md`.

1. **C1 — Sign in with Apple** (Guideline 4.8 — hard reject)
2. **C2 — Apple IAP for Pro tier, hide Business tier on iOS** (Guideline 3.1.1)
3. **C4 — Capacitor wrap with native push + geolocation + offline** (Guideline 4.2)
4. **H2 — iOS screenshots at 6.7" + 6.5"**
5. **H3 — APNs cert + Capacitor Push plugin wired**
6. **H5 — `PrivacyInfo.xcprivacy` file in iOS project**

Already shipped 2026-04-20 (this session):
- ✅ C3 — In-app account deletion button
- ✅ H1 — 1024×1024 + full iOS icon set in `public/icons/ios/`
- ✅ H4 — Support email normalized to `hello@cruzar.app`
- ✅ Store listing copy (this file)
