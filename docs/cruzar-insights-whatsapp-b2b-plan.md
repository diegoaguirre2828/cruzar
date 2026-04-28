# Cruzar Insights × WhatsApp — B2B wire-up plan

## Why this is the killer use case

The 2026-04-28 framework wired WhatsApp into consumer Co-Pilot flows (`/api/copilot/cross-detected`, `/api/family/eta`). That's nice but not load-bearing — consumer users are PWA-installed and push works fine.

**B2B Insights is the actual fit.** Per memory `_clusters/cruzar_CURRENT.md`:
> "Cruzar Insights × WhatsApp delivery flagged as **strongest fit** for OpenClaw delivery mechanism (MX SMB dispatchers live on WhatsApp, don't want web dashboards)."

MX SMB dispatchers / brokers / fleet ops don't install consumer apps. They live on WhatsApp + email all day. Real-time anomaly alerts, message-driven port queries, and morning briefings via WhatsApp = the product they'd pay $99-499/mo for.

## Six implementation pieces (~3-4 hr focused)

### 1. Migration `v70-insights-subscribers.sql`

```
CREATE TABLE insights_subscribers (
  id              uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id         uuid REFERENCES auth.users(id) ON DELETE CASCADE,
  whatsapp_phone_e164 text NOT NULL,
  watched_port_ids text[] NOT NULL DEFAULT '{}',
  briefing_lang   text NOT NULL DEFAULT 'es' CHECK (briefing_lang IN ('es', 'en')),
  briefing_local_hour int NOT NULL DEFAULT 7,  -- 0-23
  briefing_tz     text NOT NULL DEFAULT 'America/Chicago',
  stripe_subscription_id text,
  stripe_price_id text,
  tier            text NOT NULL DEFAULT 'free' CHECK (tier IN ('free','starter','pro','fleet')),
  active          boolean NOT NULL DEFAULT true,
  created_at      timestamptz NOT NULL DEFAULT NOW(),
  updated_at      timestamptz NOT NULL DEFAULT NOW()
);

CREATE INDEX insights_subscribers_active_idx ON insights_subscribers (active) WHERE active = true;
CREATE INDEX insights_subscribers_watched_gin ON insights_subscribers USING GIN (watched_port_ids);

ALTER TABLE insights_subscribers ENABLE ROW LEVEL SECURITY;
-- service-role write/read only; subscribers see their own row only
CREATE POLICY "insights_subscribers_self_read"
  ON insights_subscribers FOR SELECT TO authenticated USING (user_id = auth.uid());
```

### 2. Stripe price + checkout

Mirror the laboral pattern (`bootstrap-stripe.mjs`). Tiers TBD — see Open Product Questions below. New `/api/insights/subscribe` route that creates a Stripe checkout session, on `checkout.session.completed` webhook insert into `insights_subscribers`. Existing webhook at `/api/stripe/webhook` extends.

### 3. Anomaly alert cron

New `/api/cron/insights-anomaly-broadcast` route. Every 30 min (or 15 min — TBD):

```
for each active insights_subscriber:
  for each port in watched_port_ids:
    result = anomalyNow(port_id, includeNaturalEvents: true)
    if status === "anomaly_high":
      sendTemplate({
        to_phone_e164: subscriber.whatsapp_phone_e164,
        template_name: "cruzar_broker_anomaly_" + lang,
        components: [{
          type: "body", parameters: [
            { type: "text", text: portLabel },
            { type: "text", text: ratio + "x" },
            { type: "text", text: nearbyEventTitle ?? "no EONET event" },
            { type: "text", text: liveWaitMin + " min" },
          ],
        }],
      });
```

Dedupe via `whatsapp_messages` lookup — if same (subscriber, port_id, anomaly_kind=high) sent in last 60 min, skip. Avoids spam during sustained spikes.

### 4. Daily briefing cron

Per-subscriber morning brief at their `briefing_local_hour` in `briefing_tz`. Runs every hour UTC, computes which subscribers are at their hour. For each:
- Pulls live + 6h + 24h forecast for each watched port
- Ranks by total ETA = drive_min + predicted_wait
- Sends `cruzar_broker_briefing_<lang>` template with top 3 picks + caveats

### 5. Inbound query handler

Extend `app/api/whatsapp/webhook/route.ts` POST handler. When `messages[]` contains a user-initiated message:

```
parse text → match patterns:
  "wait at X" / "espera en X"            → cruzar_briefing(port_id) + reply free-form
  "best now" / "mejor ahora"              → cruzar_recommend_route(...) + reply
  "anomaly" / "anomalía"                  → list watched ports' anomaly_now status
  "stop" / "parar"                        → set active=false
  unknown                                 → reply menu
```

