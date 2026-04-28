import Link from "next/link";
import { MomentsNav } from "@/components/MomentsNav";
import { getAllYards, scrapedAt, totalYardCount, type TransloadYard } from "@/lib/transloadYards";
import { getPortMeta, type MegaRegion } from "@/lib/portMeta";

// Public transload-yard directory — sourced from OpenStreetMap via the
// scripts/scrape-transload-yards.mjs scrape pipeline. Audience: brokers,
// dispatchers, freight ops planning yard staging near a US-MX crossing.
//
// Data model: each yard is tagged to its nearest port-of-entry by Haversine
// distance, classified into a `kind`, and linked back to OSM for verification.
// Sparse coverage in some regions (TX is undertagged in OSM); the page is
// honest about that — see "Coverage notes" section.

export const runtime = "nodejs";
export const revalidate = 3600;

export const metadata = {
  title: "Transload yards near US-Mexico border crossings — Cruzar",
  description:
    "Open directory of transload, warehousing, and freight-forwarding facilities within 50km of every US-Mexico land port-of-entry. Sourced from OpenStreetMap. Filterable by port and region.",
  alternates: { canonical: "https://www.cruzar.app/transload" },
};

const REGIONS: Array<{ key: MegaRegion; en: string; es: string }> = [
  { key: "baja", en: "California / Baja", es: "California / Baja" },
  { key: "sonora-az", en: "Arizona / Sonora", es: "Arizona / Sonora" },
  { key: "el-paso", en: "El Paso / NM / Juárez", es: "El Paso / NM / Juárez" },
  { key: "coahuila-tx", en: "Eagle Pass / Del Rio", es: "Eagle Pass / Del Rio" },
  { key: "laredo", en: "Laredo / I-35", es: "Laredo / I-35" },
  { key: "rgv", en: "RGV / McAllen / Brownsville", es: "RGV / McAllen / Brownsville" },
];

const KIND_LABEL_EN: Record<TransloadYard["kind"], string> = {
  transhipment: "Transhipment",
  warehouse: "Warehouse",
  distribution_center: "Distribution",
  freight_terminal: "Freight terminal",
  container_terminal: "Container terminal",
  logistics_office: "Logistics office",
  freight_forwarder: "Freight forwarder",
  truck_stop: "Truck stop",
};

const KIND_LABEL_ES: Record<TransloadYard["kind"], string> = {
  transhipment: "Transbordo",
  warehouse: "Almacén",
  distribution_center: "Distribución",
  freight_terminal: "Terminal de carga",
  container_terminal: "Terminal de contenedores",
  logistics_office: "Oficina logística",
  freight_forwarder: "Agente de carga",
  truck_stop: "Parada de camiones",
};

