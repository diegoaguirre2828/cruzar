// Public live ops feed — shows real-time wait + 90d baseline anomaly status
// for every RGV crossing the model covers. No auth, indexed by search engines.
//
// Data block lives in <LiveBoard /> (client SWR, polls /api/live/board every
// 60s). The page itself stays server-rendered for SEO + JSON-LD, but the per-
// port grid hydrates client-side. This replaces the old <meta http-equiv=
// "refresh" content="60"> full-page reload that brokers reported breaking
// when they switched between pages on 2026-05-01.

import { MomentsNav } from "@/components/MomentsNav";
import { LiveBoard } from "@/components/LiveBoard";

export const runtime = "nodejs";
export const revalidate = 60;

export const metadata = {
  title: "Live RGV border crossing — what's happening right now | Cruzar",
  description:
    "The DURING moment. Real-time RGV wait times and anomaly badges for 8 crossings. Refreshes every 60s without reloading the page.",
  alternates: { canonical: "https://www.cruzar.app/live" },
};

export default function LivePage() {
  const ldjson = {
    "@context": "https://schema.org",
    "@type": "Dataset",
    name: "RGV border wait-time forecasts",
    description:
      "Real-time wait times for US-Mexico border crossings in the Rio Grande Valley.",
    url: "https://www.cruzar.app/live",
    creator: { "@type": "Organization", name: "Cruzar" },
  };

  return (
    <div
      style={{
        minHeight: "100vh",
        background: "#0f172a",
        color: "white",
        fontFamily:
          '-apple-system, BlinkMacSystemFont, "Segoe UI", Helvetica, sans-serif',
      }}
    >
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: JSON.stringify(ldjson) }}
      />
      <MomentsNav current="during" />
      <main style={{ maxWidth: 880, margin: "0 auto", padding: "24px 16px 48px" }}>
        <p
          style={{
            fontSize: 11,
            fontWeight: 700,
            letterSpacing: "0.08em",
            textTransform: "uppercase",
            color: "#fbbf24",
            margin: "0 0 6px",
          }}
        >
          During · Ahorita
        </p>
        <h1 style={{ fontSize: 28, fontWeight: 800, marginBottom: 4 }}>
          What&apos;s happening at the border right now
        </h1>
        <p style={{ color: "rgba(255,255,255,0.65)", margin: "0 0 16px" }}>
          Live waits and anomaly badges for 8 RGV crossings. Refreshes every 60s without
          reloading the page.
        </p>

        <LiveBoard />

        <footer
          style={{
            marginTop: 32,
            paddingTop: 20,
            borderTop: "1px solid rgba(255,255,255,0.08)",
            color: "rgba(255,255,255,0.45)",
            fontSize: 12,
          }}
        >
          Source: Cruzar wait_time_readings (CBP scrape, 15-min cadence). Anomaly badges
          fire when current wait crosses ±50% of the 90-day day-of-week × hour baseline.
          For B2B forecast access + alerts, see{" "}
          <a href="/insights" style={{ color: "#fbbf24" }}>
            cruzar.app/insights
          </a>
          .
        </footer>
      </main>
    </div>
  );
}
