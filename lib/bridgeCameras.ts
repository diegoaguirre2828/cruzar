// Public bridge camera feed registry.
//
// Maps portId → array of live feed sources. A port may have multiple
// angles (US side, MX side, north view, south view, etc.) — each
// entry in the array is one angle. When a portId is NOT in this map,
// or its array is empty, the BridgeCameras component shows a
// "próximamente" (coming soon) state instead of a broken player.
//
// Feed discovery workflow: verify the stream URL is public and
// embeddable (iframe-friendly or direct image refresh), then add an
// entry here. Do NOT host or proxy feeds — only embed what the
// publisher already serves publicly. Respect the source's CORS and
// x-frame-options headers.
//
// Schema extended 2026-04-14 from Record<string, CameraFeed> to
// Record<string, CameraFeed[]> after the pass-2 research unlocked
// ~17 new feeds from El Imparcial (MX) and openlaredo.com (both
// sides), many on ports that already had a US-side cam. See
// memory/project_cruzar_camera_feeds_master.md for the full catalog.

export type CameraFeed = {
  // How the feed renders in the browser
  // - 'iframe'  : third-party embed (YouTube live, TxDOT CCTV page, etc.)
  // - 'image'   : still image URL that auto-refreshes every ~10s
  // - 'youtube' : YouTube video ID (rendered as a lite embed)
  // - 'hls'     : HLS video stream (.m3u8) rendered via hls.js into a <video>
  kind: 'iframe' | 'image' | 'youtube' | 'hls'
  src: string
  // Attribution required by the source
  credit: string
  creditUrl?: string
  // Optional short description shown below the feed
  note?: string
  // Short tab label when a port has multiple feeds (e.g., "US", "MX Norte").
  // If omitted, the feed renders without a tab bar when it's the only one.
  label?: string
}

