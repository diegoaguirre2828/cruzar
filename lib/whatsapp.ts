// WhatsApp Business Cloud API — outbound + inbound primitives.
//
// Replaces the Twilio 10DLC SMS path. For Cruzar's cross-border audience,
// WhatsApp is universal in MX (~100% smartphone penetration) and the cultural
// default for messaging. SMS adds no reach over WhatsApp + push, costs more
// per message after registration, and has worse delivery (spam-filtered
// more often than WhatsApp, which lands as a real notification).
//
// Wire-up gates (Diego, one-time):
// 1. Meta Business Manager account verified
// 2. WhatsApp Business API phone number registered + verified (1-2 weeks)
// 3. Utility templates approved in Meta Business Manager (per-template, ~24h)
// 4. Env vars set in Vercel prod:
//      WHATSAPP_ACCESS_TOKEN       — bearer for graph.facebook.com/<phone-id>/messages
//      WHATSAPP_PHONE_NUMBER_ID    — sender phone number ID from Meta
//      WHATSAPP_APP_SECRET         — used to verify inbound webhook signatures
//      WHATSAPP_VERIFY_TOKEN       — arbitrary string Diego picks; sent back to Meta
//                                    on the GET webhook verification challenge
// See docs/whatsapp-business-setup.md for the full Meta setup walkthrough.
//
// Until the env vars are set, every send returns { sent: false, reason: ... }
// and logs to whatsapp_messages with status='failed' — the framework no-ops
// safely instead of throwing.

import { createHmac, timingSafeEqual } from "node:crypto";
import { getServiceClient } from "./supabase";

const META_BASE = "https://graph.facebook.com/v22.0";

interface MetaSendResponse {
  messaging_product: "whatsapp";
  contacts?: { input: string; wa_id: string }[];
  messages?: { id: string }[];
  error?: { message: string; type: string; code: number; fbtrace_id?: string };
}

export interface TemplateComponent {
  // Match Meta's component shape — header / body / button bindings.
  type: "header" | "body" | "button";
  parameters?: Array<
    | { type: "text"; text: string }
    | { type: "currency"; currency: { fallback_value: string; code: string; amount_1000: number } }
    | { type: "date_time"; date_time: { fallback_value: string } }
  >;
  sub_type?: "url" | "quick_reply" | "catalog" | "copy_code" | "voice_call" | "flow";
  index?: string;
}

export interface SendTemplateInput {
  user_id?: string | null;
  to_phone_e164: string;
  template_name: string;
  template_lang: string; // "es" | "en"
  components?: TemplateComponent[];
}

export interface SendResult {
  sent: boolean;
  meta_msg_id?: string;
  reason?: string;
  log_id?: string;
}

function envCreds(): {
  accessToken: string | null;
  phoneNumberId: string | null;
  appSecret: string | null;
  verifyToken: string | null;
} {
  return {
    accessToken: process.env.WHATSAPP_ACCESS_TOKEN ?? null,
    phoneNumberId: process.env.WHATSAPP_PHONE_NUMBER_ID ?? null,
    appSecret: process.env.WHATSAPP_APP_SECRET ?? null,
    verifyToken: process.env.WHATSAPP_VERIFY_TOKEN ?? null,
  };
}

async function logMessage(row: {
  user_id?: string | null;
  to_phone_e164: string;
  template_name?: string;
  template_lang?: string;
  payload: Record<string, unknown>;
  meta_msg_id?: string | null;
  status: string;
  status_detail?: Record<string, unknown> | null;
}): Promise<string | null> {
  try {
    const db = getServiceClient();
    const { data, error } = await db
      .from("whatsapp_messages")
      .insert({
        user_id: row.user_id ?? null,
        to_phone_e164: row.to_phone_e164,
        template_name: row.template_name ?? null,
        template_lang: row.template_lang ?? null,
        payload: row.payload,
        meta_msg_id: row.meta_msg_id ?? null,
        status: row.status,
        status_detail: row.status_detail ?? null,
      })
      .select("id")
      .single();
    if (error) {
      console.warn("[whatsapp] log insert failed:", error.message);
      return null;
    }
    return (data?.id as string) ?? null;
  } catch (err) {
    console.warn("[whatsapp] log threw:", err instanceof Error ? err.message : err);
    return null;
  }
}

/**
 * Send a pre-approved utility template. Required for business-initiated
 * messaging outside the 24h reply window. Templates must be approved in
 * Meta Business Manager — see docs/whatsapp-business-setup.md.
 */
