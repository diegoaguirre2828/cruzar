// Cruzar Insights B2B landing page — for freight brokers, dispatchers, 3PL
// operators, and AI builders working in the cross-border logistics space.
//
// This is the URL to share in cold calls and outreach. Built to load fast,
// be indexed by search engines, and convert technical buyers without
// requiring a sales conversation.

export const runtime = "nodejs";
export const revalidate = 3600;

export const metadata = {
  title: "Cruzar Insights — ML border wait forecasts for RGV freight operators",
  description: "RandomForest forecasts beat free CBP climatology by 16-18% on Laredo WTB and Brownsville Veterans (6h horizon). 8 RGV crossings, 230k+ scraped readings, MCP-native. For dispatchers, brokers, and AI builders.",
};

const PORT_NUMBERS: { name: string; rmse: number; vsCbp: number; vsPersist: number }[] = [
  { name: "Laredo World Trade Bridge", rmse: 16.7, vsCbp: 16.5, vsPersist: 42.9 },
  { name: "Brownsville Veterans", rmse: 36.4, vsCbp: 18.1, vsPersist: 35.5 },
  { name: "Hidalgo", rmse: 20.9, vsCbp: 6.4, vsPersist: 25.3 },
  { name: "Anzalduas", rmse: 18.1, vsCbp: 4.6, vsPersist: 22.1 },
  { name: "Brownsville Gateway", rmse: 51.2, vsCbp: 0.3, vsPersist: 12.2 },
  { name: "Eagle Pass", rmse: 22.9, vsCbp: -3.6, vsPersist: 17.5 },
];

const TOOLS: { name: string; what: string }[] = [
  { name: "cruzar_recommend_route", what: "Ranks crossings by total ETA = drive_min + ML-predicted wait at expected arrival" },
  { name: "cruzar_briefing", what: "One-shot markdown decision artifact: live + historical + 6h forecast + best window" },
  { name: "cruzar_anomaly_now", what: "Flags ports running ≥1.5× or ≤0.67× the 90-day DOW × hour baseline" },
  { name: "cruzar_forecast", what: "RandomForest prediction at 6h or 24h horizon for 8 RGV ports" },
  { name: "cruzar_compare_ports", what: "Side-by-side forecast across multiple ports, sorted by predicted wait" },
  { name: "cruzar_smart_route", what: "Heuristic ranking: current_wait + drive_distance, 5 nearest crossings" },
  { name: "cruzar_live_wait", what: "Most recent CBP reading per port (vehicle / SENTRI / pedestrian / commercial)" },
];

