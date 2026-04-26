// Self-serve MCP API key request form for Cruzar Insights.
// Submitted via fetch() to /api/mcp-key/request → email delivery.

"use client";

import { useState } from "react";

export default function GetKeyPage() {
  const [email, setEmail] = useState("");
  const [useCase, setUseCase] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [result, setResult] = useState<null | { ok: boolean; message?: string; error?: string; key?: string; key_warning?: string; email_delivered?: boolean; key_prefix?: string }>(null);

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setSubmitting(true);
    setResult(null);
    try {
      const r = await fetch("/api/mcp-key/request", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          email,
          use_case: useCase,
          service: "cruzar-insights",
          _company: (document.getElementById("_company") as HTMLInputElement | null)?.value || "",
        }),
      });
      const data = await r.json();
      if (!r.ok) {
        setResult({ ok: false, error: data.error || `HTTP ${r.status}` });
      } else {
        setResult(data);
      }
    } catch (err) {
      setResult({ ok: false, error: (err as Error).message });
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <div style={{ minHeight: "100vh", background: "#0f172a", color: "white", fontFamily: '-apple-system, BlinkMacSystemFont, "Segoe UI", Helvetica, sans-serif' }}>
      <main style={{ maxWidth: 560, margin: "0 auto", padding: "48px 16px" }}>
        <h1 style={{ fontSize: 28, fontWeight: 800, marginBottom: 8 }}>Get a Cruzar Insights API key</h1>
        <p style={{ color: "rgba(255,255,255,0.7)", marginBottom: 32, fontSize: 15, lineHeight: 1.5 }}>
          Self-serve in 30 seconds. Key arrives by email + we never store the plaintext (only its hash). Free during v0.1 — usage caps may apply later.
        </p>

        {result?.ok ? (
          <div style={{ background: "rgba(34,197,94,0.10)", border: "1px solid rgba(34,197,94,0.3)", borderRadius: 12, padding: 20 }}>
            <h2 style={{ color: "#86efac", margin: "0 0 8px", fontSize: 18 }}>✓ Key issued</h2>
            <p style={{ margin: "0 0 12px" }}>{result.message ?? "Check your inbox."}</p>
            {result.key_prefix && (
              <p style={{ fontSize: 12, color: "rgba(255,255,255,0.55)", margin: "0 0 12px" }}>
                Key ends in <code>...{result.key_prefix}</code> for reference.
              </p>
            )}
            {result.key_warning && result.key && (
              <>
                <p style={{ color: "#fca5a5", margin: "12px 0 6px" }}>{result.key_warning}</p>
                <pre style={{ background: "#020617", padding: 12, borderRadius: 8, fontSize: 12, overflow: "auto" }}>
                  <code>{result.key}</code>
                </pre>
              </>
            )}
            <p style={{ marginTop: 16, fontSize: 14 }}>
              <a href="/insights" style={{ color: "#86efac" }}>← Back to /insights</a>
            </p>
          </div>
        ) : (
          <form onSubmit={submit}>
            <label style={{ display: "block", marginBottom: 16 }}>
              <span style={{ fontSize: 13, color: "rgba(255,255,255,0.7)", display: "block", marginBottom: 6 }}>Your email</span>
              <input
                type="email"
                required
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                placeholder="you@dispatcher.co"
                style={{ width: "100%", padding: "12px 14px", borderRadius: 8, border: "1px solid rgba(255,255,255,0.15)", background: "rgba(255,255,255,0.05)", color: "white", fontSize: 14 }}
              />
            </label>
            <label style={{ display: "block", marginBottom: 16 }}>
              <span style={{ fontSize: 13, color: "rgba(255,255,255,0.7)", display: "block", marginBottom: 6 }}>What are you building? (one or two sentences)</span>
              <textarea
                required
                value={useCase}
                onChange={(e) => setUseCase(e.target.value)}
                placeholder="e.g. dispatch automation for our 8-truck fleet running Monterrey↔San Antonio"
                rows={4}
                style={{ width: "100%", padding: "12px 14px", borderRadius: 8, border: "1px solid rgba(255,255,255,0.15)", background: "rgba(255,255,255,0.05)", color: "white", fontSize: 14, fontFamily: "inherit", resize: "vertical" }}
              />
              <span style={{ fontSize: 11, color: "rgba(255,255,255,0.45)", display: "block", marginTop: 4 }}>
                Helps us prioritize what to build next. Doesn&apos;t gate access.
              </span>
            </label>
            {/* Honeypot — hidden field bots fill, humans don't see */}
            <div style={{ position: "absolute", left: "-9999px" }} aria-hidden="true">
              <label htmlFor="_company">Company (leave blank)</label>
              <input id="_company" name="_company" type="text" tabIndex={-1} autoComplete="off" />
            </div>
            <button
              type="submit"
              disabled={submitting}
              style={{
                background: submitting ? "rgba(255,255,255,0.2)" : "#86efac",
                color: submitting ? "rgba(255,255,255,0.5)" : "#062a14",
                border: "none",
                padding: "12px 24px",
                borderRadius: 10,
                fontWeight: 700,
                fontSize: 15,
                cursor: submitting ? "not-allowed" : "pointer",
              }}
            >
              {submitting ? "Issuing..." : "Get my key"}
            </button>
            {result?.error && (
              <p style={{ color: "#fca5a5", marginTop: 16, fontSize: 14 }}>Error: {result.error}</p>
            )}
          </form>
        )}

        <p style={{ marginTop: 32, fontSize: 12, color: "rgba(255,255,255,0.45)" }}>
          By requesting a key you agree not to redistribute it or use it to scrape the API beyond reasonable per-call needs.
          v0.1 keys may be revoked if abused. Questions: just email back the issuance email.
        </p>
      </main>
    </div>
  );
}
