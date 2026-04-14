# Shipping Cruzar to Google Play as a TWA

**What a TWA is:** a Trusted Web Activity wraps your existing PWA (cruzar.app) inside a thin Android shell. You get the Play Store listing, home-screen icon, push notifications, and native Android chrome — without building a separate React Native / Flutter app. One-time setup, zero ongoing code.

Everything here happens **outside this repo**. The Cruzar codebase just needs the PWA manifest + `public/.well-known/assetlinks.json` (already in place). The Android project + APK builds separately.

---

## Prerequisites

1. **Google Play Console developer account** — $25 one-time fee at https://play.google.com/console
2. **Chrome on desktop** (for Digital Asset Links verification testing)
3. **Java JDK installed** (for the signing key step) — https://adoptium.net or any JDK 11+

## Step 1 — Generate the Android package via PWABuilder (easiest path)

1. Visit https://www.pwabuilder.com
2. Enter `https://cruzar.app` and click **Start**
3. PWABuilder analyzes the manifest + service worker. You should see ✅ on manifest, service worker, and security. If anything is red, fix it in the Cruzar codebase first and redeploy.
4. Click **Package for Stores** → **Android**
5. On the "Android options" screen:
   - **Package ID:** `app.cruzar.twa` (must match the `package_name` in `public/.well-known/assetlinks.json`)
   - **App name:** `Cruzar`
   - **Launcher name:** `Cruzar`
   - **App version:** `1.0.0`
   - **App version code:** `1`
   - **Theme color:** `#0f172a`
   - **Background color:** `#0f172a`
   - **Start URL:** `/`
   - **Icon URL:** `https://cruzar.app/icons/icon-512.png`
   - **Maskable icon URL:** `https://cruzar.app/icons/icon-512.png`
   - **Display mode:** `standalone`
   - **Orientation:** `default`
   - **Signing key:** **Generate a new signing key** (let PWABuilder create one, it's safer than uploading your own)
   - **Key store password:** pick a strong one. **WRITE IT DOWN.** You cannot update the Play Store listing without it.
   - **Key alias:** `cruzar`
   - **Key password:** same as key store password for simplicity
6. Click **Download Package**. You'll get a ZIP containing:
   - `app-release-bundle.aab` → this is what you upload to Play Console
   - `app-release-signed.apk` → for direct testing
   - `signing-key-info.txt` → **KEEP THIS SAFE** — it has your SHA256 fingerprint
   - `assetlinks.json` → ignore (you'll copy its fingerprint into the one in this repo)

## Step 2 — Copy the SHA256 fingerprint into the Cruzar repo

1. Open `signing-key-info.txt` from the ZIP
2. Find the line `SHA256 Fingerprint: XX:XX:XX:...` (64 hex chars separated by colons)
3. Open `public/.well-known/assetlinks.json` in the Cruzar repo
4. Replace `REPLACE_WITH_SIGNING_KEY_FINGERPRINT` with that fingerprint
5. Commit and push. Vercel will redeploy within ~60s.
6. Verify it's live: visit `https://cruzar.app/.well-known/assetlinks.json` in your browser — you should see the JSON with your fingerprint. If you see 404 or the placeholder, something's wrong.

**Why this matters:** Google verifies this file to prove the APK and the website belong to the same owner. If it doesn't match, the TWA launches with a browser URL bar visible at the top — ugly and unprofessional. If it matches, the app launches fullscreen looking like a native app.

## Step 3 — Upload to Google Play Console

1. Visit https://play.google.com/console
2. Click **Create app**
3. Fill in:
   - **App name:** Cruzar
   - **Default language:** Spanish (Latin America) — this is your primary audience
   - **App or game:** App
   - **Free or paid:** Free
4. Accept the developer program policies
5. In the left sidebar, go to **Production** → **Create new release**
6. Click **Upload** and drop the `app-release-bundle.aab` file from the PWABuilder ZIP
7. **Release name:** `1.0.0 — Initial launch`
8. **Release notes (Spanish):**
   ```
   Primera versión de Cruzar. Tiempos de espera en vivo de los puentes US-México, reportes de la comunidad, cámaras en vivo, alertas push.
   ```
9. **Release notes (English):**
   ```
   First release of Cruzar. Live US-Mexico border crossing wait times, community reports, live bridge cameras, push alerts.
   ```
10. Click **Save**, then **Review release**

## Step 4 — Fill in the Store listing

Play Console will require these before submission:

- **App icon** (512x512 PNG) — use `public/icons/icon-512.png` from the repo
- **Feature graphic** (1024x500) — create one in Figma or use the existing `public/fb-cover.png` (crop/resize)
- **Screenshots** — take 4-8 screenshots from your phone (Chrome → cruzar.app → use the device screenshot feature). Min 2 required, 8 max.
- **Short description** (80 chars):
  ```
  Tiempos de espera en vivo de los puentes US-México con reportes de la comunidad
  ```
- **Full description** (4000 chars — long-form pitch — crib from /features page)
- **Privacy policy URL:** `https://cruzar.app/privacy`
- **Contact email:** your email
- **Category:** Maps & Navigation
- **Tags:** border, wait times, mexico, trucking, commuter

## Step 5 — Content rating + ads + target audience

- **Content rating:** fill out the questionnaire honestly (will probably be "Everyone")
- **Ads:** "No, my app does not contain ads" (for now)
- **Target audience:** 18+
- **Data safety:** declare what you collect (email, location, GPS for reports) — be honest, Play Console catches lies

## Step 6 — Submit for review

Click **Send for review**. Typical turnaround:
- First-time apps: 1–7 days (often 48-72h)
- Updates after approval: usually under 24h

## Step 7 — After approval

1. Test the published listing on your phone via the Play Store
2. Open Cruzar from the Play Store icon → should launch fullscreen with NO browser URL bar → that confirms assetlinks.json is working
3. Share the Play Store link on Facebook groups, in promoter templates, everywhere you currently share `cruzar.app`

## Update workflow

When you want to push a new version:
1. Make code changes in the Cruzar repo as usual → Vercel auto-deploys
2. TWA doesn't need a rebuild for PWA content changes — it's just fetching cruzar.app live
3. **Only** rebuild the APK if you change the package ID, signing key, icons, or manifest theme colors
4. If you DO rebuild, increment version code in PWABuilder before re-uploading

## iOS (App Store)

Different path — iOS doesn't support TWA. Options:
1. **PWABuilder iOS** — wraps the PWA in a WKWebView shell, easier than Capacitor but limited
2. **Capacitor** — more control, still uses your existing PWA
3. **React Native rewrite** — overkill, don't do this

Google Play is the higher-priority ship since per Diego's traffic data ~80% of Cruzar users are on Android. iOS can wait.

## Files in this folder

- `README.md` (this file) — the ship guide
- The actual Android project (`/android/app/`, `/android/build.gradle`, etc.) is **not stored here** because it contains the signing key. Keep the PWABuilder ZIP somewhere safe (Drive, 1Password, etc.) and re-download whenever you need to update.

## Signing key backup warning

**If you lose the signing key, you can never update the Play Store listing again.** You'd have to publish a new app with a different package ID and ask all users to reinstall. Back up:
- The `signing-key-info.txt` file from PWABuilder
- The `.keystore` file if you uploaded your own
- The passwords (all of them)

Store in 1Password, a private Git repo, or encrypted on Google Drive. Multiple backups.
