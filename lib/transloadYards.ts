// Transload yard directory — public scrape-only data layer.
//
// Source: OpenStreetMap via Overpass API. Features extracted by
// scripts/scrape-transload-yards.mjs:
//   - industrial=transhipment | warehousing | distribution_center | freight_terminal | container_terminal
//   - building=warehouse (only if named)
//   - office=logistics | freight_forwarding
//   - amenity=truck_stop (within 25km of a port-of-entry)
//
// Each yard is tagged to its nearest port-of-entry by Haversine distance.
// Public-domain OSM data — license is ODbL. Attribute "© OpenStreetMap contributors".

import yards from "@/data/transload-yards.json";
import { PORT_META, type MegaRegion } from "./portMeta";

export interface TransloadYard {
  id: string; // OSM stable id, e.g. "node/1234567890"
  name: string;
  kind: "transhipment" | "warehouse" | "distribution_center" | "freight_terminal" | "container_terminal" | "logistics_office" | "freight_forwarder" | "truck_stop";
  lat: number;
  lng: number;
  // Nearest port-of-entry by drive-distance proxy (Haversine for speed).
  nearest_port_id: string;
  nearest_port_distance_km: number;
  megaRegion: MegaRegion;
  address?: string | null;
  phone?: string | null;
  website?: string | null;
  hours?: string | null;
  // Original OSM tags — useful for downstream filtering / verification.
  osm_url: string;
  // Provenance
  scraped_at: string; // ISO
}

interface ScrapedManifest {
  scraped_at: string;
  yards: TransloadYard[];
}

const data = yards as ScrapedManifest;

export function getAllYards(): TransloadYard[] {
  return data.yards;
}

export function getYardsByMegaRegion(region: MegaRegion): TransloadYard[] {
  return data.yards.filter((y) => y.megaRegion === region);
}

export function getYardsByPort(portId: string, radiusKm: number = 25): TransloadYard[] {
  return data.yards.filter(
    (y) => y.nearest_port_id === portId && y.nearest_port_distance_km <= radiusKm,
  );
}

export function scrapedAt(): string {
  return data.scraped_at;
}

export function totalYardCount(): number {
  return data.yards.length;
}

// Haversine distance — used for the scrape; re-exported here so other modules
// (e.g. the MCP tool, /api/transload) can reuse the same calculation.
export function haversineKm(a: { lat: number; lng: number }, b: { lat: number; lng: number }): number {
  const R = 6371;
  const toRad = (d: number) => (d * Math.PI) / 180;
  const dLat = toRad(b.lat - a.lat);
  const dLng = toRad(b.lng - a.lng);
  const lat1 = toRad(a.lat);
  const lat2 = toRad(b.lat);
  const h =
    Math.sin(dLat / 2) ** 2 + Math.cos(lat1) * Math.cos(lat2) * Math.sin(dLng / 2) ** 2;
  return 2 * R * Math.asin(Math.sqrt(h));
}

// Used by the scrape script + the API /api/transload to assign nearest port_id
// to a feature given its lat/lng.
export function nearestPortId(coord: { lat: number; lng: number }): {
  portId: string;
  distanceKm: number;
  megaRegion: MegaRegion;
} {
  let best: { portId: string; distanceKm: number; megaRegion: MegaRegion } | null = null;
  for (const [portId, meta] of Object.entries(PORT_META)) {
    if (meta.megaRegion === "other") continue;
    const d = haversineKm(coord, { lat: meta.lat, lng: meta.lng });
    if (!best || d < best.distanceKm) {
      best = { portId, distanceKm: d, megaRegion: meta.megaRegion };
    }
  }
  return best!;
}
