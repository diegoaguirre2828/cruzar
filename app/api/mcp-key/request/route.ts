// Self-serve MCP API key issuance for Cruzar Insights.
//
// POST { email, use_case, service?: 'cruzar-insights' }
// Generates a 32-byte base64url key, hashes it (SHA-256), stores the hash,
// emails the plaintext to the requester. Returns { ok: true } on success.
//
// Rate limits: 1 request per email per 5 min, 10 requests per IP per hour.
// Honeypot: hidden `_company` field — bots fill it, humans don't see it.

import { NextRequest, NextResponse } from "next/server";
import { randomBytes, createHash } from "node:crypto";
import { getServiceClient } from "@/lib/supabase";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const SUPPORTED_SERVICES = new Set(["cruzar-insights"]);

function isValidEmail(s: string): boolean {
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(s) && s.length <= 200;
}

export async function POST(req: NextRequest) {
  const body = await req.json().catch(() => null);
  if (!body || typeof body !== "object") {
    return NextResponse.json({ error: "invalid body" }, { status: 400 });
  }

  // Honeypot — bots fill this; humans never see it
  if (typeof body._company === "string" && body._company.trim().length > 0) {
    return NextResponse.json({ ok: true }); // silently swallow
  }

  const email = String(body.email ?? "").trim().toLowerCase();
  const use_case = String(body.use_case ?? "").trim().slice(0, 1000);
  const service = String(body.service ?? "cruzar-insights").trim();

  if (!isValidEmail(email)) return NextResponse.json({ error: "invalid email" }, { status: 400 });
  if (use_case.length < 10) return NextResponse.json({ error: "tell us more about what you're building (a sentence or two)" }, { status: 400 });
  if (!SUPPORTED_SERVICES.has(service)) return NextResponse.json({ error: "unsupported service" }, { status: 400 });

  const ip = req.headers.get("x-forwarded-for")?.split(",")[0]?.trim() || "unknown";
  const sb = getServiceClient();

  // Rate limit: 1 per email per 5 min
  const fiveMinAgo = new Date(Date.now() - 5 * 60 * 1000).toISOString();
  const { count: emailCount } = await sb
    .from("mcp_key_request_log")
    .select("id", { count: "exact", head: true })
    .eq("email", email)
    .gte("requested_at", fiveMinAgo);
  if ((emailCount ?? 0) > 0) {
    return NextResponse.json({ error: "Already issued a key in the last 5 minutes — check your inbox (or spam)." }, { status: 429 });
  }

  // Rate limit: 10 per IP per hour
  const oneHourAgo = new Date(Date.now() - 60 * 60 * 1000).toISOString();
  const { count: ipCount } = await sb
    .from("mcp_key_request_log")
    .select("id", { count: "exact", head: true })
    .eq("ip", ip)
    .gte("requested_at", oneHourAgo);
  if ((ipCount ?? 0) >= 10) {
    return NextResponse.json({ error: "Rate limit hit. Try again later." }, { status: 429 });
  }

  // Generate + hash the key
  const key = randomBytes(32).toString("base64url");
  const key_hash = createHash("sha256").update(key).digest("hex");
  const key_prefix = key.slice(-4);

  // Insert key + log request in parallel
  const [{ error: keyErr }, { error: logErr }] = await Promise.all([
    sb.from("mcp_keys").insert({
      service,
      key_hash,
      key_prefix,
      owner_email: email,
      use_case,
      source: "self_serve",
    }),
    sb.from("mcp_key_request_log").insert({ email, ip }),
  ]);
  if (keyErr) {
    console.error("mcp-key insert:", keyErr);
    return NextResponse.json({ error: "could not issue key. Try again in a minute." }, { status: 500 });
  }
  if (logErr) {
    // Non-fatal — rate-limit log is best-effort
    console.warn("mcp-key log insert:", logErr);
  }

  // Email the plaintext key + notify operator (fire-and-forget for the latter)
  const sent = await sendKeyEmail(email, key, key_prefix, service);
  notifyOperator(email, use_case, key_prefix, ip, service).catch(() => {});
  if (!sent.ok) {
    // Key is created. If email failed, expose to user so they can copy manually.
    return NextResponse.json({
      ok: true,
      email_delivered: false,
      key_warning: "Email delivery failed — copy your key now (we don't store the plaintext, only its hash):",
      key,
      key_prefix,
    });
  }

  return NextResponse.json({
    ok: true,
    email_delivered: true,
    message: `Key sent to ${email}. Check inbox + spam.`,
    key_prefix,
  });
}

