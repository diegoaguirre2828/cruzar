# CRUZA — Complete Project Brain

> This file is the single source of truth for everything about this project.
> Read it fully before every task. If something conflicts with this file, this file wins.
> To update: make the change and say "update CLAUDE.md to reflect this."

---

## 0. Sensei audit mode (inherited)

Standing capability across every project Diego owns. Canonical rules live in the user-level memory folder under `~/.claude/projects/C--Users-dnawa/memory/` — see the files `feedback_sensei_audit_method.md` and `feedback_prevent_stale_memory_audits.md`. Locked 2026-04-16.

**Triggers (any session, any phrasing):** "everything wrong", "audit [the project]", "sensei [project]", "sensei mode", "full audit", "what's broken", "gimme the list" — fire the full Sensei pattern immediately, no clarifying questions.

**Pipeline:** memory pass (handoffs + backlogs, treat all claims as hypotheses) then parallel live-state scan (build, endpoint health, env drift, schema drift, bilingual coverage, security/RLS) then structured **CRITICAL / HIGH / MEDIUM / LOW** report with file:line evidence PLUS a `verified-live-at` evidence cell on every row, then autonomous-safe vs. Diego-input split with ONE pick for the autonomous bundle, then on greenlight ("all in one session", "go", "ship"), execute end-to-end: edits, run the build, commit (named files, never `-A`), push, deploy to prod via the `vercel deploy --prod` command, curl live endpoints to verify landing, self-correct against live state, and append a **Reconciliation log** section to the audit memory noting SUPERSEDED items + their commit SHA.

**Cruzar-specific audit surfaces:**
- Build: run `npm run build` — must produce 158 of 158 pages clean
- Live verify: curl `https://cruzar.app/api/ports` (at least 50 ports), plus `/privacy` and `/pricing`
- Railway fb-poster: curl `https://cruzar-production.up.railway.app/` — check `lastPosted` non-empty after 5am/4pm CT cycles
- Schema source: the file `supabase-schema-v12.sql` plus migrations `v27` through `v32` in `supabase/migrations/`
- Coord sync: the files `lib/portMeta.ts` and `components/WaitingMode.tsx` must match exactly on every port's coordinates
- Bilingual coverage: every user-facing string in `app/` pages and `components/` must route through `LangContext`
- Cron auth: every route under `/api/cron/` must accept both `?secret=` query and `Authorization: Bearer` header
- RLS: user-scoped client for auth-gated routes, service-role only for cron, admin, and public-read

**Hard rules during execution:** never touch the user's browser, never force-push, never skip hooks, no strategic calls on Cruzar (execute-only), bilingual is standard, handle infra end-to-end, notice-and-fix never recommend.

**Reference execution:** 2026-04-16 evening — see the memory file `project_cruzar_everything_wrong_audit_20260416.md`. 31 findings total, 2 self-corrected as stale memory, 5-item autonomous bundle shipped live in commit `9ec1082`.

---

## ⚠️ CRITICAL: Next.js Version Warning

This is **Next.js 16.2.1** — it has breaking changes from older versions.
APIs, conventions, and file structure differ from training data.
Before writing any Next.js code, check `node_modules/next/dist/docs/` for the relevant guide.
Heed all deprecation notices. Do NOT assume standard Next.js 13/14/15 patterns apply.

---

## 1. Project Identity

**Name:** Cruzar
**Tagline:** Live border wait times — cruzar.app
**What it is:** A real-time border crossing wait time app for the US-Mexico border. Shows live wait times from the CBP (Customs and Border Protection) API, lets users submit community reports, tracks historical patterns, and provides fleet management tools for trucking companies.
**Why it exists:** The only current solution is Facebook border crossing groups — people manually post wait times in group chats. Cruzar replaces this with a structured, real-time, bilingual app.
**Biggest gap vs. competition:** CONVENIENCE. Facebook groups require you to scroll, read posts, and guess. Cruzar shows the number instantly. This is the core pitch.
**Status:** Live and deployed. Pre-revenue. ~3-4 test accounts. Goal: 1,000 users in 3 months. First dollar in 3 months.
**Live URL:** https://cruzar.app (domain purchased, pending activation — temporary: cruzaapp.vercel.app)
**GitHub:** https://github.com/diegoaguirre2828/cruza
**Social media:** No Cruzar social accounts created yet — this is the next marketing step.

