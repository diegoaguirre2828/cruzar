#!/usr/bin/env node
// Scrape transload-relevant features from OpenStreetMap Overpass API and
// write data/transload-yards.json. Runs per-megaRegion to keep each query
// under Overpass quota.
//
// Usage:
//   node scripts/scrape-transload-yards.mjs
//
// Output: data/transload-yards.json with shape:
//   { scraped_at, yards: TransloadYard[] }
//
// Tags queried (per OSM industrial / freight conventions):
//   industrial=transhipment|warehousing|distribution_center|freight_terminal|container_terminal
//   building=warehouse (named only)
//   office=logistics|freight_forwarding
//   amenity=truck_stop

import { writeFile, readFile } from "node:fs/promises";
import { resolve } from "node:path";

// PORT_META subset — coords per port-of-entry that we tag yards against.
// Mirror of lib/portMeta.ts; keep them in sync if you add ports.
const PORT_META = JSON.parse(
  await readFile(new URL("./_port-meta-snapshot.json", import.meta.url), "utf8").catch(
    () => null,
  ) ?? "null",
);

// Build PORT_META at runtime by parsing lib/portMeta.ts so we never drift.
async function loadPortMeta() {
  const src = await readFile(
    resolve(process.cwd(), "lib", "portMeta.ts"),
    "utf8",
  );
  // Parse lines like:  '230501': { city: 'McAllen', region: RGV_REYNOSA, megaRegion: 'rgv', lat: 26.1080, lng: -98.2708, localName: 'Hidalgo' },
  const lineRe =
    /'(\d{6})':\s*\{[^}]*megaRegion:\s*'([^']+)'[^}]*lat:\s*([-\d.]+)[^}]*lng:\s*([-\d.]+)/g;
  const out = {};
  let m;
  while ((m = lineRe.exec(src)) !== null) {
    out[m[1]] = {
      megaRegion: m[2],
      lat: parseFloat(m[3]),
      lng: parseFloat(m[4]),
    };
  }
  return out;
}

const portMeta = await loadPortMeta();
const portIds = Object.keys(portMeta);
console.log(`Loaded ${portIds.length} ports from lib/portMeta.ts`);

// Compute bounding boxes per megaRegion with a 30km pad around each port's coords.
function bboxForRegion(region) {
  const ports = portIds.filter((id) => portMeta[id].megaRegion === region);
  if (ports.length === 0) return null;
  let minLat = Infinity,
    maxLat = -Infinity,
    minLng = Infinity,
    maxLng = -Infinity;
  for (const id of ports) {
    const p = portMeta[id];
    minLat = Math.min(minLat, p.lat);
    maxLat = Math.max(maxLat, p.lat);
    minLng = Math.min(minLng, p.lng);
    maxLng = Math.max(maxLng, p.lng);
  }
  // Pad ~30km in lat (~0.27 deg), more in lng (deg per km varies with cos(lat)).
  const padLat = 0.27;
  const padLng = 0.32;
  return {
    south: minLat - padLat,
    west: minLng - padLng,
    north: maxLat + padLat,
    east: maxLng + padLng,
  };
}

const REGIONS = ["rgv", "laredo", "coahuila-tx", "el-paso", "sonora-az", "baja"];

// Overpass query template — node + way for each tag class.
function buildQuery(bbox) {
  const b = `${bbox.south},${bbox.west},${bbox.north},${bbox.east}`;
  return `[out:json][timeout:90];
(
  node["industrial"~"transhipment|warehousing|distribution_center|freight_terminal|container_terminal"](${b});
  way["industrial"~"transhipment|warehousing|distribution_center|freight_terminal|container_terminal"](${b});
  way["building"="warehouse"]["name"](${b});
  node["office"~"logistics|freight_forwarding"](${b});
  way["office"~"logistics|freight_forwarding"](${b});
  node["amenity"="truck_stop"](${b});
  way["amenity"="truck_stop"](${b});
);
out center tags;`;
}

const OVERPASS_ENDPOINTS = [
  "https://overpass-api.de/api/interpreter",
  "https://overpass.kumi.systems/api/interpreter",
  "https://overpass.private.coffee/api/interpreter",
  "https://maps.mail.ru/osm/tools/overpass/api/interpreter",
];

const UA =
  "cruzar-transload-scrape/0.1 (https://cruzar.app; diegonaguirre@icloud.com)";

async function fetchOverpass(query) {
  let lastErr = null;
  for (const ep of OVERPASS_ENDPOINTS) {
    // Per-endpoint exponential backoff for transient 429s.
    for (let attempt = 1; attempt <= 4; attempt++) {
      try {
        const res = await fetch(ep, {
          method: "POST",
          headers: {
            "Content-Type": "application/x-www-form-urlencoded",
            "User-Agent": UA,
            Accept: "application/json",
          },
          body: `data=${encodeURIComponent(query)}`,
        });
        if (res.status === 429 || res.status === 504) {
          const wait = 2000 * 2 ** (attempt - 1); // 2s, 4s, 8s, 16s
          console.log(`  ${ep} returned ${res.status}, sleeping ${wait}ms (attempt ${attempt}/4)`);
          await new Promise((r) => setTimeout(r, wait));
          continue;
        }
        if (!res.ok) {
          lastErr = new Error(`HTTP ${res.status} from ${ep}`);
          break; // try next endpoint
        }
        return await res.json();
      } catch (e) {
        lastErr = e;
        const wait = 1500 * 2 ** (attempt - 1);
        console.log(`  ${ep} threw ${e.message}, sleeping ${wait}ms`);
        await new Promise((r) => setTimeout(r, wait));
      }
    }
  }
  throw lastErr ?? new Error("All Overpass endpoints failed");
}

