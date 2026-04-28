// GET /api/transload
//
// Public read of the transload-yard directory. Source: OSM via
// scripts/scrape-transload-yards.mjs (writes data/transload-yards.json).
//
// Query params:
//   port_id   — filter to yards within `radius_km` of a specific port-of-entry
//   megaRegion — filter to a region (rgv | laredo | coahuila-tx | el-paso | sonora-az | baja)
//   radius_km  — only used with port_id; default 25
//   kind       — filter by yard kind (warehouse, freight_terminal, etc.)
//
// No auth. No rate limiting beyond Vercel's defaults — this is a static file
// in disguise.

import { NextRequest, NextResponse } from "next/server";
import {
  getAllYards,
  getYardsByMegaRegion,
  getYardsByPort,
  scrapedAt,
  totalYardCount,
  type TransloadYard,
} from "@/lib/transloadYards";
import type { MegaRegion } from "@/lib/portMeta";

export const runtime = "nodejs";
export const revalidate = 3600;

const VALID_REGIONS: MegaRegion[] = [
  "rgv",
  "laredo",
  "coahuila-tx",
  "el-paso",
  "sonora-az",
  "baja",
];

export async function GET(req: NextRequest) {
  const url = new URL(req.url);
  const portId = url.searchParams.get("port_id");
  const megaRegion = url.searchParams.get("megaRegion");
  const radiusKm = Number(url.searchParams.get("radius_km") ?? "25");
  const kind = url.searchParams.get("kind");

  let yards: TransloadYard[];
  if (portId) {
    yards = getYardsByPort(portId, radiusKm);
  } else if (megaRegion && VALID_REGIONS.includes(megaRegion as MegaRegion)) {
    yards = getYardsByMegaRegion(megaRegion as MegaRegion);
  } else {
    yards = getAllYards();
  }

  if (kind) {
    yards = yards.filter((y) => y.kind === kind);
  }

  return NextResponse.json(
    {
      scraped_at: scrapedAt(),
      total_in_directory: totalYardCount(),
      returned: yards.length,
      yards,
      attribution: "OpenStreetMap contributors (ODbL)",
    },
    {
      headers: {
        "Cache-Control": "public, s-maxage=3600, stale-while-revalidate=86400",
      },
    },
  );
}