---

## 2. The Builder

- **Name:** Diego
- Building solo using Claude Code — directs AI, does not write code manually (0 coding experience)
- 20+ hours/week available to dedicate to this
- Goal: build and monetize multiple apps across different verticals
- Thinking like a startup founder + software entrepreneur
- Primary focus right now: get Cruzar to first revenue, then Insurance Automation Tool
- Located in/near the RGV (Rio Grande Valley) border region — knows this market personally
- Has a family insurance business = guaranteed first customer for next project

---

## 3. Target Users

### Primary Acquisition: Daily Commuters
- Cross the border every day for work, school, errands
- Currently use Facebook groups to check wait times
- Speak Spanish primarily — not everyone speaks English
- Want: fast, simple, real-time info. No account needed to use core features.
- Convert to: free accounts, then Pro alerts

### Primary Revenue: Truck Drivers & Trucking Fleets
- Cross commercially — delays cost real money ($85+/hour per truck)
- Need: commercial lane data, fleet tracking, driver status, shipment management
- Pay: $49–$99/mo per fleet (Business tier)
- Reach: trucking associations, dispatcher networks, logistics companies

### Secondary: Logistics Companies, Border Businesses
- Need fleet-level visibility
- Want data exports, API access, multi-driver management

---

## 4. The Competition

**Facebook border crossing groups** — This is the REAL competition, not other apps.
- People post wait times manually in group chats
- Updated sporadically, no structure, no history
- Can't send push notifications
- Can't filter by bridge or lane type
- Cruzar's moat: push notifications on wait time drops. Facebook can't do this.

**Our growth strategy:** Post in these Facebook groups. The video generator creates content automatically. One post per day, timed to peak crossing hours.

---

## 5. Tech Stack

### Frontend
- **Framework:** Next.js 16.2.1 with App Router (NOT pages router)
- **React:** 19.2.4
- **Language:** TypeScript (strict mode)
- **Styling:** Tailwind CSS v4 (breaking changes from v3 — check docs before using classes)
- **Icons:** Lucide React
- **Charts:** Recharts
- **Maps:** React Leaflet (OpenStreetMap tiles)
- **State:** React hooks + Zustand for client state
- **Data fetching:** SWR for client-side

### Backend
- **API:** Next.js App Router API routes (serverless)
- **Database:** Supabase (PostgreSQL) with Row-Level Security
- **Auth:** Supabase Auth (email/password + Google OAuth)
- **File:** No file storage currently

### Infrastructure
- **Deployment:** Vercel (Hobby plan — free)
- **Cron jobs:** cron-job.org (NOT Vercel cron — Vercel free plan limits to daily)
- **Cron schedule:** Every 15 minutes for fetch-wait-times and send-alerts
- **Weekly digest:** Mondays at 8:00 AM

### External Services
- **Wait time data:** CBP public API — https://bwt.cbp.gov/api/bwtnew
- **Email:** Resend (RESEND_API_KEY set in Vercel env vars)
- **Push notifications:** Web Push API with VAPID keys (set in Vercel)
- **SMS:** Twilio (configured but secondary priority)
- **Payments:** Stripe (keys set in Vercel — verify live status)
- **Exchange rate:** External forex API (ExchangeRateWidget)

### Video Generator (separate sub-project)
- **Location:** `/video-generator/` folder inside this project
- **Framework:** Remotion 4.x
- **Purpose:** Auto-generates animated wait time videos for social media marketing
- **Run command:** `cd video-generator && node render.mjs`
- **Output:** `/video-generator/output/cruzar-[date]-[time].mp4` + Spanish caption printed to terminal
- **How it works:** Fetches live data from cruzar.app/api/ports (or cruzaapp.vercel.app until domain activates), renders 10-second vertical (9:16) video showing 8 featured crossings with animated wait times and color coding

---

## 6. Design System

