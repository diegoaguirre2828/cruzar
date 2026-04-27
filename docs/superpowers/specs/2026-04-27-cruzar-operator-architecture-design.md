# Cruzar Operator Architecture — 12-month design (2026-04-27)

> Source of truth for the Cruzar operator/concierge build. Locked 2026-04-27 by Diego ("all in, full control"). Excludes any layer that requires reputation or outreach (Layers 4-6 below) until the underlying product earns audience leverage.

---

## 0. The reframe

**Cruzar is not a wait-times app. It is the border operator/concierge.**

> "i want to be THE border guide. not just the person who points you where to go, but the person who takes you there. connecting businesses with eachother, handling the paperwork, reaching out to security, planning their route to optimize gas, etc." — Diego, 2026-04-27

North-stars:

- **B2B:** "Tu cruce, lo manejamos." / "We handle your crossing."
- **Consumer:** "A border-crossing companion that knows your pattern, wakes you at the right time, rides shotgun in the car, handles the small things, and is there when something goes wrong."

The shift: from *showing* data to *actively participating* in the crossing.

---

## 1. The 6-layer architecture

| Layer | Function | Status | In scope this 12-month plan |
|---|---|---|---|
| 0 | Data brain | LIVE | Yes — long-horizon prediction heads (1d-4w) for v0.6 |
| 1 | Decision engine | LIVE | Yes — extend MCP tool surface |
| 2 | Crossing helper | BUILD next 30 days | Yes — checklist + alerts + paperwork moat |
| 3 | Orchestration | BUILD m2-3 | Yes — dispatcher dashboard + driver app + CSV TMS pipe |
| 4 | Partner network | OPEN m6-12 | NO — requires reputation/outreach |
| 5 | Marketplace | Year 2 | NO — gated by Layer 4 |
| 6 | Geo replication | Year 2+ | NO — needs operating layer first |

Solo + Claude Code can build **Layers 0-3 entirely**. Layers 4-6 require human relationships and start when 0-3 give audience leverage.

---

## 2. Layer 0 — Data brain (LIVE, in-flight)

### Current state (verified 2026-04-27 evening)

- v0.5.2 RandomForest models, 52-port coverage, served from `cruzar-insights-api.vercel.app/api/forecast`
- Two horizons: 6h + 24h
- Drift-affected ports auto-fall-back to CBP climatology baseline (Pharr 6h+24h, Br Vets 24h, Eagle Pass 6h)
- CBP backfill running in background — 19 of 36 RGV-list ports populated, ~155k rows added since Apr 25
- Weekly retrain via GH Action (Sundays 06:00 UTC) — currently 13-port manifest

### v0.6 redirect (this plan, decided 2026-04-27)

**DROPPED from prediction features:** vision/satellite (Sentinel-2 too coarse, Planet Labs too pricey, drones airspace-blocked at federal POEs).