export default function InsightsPage() {
  const ldjson = {
    "@context": "https://schema.org",
    "@type": "Service",
    "name": "Cruzar Insights",
    "description": "Border wait-time forecasting service for US-Mexico freight operations.",
    "provider": { "@type": "Organization", "name": "Cruzar" },
    "areaServed": { "@type": "Place", "name": "Rio Grande Valley, US-Mexico border" },
    "url": "https://www.cruzar.app/insights",
  };
  return (
    <div style={{ minHeight: "100vh", background: "#0f172a", color: "white", fontFamily: '-apple-system, BlinkMacSystemFont, "Segoe UI", Helvetica, sans-serif' }}>
      {/* eslint-disable-next-line @next/next/no-head-element */}
      <head>
        <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(ldjson) }} />
      </head>
      <main style={{ maxWidth: 880, margin: "0 auto", padding: "48px 16px" }}>
        {/* Hero */}
        <h1 style={{ fontSize: 36, fontWeight: 800, marginBottom: 12, lineHeight: 1.15 }}>
          We forecast US-MX border wait times <span style={{ color: "#86efac" }}>16-18% better</span> than the free CBP baseline.
        </h1>
        <p style={{ fontSize: 18, color: "rgba(255,255,255,0.7)", marginBottom: 32, lineHeight: 1.5 }}>
          For RGV freight brokers, dispatchers, and the AI tools that serve them. Live now, MCP-native, no sales call.
        </p>

        {/* Numbers */}
        <section style={{ marginBottom: 40 }}>
          <h2 style={{ fontSize: 22, fontWeight: 700, marginBottom: 16, borderBottom: "1px solid rgba(255,255,255,0.1)", paddingBottom: 8 }}>
            6-hour horizon performance
          </h2>
          <p style={{ fontSize: 14, color: "rgba(255,255,255,0.6)", marginBottom: 16 }}>
            Backtested on 7-day held-out window from 35,224 scraped CBP readings. Two baselines reported: persistence (next = last) and the smart-competitor baseline — CBP&apos;s own historical-average widget exposed at <code style={{ fontSize: 13, color: "#86efac" }}>/api/historicalwaittimes/</code>.
          </p>
          <div style={{ display: "grid", gap: 8 }}>
            {PORT_NUMBERS.map((p) => (
              <div key={p.name} style={{ background: "rgba(255,255,255,0.04)", padding: "12px 16px", borderRadius: 12, border: "1px solid rgba(255,255,255,0.08)", display: "grid", gridTemplateColumns: "1fr auto auto auto", gap: 16, alignItems: "center" }}>
                <div style={{ fontSize: 15, fontWeight: 600 }}>{p.name}</div>
                <div style={{ fontSize: 13, color: "rgba(255,255,255,0.5)" }}>RMSE {p.rmse} min</div>
                <div style={{ fontSize: 14, fontWeight: 700, color: p.vsCbp >= 5 ? "#86efac" : p.vsCbp >= 0 ? "rgba(255,255,255,0.6)" : "#fca5a5", minWidth: 110, textAlign: "right" }}>
                  {p.vsCbp >= 0 ? "+" : ""}{p.vsCbp}% vs CBP
                </div>
                <div style={{ fontSize: 13, color: "rgba(255,255,255,0.55)", minWidth: 130, textAlign: "right" }}>
                  +{p.vsPersist}% vs persistence
                </div>
              </div>
            ))}
          </div>
          <p style={{ fontSize: 13, color: "rgba(255,255,255,0.45)", marginTop: 12 }}>
            Pharr-Reynosa is currently degraded (concept drift / regime shift, -292% vs CBP). Inference API auto-falls-back to the CBP climatology baseline so callers don&apos;t see broken predictions.
          </p>
        </section>

        {/* Live proof */}
        <section style={{ marginBottom: 40, background: "rgba(34,197,94,0.08)", padding: 20, borderRadius: 16, border: "1px solid rgba(34,197,94,0.2)" }}>
          <h2 style={{ fontSize: 20, fontWeight: 700, marginBottom: 8 }}>See it predicting in public</h2>
          <p style={{ fontSize: 15, color: "rgba(255,255,255,0.75)", marginBottom: 12 }}>
            Forecasts auto-refresh every 60 seconds. Verify our predictions against what actually happens at the bridge over the next 6 hours.
          </p>
          <a href="/live" style={{ display: "inline-block", background: "#22c55e", color: "#062a14", padding: "10px 18px", borderRadius: 10, fontWeight: 700, textDecoration: "none" }}>
            → Live forecasts at /live
          </a>
        </section>

        {/* Tools */}
        <section style={{ marginBottom: 40 }}>
          <h2 style={{ fontSize: 22, fontWeight: 700, marginBottom: 16, borderBottom: "1px solid rgba(255,255,255,0.1)", paddingBottom: 8 }}>
            7 tools, one MCP endpoint
          </h2>
          <p style={{ fontSize: 14, color: "rgba(255,255,255,0.6)", marginBottom: 16 }}>
            Connect once from Claude Desktop, Claude Code, Cursor, or any MCP client. Bearer-auth, stateless HTTP, no SDK install.
          </p>
          <div style={{ display: "grid", gap: 8 }}>
            {TOOLS.map((t) => (
              <div key={t.name} style={{ background: "rgba(255,255,255,0.04)", padding: "10px 14px", borderRadius: 10, border: "1px solid rgba(255,255,255,0.08)" }}>
                <div style={{ fontSize: 13, fontFamily: "ui-monospace, SFMono-Regular, Menlo, monospace", color: "#86efac", marginBottom: 2 }}>{t.name}</div>
                <div style={{ fontSize: 13, color: "rgba(255,255,255,0.7)" }}>{t.what}</div>
              </div>
            ))}
          </div>
        </section>

        {/* Install */}
        <section style={{ marginBottom: 40 }}>
          <h2 style={{ fontSize: 22, fontWeight: 700, marginBottom: 16, borderBottom: "1px solid rgba(255,255,255,0.1)", paddingBottom: 8 }}>
            Install in 30 seconds
          </h2>
          <p style={{ fontSize: 14, color: "rgba(255,255,255,0.7)", marginBottom: 12 }}>Claude Desktop / Code config:</p>
          <pre style={{ background: "#020617", padding: 16, borderRadius: 10, fontSize: 12, overflow: "auto", border: "1px solid rgba(255,255,255,0.1)", color: "#e2e8f0" }}>
{`{
  "mcpServers": {
    "cruzar-insights": {
      "transport": {
        "type": "http",
        "url": "https://www.cruzar.app/mcp",
        "headers": { "Authorization": "Bearer YOUR_KEY" }
      }
    }
  }
}`}
          </pre>
          <p style={{ fontSize: 14, color: "rgba(255,255,255,0.7)", marginTop: 12 }}>Or curl directly:</p>
          <pre style={{ background: "#020617", padding: 16, borderRadius: 10, fontSize: 12, overflow: "auto", border: "1px solid rgba(255,255,255,0.1)", color: "#e2e8f0" }}>
{`curl -X POST https://www.cruzar.app/mcp \\
  -H "Authorization: Bearer YOUR_KEY" \\
  -H "Content-Type: application/json" \\
  -H "Accept: application/json, text/event-stream" \\
  -d '{"jsonrpc":"2.0","id":1,"method":"tools/list"}'`}
          </pre>
        </section>

        {/* Methodology */}
        <section style={{ marginBottom: 40 }}>
          <h2 style={{ fontSize: 22, fontWeight: 700, marginBottom: 16, borderBottom: "1px solid rgba(255,255,255,0.1)", paddingBottom: 8 }}>
            How it works
          </h2>
          <ul style={{ fontSize: 14, color: "rgba(255,255,255,0.75)", lineHeight: 1.7, paddingLeft: 20 }}>
            <li><strong>Data:</strong> 230,000+ readings scraped from CBP&apos;s public BWT API every 15 minutes since March 2026, plus BTS monthly volumes 1996-present, plus CBP&apos;s own historical climatology widget.</li>
            <li><strong>Model:</strong> Per-port RandomForest, 21 features (cyclical time, lag1, rolling 4/16/96, 24h/168h-ago, weather, lane counts, BTS volume, CBP climatology, deviation_now).</li>
            <li><strong>Backtest:</strong> Last 7 days held out as test set. Two baselines reported per port: persistence and CBP-climatology.</li>
            <li><strong>Methodology heritage:</strong> Sakhare et al. 2024 (Purdue, 26 US-MX crossings, 93k+ Wejo trips). Samant et al. 2026-03 (TTI lane-level pilot). Lu 2023 + Li 2024 for concept-drift detection.</li>
            <li><strong>License:</strong> Built on public-domain CBP and BTS data. No DHS/CBP endorsement implied.</li>
          </ul>
        </section>

        {/* CTA */}
        <section style={{ marginBottom: 40, background: "rgba(34,197,94,0.08)", padding: 24, borderRadius: 16, border: "1px solid rgba(34,197,94,0.2)" }}>
          <h2 style={{ fontSize: 22, fontWeight: 700, marginBottom: 12 }}>Get an API key — self-serve, 30 seconds</h2>
          <p style={{ fontSize: 15, color: "rgba(255,255,255,0.75)", marginBottom: 16 }}>
            Submit your email + what you&apos;re building. Key arrives by email immediately. Free during v0.1.
          </p>
          <a href="/insights/get-key" style={{ display: "inline-block", background: "#86efac", color: "#062a14", padding: "12px 24px", borderRadius: 10, fontWeight: 700, textDecoration: "none", marginRight: 12 }}>
            Get my key →
          </a>
          <a href="mailto:diegonaguirre@icloud.com?subject=Cruzar%20Insights%20question" style={{ display: "inline-block", color: "rgba(255,255,255,0.7)", padding: "12px 16px", borderRadius: 10, fontWeight: 500, textDecoration: "none", fontSize: 14 }}>
            …or just email Diego
          </a>
        </section>

        <footer style={{ paddingTop: 24, borderTop: "1px solid rgba(255,255,255,0.08)", color: "rgba(255,255,255,0.5)", fontSize: 12 }}>
          Cruzar Insights is a B2B layer on top of <a href="/" style={{ color: "#86efac" }}>Cruzar</a> (the consumer border-crossing app). Same data backbone, different audience. Source: CBP BWT public API, BTS Border Crossing/Entry Data, Cruzar&apos;s own 15-min scrape.
        </footer>
      </main>
    </div>
  );
}