### Colors
```
Background primary:   #0f172a (dark navy)
Background secondary: #1e293b (lighter navy)
Background card:      rgba(255,255,255,0.05-0.08)

Wait level LOW:       #22c55e (green)  — ≤20 min
Wait level MEDIUM:    #f59e0b (amber)  — 21-45 min
Wait level HIGH:      #ef4444 (red)    — 45+ min
Wait level UNKNOWN:   #6b7280 (gray)   — no data

Text primary:         white
Text secondary:       rgba(255,255,255,0.6)
Text muted:           rgba(255,255,255,0.35-0.45)

Border:               rgba(255,255,255,0.10-0.12)
Accent blue:          #2563eb
```

### Typography
- Font: System font stack — `-apple-system, BlinkMacSystemFont, "Segoe UI", Helvetica, sans-serif`
- No custom fonts loaded currently
- Headings: font-weight 700-900
- Body: font-weight 400-500

### Design Philosophy
- **Mobile-first** — most users are on phones at the border
- **Dark mode primary** — easier to read in sunlight on a phone
- **Speed over beauty** — users want the number fast, not a pretty interface
- **Minimal friction** — anonymous report submission, no account wall for core features
- **Bilingual by default** — Spanish toggle in nav, not an afterthought
- **Cards with rounded corners** — rounded-2xl (16px) standard
- **Subtle borders** — 1px rgba borders, no hard edges
- **Left-colored borders** on crossing cards (color = wait level)
- **No shadows currently** — flat dark design

### UI Patterns
- Bottom navigation bar on mobile
- "Near Me" geolocation button prominently placed
- Wait time badge: small colored dot + number + "min"
- Report form: full-screen modal style
- Map: Leaflet with color-coded dots (green/yellow/red)

---

## 7. Language & Content Rules

### Spanish is CRITICAL
- Nearly every border crosser speaks Spanish. Many speak ONLY Spanish.
- The app has a language toggle (ES/EN) in the navbar
- ALL new features must have Spanish translations
- Default to Spanish based on device locale — don't make users hunt for the toggle
- Content tone: casual, local, neighborhood feel — not corporate
- Use "puente" not "bridge," "espera" not "wait time" in Spanish contexts

### Spanish Content Examples
```
Low wait:      "Espera baja" / "Rápido"
Medium wait:   "Espera moderada" / "Moderado"
High wait:     "Espera alta" / "Lento"
Report prompt: "¿Cuánto tiempo esperaste?"
Alert:         "Bajó la espera en [puente] — [X] min ahorita"
```

---

## 8. Database Schema

**Active schema file:** `supabase-schema-v12.sql` (this is the canonical production schema)
There are v1-v12 files — only v12 matters. The others are historical.
**IMPORTANT:** v12 must be run in Supabase SQL Editor if not done yet — adds `exchange_rate_reports` table and new columns to `rewards_businesses`.

### Key Tables
| Table | Purpose |
|---|---|
| `wait_time_readings` | CBP data stored every 15 min by cron. Has port_id, vehicle_wait, sentri_wait, pedestrian_wait, commercial_wait, recorded_at, day_of_week, hour_of_day |
| `profiles` | User profiles. Fields: id, tier (guest/free/pro/business), display_name, points, reports_count, badges |
| `crossing_reports` | Community reports. Fields: port_id, report_type, description, wait_minutes, user_id (nullable for guests), upvotes |
| `alert_preferences` | User wait time alerts. Fields: port_id, lane_type, threshold_minutes, active, last_triggered_at, phone |
| `saved_crossings` | User saved ports. Composite key (user_id, port_id) |
| `subscriptions` | Stripe subscription tracking |
| `shipments` | Business tier — shipment tracking with status lifecycle |
| `drivers` | Business tier — driver tracking via token-based check-in (no login required) |
| `push_subscriptions` | Web push notification endpoints |
| `rewards_businesses` | Business directory (Negocios tab). Free listings go live immediately. Fields: name, category, phone, whatsapp, hours, claimed, listing_tier (free/featured), notes_es |
| `rewards_deals` | Deals tied to businesses, redeemable with points |
| `rewards_redemptions` | Tracks who redeemed what |
| `exchange_rate_reports` | Crowdsourced real casa de cambio rates. Fields: user_id, house_name, sell_rate, buy_rate, port_id, city, reported_at |

