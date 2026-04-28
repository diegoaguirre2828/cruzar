// Meta WhatsApp Cloud API webhook receiver.
//
// Meta calls this endpoint for two reasons:
//   1. GET — webhook subscription verification. Meta sends hub.mode=subscribe
//      with hub.verify_token and hub.challenge; we echo the challenge if the
//      token matches WHATSAPP_VERIFY_TOKEN.
//   2. POST — incoming events. Either user-sent messages or status updates
//      (delivered, read, failed) for messages we sent. We verify the
//      X-Hub-Signature-256 HMAC and persist to whatsapp_messages.
//
// Public route. Auth is via the signature verification on POSTs and the
// verify-token check on GETs. Never trust the request without one of those.

import { NextRequest, NextResponse } from "next/server";
import {
  handleMetaVerification,
  verifyMetaSignature,
  ingestWebhookEvent,
} from "@/lib/whatsapp";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET(req: NextRequest) {
  const result = handleMetaVerification(req.nextUrl.searchParams);
  if (!result.ok) {
    return NextResponse.json({ error: "verification_failed" }, { status: 403 });
  }
  // Meta expects the raw challenge string, not a JSON wrap.
  return new NextResponse(result.challenge ?? "", {
    status: 200,
    headers: { "Content-Type": "text/plain" },
  });
}

export async function POST(req: NextRequest) {
  // Read the body as raw text — signature is computed against the exact bytes.
  const raw = await req.text();
  const sig = req.headers.get("x-hub-signature-256");

  if (!verifyMetaSignature(raw, sig)) {
    return NextResponse.json({ error: "bad_signature" }, { status: 401 });
  }

  let parsed: unknown;
  try {
    parsed = JSON.parse(raw);
  } catch {
    return NextResponse.json({ error: "invalid_json" }, { status: 400 });
  }

  const result = await ingestWebhookEvent(parsed);

  // Meta retries on non-200 — return 200 even on partial parse failures so we
  // don't get throttled. Errors are logged in the ingest path itself.
  return NextResponse.json({ ok: true, ...result });
}