// Pass-1 entries (2026-04-14 early) + pass-2 additions (2026-04-14 late).
//
// Coverage summary after pass 2:
//   - California: San Ysidro (US Caltrans + MX Ready Line + MX SENTRI),
//                 Otay Mesa (US Caltrans + MX Norte + MX Sur),
//                 Calexico East / Mexicali Nuevo (US Caltrans + MX east + MX west)
//   - Arizona:    Nogales Mariposa (US AZ511 + MX El Imparcial),
//                 Nogales DeConcini (MX Norte + MX Sur — US AZ511 ID TBD)
//   - Texas Laredo: all 4 bridges now have US + MX sides (8 new feeds)
//   - El Paso:    BOTA, PDN, Zaragoza HLS (unchanged from pass 1)
//   - Texas RGV / Brownsville: still zero (TxDOT SignalR-locked, McAllen
//                 Milestone auth-walled, Comtodo MX JS-locked)
//
// DO NOT add entries until the URL has been verified to (a) load,
// (b) not require auth, (c) not silently redirect, (d) not embed
// malware or ads.
export const BRIDGE_CAMERAS: Record<string, CameraFeed[]> = {
  // ─── California — San Ysidro POE ────────────────────────────────
  '250401': [
    {
      kind: 'image',
      src: 'https://cwwp2.dot.ca.gov/data/d11/cctv/image/c214sb5viadesanysidro/c214sb5viadesanysidro.jpg',
      credit: 'Caltrans District 11',
      creditUrl: 'https://cwwp2.dot.ca.gov/vm/iframemap.htm',
      note: 'SB I-5 at Via de San Ysidro — último Caltrans antes del POE',
      label: 'US · Caltrans',
    },
    {
      kind: 'image',
      src: 'https://garitas.elimparcial.com/imgwebcams/garita-san-ysidro-ready-line.jpg',
      credit: 'El Imparcial',
      creditUrl: 'https://www.elimparcial.com/',
      note: 'Ready Line — vista desde México',
      label: 'MX · Ready Line',
    },
    {
      kind: 'image',
      src: 'https://garitas.elimparcial.com/imgwebcams/garita-san-ysidro-sentri.jpg',
      credit: 'El Imparcial',
      creditUrl: 'https://www.elimparcial.com/',
      note: 'Línea SENTRI — vista desde México',
      label: 'MX · SENTRI',
    },
  ],

  // ─── California — Otay Mesa POE ─────────────────────────────────
  '250501': [
    {
      kind: 'image',
      src: 'https://cwwp2.dot.ca.gov/data/d11/cctv/image/c292sb125atotaymesard/c292sb125atotaymesard.jpg',
      credit: 'Caltrans District 11',
      creditUrl: 'https://cwwp2.dot.ca.gov/vm/iframemap.htm',
      note: 'SB SR-125 at Otay Mesa Rd — arriba del POE',
      label: 'US · Caltrans',
    },
    {
      kind: 'image',
      src: 'https://garitas.elimparcial.com/imgwebcams/garita-otay-norte.jpg',
      credit: 'El Imparcial',
      creditUrl: 'https://www.elimparcial.com/',
      note: 'Garita Otay — vista norte desde México',
      label: 'MX · Norte',
    },
    {
      kind: 'image',
      src: 'https://garitas.elimparcial.com/imgwebcams/garita-otay-sur.jpg',
      credit: 'El Imparcial',
      creditUrl: 'https://www.elimparcial.com/',
      note: 'Garita Otay — vista sur desde México',
      label: 'MX · Sur',
    },
  ],

  // ─── California — Calexico / Mexicali Nuevo ─────────────────────
  '250302': [
    {
      kind: 'image',
      src: 'https://cwwp2.dot.ca.gov/data/d11/cctv/image/c430nb111jno2ndst/c430nb111jno2ndst.jpg',
      credit: 'Caltrans District 11',
      creditUrl: 'https://cwwp2.dot.ca.gov/vm/iframemap.htm',
      note: 'NB SR-111 just north of 2nd St — primer Caltrans al norte del POE',
      label: 'US · Caltrans',
    },
    {
      kind: 'image',
      src: 'https://garitas.elimparcial.com/imgwebcams/garita-mexicali-nuevoe.jpg',
      credit: 'El Imparcial',
      creditUrl: 'https://www.elimparcial.com/',
      note: 'Garita Mexicali Nuevo — vista este',
      label: 'MX · Este',
    },
    {
      kind: 'image',
      src: 'https://garitas.elimparcial.com/imgwebcams/garita-mexicali-nuevoo.jpg',
      credit: 'El Imparcial',
      creditUrl: 'https://www.elimparcial.com/',
      note: 'Garita Mexicali Nuevo — vista oeste',
      label: 'MX · Oeste',
    },
  ],

  // ─── Arizona — Nogales Mariposa ─────────────────────────────────
  '260402': [
    {
      kind: 'image',
      src: 'https://www.az511.gov/map/Cctv/1218',
      credit: 'ADOT AZ511',
      creditUrl: 'https://www.az511.gov/cctv',
      note: 'SR-189 at Loma Mariposa — en la salida del POE',
      label: 'US · AZ511',
    },
    {
      kind: 'image',
      src: 'https://garitas.elimparcial.com/imgwebcams/garita-mariposa.jpg',
      credit: 'El Imparcial / Heroica Nogales',
      creditUrl: 'https://heroicanogales.gob.mx/webcams-garitas',
      note: 'Garita Mariposa — vista desde México',
      label: 'MX · Mariposa',
    },
  ],

  // ─── Arizona — Nogales DeConcini (Mexican-side only for now) ────
  '260401': [
    {
      kind: 'image',
      src: 'https://garitas.elimparcial.com/imgwebcams/garita-deconcini-norte.jpg',
      credit: 'El Imparcial / Heroica Nogales',
      creditUrl: 'https://heroicanogales.gob.mx/webcams-garitas',
      note: 'Garita DeConcini — vista norte',
      label: 'MX · Norte',
    },
    {
      kind: 'image',
      src: 'https://garitas.elimparcial.com/imgwebcams/garita-deconcini-sur.jpg',
      credit: 'El Imparcial / Heroica Nogales',
      creditUrl: 'https://heroicanogales.gob.mx/webcams-garitas',
      note: 'Garita DeConcini — vista sur',
      label: 'MX · Sur',
    },
  ],

  // ─── Texas Laredo — openlaredo.com / City of Laredo AXIS cams ───
  // Verified live via EXIF timestamps. Direct AXIS snapshot JPGs,
  // refresh ~30-60s. Publisher: City of Laredo / Aduanet.

  '230401': [
    {
      kind: 'image',
      src: 'https://www.openlaredo.com/bridge/BridgeWebCamStills/bridge1US.jpg',
      credit: 'City of Laredo',
      creditUrl: 'https://www.cityoflaredo.com/services/bridge-cameras',
      note: 'Laredo I / Gateway to the Americas — lado US',
      label: 'US',
    },
    {
      kind: 'image',
      src: 'https://www.openlaredo.com/bridge/BridgeWebCamStills/bridge1MEX.jpg',
      credit: 'City of Laredo',
      creditUrl: 'https://www.cityoflaredo.com/services/bridge-cameras',
      note: 'Laredo I / Gateway to the Americas — lado MX',
      label: 'MX',
    },
  ],

  '230404': [
    {
      kind: 'image',
      src: 'https://www.openlaredo.com/bridge/BridgeWebCamStills/bridge2US.jpg',
      credit: 'City of Laredo',
      creditUrl: 'https://www.cityoflaredo.com/services/bridge-cameras',
      note: 'Puente Juárez-Lincoln — lado US',
      label: 'US',
    },
    {
      kind: 'image',
      src: 'https://www.openlaredo.com/bridge/BridgeWebCamStills/bridge2MEX.jpg',
      credit: 'City of Laredo',
      creditUrl: 'https://www.cityoflaredo.com/services/bridge-cameras',
      note: 'Puente Juárez-Lincoln — lado MX',
      label: 'MX',
    },
  ],

  '230403': [
    {
      kind: 'image',
      src: 'https://www.openlaredo.com/bridge/BridgeWebCamStills/bridge3US.jpg',
      credit: 'City of Laredo',
      creditUrl: 'https://www.cityoflaredo.com/services/bridge-cameras',
      note: 'Puente Colombia Solidaridad — lado US',
      label: 'US',
    },
    {
      kind: 'image',
      src: 'https://www.openlaredo.com/bridge/BridgeWebCamStills/bridge3MEX.jpg',
      credit: 'City of Laredo',
      creditUrl: 'https://www.cityoflaredo.com/services/bridge-cameras',
      note: 'Puente Colombia Solidaridad — lado MX',
      label: 'MX',
    },
  ],

  '230402': [
    {
      kind: 'image',
      src: 'https://www.openlaredo.com/bridge/BridgeWebCamStills/bridge4US.jpg',
      credit: 'City of Laredo',
      creditUrl: 'https://www.cityoflaredo.com/services/bridge-cameras',
      note: 'World Trade Bridge (comercial) — lado US',
      label: 'US',
    },
    {
      kind: 'image',
      // Case-sensitive "Mex" on bridge4 only (openlaredo.com quirk)
      src: 'https://www.openlaredo.com/bridge/BridgeWebCamStills/bridge4Mex.jpg',
      credit: 'City of Laredo',
      creditUrl: 'https://www.cityoflaredo.com/services/bridge-cameras',
      note: 'World Trade Bridge (comercial) — lado MX',
      label: 'MX',
    },
  ],

  // ─── Texas RGV — Brownsville / Matamoros (Comtodo via ipcamlive) ─
  // Verified live 2026-04-14 pass-3 research. Direct JPEG snapshot
  // endpoint, CORS-open, no-cache headers — identical gold-standard
  // pattern to Caltrans / openlaredo. Publisher: Comtodo (Matamoros
  // ISP). Pass-2 had flagged these as JS-locked; that was wrong —
  // the cameras were two iframe tags in static HTML the whole time,
  // and ipcamlive exposes a CORS-open JPEG snapshot endpoint we can
  // use directly.

  '535501': [
    {
      kind: 'image',
      src: 'https://g3.ipcamlive.com/player/snapshot.php?alias=5df59f3827371',
      credit: 'Comtodo',
      creditUrl: 'https://comtodo.com/camaras/',
      note: 'Puente Viejo (B&M) — vista desde Matamoros',
      label: 'MX · Viejo',
    },
  ],

  '535504': [
    {
      kind: 'image',
      src: 'https://g3.ipcamlive.com/player/snapshot.php?alias=61af904e45b24',
      credit: 'Comtodo',
      creditUrl: 'https://comtodo.com/camaras/',
      note: 'Puente Nuevo / Gateway International — vista desde Matamoros',
      label: 'MX · Nuevo',
    },
  ],

  // ─── Texas RGV — Pharr-Reynosa (City of Pharr YouTube live) ─────
  // 24/7 YouTube live stream by Pharr.IT (City of Pharr IT dept).
  // Verified live 2026-04-14 (isLiveNow:true, streaming since
  // 2026-02-17). Video ID can rotate — if this goes 404, re-check
  // channel UCYUv0nRbGf6LnGGtx34hcZw / live.

  '230502': [
    {
      kind: 'youtube',
      src: 'T1as39NDW7o',
      credit: 'City of Pharr',
      creditUrl: 'https://bridge.pharr-tx.gov/live-bridge-camera/',
      note: 'Pharr-Reynosa International Bridge — live 24/7',
      label: 'US · Live',
    },
  ],

  // ─── El Paso — City of El Paso zoocam HLS streams ───────────────
  // CORS-open .m3u8 streams. Rendered via hls.js into a <video> tag.
  // Publisher: zoocams.elpasozoo.org (City of El Paso)

  '240201': [
    {
      kind: 'hls',
      src: 'https://zoocams.elpasozoo.org/memfs/15-bota-hq.m3u8',
      credit: 'City of El Paso',
      creditUrl: 'https://www2.elpasotexas.gov/misc/externally_linked/bridges/cameras.html',
      note: 'Bridge of the Americas (BOTA) live HLS stream',
      label: 'US · Live',
    },
  ],

  '240204': [
    {
      kind: 'hls',
      src: 'https://zoocams.elpasozoo.org/memfs/10-pdn-hq.m3u8',
      credit: 'City of El Paso',
      creditUrl: 'https://www2.elpasotexas.gov/misc/externally_linked/bridges/cameras.html',
      note: 'Paso del Norte (PDN) live HLS stream',
      label: 'US · Live',
    },
  ],

  '240221': [
    {
      kind: 'hls',
      src: 'https://zoocams.elpasozoo.org/memfs/20-zar-hq.m3u8',
      credit: 'City of El Paso',
      creditUrl: 'https://www2.elpasotexas.gov/misc/externally_linked/bridges/cameras.html',
      note: 'Ysleta / Zaragoza live HLS stream',
      label: 'US · Live',
    },
  ],
}

// Returns all feeds for a port (may be empty array).
export function getBridgeCameras(portId: string): CameraFeed[] {
  return BRIDGE_CAMERAS[portId] ?? []
}

// Backward-compat single-feed helper for callers that only want the
// primary feed. Returns the first feed or null.
export function getBridgeCamera(portId: string): CameraFeed | null {
  return BRIDGE_CAMERAS[portId]?.[0] ?? null
}

export function hasCamera(portId: string): boolean {
  return (BRIDGE_CAMERAS[portId]?.length ?? 0) > 0
}