Free-form replies are valid within the 24h reply window from a user-initiated message — no template needed. Saves us ~$0.005/reply.

### 6. Templates to submit to Meta

After Meta Business Manager unverified setup (no LLC needed for v0):

- **`cruzar_broker_anomaly_es`** (utility):
  ```
  ⚠️ {{1}}: espera {{2}} del baseline. {{3}}.
  Espera actual: {{4}}.
  Detalles: cruzar.app/insights
  ```
- **`cruzar_broker_anomaly_en`**: same, English.
- **`cruzar_broker_briefing_es`** (utility, sent ~daily):
  ```
  Buenos días. Picks de hoy:
  1. {{1}} — {{2}}
  2. {{3}} — {{4}}
  3. {{5}} — {{6}}
  Detalles: cruzar.app/insights
  ```
- **`cruzar_broker_briefing_en`**: same, English.

Each takes ~24h Meta review. Submit all 4 in parallel.

## Open product questions (Diego decisions)

These are not implementation questions — they're product calls. Each blocks the corresponding piece:

1. **Pricing tiers.** Memory locked Cruzar Insights B2B as "$99-999/mo decision overlay product" (`_clusters/cruzar_CURRENT.md`). For v0:
   - **free**: 1 watched port, briefing only, no anomaly alerts? Used as funnel.
   - **starter**: $99/mo, 5 watched ports, all alerts + daily briefing.
   - **pro**: $299/mo, 20 watched ports, all alerts + briefing + inbound query unlimited.
   - **fleet**: $999/mo, 50 watched ports, all features + multi-recipient (driver + dispatcher).

   Do these tiers work? Or different shape?

2. **Briefing content.** Text-only or with embedded chart / map link?
   - Text-only: simpler, fits Meta utility template constraints.
   - With chart: needs a CDN-hosted PNG generated on-demand. Slightly more infra, more impressive.

3. **Watchlist cap UX.** When a free user tries to watch a 6th port, what's the upsell path? In-app on `/insights`? Reply via WhatsApp ("you've hit your free port limit, upgrade at cruzar.app/insights/upgrade")?

4. **Multi-recipient on fleet tier.** Does a fleet sub mean: (a) one phone number gets alerts for 50 ports, or (b) up to 5 phone numbers get the same alerts? UX shape changes the schema.

5. **Anomaly threshold.** Currently 1.5× baseline = `anomaly_high`. For brokers, do we want a configurable per-subscriber threshold (e.g. some only want >2× to avoid noise)?

6. **Inbound stop word.** Meta requires opt-out keywords (typically `STOP` / `BAJA` / `CANCELAR` for MX). What's our opt-out flow? Does sending STOP just pause briefings, or unsubscribe entirely from Stripe too?

## Sequencing once Diego answers

1. Apply v70 migration (5 min)
2. Submit 4 templates to Meta in parallel (~24h Meta review — happens during the rest)
3. Build `/api/cron/insights-anomaly-broadcast` (~1 hr) — testable without Meta via dry-run mode
4. Build `/api/cron/insights-briefing` (~1 hr)
5. Wire Stripe checkout + webhook for B2B (~30 min — mirror laboral)
6. Build inbound query handler (~1.5 hr)
7. End-to-end smoke test once Meta env vars + templates land

## What's already in place (don't rebuild)

- `lib/whatsapp.ts` — sendTemplate, signature verify, webhook ingest. Audience-agnostic.
- `app/api/whatsapp/webhook/route.ts` — GET verify + POST ingest. Inbound query handler bolts in here.
- `whatsapp_messages` audit table.
- v69 profile columns (`whatsapp_optin`, `whatsapp_phone_e164`) — reusable for B2B subscribers, OR we use the new `insights_subscribers.whatsapp_phone_e164` to keep B2B isolated. Lean toward isolated — different consent surface, different opt-out flow.
- EONET context layer on `cruzar_anomaly_now` — broker-anomaly template can use the same `nearby_natural_events` field.
- `cruzar_briefing` MCP tool — internal logic for the briefing cron.

## Cross-references

- `docs/whatsapp-business-setup.md` — Meta Business Manager setup walkthrough (no LLC for v0)
- `project_cruzar_whatsapp_replaces_twilio_20260428.md` — initial framework decision
- `_clusters/cruzar_CURRENT.md` — B2B Insights direction lock + the WhatsApp delivery thesis
- `project_cruzar_b2b_direction_lock_smb_mexico_20260424.md` — "all in for THE platform for SMB MX import/export"