### RLS Policy Summary
- `wait_time_readings`: Public read, service role write
- `crossing_reports`: Public read, authenticated or guest create
- `profiles`: Users read/update own only
- `alert_preferences`: Users manage own only
- `shipments`, `drivers`: Business owner manages own only

---

## 9. API Routes Reference

### Public (no auth required)
| Route | Method | Purpose |
|---|---|---|
| `/api/ports` | GET | Live wait times from CBP — force-dynamic |
| `/api/reports` | GET/POST | Community reports feed + submit |
| `/api/reports/recent` | GET | Recent reports across all ports |
| `/api/reports/upvote` | POST | Upvote a report |
| `/api/leaderboard` | GET | Top reporters by points |
| `/api/exchange` | GET | USD/MXN exchange rate — returns official rate + community-reported rates (last 6h) |
| `/api/exchange/report` | POST | Submit a real casa de cambio sell rate — awards 3 points if authenticated |
| `/api/negocios` | GET/POST | List businesses (GET) or add a new free listing (POST) |
| `/api/negocios/claim` | POST | Claim ownership of a business listing (email or WhatsApp) |
| `/api/widget` | GET | Embeddable wait time widget |

### Authenticated
| Route | Method | Purpose |
|---|---|---|
| `/api/alerts` | GET/POST/DELETE | User alert preferences |
| `/api/saved` | GET/POST/DELETE | Saved crossings |
| `/api/profile` | GET/PUT | User profile |
| `/api/push/subscribe` | POST | Register push notification endpoint |
| `/api/stripe/checkout` | POST | Create Stripe checkout session |
| `/api/stripe/portal` | POST | Stripe customer portal |
| `/api/export` | GET | Data export (Business) |

### Business Tier
| Route | Method | Purpose |
|---|---|---|
| `/api/business/drivers` | GET/POST/PUT/DELETE | Driver management |
| `/api/business/shipments` | GET/POST/PUT | Shipment management |
| `/api/driver/checkin` | POST | Token-based driver check-in (no auth) |
| `/api/checkin` | GET | Driver check-in page data |

### Port Analytics
| Route | Method | Purpose |
|---|---|---|
| `/api/ports/[portId]/history` | GET | Historical wait data |
| `/api/ports/[portId]/best-times` | GET | Best time to cross by day/hour |
| `/api/predict` | GET | AI predictions (historical averages) |
| `/api/route-optimize` | GET | Route optimizer for fleet (Pro+) |

### Cron (protected by CRON_SECRET)
| Route | Schedule | Purpose |
|---|---|---|
| `/api/cron/fetch-wait-times` | Every 15 min | Fetch CBP data → store in wait_time_readings |
| `/api/cron/send-alerts` | Every 15 min | Check thresholds → send email/push/SMS |
| `/api/cron/weekly-digest` | Monday 8am | Send weekly summary to Pro/Business users |

**Cron auth:** Accepts `?secret=CRON_SECRET` query param OR `Authorization: Bearer CRON_SECRET` header.

---

## 10. Port Coordinates

Crossing coordinates are defined in TWO places — keep them in sync:
1. `lib/portMeta.ts` — used by the MAP to place dots
2. `components/WaitingMode.tsx` — used by geofence detection (3km radius)

### RGV Key Crossings
```
230501 — Hidalgo / McAllen:     26.1080, -98.2708
230502 — Pharr–Reynosa:         26.1764, -98.1836
230503 — Anzaldúas:             26.0432, -98.3647
230901 — Progreso:              26.0905, -97.9736
230902 — Donna:                 26.1649, -98.0492
230701 — Rio Grande City:       26.3795, -98.8219
231001 — Roma:                  26.4079, -99.0195
```

### Brownsville Crossings
```
535501 — Gateway International: 25.9007, -97.4935
535502 — Veterans International:25.8726, -97.4866
535503 — Los Tomates:           26.0416, -97.7367
535504 — Gateway to Americas:   25.9044, -97.5040
```

### Laredo
```
230401 — Laredo I (Gateway):    27.4994, -99.5076
230402 — Laredo II (World Trade):27.5628, -99.5019
230403 — Colombia Solidarity:   27.6506, -99.5539
230404 — Laredo IV:             27.5533, -99.4786
```

---

## 11. Feature Scope & Tiers

