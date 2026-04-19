# Play Console — fastest path to "submitted"

Literal click-by-click. Open https://play.google.com/console in one tab and
this file in another. Work top to bottom, copy-paste every field, don't
think. ~25 minutes if you don't get interrupted.

Files you need (already in `C:\Users\dnawa\OneDrive\Cruzar-TWA-KEYSTORE-BACKUP\`):
- `Cruzar.aab` ← upload this
- `signing-key-info.txt` ← has the keystore password, keep safe
- `signing.keystore` ← keep safe, don't lose

You'll also need the signed-in Play Console with the $25 fee paid (done).

---

## 1. Create app

Left sidebar → **All apps** → **Create app**.

| Field | Value |
|---|---|
| App name | `Cruzar` |
| Default language | **Spanish (Latin America) – es-419** |
| App or game | **App** |
| Free or paid | **Free** |
| Declarations — policies | ✅ both checkboxes |
| Declarations — US export laws | ✅ |

Click **Create app**.

---

## 2. Left sidebar → Dashboard

You'll see a giant checklist. Work through it in the order Play Console
presents it. Below is the answer for each checklist item.

### 2a. "Set privacy policy"

Privacy policy URL: `https://cruzar.app/privacy`

### 2b. "App access"

Pick **All functionality is available without special access**. Don't need
to give Google test credentials since guests see everything on the home page.

### 2c. "Ads"

**No, my app doesn't contain ads.**

(AdSense placeholder in code doesn't render live ad units to users today.
If you flip live ads on later, update this declaration in Play Console.)

### 2d. "Content ratings"

Click **Start questionnaire**.

| Field | Answer |
|---|---|
| Email | diegonaguirre@icloud.com |
| Category | **Reference, news, or educational** |
| Violence – cartoon/fantasy | No |
| Violence – realistic | No |
| Blood | No |
| Sexual content | No |
| Crude humor | No |
| Digital purchases | **Yes** (Stripe subscriptions to Pro/Business) |
| Gambling | No |
| User-generated content | **Yes** — users can post text reports. Note the moderation: `crossing_reports` are moderated via `report-quality` cron + admin tools. |
| Users can interact | **Yes** — community reports visible to all users |
| Share location | **Yes, approximate** (port coordinates, not user GPS) |
| Personal info collected | **Yes** — email for account |
| Leaderboards | Yes |
| Unrestricted web access | **No** — TWA scoped to cruzar.app domain only |

Submit. You'll get a rating — probably **Teen** or **Everyone 10+** given
user-generated content + gambling-like category absent.

### 2e. "Target audience and content"

| Field | Answer |
|---|---|
| Target age groups | **18 and over** |
| Appeals to children? | **No** |
| Ads intended for children? | **No** |

### 2f. "News apps"

**No, this is not a news app.** (It's a utility/maps app.)

### 2g. "COVID-19 contact tracing"

**No, not a contact tracing app.**

### 2h. "Data safety"

Big form. Declare:

**Data collected:**
- ✅ **Personal info → Name** (display name, optional)
- ✅ **Personal info → Email address** (for auth, optional — guests skip)
- ✅ **Financial info → Purchase history** (Stripe subscriptions — required for Pro/Business)
- ✅ **Location → Approximate location** (port coords only, not user GPS)
- ✅ **Location → Precise location** (optional — used for "nearby crossing" feature, user must opt-in via browser prompt)
- ✅ **App activity → App interactions** (community reports)
- ✅ **App info and performance → Crash logs** (via Sentry, required)
- ✅ **App info and performance → Diagnostics** (via Sentry, required)
- ✅ **Device or other IDs → Device or other IDs** (push notification tokens, optional)

For each: **Not shared with third parties** (we don't sell data), **Encrypted
in transit: Yes** (HTTPS), **Can users delete: Yes** (data-deletion page at
`/data-deletion`).

### 2i. "Government apps"

**Not a government app.** (Cruzar uses CBP public API data but has no CBP
affiliation — store-listing.md calls this out in the description.)

### 2j. "Financial features"

**No financial features.** (Stripe is only for subscription payments, not
a money-transfer or crypto feature.)

### 2k. "Health"

**Not a health app.**

---

## 3. Main store listing

Left sidebar → **Grow → Store listing** (or similar under "Grow").

### 3a. App details (Spanish – es-419 by default)

| Field | Value |
|---|---|
| App name | `Cruzar — Tiempos de espera en los puentes` |
| Short description | `Tiempos de espera en vivo de los puentes US–México, de la comunidad.` |
| Full description | See `android/store-listing.md` — paste the full Spanish block |

### 3b. Add English (en-US) translation

Click **Manage translations** → Add English (United States).

| Field | Value |
|---|---|
| App name | `Cruzar — Border Wait Times` |
| Short description | `Live US–Mexico border wait times, camera feeds, and community reports.` |
| Full description | See `android/store-listing.md` — paste the full English block |

### 3c. Graphics

| Asset | Where to get |
|---|---|
| App icon (512×512 PNG) | `C:\Users\dnawa\cruzar\public\icons\icon-512.png` |
| Feature graphic (1024×500 PNG) | Crop `C:\Users\dnawa\cruzar\public\fb-cover.png` (1640×624) down to 1024×500. Use paint.net or any image editor. Or ship as-is if Play Console accepts close aspect ratios — it sometimes does. |
| Phone screenshots | **MINIMUM 2, MAXIMUM 8.** See shot list in `store-listing.md`. Take fresh screenshots from your phone on cruzar.app. Chrome → cruzar.app → device screenshot button. Upload at least 2 to ship; you can add more later. |

**TIP:** don't perfectionism-trap on screenshots. Ship with 2 quick ones.
You can update screenshots any time without resubmitting for review.

### 3d. Categorization

| Field | Value |
|---|---|
| App category | **Maps & Navigation** |
| Tags | border, wait times, commute, trucking, mexico |

### 3e. Contact details

| Field | Value |
|---|---|
| Email | diegonaguirre@icloud.com |
| Phone | (optional — skip) |
| Website | `https://cruzar.app` |

---

## 4. Production release

Left sidebar → **Production** → **Create new release**.

### 4a. Upload

Click **Upload** and drop:
`C:\Users\dnawa\OneDrive\Cruzar-TWA-KEYSTORE-BACKUP\Cruzar.aab`

Wait for it to process (~30-60 sec). It'll show package name `app.cruzar.twa`
and version `1.0.0 (1)`.

### 4b. Release name

`1.0.0 — Initial launch`

### 4c. Release notes

**Spanish (es-419):**
```
Primera versión de Cruzar. Tiempos de espera en vivo de los puentes US–México, reportes de la comunidad, cámaras en vivo, alertas push, y tipo de cambio actualizado por la banda.
```

**English (en-US):**
```
First release of Cruzar. Live US–Mexico border wait times, community reports, live bridge cameras, push alerts, and community-reported exchange rates.
```

Click **Save**.

### 4d. Review release

Click **Review release** → Play Console will flag anything missing. Common
gotchas:
- Missing phone screenshots → go back to store listing + upload 2+
- Missing feature graphic → go back + upload 1024×500 PNG
- Missing content rating → should be done in step 2d

Resolve any blockers, then click **Start rollout to production**.

### 4e. Confirm rollout

Play Console will ask to confirm. Confirm. Your app now says **In review**.

---

## 5. After you click "Start rollout"

Review time: **usually 48-72h for first submission.** Can be as fast as
3 hours, can be up to 7 days. Google emails diegonaguirre@icloud.com when
approved.

When it's live:
1. Grab the Play Store URL (like `https://play.google.com/store/apps/details?id=app.cruzar.twa`)
2. Paste it back to Claude — I'll set `NEXT_PUBLIC_TWA_PLAY_STORE_URL` in
   Vercel env, which flips on the `TwaPromoBanner` for every Android web
   visitor to cruzar.app.

If Google rejects it, paste the rejection message to Claude. Typical
rejection reasons for TWAs:
- `assetlinks.json` not verifying → check `https://cruzar.app/.well-known/assetlinks.json` serves the SHA256 fingerprint (it does as of 2026-04-19, commit 9bd5727)
- Privacy policy missing a specific clause → Google flags exact wording needed
- Screenshots too close to generic images → retake from actual UI

---

## If you get stuck

Screenshot whatever Play Console is showing you and paste it to Claude.
Don't waste 20 min hunting a dropdown — I can parse the screenshot in 5s.
