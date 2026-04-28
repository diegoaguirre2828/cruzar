# WhatsApp Business API — setup walkthrough (one-time)

The code is shipped. The only thing standing between Cruzar and live WhatsApp messaging is Meta's verification process. This doc walks Diego through it end-to-end.

> **Why this replaces Twilio:** for the cross-border MX/US audience, WhatsApp is universal (~100% MX smartphone penetration), the cultural default, cheaper per message after setup, richer content (templates, buttons, media), and has better delivery rates (lands as a real notification, not a spam-filtered SMS). SMS adds no reach over WhatsApp + push.

## Phase 1 — Meta Business Manager (~30 min, no LLC needed for v0)

> **Important correction (2026-04-28):** an earlier draft of this doc suggested using Aguirre Insurance LLC if Cruzar isn't incorporated. **Don't do that.** TIER-0 memory rule: "NEVER pair Cruzar × Aguirre insurance — family agency NEVADA, Cruzar RGV. Zero overlap." Use the unverified-tier path below instead.

> **You do NOT need an LLC for v0.** Meta Business Manager creation only requires a Facebook account + a business name string. No tax ID, no legal entity verification at this step. Verification is OPTIONAL and only required for: green-checkmark display name, Click-to-WhatsApp ads, or scaling beyond ~250 conv/24h. None of those matter at < 1k users.

1. **Create your Meta Business Manager account (unverified is fine)**
   - https://business.facebook.com/
   - Use the same Facebook account that owns the Cruzar Facebook Page (per `reference_cruzar_facebook_main_page.md`).
   - Business name: "Cruzar" (just a string, not a legal entity).
   - Skip the "Verify your business" prompts when they appear — they're optional.

2. **Create a WhatsApp Business App**
   - In Meta Business Manager: Apps → Add → Business → WhatsApp Business Platform.
   - Name it "Cruzar".
   - Copy the **App ID** and **App Secret** (top-level — used for webhook signature verification).

3. **Add a phone number for sending**
   - Two-step verification: verify by SMS or call.
   - **Use a number that does not already have WhatsApp on a regular phone.** Once registered with the Business Cloud API, the number cannot be used in the consumer WhatsApp app.
   - Pick the display name (shown to recipients): "Cruzar" or "Cruzar Insights".
   - Copy the **Phone Number ID** that Meta assigns.

## Phase 2 — Webhook subscription (~5 min)

1. **Set the env vars in Vercel prod** (one push, no Vercel CLI v52 bug because these are not "sensitive"):

   ```bash
   # Required for sending
   WHATSAPP_ACCESS_TOKEN=<from Meta Business Manager → System Users → Create token>
   WHATSAPP_PHONE_NUMBER_ID=<from step 1.3 above>

   # Required for receiving + signature verification
   WHATSAPP_APP_SECRET=<App Secret from step 1.2>
   WHATSAPP_VERIFY_TOKEN=<any random string you pick — pass to Meta in step 2.2>
   ```

   Set via Vercel REST API (per the v52 CLI bug rule) or the dashboard.

2. **Subscribe the webhook URL in Meta Business Manager**
   - WhatsApp Configuration → Webhook → Edit
   - Callback URL: `https://www.cruzar.app/api/whatsapp/webhook`
   - Verify Token: same string as `WHATSAPP_VERIFY_TOKEN` env var
   - Click "Verify and Save" → Meta hits our GET handler with `hub.mode=subscribe&hub.verify_token=<your token>&hub.challenge=<random>`. Our handler echoes the challenge if the token matches → green checkmark in Meta.

3. **Subscribe to the relevant fields**
   - `messages` — incoming user messages
   - `message_statuses` — sent/delivered/read/failed updates for our outbound messages

## Phase 3 — Approve at least one utility template (~24h per template)

Business-initiated messages outside the 24h reply window MUST use a pre-approved template. Meta reviews each one (~24h turnaround).

For Cruzar's Co-Pilot trip auto-text + family ETA, we need at least:

**Template `cruzar_arrival_es` (Spanish, primary audience):**
```
{{1}} cruzó la frontera en {{2}}. ETA al destino: {{3}}.

Ver detalles en cruzar.app
```
- `{{1}}` = sender's display name (e.g., "Diego")
- `{{2}}` = bridge name (e.g., "Pharr-Reynosa")
- `{{3}}` = ETA timestamp formatted

**Template `cruzar_arrival_en` (English fallback):** same, in English.

**Template `cruzar_eta_update_es`:**
```
{{1}} viene en camino. ETA estimada a {{2}}: {{3}}.

Sigue en vivo: cruzar.app/track/{{4}}
```

Submit each via Meta Business Manager → Message Templates. Category: **Utility** (transactional, not marketing — Utility templates have higher delivery + lower cost).

## Phase 4 — User opt-in flow (already wired in code)

The framework already enforces opt-in via the `whatsapp_optin` profile column (added in v69 migration). Surface to wire in the UI when ready:

1. **`/account` settings page** — checkbox "Avísame por WhatsApp cuando crucé" + phone number input (E.164 format, validated server-side).
2. **`/copilot` setup** — same toggle as part of trip-mode setup.
3. **Server enforcement** — `lib/whatsapp.sendTemplate()` should be wrapped by the caller with a profile lookup that confirms `whatsapp_optin = true` AND `whatsapp_phone_e164 IS NOT NULL` before firing.

> **Don't bypass this.** Mexico's LFPDPPP (data privacy law) and Meta's policy both require explicit opt-in for business-initiated messaging. The DB constraint `profiles_whatsapp_consent_pair` already prevents the "phone-without-consent" footgun, but UI must respect it too.

## Phase 5 — Wire the actual sends (one-time, after Phase 1-4 done)

Once `WHATSAPP_ACCESS_TOKEN` lands in Vercel prod:

1. **`/api/copilot/cross-detected`** — after the webpush broadcast, look up `profiles.whatsapp_phone_e164` for circle members opted in, fire `sendTemplate({ template_name: "cruzar_arrival_es", ... })`.
2. **`/api/family/eta`** — same pattern for the in-transit ping.
3. **Test with a real phone number** (Diego's own first) before opening to users.

## Cost notes

- Utility templates: free for the **first 1,000/mo** in MX, then ~$0.005-0.01/msg.
- Marketing templates: charged from msg #1 (~$0.05-0.07 in MX). **Don't use for Cruzar Co-Pilot — utility category fits.**
- Free 24h reply window: any user-initiated message gives you a 24h window to send free-form messages back, even without a template.

## Cost vs Twilio (per 1k messages, MX recipients)

| Channel | Per 1k msgs | Setup cost | Ongoing | Verification |
|---|---|---|---|---|
| WhatsApp utility (unverified tier) | ~$5-10 | $0 | None | None — just Facebook account + business-name string |
| WhatsApp utility (verified tier) | ~$5-10 | $0 | None | LLC + tax ID; needed for green checkmark + > 250 conv/24h |
| Twilio 10DLC | ~$8 + carrier fees | ~$50 (campaign reg) | $4-12/mo | Carrier vetting (similar timeline) |
| Web Push (Cruzar PWA) | $0 | $0 | $0 | None |

**Defer business verification until ~1k+ users** when the green checkmark matters for trust + you're hitting message limits. Until then, unverified tier is sufficient.

WhatsApp wins on cost AND user experience even unverified.

## Files in this repo today

- `lib/whatsapp.ts` — sendTemplate, verifyMetaSignature, handleMetaVerification, ingestWebhookEvent
- `app/api/whatsapp/webhook/route.ts` — GET (verification) + POST (signature-verified ingest)
- `supabase/migrations/v69-whatsapp-optin.sql` — applied to prod 2026-04-28
- `docs/whatsapp-business-setup.md` — this file

## Cross-references

- Decision memo: `project_cruzar_whatsapp_replaces_twilio_20260428.md` (decommissions Twilio)
- TIER-0 safety rule on auto-broadcast: `feedback_safety_audit_before_scaling_automation_20260428.md`