### Guest (no account)
- View live wait times (list + map)
- Submit crossing reports anonymously
- View community reports feed
- Exchange rate widget
- Basic port filtering by region

### Free (account required)
- Everything in Guest
- Save favorite crossings
- View leaderboard + earn points
- Submit reports with points/badges
- Push notification opt-in

### Pro ($2.99/month)
- Everything in Free
- Wait time alerts (email + push + SMS)
- Route optimizer ("best crossing right now")
- Historical patterns + best time to cross
- Weekly digest email
- AI predictions (actually historical averages — do NOT call it AI externally)

### Business ($49.99/month)
- Everything in Pro
- Fleet management dashboard
- Driver tracking (token-based, drivers need no account)
- Shipment tracking with status lifecycle
- Cost calculator (delay hours × $85 × truck count)
- Data export (CSV)
- Dispatch intel view

---

## 12. User Flows

### New User (from Facebook group)
1. Sees Facebook post with wait time video or text → clicks link
2. Lands on homepage showing live wait times — **no login wall**
3. Sees real-time data immediately
4. Optionally submits a report (works without account)
5. Nudged to create account to "save your favorite crossings" or "get alerts"
6. Signs up → free tier → upgrade prompt for alerts

### Daily Commuter Flow
1. Opens app → bottom nav "Near Me" shows nearest crossing wait
2. Or opens saved crossing directly from home screen widget
3. Checks wait time → decides when to leave
4. At crossing → WaitingMode activates (geofence) → prompted to report for double points

### Trucking Fleet Flow
1. Dispatcher creates fleet account (Business tier)
2. Adds drivers with names + phone numbers
3. System generates unique check-in link per driver (no app download needed)
4. Driver opens link on phone → updates status (in line, at bridge, cleared)
5. Dispatcher sees real-time driver board
6. Shipments tracked with expected vs actual crossing time
7. Delay costs auto-calculated

---

## 13. Marketing System

### Video Generator
- **Run:** `cd /c/Users/dnawa/cruzar/video-generator && node render.mjs`
- Fetches live data → renders 10-second animated vertical (1080x1920) MP4
- Shows 8 featured crossings with animated wait time numbers
- Color-coded green/yellow/red bars
- Spanish labels and CTA: "cruzar.app"
- Also prints ready-to-paste Spanish Facebook caption with hashtags
- Output saved to `video-generator/output/`

### Facebook Strategy
- **Page posts (can automate via Meta Graph API):** 4x per day
  - 5:30am — morning commute
  - 11:30am — midday truckers
  - 3:30pm — after school/work
  - 7:00pm — evening crossing
- **Group posts (manual, 2 min/day):** Post video + caption in target groups
- **Content types:** Live wait time video, "best time to cross today", daily border tip, holiday/event alerts
- **Tone:** Casual, local, community feel. Not corporate.
- **Key rule:** Post useful information (actual wait times) every time. Never post fluff.

### Target Facebook Groups
**Confirmed groups to post in:**
- "Filas de Puentes Matamoros/Brownsville" (search this exact name — multiple groups)
- "FILAS DE LOS PUENTES INTERNACIONALES EN MATAMOROS"
- Search for similar: "filas de puentes", "espera en el puente", border groups in Laredo/McAllen/Eagle Pass

**Content tone:** Professional but local. Not corporate. Speaks like someone from the community, not a tech company. Use neighborhood language ("ahorita," "pásenle," "¿cuánto tardas en el puente?").

**No social media accounts created yet** — first step is posting directly in Facebook groups, then create a Facebook Page.

### Spanish Tip Bank
(30 rotating tips — to be built)
Examples:
- "¿Sabías que SENTRI te puede ahorrar hasta 2 horas en días de mucho tráfico?"
- "Los lunes y viernes son los días más lentos — si puedes, cruza martes o miércoles"
- "Lleva tu licencia, comprobante de domicilio y placa visible para cruzar más rápido"
- "El puente de Anzaldúas suele tener menos espera que Hidalgo — pruébalo"

---

## 14. Environment Variables