export async function sendTemplate(input: SendTemplateInput): Promise<SendResult> {
  const { accessToken, phoneNumberId } = envCreds();

  // Always log the attempt — even if creds are missing, we want the audit row.
  const payload = {
    messaging_product: "whatsapp",
    to: input.to_phone_e164,
    type: "template",
    template: {
      name: input.template_name,
      language: { code: input.template_lang },
      components: input.components ?? [],
    },
  };

  if (!accessToken || !phoneNumberId) {
    const log_id = await logMessage({
      user_id: input.user_id,
      to_phone_e164: input.to_phone_e164,
      template_name: input.template_name,
      template_lang: input.template_lang,
      payload,
      status: "failed",
      status_detail: { reason: "missing_creds", note: "WHATSAPP_ACCESS_TOKEN / WHATSAPP_PHONE_NUMBER_ID not set" },
    });
    return { sent: false, reason: "missing_creds", log_id: log_id ?? undefined };
  }

  try {
    const res = await fetch(`${META_BASE}/${phoneNumberId}/messages`, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${accessToken}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify(payload),
    });
    const json = (await res.json()) as MetaSendResponse;
    if (!res.ok || json.error) {
      const log_id = await logMessage({
        user_id: input.user_id,
        to_phone_e164: input.to_phone_e164,
        template_name: input.template_name,
        template_lang: input.template_lang,
        payload,
        status: "failed",
        status_detail: { http_status: res.status, error: json.error ?? "unknown" },
      });
      return {
        sent: false,
        reason: json.error?.message ?? `HTTP ${res.status}`,
        log_id: log_id ?? undefined,
      };
    }
    const meta_msg_id = json.messages?.[0]?.id ?? null;
    const log_id = await logMessage({
      user_id: input.user_id,
      to_phone_e164: input.to_phone_e164,
      template_name: input.template_name,
      template_lang: input.template_lang,
      payload,
      meta_msg_id,
      status: "sent",
    });
    return { sent: true, meta_msg_id: meta_msg_id ?? undefined, log_id: log_id ?? undefined };
  } catch (err) {
    const log_id = await logMessage({
      user_id: input.user_id,
      to_phone_e164: input.to_phone_e164,
      template_name: input.template_name,
      template_lang: input.template_lang,
      payload,
      status: "failed",
      status_detail: { exception: err instanceof Error ? err.message : "unknown" },
    });
    return {
      sent: false,
      reason: err instanceof Error ? err.message : "send threw",
      log_id: log_id ?? undefined,
    };
  }
}

/**
 * Send a free-form text message. Only allowed within the 24-hour customer-service
 * window — i.e., the recipient must have messaged us in the last 24h. Outside
 * the window, you must use sendTemplate. Inbound webhook handlers are the
 * canonical caller of this — replying inside the window is what makes the
 * inbound→outbound conversation feel native.
 */
export async function sendFreeFormText(input: {
  to_phone_e164: string;
  body: string;
  user_id?: string | null;
}): Promise<SendResult> {
  const { accessToken, phoneNumberId } = envCreds();

  const payload = {
    messaging_product: "whatsapp",
    to: input.to_phone_e164,
    type: "text",
    text: { body: input.body, preview_url: false },
  };

  if (!accessToken || !phoneNumberId) {
    const log_id = await logMessage({
      user_id: input.user_id,
      to_phone_e164: input.to_phone_e164,
      payload,
      status: "failed",
      status_detail: { reason: "missing_creds" },
    });
    return { sent: false, reason: "missing_creds", log_id: log_id ?? undefined };
  }

  try {
    const res = await fetch(`${META_BASE}/${phoneNumberId}/messages`, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${accessToken}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify(payload),
    });
    const json = (await res.json()) as MetaSendResponse;
    if (!res.ok || json.error) {
      const log_id = await logMessage({
        user_id: input.user_id,
        to_phone_e164: input.to_phone_e164,
        payload,
        status: "failed",
        status_detail: { http_status: res.status, error: json.error ?? "unknown" },
      });
      return {
        sent: false,
        reason: json.error?.message ?? `HTTP ${res.status}`,
        log_id: log_id ?? undefined,
      };
    }
    const meta_msg_id = json.messages?.[0]?.id ?? null;
    const log_id = await logMessage({
      user_id: input.user_id,
      to_phone_e164: input.to_phone_e164,
      payload,
      meta_msg_id,
      status: "sent",
    });
    return { sent: true, meta_msg_id: meta_msg_id ?? undefined, log_id: log_id ?? undefined };
  } catch (err) {
    const log_id = await logMessage({
      user_id: input.user_id,
      to_phone_e164: input.to_phone_e164,
      payload,
      status: "failed",
      status_detail: { exception: err instanceof Error ? err.message : "unknown" },
    });
    return {
      sent: false,
      reason: err instanceof Error ? err.message : "send threw",
      log_id: log_id ?? undefined,
    };
  }
}