// Haversine — same shape as lib/transloadYards.ts.
function haversineKm(a, b) {
  const R = 6371;
  const toRad = (d) => (d * Math.PI) / 180;
  const dLat = toRad(b.lat - a.lat);
  const dLng = toRad(b.lng - a.lng);
  const lat1 = toRad(a.lat);
  const lat2 = toRad(b.lat);
  const h =
    Math.sin(dLat / 2) ** 2 +
    Math.cos(lat1) * Math.cos(lat2) * Math.sin(dLng / 2) ** 2;
  return 2 * R * Math.asin(Math.sqrt(h));
}

function nearestPort(coord) {
  let best = null;
  for (const id of portIds) {
    const p = portMeta[id];
    if (p.megaRegion === "other") continue;
    const d = haversineKm(coord, { lat: p.lat, lng: p.lng });
    if (!best || d < best.distanceKm) {
      best = { portId: id, distanceKm: d, megaRegion: p.megaRegion };
    }
  }
  return best;
}

// Map an OSM element's tags to our `kind` enum. Returns null if no match.
function classifyTags(tags) {
  if (!tags) return null;
  if (tags.industrial === "transhipment") return "transhipment";
  if (tags.industrial === "warehousing") return "warehouse";
  if (tags.industrial === "distribution_center") return "distribution_center";
  if (tags.industrial === "freight_terminal") return "freight_terminal";
  if (tags.industrial === "container_terminal") return "container_terminal";
  if (tags.office === "logistics") return "logistics_office";
  if (tags.office === "freight_forwarding") return "freight_forwarder";
  if (tags.amenity === "truck_stop") return "truck_stop";
  if (tags.building === "warehouse" && tags.name) return "warehouse";
  return null;
}

// Stable id from OSM type + numeric id.
function osmId(el) {
  return `${el.type}/${el.id}`;
}

function osmUrl(el) {
  return `https://www.openstreetmap.org/${el.type}/${el.id}`;
}

// Extract lat/lng — for ways, OSM returns the centroid as element.center.
function coordOf(el) {
  if (el.type === "node") return { lat: el.lat, lng: el.lon };
  if (el.center) return { lat: el.center.lat, lng: el.center.lon };
  return null;
}

const allYards = new Map();
let totalElements = 0;

for (const region of REGIONS) {
  const bbox = bboxForRegion(region);
  if (!bbox) {
    console.log(`SKIP ${region}: no ports`);
    continue;
  }
  console.log(`\n=== ${region} ===`);
  console.log(
    `  bbox: S=${bbox.south.toFixed(2)} W=${bbox.west.toFixed(2)} N=${bbox.north.toFixed(2)} E=${bbox.east.toFixed(2)}`,
  );
  let json;
  try {
    json = await fetchOverpass(buildQuery(bbox));
  } catch (e) {
    console.error(`  FAIL ${region}: ${e.message}`);
    continue;
  }
  const elements = json.elements ?? [];
  totalElements += elements.length;
  console.log(`  raw elements: ${elements.length}`);

  let kept = 0;
  for (const el of elements) {
    const kind = classifyTags(el.tags);
    if (!kind) continue;
    const coord = coordOf(el);
    if (!coord || coord.lat === undefined) continue;
    const name = el.tags.name ?? el.tags["name:en"] ?? el.tags.operator ?? null;
    if (!name) continue; // Drop unnamed features — useless to a directory.
    const np = nearestPort(coord);
    if (!np || np.distanceKm > 50) continue; // Outside our corridor radius.

    const yard = {
      id: osmId(el),
      name,
      kind,
      lat: coord.lat,
      lng: coord.lng,
      nearest_port_id: np.portId,
      nearest_port_distance_km: Math.round(np.distanceKm * 10) / 10,
      megaRegion: np.megaRegion,
      address:
        [
          el.tags["addr:housenumber"],
          el.tags["addr:street"],
          el.tags["addr:city"],
          el.tags["addr:state"] ?? el.tags["addr:province"],
        ]
          .filter(Boolean)
          .join(", ") || null,
      phone: el.tags.phone ?? el.tags["contact:phone"] ?? null,
      website: el.tags.website ?? el.tags["contact:website"] ?? null,
      hours: el.tags.opening_hours ?? null,
      osm_url: osmUrl(el),
      scraped_at: new Date().toISOString(),
    };
    allYards.set(yard.id, yard);
    kept++;
  }
  console.log(`  named + classified + within-corridor: ${kept}`);

  // Be a polite scrape client — Overpass asks for ~1 req/s.
  await new Promise((r) => setTimeout(r, 2000));
}

const yards = Array.from(allYards.values()).sort((a, b) => {
  // Group by region, then by distance ascending.
  if (a.megaRegion !== b.megaRegion) return a.megaRegion.localeCompare(b.megaRegion);
  return a.nearest_port_distance_km - b.nearest_port_distance_km;
});

const out = {
  scraped_at: new Date().toISOString(),
  yards,
};

const outPath = resolve(process.cwd(), "data", "transload-yards.json");
await writeFile(outPath, JSON.stringify(out, null, 2));

console.log(`\n--- DONE ---`);
console.log(`Total raw OSM elements: ${totalElements}`);
console.log(`Yards kept (named + classified + corridor): ${yards.length}`);
console.log(`Per region breakdown:`);
const byRegion = {};
for (const y of yards) byRegion[y.megaRegion] = (byRegion[y.megaRegion] ?? 0) + 1;
for (const [k, v] of Object.entries(byRegion).sort()) {
  console.log(`  ${k.padEnd(14)} ${v}`);
}
console.log(`Wrote: ${outPath}`);