### Local (.env.local) — incomplete, missing some keys
```
NEXT_PUBLIC_SUPABASE_URL=          (set)
NEXT_PUBLIC_SUPABASE_ANON_KEY=     (set)
SUPABASE_SERVICE_ROLE_KEY=         (set)
CRON_SECRET=                       (set — do not expose)
NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY=(set — placeholder, verify live)
STRIPE_SECRET_KEY=                 (set — placeholder, verify live)
STRIPE_WEBHOOK_SECRET=             (set — placeholder, verify live)
STRIPE_PRO_PRICE_ID=               (set — placeholder, verify live)
STRIPE_BUSINESS_PRICE_ID=          (set — placeholder, verify live)
NEXT_PUBLIC_ADSENSE_CLIENT=        (set — placeholder)
```

### Vercel (production — all set)
All of the above PLUS:
```
RESEND_API_KEY=                    (set — email alerts)
RESEND_FROM_EMAIL=                 (set — Cruzar Alerts <alerts@cruzar.app>)
VAPID_PUBLIC_KEY=                  (set — push notifications)
VAPID_PRIVATE_KEY=                 (set — push notifications)
NEXT_PUBLIC_VAPID_PUBLIC_KEY=      (set)
NEXT_PUBLIC_APP_URL=               (set)
OWNER_EMAIL=                       (set)
```

### Known Gaps
- Emails send from `Cruzar Alerts <alerts@cruzar.app>` — domain verified in Resend, delivers to real users.
- Stripe keys may be placeholder values — verify before charging real users.
- Custom domain: cruzar.app (live).

---

## 15. Deployment

### Standard Deploy Command
```bash
cd /c/Users/dnawa/cruzar
npm run build   # verify clean build first
vercel deploy --prod
```

### Pre-Deploy Checklist
1. Run `npm run build` — must complete with zero errors
2. Check TypeScript passes (included in build)
3. Verify no hardcoded secrets or API keys in code
4. Confirm portMeta.ts and WaitingMode.tsx have matching coordinates
5. Deploy with `vercel deploy --prod`
6. Verify live: `curl https://cruzar.app/api/ports` → should return 50+ ports with data

### Cron Jobs (cron-job.org — NOT Vercel)
Vercel free plan only allows daily crons. All crons run via cron-job.org:
- fetch-wait-times: every 15 min ✅ running
- send-alerts: every 15 min ✅ running
- weekly-digest: Monday 8am ✅ scheduled

To manually trigger any cron for testing:
```bash
curl "https://cruzar.app/api/cron/fetch-wait-times?secret=YOUR_CRON_SECRET"
```
Expected response: `{"saved": 52, "at": "..."}`

---

## 16. Known Issues & Gaps

### Confirmed Working
- Live CBP data fetching ✅
- Community report submission ✅
- Map with color-coded dots ✅
- Geolocation "Near Me" ✅
- Language toggle (ES/EN) ✅
- User auth (email + Google) ✅
- Push notification infrastructure ✅
- Cron data collection ✅
- Video generator ✅

### Unverified / Potentially Broken
- Stripe payments — keys may be placeholders, payment flow untested
- Email alerts to real users — needs custom Resend domain
- SMS via Twilio — configured but untested
- `driver_events` table — silently fails on insert, may not exist in production
- Team collaboration — schema exists, no UI built
- Rewards system — businesses seeded with `approved=false`, no admin UI to approve
- AI predictions label — it's actually historical averages, rename to "historical patterns"
- Data export (CSV) — route exists, implementation may be incomplete

### Missing Features (Prioritized)
1. Custom domain (not a code issue — needs domain purchase)
2. Facebook Page API auto-posting
3. More video template types (tip card, best-time, alert)
4. Resend email domain verification
5. Stripe live payment testing

---

## 17. Business Context & Revenue Model

### Revenue Targets
- Month 1-3: $1,000 first revenue
- Path: 1 Business fleet account OR 10 Pro subscriptions

### Pricing (confirmed by Diego)
- Free: $0 — basic features, max stickiness
- Pro: $2.99/month — alerts, predictions, weekly digest
- Business: $49.99/month — fleet management, drivers, shipments

**Note on Pro pricing:** At $2.99, need 334 Pro subscribers to reach $1k/month. Consider raising to $4.99 (200 subscribers to $1k) when there's traction. For now $2.99 is a low-friction intro price.