async function notifyOperator(email: string, use_case: string, key_prefix: string, ip: string, service: string): Promise<void> {
  if (!process.env.RESEND_API_KEY) return;
  const from = process.env.RESEND_FROM_EMAIL || "Cruzar Alerts <alerts@cruzar.app>";
  const ownerEmail = process.env.OWNER_EMAIL || "diegonaguirre@icloud.com";
  const body = [
    `New self-serve MCP key signup at cruzar.app/insights/get-key:`,
    ``,
    `Service: ${service}`,
    `Email: ${email}`,
    `Use case: ${use_case}`,
    `Key prefix: ...${key_prefix}`,
    `IP: ${ip}`,
    `Time: ${new Date().toISOString()}`,
    ``,
    `Reply to them or check the mcp_keys table for the full row.`,
  ].join("\n");
  await fetch("https://api.resend.com/emails", {
    method: "POST",
    headers: { "Authorization": `Bearer ${process.env.RESEND_API_KEY}`, "Content-Type": "application/json" },
    body: JSON.stringify({
      from,
      to: [ownerEmail],
      subject: `[Cruzar Insights] new MCP key signup — ${email}`,
      text: body,
    }),
  }).catch(() => {});
}

async function sendKeyEmail(to: string, key: string, prefix: string, service: string): Promise<{ ok: boolean; detail?: string }> {
  if (!process.env.RESEND_API_KEY) return { ok: false, detail: "RESEND_API_KEY not set" };
  const from = process.env.RESEND_FROM_EMAIL || "Cruzar Insights <alerts@cruzar.app>";
  const html = `
<div style="font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',sans-serif;max-width:560px;margin:0 auto;padding:24px;background:#0f172a;color:#e2e8f0;border-radius:12px;">
  <h2 style="margin:0 0 16px;color:#86efac;font-size:20px;">Your Cruzar Insights API key</h2>
  <p style="color:#cbd5e1;font-size:14px;line-height:1.6;margin:0 0 12px;">
    Here's your API key for <code style="color:#86efac;">${service}</code> at <code style="color:#86efac;">https://www.cruzar.app/mcp</code>.
    Save it somewhere safe — we don't store the plaintext, only its hash.
  </p>
  <pre style="background:#020617;padding:14px;border-radius:8px;font-size:13px;color:#e2e8f0;overflow-x:auto;border:1px solid rgba(255,255,255,0.1);"><code>${key}</code></pre>
  <p style="color:#94a3b8;font-size:12px;margin:8px 0 20px;">
    Key ends in <code>...${prefix}</code> for reference.
  </p>
  <h3 style="color:#e2e8f0;font-size:15px;margin:20px 0 8px;">Connect it from Claude Desktop / Code:</h3>
  <pre style="background:#020617;padding:14px;border-radius:8px;font-size:11px;color:#e2e8f0;overflow-x:auto;border:1px solid rgba(255,255,255,0.1);">{
  "mcpServers": {
    "cruzar-insights": {
      "transport": {
        "type": "http",
        "url": "https://www.cruzar.app/mcp",
        "headers": { "Authorization": "Bearer ${key}" }
      }
    }
  }
}</pre>
  <h3 style="color:#e2e8f0;font-size:15px;margin:20px 0 8px;">Or curl it:</h3>
  <pre style="background:#020617;padding:14px;border-radius:8px;font-size:11px;color:#e2e8f0;overflow-x:auto;border:1px solid rgba(255,255,255,0.1);">curl -X POST https://www.cruzar.app/mcp \\
  -H "Authorization: Bearer ${key}" \\
  -H "Content-Type: application/json" \\
  -H "Accept: application/json, text/event-stream" \\
  -d '{"jsonrpc":"2.0","id":1,"method":"tools/list"}'</pre>
  <p style="color:#94a3b8;font-size:12px;margin-top:24px;">
    Docs: <a href="https://www.cruzar.app/insights" style="color:#86efac;">cruzar.app/insights</a><br>
    Live forecasts: <a href="https://www.cruzar.app/live" style="color:#86efac;">cruzar.app/live</a><br>
    Questions? Just reply to this email.
  </p>
  <p style="color:#64748b;font-size:11px;margin-top:16px;">— Diego</p>
</div>`;
  try {
    const res = await fetch("https://api.resend.com/emails", {
      method: "POST",
      headers: {
        "Authorization": `Bearer ${process.env.RESEND_API_KEY}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        from,
        to: [to],
        subject: "Your Cruzar Insights API key",
        html,
      }),
    });
    if (!res.ok) {
      const text = await res.text().catch(() => "");
      return { ok: false, detail: `Resend ${res.status}: ${text.slice(0, 200)}` };
    }
    return { ok: true };
  } catch (e) {
    return { ok: false, detail: (e as Error).message };
  }
}