export default function TransloadPage() {
  const yards = getAllYards();
  const total = totalYardCount();
  const lastScrape = scrapedAt();
  const lastScrapeDate = lastScrape !== "1970-01-01T00:00:00Z" ? new Date(lastScrape) : null;

  const ldjson = {
    "@context": "https://schema.org",
    "@type": "ItemList",
    name: "US-Mexico border transload yards",
    description:
      "Directory of transload-relevant facilities near US-Mexico ports-of-entry, sourced from OpenStreetMap.",
    numberOfItems: total,
    url: "https://www.cruzar.app/transload",
  };

  return (
    <div className="min-h-screen bg-[#0a1020] text-slate-100 selection:bg-amber-400/30 selection:text-amber-100">
      <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(ldjson) }} />

      <MomentsNav current="before" />

      {/* ── Masthead ── */}
      <div className="border-b border-white/[0.07] bg-[#070b18]">
        <div className="mx-auto flex max-w-[1180px] items-center justify-between gap-4 px-5 py-3 text-[11px] uppercase tracking-[0.18em] text-white/55 sm:px-8">
          <div className="flex items-center gap-3">
            <span className="inline-block h-1.5 w-1.5 rounded-full bg-amber-400" aria-hidden />
            <span className="font-mono text-white/80">Cruzar Transload</span>
            <span className="hidden text-white/30 sm:inline">/ public directory</span>
          </div>
          <div className="hidden items-center gap-5 sm:flex">
            {lastScrapeDate && (
              <span className="font-mono text-white/55">
                last scrape {lastScrapeDate.toISOString().slice(0, 10)}
              </span>
            )}
            <a href="/insights" className="text-white/55 transition hover:text-amber-300">
              /insights
            </a>
          </div>
        </div>
      </div>

      {/* ── Hero ── */}
      <header className="border-b border-white/[0.07] bg-gradient-to-b from-[#070b18] via-[#0a1020] to-[#0a1020]">
        <div className="mx-auto max-w-[1180px] px-5 py-12 sm:px-8 sm:py-16">
          <h1 className="font-serif text-[clamp(2rem,5vw,4rem)] font-medium leading-[1.02] tracking-[-0.02em] text-white">
            Transload yards along the<br />
            US-Mexico border.
          </h1>
          <div className="mt-6 grid max-w-3xl gap-4 sm:grid-cols-2 sm:gap-10">
            <p className="text-[15px] leading-[1.55] text-white/70">
              Every named transload, warehousing, distribution, freight-terminal, logistics-office,
              and freight-forwarding facility within 50 km of a US-Mexico land port-of-entry. Sourced
              from OpenStreetMap; each entry links back to its source for verification.
            </p>
            <p className="text-[15px] leading-[1.55] text-white/55" lang="es">
              Cada instalación nombrada de transbordo, almacenaje, distribución, terminal de carga,
              oficina logística o agente aduanal dentro de 50 km de un cruce US-México. Datos de
              OpenStreetMap; cada entrada se enlaza a su fuente para verificar.
            </p>
          </div>

          <dl className="mt-10 grid grid-cols-2 gap-x-6 gap-y-6 border-y border-white/[0.07] py-6 sm:grid-cols-4 sm:gap-x-10">
            <div>
              <dt className="text-[10.5px] uppercase tracking-[0.2em] text-white/45">Yards listed</dt>
              <dd className="mt-2 font-mono text-[1.8rem] leading-none tracking-tight text-amber-400">
                {total}
              </dd>
            </div>
            <div>
              <dt className="text-[10.5px] uppercase tracking-[0.2em] text-white/45">Source</dt>
              <dd className="mt-2 font-mono text-[1.8rem] leading-none tracking-tight text-white">OSM</dd>
              <dd className="mt-1 text-[12px] text-white/45">ODbL public domain</dd>
            </div>
            <div>
              <dt className="text-[10.5px] uppercase tracking-[0.2em] text-white/45">Coverage</dt>
              <dd className="mt-2 font-mono text-[1.8rem] leading-none tracking-tight text-white">6</dd>
              <dd className="mt-1 text-[12px] text-white/45">megaRegions</dd>
            </div>
            <div>
              <dt className="text-[10.5px] uppercase tracking-[0.2em] text-white/45">API</dt>
              <dd className="mt-2 font-mono text-[1.4rem] leading-none tracking-tight text-white">
                /api/transload
              </dd>
              <dd className="mt-1 text-[12px] text-white/45">JSON · cached 1h</dd>
            </div>
          </dl>
        </div>
      </header>

      {/* ── Region nav ── */}
      <nav className="sticky top-0 z-10 border-b border-white/[0.07] bg-[#0a1020]/95 backdrop-blur supports-[backdrop-filter]:bg-[#0a1020]/75">
        <div className="mx-auto flex max-w-[1180px] gap-2 overflow-x-auto px-5 py-3 sm:px-8">
          {REGIONS.map((r) => {
            const count = yards.filter((y) => y.megaRegion === r.key).length;
            return (
              <a
                key={r.key}
                href={`#${r.key}`}
                className="flex-shrink-0 rounded-full border border-white/[0.08] bg-white/[0.02] px-3 py-1.5 text-[12px] text-white/70 transition hover:border-amber-400/40 hover:text-amber-300"
              >
                {r.en} <span className="font-mono text-white/40">({count})</span>
              </a>
            );
          })}
        </div>
      </nav>

      {/* ── Listings by region ── */}
      <main className="mx-auto max-w-[1180px] px-5 py-12 sm:px-8 sm:py-16">
        {total === 0 ? (
          <EmptyState />
        ) : (
          <div className="space-y-16">
            {REGIONS.map((r) => {
              const ports = yards.filter((y) => y.megaRegion === r.key);
              if (ports.length === 0) {
                return (
                  <section key={r.key} id={r.key}>
                    <RegionHeader region={r} count={0} />
                    <div className="mt-6 rounded-2xl border border-white/[0.06] bg-white/[0.01] px-5 py-8 text-center text-[13px] text-white/45">
                      No yards found in OSM for this region. Coverage gap — see Coverage notes below.
                    </div>
                  </section>
                );
              }
              return (
                <section key={r.key} id={r.key}>
                  <RegionHeader region={r} count={ports.length} />
                  <div className="mt-6 grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
                    {ports.map((y) => (
                      <YardCard key={y.id} yard={y} />
                    ))}
                  </div>
                </section>
              );
            })}
          </div>
        )}

        {/* ── Coverage notes ── */}
        <section className="mt-20 rounded-2xl border border-white/[0.08] bg-white/[0.02] p-6 sm:p-8">
          <div className="text-[10.5px] uppercase tracking-[0.2em] text-white/55">Coverage notes</div>
          <div className="mt-4 grid gap-4 text-[13.5px] leading-[1.6] text-white/70 sm:grid-cols-2">
            <p>
              Counts vary widely by region because OSM tagging density does. CA/Baja is well-tagged —
              every Otay Mesa cross-dock has a node. Texas border is undertagged — Laredo&apos;s World
              Trade Bridge corridor has hundreds of warehouses but only a handful are named in OSM.
              Sparse coverage means &quot;OSM hasn&apos;t mapped it yet,&quot; not &quot;it doesn&apos;t exist.&quot;
            </p>
            <p className="text-white/55" lang="es">
              Los conteos varían por región porque la densidad de etiquetas de OSM también. CA/Baja
              está bien etiquetada — cada cross-dock de Otay Mesa tiene un nodo. La frontera de Texas
              está sub-etiquetada — el corredor del Puente World Trade en Laredo tiene cientos de
              almacenes pero solo algunos están nombrados en OSM. Cobertura escasa significa
              &quot;OSM no lo ha mapeado aún&quot;, no &quot;no existe&quot;.
            </p>
          </div>
          <div className="mt-6 grid gap-4 text-[13px] text-white/55 sm:grid-cols-[1fr_auto] sm:gap-8">
            <p>
              Spot a yard that should be listed? The fix is in OSM upstream — add it at{" "}
              <a
                href="https://www.openstreetmap.org/edit"
                className="text-amber-300 underline decoration-amber-300/30 underline-offset-2"
                target="_blank"
                rel="noopener noreferrer"
              >
                openstreetmap.org/edit
              </a>{" "}
              with tag <code className="rounded bg-white/[0.05] px-1.5 py-0.5 font-mono text-[11px]">industrial=warehousing</code>{" "}
              or <code className="rounded bg-white/[0.05] px-1.5 py-0.5 font-mono text-[11px]">office=logistics</code>. Cruzar
              re-runs the scrape weekly; new entries land automatically.
            </p>
            <a
              href="mailto:diegonaguirre@icloud.com?subject=Transload%20yard%20listing"
              className="self-start whitespace-nowrap rounded-xl border border-amber-400/40 bg-amber-400/10 px-4 py-2 text-[13px] font-semibold text-amber-300 transition hover:bg-amber-400/20"
            >
              Or email Diego
            </a>
          </div>
        </section>

        {/* ── Footer attribution ── */}
        <div className="mt-12 flex flex-wrap items-baseline justify-between gap-2 border-t border-white/[0.06] pt-6 text-[11px] text-white/40">
          <span className="font-mono">© OpenStreetMap contributors · ODbL</span>
          <Link href="/insights" className="hover:text-amber-300">
            /insights — wait-time forecasts →
          </Link>
        </div>
      </main>
    </div>
  );
}