**Vision REPURPOSED into 3-tier dashboard stack** (see Layer 3):
1. Ambient — weekly Sentinel-2 image per main bridge ($0)
2. Emergency — anomaly-triggered TxDOT webcam + Sentinel-1 SAR ($0, Diego's idea)
3. Investigative — Planet SkySat tasking as paid Pro upsell ($25-50/snapshot SKU)

**ADDED to v0.6 prediction features:**
- Long-horizon heads at 1d, 3d, 1w, 2-4w
- BTS monthly volumes (1996+, free)
- DOF Mexican-holidays feed
- Open-Meteo 16-day weather forecast (free)

### Layer 0 deliverables

- `cruzar-insights-ml/watchdog.py` — polls CSV, fires `save_v05_artifacts.py` once 8+ new ports cross threshold, optional Vercel deploy via `VERCEL_TOKEN` (SHIPPED 2026-04-27)
- `cruzar-insights-ml/save_v06_artifacts.py` — long-horizon training script (TODO)
- `cruzar-insights-ml/.github/workflows/weekly-retrain.yml` — bump to v06 paths (TODO after v0.6 trains clean)
- HF Jobs migration for v0.7+ training when budget allows

---

## 3. Layer 1 — Decision engine (LIVE, extending)

### Current MCP tool surface (10 tools, was 9)

`cruzar_smart_route`, `cruzar_live_wait`, `cruzar_best_times`, `cruzar_forecast`, `cruzar_recommend_route`, `cruzar_anomaly_now`, `cruzar_compare_ports`, `cruzar_briefing`, `cruzar_load_eta`, **`cruzar_history` (NEW 2026-04-27)**.

### Layer 1 deliverables

- `cruzar_history(port_id, days, limit)` — raw recent readings for power users (SHIPPED 2026-04-27)
- `cruzar_lane_recommend(port_id)` — pending lane-quality audit per port
- `cruzar_help()` meta-tool — pending; needed when surface crosses ~12 tools to keep AI clients oriented

---

## 4. Layer 2 — Crossing helper (BUILD next 30 days)

### Week 1 — Awareness

- `/checklist?lane=X&cargo=Y` — interactive bilingual checklist (Standard/Ready/SENTRI/FAST × dry/produce/refrigerated/hazmat). Uses `customs-trade-compliance` skill for content.
- `/live` rewrite — frame as the **"during"** moment.
- `/insights` rewrite — frame as the **"before"** moment.
- "Actively guiding" copy goes live the same week as Week 2 alerts (don't oversell).

### Week 2 — Action

- Driver alert system: per-load threshold triggers + anomaly-triggered SMS via Twilio + push via web-push.
- Dispatcher relay UI: assign load → see driver ETA → "reroute" button (CONFIRM step required).
- Pricing tier limits already in place (free=1, pro=20, business=100).
- Use `vercel:workflow` for durable load lifecycle.
- Use `vercel:chat-sdk` for multi-channel (SMS now, WhatsApp/Telegram later).

**Hard prereq:** Twilio 10DLC registration (1-7 days). Push-only fallback if 10DLC not done by Week 2.

### Week 3-4 — Paperwork moat

- Customs declaration generator: CBP Form 7501, truck cargo lane only. Pre-fill from load metadata + driver wallet, generate PDF + ACE-ready CSV, "we generate / you verify" disclaimer.
- Driver wallet: encrypted doc storage (license, passport, SENTRI, vehicle title, MX insurance, IRP cab card, IFTA decal). pgsodium at rest. Photo-only.
- Pre-stage sync stub webhook for broker integration.

**Legal guardrail:** every PDF watermarked "DRAFT — REQUIRES BROKER REVIEW." ToS must say Cruzar is not a customs broker. Budget actual legal review before Week 3 ship.

---

## 5. Layer 3 — Orchestration (BUILD m2-3)

- Dispatcher dashboard — Kanban (assigned/en-route/in-line/crossed/delivered) with filter by lane, port, driver, customer.
- Driver app — same PWA, role-gated `/driver`. Manual status taps only. **No background GPS in v1, ever.**
- CSV TMS pipe v1 — read-only import for fleets without API. Bidirectional API integrations are Layer 4.
- Per-driver-seat pricing from launch (not per-account).
- Vision Tier 3 (paid border snapshot) ships here as `/dashboard?snapshot=true`.

---

## 6. Consumer pillars (parallel track to B2B)

The "moments" frame (load-bearing): **Wake-up → Pre-leave → In-car/approaching → In line → At agent → After crossing → Long-term patterns.**

| Pillar | Build | Ship target |
|---|---|---|
| 1. Pattern Brain | Detect commute pattern → schedule push notif at "wake-up moment" tomorrow | Month 1 (after PostHog wired) |
| 2. Co-Pilot | iOS Live Activity + voice prompts + auto-text spouse on cross | Month 1 build 21 (iOS only initially) |
| 3. Family Layer | Households + invitation flow + family ETA broadcast (Cruzar Circle already partially built — extend, don't reinvent) | Month 2 |
| 4. Wallet | Encrypted doc storage + agent-prep card EN/ES + currency widget | Month 3 (rides on driver wallet infra) |
| 5. Memory | `/memory` page — timeline + stats + Cruzar Wrapped share card | SHIPPED 2026-04-27 |
| 6. Safety Net | Emergency mode UI + bilingual scripts + family location share | Month 3 (after script content review) |

---

## 7. Vision stack (3 tiers, refined 2026-04-27)

| Tier | Trigger | Source | Cost | Delivery target |
|---|---|---|---|---|
| Ambient | Always-on (weekly) | Sentinel-2 | $0 | Operator dashboard background credibility |
| Emergency | `cruzar_anomaly_now` ≥2.0× / ≤0.5× baseline | TxDOT webcam (US) + Sentinel-1 SAR (MX) | $0 | Auto-attached to operator alert + SMS/push |
| Investigative | Buyer requests "snapshot now" | Planet SkySat tasking | ~$5-15/image, sold $25-50 | Pro upsell SKU after Layer 2 Week 2 |

---

## 8. Phase 4 backlog (DEFERRED — trigger conditions named)

- **Transload directory** (scrape-only v1) — ships when first Cruzar Operator customer asks
- **Nearshoring Readiness Audit** — DEFERRED, audience mismatch with Cruzar core; build only when first inbound nearshoring inquiry hits
- **Rail capacity tracker** — DEFERRED; only the truck-vs-rail calculator content page ships in Layer 2 Week 1 SEO bundle

---

## 9. Cross-cutting infrastructure (gates the empire)

| Build | Why | Status |
|---|---|---|
| PostHog wiring (paste env keys, verify event flow) | 41-event tracking plan from commit `e4d1364` is no-op until live | Diego TODO |
| RLS test harness | Every multi-tenant table (loads, households, wallet docs, family ETAs) needs RLS verification BEFORE features ship | TODO before Layer 2 Week 2 |
| Twilio 10DLC registration | Gates SMS in Layer 2 Week 2 + Pillar 6 + Pillar 1 | Diego TODO (EIN/business address required) |
| Vercel Workflow setup | Durable workflows for load lifecycle, scheduled wake-ups | TODO with Layer 2 Week 2 |
| `customs-trade-compliance` skill activation | Layer 2 Week 1 (checklist) + Week 3-4 (paperwork) | In-stash, ready |

---

## 10. New Claude additions powering the build

- `huggingface-skills:huggingface-llm-trainer` + `vision-trainer` + `trackio` → v0.6 onward training off-laptop (HF Jobs cloud GPU)
- `customs-trade-compliance` → Layer 2 paperwork moat
- `vercel:ai-sdk` + `vercel:workflow` → durable workflows + AI generation across Layer 2 + 3
- `vercel:chat-sdk` → multi-channel relay (SMS/WhatsApp/Telegram)
- `vercel:next-cache-components` → PPR for `/live` and `/insights`
- `vercel:vercel-sandbox` → safe untrusted PDF code (customs generator)
- `mcp__github__*` → cross-repo PR coordination (cruzar + cruzar-insights-ml + autosites)
- `mcp__exa__web_search_exa` + `deep-research` skill → DAT/ATA detention number sourcing for Layer 4 pitch
- `mcp__plugin_playwright_playwright__*` → automated UI verification across operator + consumer flows
- `mcp__reddit__*` → user pain-point discovery for consumer pillars 5/6
- `superpowers:writing-plans` + `executing-plans` + `dispatching-parallel-agents` → spec-then-execute, parallel subagents for independent layers
- `product-tracking-skills:*` → keep tracking plan coherent as features ship

---

## 11. Honest red flags to monitor

1. **Privacy/legal exposure cluster** — driver wallet, customs paperwork, household docs, family location share. Each manageable; stacked = SOC 2 conversation in 6 months. Budget legal review before Layer 2 Week 3.
2. **Scope-vs-solo math** — Month 1 (Layers 0-2 + Memory + Pattern Brain) is achievable. Month 2-3 starts feeling like a team is needed.
3. **Reputation/outreach exclusion** has a real cost — Layer 4 partner relationships are where moats compound. Revisit when Layer 2 ships: at that point "outreach" might just mean publishing a `/partners` page and letting partners self-serve.
4. **Phase 4 wedges 2+3** — share brand but not audience. Build them as separate brands later, not as Cruzar SKUs.
5. **Vision moat dropped from prediction** — long-horizon predictions take its place as the buyer-relevant differentiator. If long-horizon doesn't beat persistence, we have no moat beyond UX.

---

## 12. Build order (dependency-ordered, parallel where independent)

**Tonight (idle Diego):** Layer 0 watchdog + Layer 1 `cruzar_history` + Pillar 5 Memory + this spec doc.

**Next session (Diego available):** PostHog wiring, RLS test harness, Layer 2 Week 1 checklist + page rewrites, Pillar 1 Pattern Brain.

**Week 2:** Layer 2 Week 2 alerts/relay, Pillar 2 Co-Pilot, Pillar 3 Family Layer extension.

**Week 3-4:** Layer 2 Week 3-4 customs + driver wallet, Pillar 4 Wallet, Pillar 6 Safety Net.

**Month 2-3:** Layer 3 dispatcher dashboard + driver app, Phase 4 wedge 1 (transload directory).

**Trigger-based:** Phase 4 wedges 2+3 only when buyer signal hits.

---

## 13. Reconciliation log

- 2026-04-27 — Spec created. Layers 0-3 + 6 consumer pillars + 3 Phase 4 wedges scoped. Vision Tiers 1/2/3 added per Diego "use in emergency" idea.
- 2026-04-27 — Watchdog SHIPPED (`cruzar-insights-ml/watchdog.py`).
- 2026-04-27 — `cruzar_history` MCP tool SHIPPED (`cruzar/app/mcp/route.ts`).
- 2026-04-27 — Pillar 5 Memory page SHIPPED (`cruzar/app/memory/page.tsx` + `cruzar/app/api/memory/route.ts`).
