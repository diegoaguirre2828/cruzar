// HERE Geocoding — address → lat/lng for dock locations.
// Used at POST /api/insights/loads time so we cache the dock coords on the
// row instead of re-geocoding on every ETA refresh.

const HERE_KEY = process.env.HERE_API_KEY;

interface HereGeocodeResponse {
  items?: Array<{
    title?: string;
    position?: { lat: number; lng: number };
    address?: { label?: string };
    scoring?: { queryScore?: number };
  }>;
}

export interface GeocodeResult {
  lat: number;
  lng: number;
  label: string;
  score: number;
}

export async function geocode(address: string): Promise<GeocodeResult | null> {
  if (!HERE_KEY) return null;
  if (!address || address.trim().length < 3) return null;

  const url =
    `https://geocode.search.hereapi.com/v1/geocode` +
    `?q=${encodeURIComponent(address.trim())}` +
    `&in=countryCode:USA,MEX` +
    `&apiKey=${HERE_KEY}`;

  try {
    const res = await fetch(url, { cache: "no-store" });
    if (!res.ok) return null;
    const data: HereGeocodeResponse = await res.json();
    const top = data.items?.[0];
    if (!top || !top.position) return null;
    return {
      lat: top.position.lat,
      lng: top.position.lng,
      label: top.address?.label ?? top.title ?? address,
      score: top.scoring?.queryScore ?? 0,
    };
  } catch {
    return null;
  }
}