function RegionHeader({
  region,
  count,
}: {
  region: { key: string; en: string; es: string };
  count: number;
}) {
  return (
    <div className="flex items-baseline justify-between gap-3 border-b border-white/[0.07] pb-3">
      <div>
        <h2 className="font-serif text-[clamp(1.4rem,2.5vw,1.9rem)] font-medium tracking-[-0.01em] text-white">
          {region.en}
        </h2>
        <p className="mt-0.5 text-[12.5px] italic text-white/40" lang="es">
          {region.es}
        </p>
      </div>
      <div className="font-mono text-[11px] tabular-nums text-amber-300/80">
        {count} {count === 1 ? "yard" : "yards"}
      </div>
    </div>
  );
}

function YardCard({ yard }: { yard: TransloadYard }) {
  const portMeta = getPortMeta(yard.nearest_port_id);
  const portLabel = portMeta.localName ?? portMeta.city;
  const kindEn = KIND_LABEL_EN[yard.kind];
  const kindEs = KIND_LABEL_ES[yard.kind];

  return (
    <div className="flex flex-col rounded-2xl border border-white/[0.08] bg-white/[0.02] p-5 transition hover:border-white/[0.15]">
      <div className="flex items-start justify-between gap-3">
        <h3 className="text-[15px] font-medium leading-tight text-white">{yard.name}</h3>
        <span className="flex-shrink-0 rounded-md bg-amber-400/10 px-1.5 py-0.5 font-mono text-[10px] uppercase tracking-[0.1em] text-amber-300/85">
          {kindEn}
        </span>
      </div>
      <p className="mt-1 text-[11px] italic text-white/35" lang="es">
        {kindEs}
      </p>

      <div className="mt-3 flex flex-wrap items-baseline gap-x-3 gap-y-1 text-[12px] text-white/60">
        <span className="font-mono text-amber-300/70">{yard.nearest_port_distance_km} km</span>
        <span className="text-white/40">from</span>
        <Link
          href={`/port/${yard.nearest_port_id}`}
          className="font-medium text-white/80 hover:text-amber-300"
        >
          {portLabel}
        </Link>
      </div>

      {yard.address && <p className="mt-3 text-[12px] text-white/55">{yard.address}</p>}

      <div className="mt-3 flex flex-wrap gap-2 text-[11px]">
        {yard.phone && (
          <a
            href={`tel:${yard.phone}`}
            className="rounded-lg border border-white/[0.08] bg-white/[0.02] px-2 py-1 text-white/65 hover:text-amber-300"
          >
            {yard.phone}
          </a>
        )}
        {yard.website && (
          <a
            href={yard.website.startsWith("http") ? yard.website : `https://${yard.website}`}
            target="_blank"
            rel="noopener noreferrer"
            className="rounded-lg border border-white/[0.08] bg-white/[0.02] px-2 py-1 text-white/65 hover:text-amber-300"
          >
            site →
          </a>
        )}
      </div>

      <div className="mt-auto pt-3">
        <a
          href={yard.osm_url}
          target="_blank"
          rel="noopener noreferrer"
          className="text-[10.5px] font-mono uppercase tracking-[0.15em] text-white/30 hover:text-amber-300"
        >
          OSM →
        </a>
      </div>
    </div>
  );
}

function EmptyState() {
  return (
    <div className="rounded-2xl border border-white/[0.08] bg-white/[0.02] p-12 text-center">
      <div className="text-[10.5px] uppercase tracking-[0.2em] text-white/55">No data yet</div>
      <p className="mt-3 text-[14px] leading-relaxed text-white/65">
        The scrape pipeline hasn&apos;t run yet, or returned no results. Run it locally with{" "}
        <code className="rounded bg-white/[0.05] px-1.5 py-0.5 font-mono text-[12px]">
          node scripts/scrape-transload-yards.mjs
        </code>{" "}
        to populate this directory.
      </p>
    </div>
  );
}
