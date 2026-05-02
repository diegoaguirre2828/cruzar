# CRUZA — Complete Project Brain

> This file is the single source of truth for everything about this project.
> Read it fully before every task. If something conflicts with this file, this file wins.
> To update: make the change and say "update CLAUDE.md to reflect this."

---

## Cross-portfolio context (lazy-fetch — pull only when needed)

Diego runs an 11-project portfolio. For context this project doesn't have, the brain vault holds cross-portfolio synthesis:

- **Brain vault:** `~/brain/` (Karpathy LLM Wiki structure — raw / wiki / schema)
- **This project's high-level page:** `~/brain/projects/Cruzar.md` (status, Active queue, decisions, blockers)
- **Cross-portfolio concepts:** `~/brain/wiki/concepts/` (e.g., RGV trucking ecosystem, USMCA dynamics, etc.)
- **Cross-portfolio entities:** `~/brain/wiki/entities/` (people, products, tools across portfolio)
- **Per-source summaries:** `~/brain/wiki/sources/` (compiled from articles, reels, papers ingested into raw/)
- **Active inbox:** `~/brain/inbox.md` (Diego's barf channel — items routed to projects/ Active queues)
- **Cross-portfolio memory rules:** `~/.claude/projects/C--Users-dnawa/memory/MEMORY.md` (auto-loaded by Claude Code)
- **Cruzar code knowledge graph:** `~/cruzar/graphify-obsidian/` (when graphified — open as a separate Obsidian vault for code-level Q&A)

**When to read these:** lazy-fetch only — pull when this project's local code/docs don't answer. Don't preload (token-efficient per the canonical executive-assistant pattern from `~/brain/raw/youtube-sboNwYmH3AY.md`).

The brain vault is the cross-portfolio synthesis layer; Cruzar is one of many projects pulling from it.

---

## 0. Sensei audit mode (inherited)

Standing capability across every project Diego owns. Canonical rules live in the user-level memory folder under `~/.claude/projects/C--Users-dnawa/memory/` — see the files `feedback_sensei_audit_method.md` and `feedback_prevent_stale_memory_audits.md`. Locked 2026-04-16.

**Triggers (any session, any phrasing):** "everything wrong", "audit [the project]", "sensei [project]", "sensei mode", "full audit", "what's broken", "gimme the list" — fire the full Sensei pattern immediately, no clarifying questions.

**Pipeline:** memory pass (handoffs + backlogs, treat all claims as hypotheses) then parallel live-state scan (build, endpoint health, env drift, schema drift, bilingual coverage, security/RLS) then structured **CRITICAL / HIGH / MEDIUM / LOW** report with file:line evidence PLUS a `verified-live-at` evidence cell on every row, then autonomous-safe vs. Diego-input split with ONE pick for the autonomous bundle, then on greenlight ("all in one session", "go", "ship"), execute end-to-end: edits, run the build, commit (named files, never `-A`), push, deploy to prod via the `vercel deploy --prod` command, curl live endpoints to verify landing, self-correct against live state, and append a **Reconciliation log** section to the audit memory noting SUPERSEDED items + their commit SHA.

**Cruzar-specific audit surfaces:**
- Build: run `npm run build` — must produce 197 of 197 pages clean
- Live verify: curl `https://cruzar.app/api/ports` (at least 50 ports), plus `/privacy` and `/pricing`
- Railway fb-poster: **decommissioned 2026-04-17** — `lastPosted: null` is expected; don't flag. Native Graph API publisher SHIPPED 2026-04-25 (see /api/social + admin/fb).
- Schema source: `supabase/migrations/` is authoritative (v27 → v68 as of 2026-04-28 evening). Top-level `supabase-schema-v*.sql` files are per-version deltas, not full schema dumps. No canonical full-schema file is committed — rebuild from ordered migrations.
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
**Status:** Live + iOS in TestFlight (build 20, Apr-25). Pre-revenue, ~62 founders enrolled (PWA-gated lifetime Pro promo, 938 slots open). Goal: 1,000 users in 3 months. First dollar in 3 months.
**Live URL:** https://cruzar.app (active)
**GitHub:** https://github.com/diegoaguirre2828/cruza
**iOS:** TestFlight build 20 — RevenueCat IAP + native plugins on Capacitor 8.3.1.
**Social media:** Cruzar FB Page live + Natividad Rivera FB alt; FB native publisher pipeline live.

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
- **Database:** Supabase (PostgreSQL) with Row-Level Security. Service-role key migrated to `sb_secret_` 2026-04-23. Anon → `sb_publishable_`. Legacy JWTs DISABLED.
- **Auth:** Supabase Auth (email/password + Google OAuth + native Sign-in with Apple on iOS)
- **File storage:** Vercel Blob (port photos, camera frames, social-post images)
- **Rate limiting + KV:** Upstash Redis (`@upstash/redis` + `@upstash/ratelimit`)
- **Errors:** Sentry (`@sentry/nextjs`)
- **MCP server:** Cruzar MCP at `/api/mcp` — 15 tools (`smart_route`, `live_wait`, `best_times`, `briefing`, `recommend_route`, `forecast`, `anomaly_now`, `compare_ports`, `history`, `load_eta`, `safety_script`, `generate_customs`, `anomaly_camera_recent`, `transload_yards`, `nearby_natural_events`) over Streamable HTTP (bearer-auth, tracked in `mcp_keys` table). `anomaly_now` auto-attaches NASA EONET nearby natural events when port flags `anomaly_high`.
- **iOS native:** Capacitor 8.3.1 + RevenueCat 13.0.1 (IAP) + native plugins (App, Geolocation, Preferences, Push, SplashScreen, StatusBar)

### Infrastructure
- **Deployment:** Vercel (Hobby plan — free)
- **Cron jobs:** cron-job.org (NOT Vercel cron). API wired at `/api/admin/create-cron-jobs` — NEVER tell Diego to add cron-job.org jobs manually.
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

**Schema source of truth:** `supabase/migrations/` — ordered files `v27-*.sql` through `v57-*.sql` (current as of 2026-04-26) plus `20260416_referrals.sql`. Apply in filename order via the `npm run apply-migration -- <path>` script (hits Supabase Management API via `SUPABASE_PAT`). Never paste SQL to Diego to hand-run.

The top-level `supabase-schema-v12.sql` … `supabase-schema-v26.sql` files are historical per-version deltas, NOT full schema dumps. There is no canonical single-file dump committed. Core tables (`profiles`, `crossing_reports`, `wait_time_readings`, `alert_preferences`, `push_subscriptions`, `drivers`, `shipments`, `saved_crossings`, `subscriptions`, `rewards_*`) were created in pre-v12 files that are no longer in the repo — prod was built incrementally. Re-creating prod from scratch currently requires a Supabase dump; not possible from git alone. If you add new tables, prefer an idempotent `CREATE TABLE IF NOT EXISTS` migration in `supabase/migrations/` with the next `v<n>-` prefix.

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
| `/api/predict` | GET | Free-tier predictions (historical averages) |
| `/api/predictions` | GET | Pro-tier ML forecasts (proxies cruzar-insights-api v0.5.2) |
| `/api/route-optimize` | GET | Route optimizer for fleet (Pro+) |
| `/api/smart-route` | GET | MCP-friendly best-port-now lookup |
| `/api/auto-crossings` | GET/POST | Opt-in bridge + checkpoint detection (v48/v49) |
| `/api/intelligence` | GET | Operator+Intel tier dashboards (v52) |
| `/api/mcp` | POST | Cruzar MCP server (Streamable HTTP, bearer-auth) |
| `/api/insights/scenario-sim` | POST | Dispatcher scenario simulator (Haiku) — primary rec + alts + cascade + transcript + caveats. Logs every run to `calibration_log`. |
| `/api/social/*` | various | FB native Graph API publisher pipeline |
| `/api/port-photos`, `/api/cameras` | various | Camera HLS feeds + frame extraction (v43, v55c) |

### Cron (protected by CRON_SECRET)
| Route | Schedule | Purpose |
|---|---|---|
| `/api/cron/fetch-wait-times` | Every 15 min | Fetch CBP data → store in wait_time_readings |
| `/api/cron/send-alerts` | Every 15 min | Check thresholds → send email/push/SMS |
| `/api/cron/weekly-digest` | Monday 8am | Send weekly summary to Pro/Business users |
| `/api/cron/insights-briefing` | Every hour (top of hour) | Per-subscriber morning brief at their local hour |
| `/api/cron/insights-anomaly-broadcast` | Every 30 min | Watched-port anomaly fanout to SMS + email |
| `/api/cron/calibration-tick` | Every 15 min | Score predictions made 6h ago against actuals (Diego registers at cron-job.org) |

**Cron auth:** Accepts `?secret=CRON_SECRET` query param OR `Authorization: Bearer CRON_SECRET` header.

### Insights B2B (subscriber-gated)
| Route | Method | Purpose |
|---|---|---|
| `/api/insights/preferences` | GET / PUT | Own subscriber prefs with tier-bounded validation |
| `/api/insights/subscribe` | POST | Free-direct or Stripe checkout for paid tiers |
| `/api/insights/portal` | POST | Stripe billing portal session |
| `/api/insights/accuracy-summary` | GET | Median 30d accuracy across given ports (drives /dispatch hero) |
| `/api/admin/create-insights-cron-jobs` | POST | Register both insights crons at cron-job.org (admin only) |

### Insights schema (v70)
- `insights_subscribers` — tier (free/starter/pro/fleet), watched_port_ids[], briefing prefs (local hour + tz + language), channels (email/sms/whatsapp), recipient_emails[]/recipient_phones[], anomaly_threshold_default, port_thresholds JSONB. RLS: own-row select/update/insert.
- `insights_anomaly_fires` — fire log + dedupe table. Service-role only.

### B2B architecture notes
- `/insights` is the **sales page** (editorial, ~190 lines). Hero = verbatim "the border is the black hole" copy from RGV broker dossier. Inline calibration scoreboard teaser → links to full `/insights/accuracy`.
- `/dispatch` is the **operator panel** — config + watchlist + hero strip (watching N · X anomalies firing · 30d accuracy · next briefing label) + per-row AlertsRail.
- `/dispatch/account` — subscription management (briefing time/tz/language, channels, recipients, watched ports, Stripe billing portal).
- `/dispatch?demo=rgv` — Raul's broker-office demo preset (RGV-heavy watchlist, persistence skipped).
- The actual product is the **morning briefing + anomaly push + calibration receipts**. The panel is the configuration surface.
- B2B nav = `<B2BNav />` (Sales · Console · Account). Consumer nav = `<MomentsNav />` (During · After). DO NOT mix them.
- **Strip every "AI" / "model" / "MCP" mention from customer-visible surfaces** per `feedback_ai_as_infrastructure_not_product_20260430.md`. Internal code keeps it.

### Insights env vars (Vercel prod)
- `STRIPE_INSIGHTS_STARTER_PRICE_ID` ($99/mo)
- `STRIPE_INSIGHTS_PRO_PRICE_ID` ($299/mo)
- `STRIPE_INSIGHTS_FLEET_PRICE_ID` ($999/mo)

Until Diego creates the Stripe price IDs and adds the env vars, the free tier still works (no Stripe needed). Paid checkout returns `price_id_not_configured` cleanly.

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

### Local (.env.local)
```
NEXT_PUBLIC_SUPABASE_URL=          (set)
NEXT_PUBLIC_SUPABASE_ANON_KEY=     (sb_publishable_… as of 2026-04-23)
SUPABASE_SERVICE_ROLE_KEY=         (sb_secret_… as of 2026-04-23)
SUPABASE_PAT=                      (Management API token — used by apply-migration script)
CRON_SECRET=                       (set — rotated 2026-04-23)
NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY=(live)
STRIPE_SECRET_KEY=                 (live, rotated 2026-04-23)
STRIPE_WEBHOOK_SECRET=             (live)
STRIPE_PRO_PRICE_ID=               (live)
STRIPE_BUSINESS_PRICE_ID=          (live)
ANTHROPIC_API_KEY=                 (rotated 2026-04-23)
RESEND_API_KEY=                    (rotated 2026-04-23)
HERE_API_KEY=                      (rotated 2026-04-23)
SENTRY_DSN=                        (rotated 2026-04-23)
UPSTASH_REDIS_REST_URL=            (set)
UPSTASH_REDIS_REST_TOKEN=          (set)
BLOB_READ_WRITE_TOKEN=             (Vercel Blob)
FACEBOOK_PAGE_ID=                  (FB Graph API publisher)
FACEBOOK_PAGE_ACCESS_TOKEN=        (long-lived page token)
CRUZAR_INSIGHTS_API_KEY=           (bearer for ML forecast endpoint)
```

### Vercel (production — all set)
All of the above PLUS push + email:
```
VAPID_PUBLIC_KEY / VAPID_PRIVATE_KEY / NEXT_PUBLIC_VAPID_PUBLIC_KEY
RESEND_FROM_EMAIL=Cruzar Alerts <alerts@cruzar.app>
NEXT_PUBLIC_APP_URL=https://cruzar.app
OWNER_EMAIL
```

### Verification before revenue claims
Before saying a flow is ready: `vercel env pull` and confirm keys exist + curl the live endpoint. Autosites had Stripe unwired in prod — every buy button 503'd — caught only on smoke test. Same lesson applies here.

### Known Gaps
- Emails: domain verified in Resend, delivers to real users.
- Stripe: live mode, all 7 leaked keys rotated 2026-04-23 (see `project_cruzar_security_fixes_shipped_20260423.md`). DO NOT re-propose rotation.
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
- User auth (email + Google + native SIWA on iOS) ✅
- Push notification infrastructure (multi-device per v40) ✅
- Cron data collection ✅
- Video generator ✅
- **Auto-crossing detection** (v48+v49) — opt-in bridge + inland checkpoint geofence, SHIPPED 2026-04-25
- **Cruzar Insights ML** — v0.5.2 RandomForest models, 52-port coverage, served from `cruzar-insights-api.vercel.app/api/forecast`. Repo: `C:\Users\dnawa\cruzar-insights-ml`
- **Cruzar MCP server** — `/api/mcp` (smart_route, live_wait, best_times, briefing) — bearer-auth via `mcp_keys`
- **Native FB Graph API publisher** (v50-social-posts-fb-publish) — replaced Make.com loop
- **Camera HLS feeds + frame extraction** (v43, v55c) — ffmpeg-static for AI-readable border cams
- **Officer staffing alerts** (v55d → v56) — leading-indicator Pro-tier push
- **First-1000 lifetime Pro promo** (v37 + v51 + v57) — gated to PWA install
- **Operator + Express Cert tier** (v50) — phase 1 auto-crossing infrastructure
- **3-panel home swipe** — Cerca / Mi puente / Comunidad (commit c2f7745)
- **Scenario Sim v0** (2026-04-28) — `/api/insights/scenario-sim` + `/admin/scenario-sim` console. Haiku-backed dispatcher decision sim. Always labels `is_simulation: true`. Calibration log wired (v63 migration applied; row id=1 verified live).
- **Co-Pilot trip mode** (2026-04-28) — `/copilot` page with start-trip/auto-cross-detection (geolocation watchPosition + auto-fire `/api/family/eta` + auto-fire `/api/copilot/cross-detected`). iOS Live Activity opt-in stub (lands when iOS build 22+ ships the Swift widget extension). v68 migration adds `copilot_live_activity_opt_in` + `copilot_active_trip_id` profile columns.
- **Transload directory** (2026-04-28) — `/transload` public page + `/api/transload` + `cruzar_transload_yards` MCP. 62 OSM-sourced freight facilities across 6 megaRegions. `negocios` cross-link in transload category.
- **/insights v0.5.4** (2026-04-28) — manifest-driven render (52 ports across TX/NM/AZ/CA), per-port RF-vs-XGBoost winner selection, self-climatology baseline (sky-tinted rows for CA/AZ/NM where CBP doesn't publish), payday + holiday features. `data/insights-manifest.json` snapshot synced from cruzar-insights-ml weekly via `.github/workflows/sync-insights-manifest.yml` (needs `CRUZAR_INSIGHTS_ML_TOKEN` repo secret to run).
- **EONET anomaly explanation** (2026-04-28) — `lib/eonet.ts` + augmented `cruzar_anomaly_now` MCP tool + new `cruzar_nearby_natural_events` tool. NASA wildfires/storms/floods within 100km of port-of-entry. Public domain. 1h cache.
- **Calibration dashboard** (concurrent session) — `/admin/calibration` + mark-observed flow. Service-role read of `calibration_log` + `calibration_accuracy_30d` view. Closes predicted-vs-observed loop end-to-end.
- **PWA funnel + Supabase advisor cleanup** (concurrent session 2026-04-28 evening) — install-sheet whitelist (only on `/`), iOS step-1 → /ios-install dwell banner, post-signup nudge throttled, v64-v67 cleared all 27 Supabase advisor findings (3 errors + 16 warn + 8 info), SW v9 bump.
- **Stripe live + rotated** ✅
- **Anthropic SDK** (`@anthropic-ai/sdk`) — used for AI features

### Open / In-flight
- Team collaboration — schema exists, no UI built
- Rewards system — businesses seeded with `approved=false`, admin UI partially built
- AI predictions label — historical averages on free tier; v0.5.2 ML forecasts on Pro+
- Pharr-Reynosa ML — degraded → CBP climatology fallback (regime shift)
- iOS submission — TestFlight build 20 in Apple review (last status check Apr-25)

### Shelved / DO NOT re-propose
- Play Console closed test gate (12-tester/14-day rule infeasible solo) — `project_cruzar_play_console_closed_test_gate_20260423.md`. iOS-only mobile.
- Cruzar × Aguirre family insurance pairing — Nevada agency, RGV product, zero overlap. TIER-0 rule.

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
├── supabase/migrations/            # AUTHORITATIVE schema (v27 → v40, ordered; apply in filename order)
├── supabase-schema-v12.sql         # delta only (exchange_rate_reports + rewards_businesses alters). Historical.
├── CLAUDE.md                       # This file
└── AGENTS.md                       # Next.js version warning (referenced by CLAUDE.md)
```