### Revenue Priority Order
1. Business tier: one fleet customer = $49-99/mo
2. Pro tier: commuters who need alerts
3. Advertising: Google AdSense (placeholder configured, not live)
4. White-label: sell wait time data to logistics apps (future)

### Next Project: Insurance Automation Tool
- Family insurance business = guaranteed first customer
- Start with Google Sheets automation, charge $200-300/mo
- Then productize into a web app
- Same stack (Next.js + Supabase) when ready to build

---

## 18. Behavioral Rules for Claude

### Always
- Read relevant files before editing them — never guess at existing code
- Run `npm run build` mentally (check for TypeScript errors) before declaring done
- Keep Spanish translations in sync when adding any user-facing text
- Check BOTH `lib/portMeta.ts` AND `components/WaitingMode.tsx` when touching crossing coordinates
- Prefer editing existing files over creating new ones
- Keep the CLAUDE.md updated when making significant architectural changes

### Never
- Add features beyond what was asked
- Refactor surrounding code when fixing a bug
- Add comments or docstrings to code that wasn't changed
- Add error handling for scenarios that can't happen
- Create abstractions for one-time operations
- Write CSS animations — in Remotion, all animations MUST use useCurrentFrame()
- Hardcode secrets or API keys anywhere in source code
- Push to production without running a build check first

### When Something is Broken
1. Read the error message fully
2. Check the relevant file
3. Make a targeted fix
4. If stuck after 2 attempts, explain what you tried and ask clarifying questions

### When Adding a New Page/Feature
1. Check what tier it belongs to (guest/free/pro/business)
2. Add auth check if needed
3. Add Spanish translations
4. Check if a new API route is needed
5. If touching the map, update BOTH coordinate files

---

## 19. Project Ideas Pipeline

For context on future projects (full details in memory):

| Idea | Status | Next Action |
|---|---|---|
| Cruzar | Live, pre-revenue | Post in Facebook groups TODAY |
| Insurance Automation | Ready to start | Discovery call with family business |
| System Fixer / Car+Mechanic Tools | Planned | After Insurance proves out |
| Felon Job Finder | On roadmap | 6+ months out |
| Travel Simplifier | Shelved | Too crowded market |
| Fishing Rod Builder | Shelved | Too niche for now |

---

## 20. File Structure Reference

```
cruzar/
├── app/
│   ├── page.tsx                    # Homepage — port list + map
│   ├── port/[portId]/              # Individual port detail page
│   ├── dashboard/                  # User dashboard (saved, alerts)
│   ├── business/                   # Business fleet portal
│   ├── api/
│   │   ├── ports/                  # Live CBP data
│   │   ├── reports/                # Community reports
│   │   ├── cron/                   # Scheduled jobs
│   │   ├── alerts/                 # Alert preferences
│   │   ├── business/               # Fleet management
│   │   └── stripe/                 # Payment webhooks
│   └── [other pages]/
├── components/
│   ├── PortList.tsx                # Main crossing list
│   ├── BorderMap.tsx               # Leaflet map
│   ├── ReportForm.tsx              # Submit report modal
│   ├── WaitingMode.tsx             # Geofence detection + quick report
│   ├── WaitBadge.tsx               # Green/yellow/red wait indicator
│   ├── BusinessCommandWidget.tsx   # Business quick actions
│   └── [other components]/
├── lib/
│   ├── portMeta.ts                 # PORT COORDINATES — update carefully
│   ├── cbp.ts                      # CBP API fetching + parsing
│   ├── supabase.ts                 # Supabase client setup
│   ├── useAuth.ts                  # Auth hook
│   ├── useTier.ts                  # Feature gating by tier
│   └── LangContext.tsx             # Spanish/English toggle
├── video-generator/                # SEPARATE sub-project — Remotion
│   ├── src/
│   │   ├── index.ts
│   │   ├── Root.tsx
│   │   └── WaitTimeVideo.tsx       # Main video composition
│   ├── render.mjs                  # Run this to generate a video
│   └── output/                     # Generated MP4s (gitignored)
├── supabase-schema-v11.sql         # CANONICAL production schema
├── CLAUDE.md                       # This file
└── AGENTS.md                       # Next.js version warning (referenced by CLAUDE.md)
```