/**
 * Verify Meta's X-Hub-Signature-256 header on an inbound webhook POST.
 * Returns true on match. Constant-time comparison to defend against timing
 * leaks. The body must be the RAW request body (string or buffer), not a
 * re-serialized JSON.
 */
export function verifyMetaSignature(
  rawBody: string | Buffer,
  signatureHeader: string | null,
  appSecret?: string,
): boolean {
  const secret = appSecret ?? envCreds().appSecret;
  if (!secret || !signatureHeader) return false;
  // Header format: "sha256=<hex>"
  const expectedPrefix = "sha256=";
  if (!signatureHeader.startsWith(expectedPrefix)) return false;
  const provided = signatureHeader.slice(expectedPrefix.length);

  const hmac = createHmac("sha256", secret);
  hmac.update(rawBody);
  const computed = hmac.digest("hex");

  if (provided.length !== computed.length) return false;
  try {
    return timingSafeEqual(Buffer.from(provided, "hex"), Buffer.from(computed, "hex"));
  } catch {
    return false;
  }
}

/**
 * Validate Meta's webhook subscription verification GET. Meta sends:
 *   GET /webhook?hub.mode=subscribe&hub.verify_token=...&hub.challenge=...
 * If `hub.verify_token` matches our WHATSAPP_VERIFY_TOKEN, echo `hub.challenge`.
 */
export function handleMetaVerification(searchParams: URLSearchParams): {
  ok: boolean;
  challenge?: string;
} {
  const { verifyToken } = envCreds();
  const mode = searchParams.get("hub.mode");
  const token = searchParams.get("hub.verify_token");
  const challenge = searchParams.get("hub.challenge");
  if (!verifyToken) return { ok: false };
  if (mode === "subscribe" && token === verifyToken && challenge) {
    return { ok: true, challenge };
  }
  return { ok: false };
}

/**
 * Persist incoming message + status updates from Meta. The webhook POST body
 * has shape { entry: [{ changes: [{ value: { messages: [...], statuses: [...] }}]}]}.
 * Returns the count of rows updated/inserted.
 */
export async function ingestWebhookEvent(body: unknown): Promise<{
  inserted: number;
  status_updates: number;
}> {
  let inserted = 0;
  let status_updates = 0;
  const db = getServiceClient();

  type WhatsAppEntry = {
    changes?: Array<{
      value?: {
        messages?: Array<{ id: string; from: string; type: string; text?: { body: string } }>;
        statuses?: Array<{ id: string; status: string; recipient_id: string; errors?: unknown[] }>;
      };
    }>;
  };
  const root = body as { entry?: WhatsAppEntry[] };

  for (const entry of root.entry ?? []) {
    for (const change of entry.changes ?? []) {
      const v = change.value ?? {};

      // Status updates (delivered / read / failed) for messages we sent.
      for (const s of v.statuses ?? []) {
        const { error } = await db
          .from("whatsapp_messages")
          .update({
            status: s.status,
            status_detail: s,
            updated_at: new Date().toISOString(),
          })
          .eq("meta_msg_id", s.id);
        if (!error) status_updates++;
      }

      // Inbound messages from users (logged with status='received'), then
      // routed through the intent parser → free-form reply. Reply happens
      // inside the 24h customer-service window the inbound message opens.
      // Lazy-import to keep the cycle (whatsappIntent imports from this file
      // for getServiceClient) one-directional only.
      for (const m of v.messages ?? []) {
        const { error } = await db.from("whatsapp_messages").insert({
          to_phone_e164: m.from, // for inbound, "from" is what we'd reply to
          payload: m,
          status: "received",
          meta_msg_id: m.id,
        });
        if (!error) inserted++;

        const text = m.text?.body;
        if (m.type === "text" && text) {
          try {
            const { buildReplyForInbound } = await import("./whatsappIntent");
            const reply = await buildReplyForInbound(text);
            if (reply) {
              await sendFreeFormText({ to_phone_e164: m.from, body: reply });
            }
          } catch (err) {
            console.warn(
              "[whatsapp] inbound reply failed:",
              err instanceof Error ? err.message : err,
            );
          }
        }
      }
    }
  }
  return { inserted, status_updates };
}
