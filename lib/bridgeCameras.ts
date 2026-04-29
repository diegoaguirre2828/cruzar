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

  // ─── California — Otay Mesa Passenger POE ───────────────────────
  // Corrected 2026-04-17: portId 250501 is CBP's Tecate crossing,
  // not Otay Mesa. Otay Mesa Passenger is 250601.
  '250601': [
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

  // ─── California — Calexico East POE ↔ Mexicali Nuevo ────────────
  // Pass-6 audit 2026-04-28: Mexicali Nuevo is the EAST crossing
  // (~32.679, -115.39), so its El Imparcial cams pair with 250301
  // (Calexico East), not 250302. Previous entry had them mis-keyed.
  '250301': [
    {
      kind: 'image',
      src: 'https://garitas.elimparcial.com/imgwebcams/garita-mexicali-nuevoe.jpg',
      credit: 'El Imparcial',
      creditUrl: 'https://www.elimparcial.com/mexicali/site/garitas/',
      note: 'Garita Mexicali Nuevo — vista este',
      label: 'MX · Nuevo Este',
    },
    {
      kind: 'image',
      src: 'https://garitas.elimparcial.com/imgwebcams/garita-mexicali-nuevoo.jpg',
      credit: 'El Imparcial',
      creditUrl: 'https://www.elimparcial.com/mexicali/site/garitas/',
      note: 'Garita Mexicali Nuevo — vista oeste',
      label: 'MX · Nuevo Oeste',
    },
  ],

  // ─── California — Calexico West (downtown) ↔ Mexicali Centro ────
  // Pass-6 add 2026-04-28: Mexicali Centro pair pulled from El Imparcial
  // /mexicali/site/garitas/ — correct pairing for the downtown Calexico
  // West POE. The existing Caltrans cam stays here (NB SR-111 jn 2nd St
  // is downtown Calexico, ground truth verified).
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
      src: 'https://garitas.elimparcial.com/imgwebcams/garita-mexicali-centroe.jpg',
      credit: 'El Imparcial',
      creditUrl: 'https://www.elimparcial.com/mexicali/site/garitas/',
      note: 'Garita Mexicali Centro — vista este',
      label: 'MX · Centro Este',
    },
    {
      kind: 'image',
      src: 'https://garitas.elimparcial.com/imgwebcams/garita-mexicali-centroo.jpg',
      credit: 'El Imparcial',
      creditUrl: 'https://www.elimparcial.com/mexicali/site/garitas/',
      note: 'Garita Mexicali Centro — vista oeste',
      label: 'MX · Centro Oeste',
    },
  ],

  // ─── Arizona — Nogales Mariposa ─────────────────────────────────
  // Pass-5 audit 2026-04-26: extracted a sample frame from every Heroica
  // Nogales stream, read the bottom-right caption baked into the video,
  // and rebuilt these labels to match what the camera ACTUALLY shows
  // (not what the URL path suggests). Pass-4 had guessed labels from
  // path naming conventions — those guesses were wrong. Real findings:
  //   - deconcini/pla-sur is captioned "Garita Mariposa Vista Norte"
  //     (mislabeled by publisher — it's a Mariposa view, moved here)
  //   - mariposa/general2 is captioned "Miguel Hidalgo Sur" (a street
  //     near Mariposa, kept here as approach context)
  //   - All "pla", "ban", "hot", "san" path names are LANDMARK names
  //     (Bancomer, Santander, Sentri lane, Hidalgo Ave), not function
  //     names. None are dedicated pedestrian-platform cameras.
  '260402': [
    {
      kind: 'hls',
      src: 'https://cruce.heroicanogales.gob.mx/mariposa/general/index.m3u8',
      credit: 'Heroica Nogales',
      creditUrl: 'https://heroicanogales.gob.mx/webcams-garitas',
      note: 'Garita Mariposa — vista general (estacionamiento + acceso)',
      label: 'MX · Garita',
    },
    {
      kind: 'hls',
      src: 'https://cruce.heroicanogales.gob.mx/deconcini/pla-sur/index.m3u8',
      credit: 'Heroica Nogales',
      creditUrl: 'https://heroicanogales.gob.mx/webcams-garitas',
      note: 'Mariposa — vista norte (mislabeled "deconcini/pla-sur" en la URL)',
      label: 'MX · Vista Norte',
    },
    {
      kind: 'hls',
      src: 'https://cruce.heroicanogales.gob.mx/mariposa/general2/index.m3u8',
      credit: 'Heroica Nogales',
      creditUrl: 'https://heroicanogales.gob.mx/webcams-garitas',
      note: 'Av. Miguel Hidalgo Sur — calle de acceso a Mariposa',
      label: 'MX · Hidalgo Sur',
    },
    {
      kind: 'hls',
      src: 'https://cruce.heroicanogales.gob.mx/mariposa/mariposa3/index.m3u8',
      credit: 'Heroica Nogales',
      creditUrl: 'https://heroicanogales.gob.mx/webcams-garitas',
      note: 'Garita Mariposa — ángulo 3 en vivo',
      label: 'MX · 3',
    },
    {
      kind: 'hls',
      src: 'https://cruce.heroicanogales.gob.mx/mariposa/mariposa4/index.m3u8',
      credit: 'Heroica Nogales',
      creditUrl: 'https://heroicanogales.gob.mx/webcams-garitas',
      note: 'Garita Mariposa — ángulo 4 en vivo',
      label: 'MX · 4',
    },
    {
      kind: 'hls',
      src: 'https://cruce.heroicanogales.gob.mx/mariposa/mariposa5/index.m3u8',
      credit: 'Heroica Nogales',
      creditUrl: 'https://heroicanogales.gob.mx/webcams-garitas',
      note: 'Garita Mariposa — ángulo 5 en vivo',
      label: 'MX · 5',
    },
    {
      kind: 'hls',
      src: 'https://cruce.heroicanogales.gob.mx/mariposa/mariposa6/index.m3u8',
      credit: 'Heroica Nogales',
      creditUrl: 'https://heroicanogales.gob.mx/webcams-garitas',
      note: 'Garita Mariposa — ángulo 6 en vivo',
      label: 'MX · 6',
    },
    {
      kind: 'image',
      src: 'https://www.az511.gov/map/Cctv/1218',
      credit: 'ADOT AZ511',
      creditUrl: 'https://www.az511.gov/cctv',
      note: 'SR-189 at Loma Mariposa — en la salida del POE',
      label: 'US · AZ511',
    },
  ],

  // ─── Arizona — Nogales DeConcini ────────────────────────────────
  // Pass-5 audit 2026-04-26 corrected pass-4's wrong path-name guesses.
  // Sample frames extracted from every Heroica stream show:
  //   - "deconcini/norte" → captioned "Deconcini Norte" (real DeConcini queue)
  //   - "deconcini/sur"   → captioned "Deconcini Sur" (real DeConcini queue)
  //   - "deconcini/ban-*" → captioned "Bancomer Norte/Sur" (DeConcini queue
  //                          near Bancomer bank — vehicles + sidewalks)
  //   - "deconcini/hot-*" → captioned "Sentri Sur" / "Acceso Sentri Norte"
  //                          (DeConcini SENTRI lane vehicle approach)
  //   - "deconcini/san-*" → captioned "Santander Norte/Sur" (DeConcini area
  //                          near Santander bank — vehicle queue)
  //   - "deconcini/pla-sur" → MISLABELED — captioned "Mariposa Vista Norte"
  //                            (moved to 260402 above)
  //   - "deconcini/pla-nor" → captioned "Miguel Hidalgo Norte" (Nogales city
  //                            street, not border — dropped, not a useful
  //                            wait-time signal)
  //
  // Net: 8 genuine DeConcini-area HLS streams, all VEHICLE QUEUE views.
  // None are dedicated pedestrian-inspection cams — that publisher
  // doesn't exist. Some frames show pedestrians on sidewalks but
  // that's incidental, not a dedicated queue cam.
  //
  // Ordered with the cleanest DeConcini queue views first since
  // pickPrimaryFeed picks index 0 for AI analysis.
  '260401': [
    {
      kind: 'hls',
      src: 'https://cruce.heroicanogales.gob.mx/deconcini/sur/index.m3u8',
      credit: 'Heroica Nogales',
      creditUrl: 'https://heroicanogales.gob.mx/webcams-garitas',
      note: 'DeConcini Sur — fila principal hacia EU',
      label: 'MX · DeConcini Sur',
    },
    {
      kind: 'hls',
      src: 'https://cruce.heroicanogales.gob.mx/deconcini/norte/index.m3u8',
      credit: 'Heroica Nogales',
      creditUrl: 'https://heroicanogales.gob.mx/webcams-garitas',
      note: 'DeConcini Norte — fila principal hacia EU',
      label: 'MX · DeConcini Norte',
    },
    {
      kind: 'hls',
      src: 'https://cruce.heroicanogales.gob.mx/deconcini/ban-nor/index.m3u8',
      credit: 'Heroica Nogales',
      creditUrl: 'https://heroicanogales.gob.mx/webcams-garitas',
      note: 'Bancomer Norte — DeConcini fila + acera con peatones visibles',
      label: 'MX · Bancomer N',
    },
    {
      kind: 'hls',
      src: 'https://cruce.heroicanogales.gob.mx/deconcini/ban-sur/index.m3u8',
      credit: 'Heroica Nogales',
      creditUrl: 'https://heroicanogales.gob.mx/webcams-garitas',
      note: 'Bancomer Sur — DeConcini fila',
      label: 'MX · Bancomer S',
    },
    {
      kind: 'hls',
      src: 'https://cruce.heroicanogales.gob.mx/deconcini/san-nor/index.m3u8',
      credit: 'Heroica Nogales',
      creditUrl: 'https://heroicanogales.gob.mx/webcams-garitas',
      note: 'Santander Norte — DeConcini fila bajo el puente',
      label: 'MX · Santander N',
    },
    {
      kind: 'hls',
      src: 'https://cruce.heroicanogales.gob.mx/deconcini/san-sur/index.m3u8',
      credit: 'Heroica Nogales',
      creditUrl: 'https://heroicanogales.gob.mx/webcams-garitas',
      note: 'Santander Sur — DeConcini área de Pemex',
      label: 'MX · Santander S',
    },
    {
      kind: 'hls',
      src: 'https://cruce.heroicanogales.gob.mx/deconcini/hot-nor/index.m3u8',
      credit: 'Heroica Nogales',
      creditUrl: 'https://heroicanogales.gob.mx/webcams-garitas',
      note: 'Acceso SENTRI Norte — carril de cruzantes confiables',
      label: 'MX · SENTRI N',
    },
    {
      kind: 'hls',
      src: 'https://cruce.heroicanogales.gob.mx/deconcini/hot-sur/index.m3u8',
      credit: 'Heroica Nogales',
      creditUrl: 'https://heroicanogales.gob.mx/webcams-garitas',
      note: 'SENTRI Sur — carril de cruzantes confiables',
      label: 'MX · SENTRI S',
    },
    {
      kind: 'image',
      src: 'https://garitas.elimparcial.com/imgwebcams/garita-deconcini-norte.jpg',
      credit: 'El Imparcial / Heroica Nogales',
      creditUrl: 'https://heroicanogales.gob.mx/webcams-garitas',
      note: 'DeConcini norte (snapshot estático)',
      label: 'MX · Snap N',
    },
    {
      kind: 'image',
      src: 'https://garitas.elimparcial.com/imgwebcams/garita-deconcini-sur.jpg',
      credit: 'El Imparcial / Heroica Nogales',
      creditUrl: 'https://heroicanogales.gob.mx/webcams-garitas',
      note: 'DeConcini sur (snapshot estático)',
      label: 'MX · Snap S',
    },
  ],

  // ─── Texas Coahuila — Eagle Pass / Piedras Negras ───────────────
  // Pass-6 discovery 2026-04-28: City of Eagle Pass publishes ipcamlive
  // feeds (same publisher as our Brownsville/Matamoros cams). Bridge I
  // page exposes 2 working aliases, Bridge II page exposes 4 aliases of
  // which 3 return live snapshots (the 4th polls without a snapshot →
  // skipped as offline). Verified via DevTools network capture.
  // Source: https://www.eaglepasstx.gov/310/ + /335/

  '230301': [
    {
      kind: 'iframe',
      src: 'https://www.ipcamlive.com/player/player.php?alias=bridge1trafficplaza&autoplay=1',
      credit: 'City of Eagle Pass',
      creditUrl: 'https://www.eaglepasstx.gov/310/International-Bridge-I-Cameras',
      note: 'Bridge I (Puente Viejo) — plaza de tráfico',
      label: 'US · Plaza',
    },
    {
      kind: 'iframe',
      src: 'https://www.ipcamlive.com/player/player.php?alias=bridge1platform&autoplay=1',
      credit: 'City of Eagle Pass',
      creditUrl: 'https://www.eaglepasstx.gov/310/International-Bridge-I-Cameras',
      note: 'Bridge I (Puente Viejo) — plataforma del puente',
      label: 'US · Puente',
    },
  ],

  '230302': [
    {
      kind: 'iframe',
      src: 'https://www.ipcamlive.com/player/player.php?alias=67231a475ead1&autoplay=1',
      credit: 'City of Eagle Pass',
      creditUrl: 'https://www.eaglepasstx.gov/335/International-Bridge-2-Cameras',
      note: 'Bridge II (Camino Real) — ángulo 1 en vivo',
      label: 'US · Ángulo 1',
    },
    {
      kind: 'iframe',
      src: 'https://www.ipcamlive.com/player/player.php?alias=639ba5d96b3f6&autoplay=1',
      credit: 'City of Eagle Pass',
      creditUrl: 'https://www.eaglepasstx.gov/335/International-Bridge-2-Cameras',
      note: 'Bridge II (Camino Real) — ángulo 2 en vivo',
      label: 'US · Ángulo 2',
    },
    {
      kind: 'iframe',
      src: 'https://www.ipcamlive.com/player/player.php?alias=68f3f8b846277&autoplay=1',
      credit: 'City of Eagle Pass',
      creditUrl: 'https://www.eaglepasstx.gov/335/International-Bridge-2-Cameras',
      note: 'Bridge II (Camino Real) — ángulo 3 en vivo',
      label: 'US · Ángulo 3',
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

  // Pass-4 upgrade 2026-04-17: ipcamlive exposes a live player iframe
  // (same embed comtodo.com uses). Swapping snapshot → iframe gives
  // true live video instead of a JPEG refreshing every 10s.
  '535501': [
    {
      kind: 'iframe',
      src: 'https://www.ipcamlive.com/player/player.php?alias=5df59f3827371&autoplay=1',
      credit: 'Comtodo',
      creditUrl: 'https://comtodo.com/camaras/',
      note: 'Puente Viejo (B&M) — en vivo desde Matamoros',
      label: 'MX · Vivo',
    },
  ],

  '535504': [
    {
      kind: 'iframe',
      src: 'https://www.ipcamlive.com/player/player.php?alias=61af904e45b24&autoplay=1',
      credit: 'Comtodo',
      creditUrl: 'https://comtodo.com/camaras/',
      note: 'Puente Nuevo / Gateway International — en vivo desde Matamoros',
      label: 'MX · Vivo',
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

  // Pass-5 2026-04-26: City of El Paso renamed all zoocam stream paths.
  // Old `/memfs/15-bota-hq.m3u8` etc. now 404. New paths discovered from
  // the canonical cameras.html. BOTA is no longer published — only PDN /
  // Stanton / Santa Fe / Zaragoza remain.

  '240202': [
    {
      kind: 'hls',
      src: 'https://zoocams.elpasozoo.org/bridgepdn1.m3u8',
      credit: 'City of El Paso',
      creditUrl: 'https://www2.elpasotexas.gov/misc/externally_linked/bridges/cameras.html',
      note: 'Paso del Norte — bridge view (live)',
      label: 'US · PDN',
    },
    {
      kind: 'hls',
      src: 'https://zoocams.elpasozoo.org/bridgesantafe3.m3u8',
      credit: 'City of El Paso',
      creditUrl: 'https://www2.elpasotexas.gov/misc/externally_linked/bridges/cameras.html',
      note: 'Santa Fe (PdN) — ángulo 3 en vivo',
      label: 'US · Santa Fe 3',
    },
    {
      kind: 'hls',
      src: 'https://zoocams.elpasozoo.org/bridgesantafe4.m3u8',
      credit: 'City of El Paso',
      creditUrl: 'https://www2.elpasotexas.gov/misc/externally_linked/bridges/cameras.html',
      note: 'Santa Fe (PdN) — ángulo 4 en vivo',
      label: 'US · Santa Fe 4',
    },
    // Pass-6 add 2026-04-28: Mexican-side feeds via Fideicomiso de Puentes
    // Fronterizos de Chihuahua (camstreamer wrapper around YouTube live).
    {
      kind: 'iframe',
      src: 'https://camstreamer.com/embed/tRbi7yHcfP1Q0MHaZwXCfd3ymXHZV8QYuulTvofn',
      credit: 'Fideicomiso de Puentes Fronterizos de Chihuahua',
      creditUrl: 'https://www.puentesfronterizos.gob.mx/camaras-en-vivo.php',
      note: 'Paso del Norte — vista de norte a sur (lado MX)',
      label: 'MX · N→S',
    },
    {
      kind: 'iframe',
      src: 'https://camstreamer.com/embed/RmKKjLTyispBGGbIfFYnNMasTH45jhRs2Wo9Z1nZ',
      credit: 'Fideicomiso de Puentes Fronterizos de Chihuahua',
      creditUrl: 'https://www.puentesfronterizos.gob.mx/camaras-en-vivo.php',
      note: 'Paso del Norte — vista de sur a norte (lado MX)',
      label: 'MX · S→N',
    },
  ],

  '240203': [
    {
      kind: 'hls',
      src: 'https://zoocams.elpasozoo.org/BridgeZaragoza1.m3u8',
      credit: 'City of El Paso',
      creditUrl: 'https://www2.elpasotexas.gov/misc/externally_linked/bridges/cameras.html',
      note: 'Ysleta / Zaragoza — ángulo 1 en vivo',
      label: 'US · Ángulo 1',
    },
    {
      kind: 'hls',
      src: 'https://zoocams.elpasozoo.org/BridgeZaragoza2.m3u8',
      credit: 'City of El Paso',
      creditUrl: 'https://www2.elpasotexas.gov/misc/externally_linked/bridges/cameras.html',
      note: 'Ysleta / Zaragoza — ángulo 2 en vivo',
      label: 'US · Ángulo 2',
    },
    {
      kind: 'hls',
      src: 'https://zoocams.elpasozoo.org/BridgeZaragoza3.m3u8',
      credit: 'City of El Paso',
      creditUrl: 'https://www2.elpasotexas.gov/misc/externally_linked/bridges/cameras.html',
      note: 'Ysleta / Zaragoza — ángulo 3 en vivo',
      label: 'US · Ángulo 3',
    },
    // Pass-6 add 2026-04-28: 6 Mexican-side angles from Fideicomiso de
    // Puentes Fronterizos de Chihuahua (camstreamer/YouTube wrapper).
    {
      kind: 'iframe',
      src: 'https://camstreamer.com/embed/HlfBjAnK17GcfIvm0PzDLDuTLFYdtOtruMOIZeQy',
      credit: 'Fideicomiso de Puentes Fronterizos de Chihuahua',
      creditUrl: 'https://www.puentesfronterizos.gob.mx/camaras-en-vivo.php',
      note: 'Zaragoza-Ysleta — vista de norte a sur (lado MX)',
      label: 'MX · N→S',
    },
    {
      kind: 'iframe',
      src: 'https://camstreamer.com/embed/B3cMCOh60f8wcGEGwRhe3WTc8kFqthAFvUUdxGtE',
      credit: 'Fideicomiso de Puentes Fronterizos de Chihuahua',
      creditUrl: 'https://www.puentesfronterizos.gob.mx/camaras-en-vivo.php',
      note: 'Zaragoza-Ysleta — vista de sur a norte (lado MX)',
      label: 'MX · S→N',
    },
    {
      kind: 'iframe',
      src: 'https://camstreamer.com/embed/eh5RXRRWvauzFlsuIUWWDO9Dzg4aXy2kN3drkGHF',
      credit: 'Fideicomiso de Puentes Fronterizos de Chihuahua',
      creditUrl: 'https://www.puentesfronterizos.gob.mx/camaras-en-vivo.php',
      note: 'Zaragoza-Ysleta — vista a Av. Waterfill (lado MX)',
      label: 'MX · Waterfill',
    },
    {
      kind: 'iframe',
      src: 'https://camstreamer.com/embed/B372xW1vsMl8D4ncXbkr0Skqs1iABInJ9iUFUJi8',
      credit: 'Fideicomiso de Puentes Fronterizos de Chihuahua',
      creditUrl: 'https://www.puentesfronterizos.gob.mx/camaras-en-vivo.php',
      note: 'Puente Internacional Zaragoza — Av. Waterfill (lado MX)',
      label: 'MX · Waterfill 2',
    },
    {
      kind: 'iframe',
      src: 'https://camstreamer.com/embed/VGvwCDk2Q3llvv72dI1eSvdoBOiZZ7jnQgV1zvN7',
      credit: 'Fideicomiso de Puentes Fronterizos de Chihuahua',
      creditUrl: 'https://www.puentesfronterizos.gob.mx/camaras-en-vivo.php',
      note: 'Zaragoza Carga — vista de sur a norte (lado MX, comercial)',
      label: 'MX · Carga S→N',
    },
    {
      kind: 'iframe',
      src: 'https://camstreamer.com/embed/xJBZVxgjwn8N8ix09zaRnP4B8ZnT3nyapF52p38B',
      credit: 'Fideicomiso de Puentes Fronterizos de Chihuahua',
      creditUrl: 'https://www.puentesfronterizos.gob.mx/camaras-en-vivo.php',
      note: 'Zaragoza Carga — vista de norte a sur (lado MX, comercial)',
      label: 'MX · Carga N→S',
    },
  ],

  // Pass-6 add 2026-04-28: Stanton DCL gained 2 working US-side HLS angles
  // (Stanton1, Stanton2 — published on puentesfronterizos.gob.mx) plus 3 MX
  // CamStreamer angles. Stanton1/2 ORB-block on first cross-origin load but
  // serve 206 partial content on retry; hls.js handles this transparently.
  '240204': [
    {
      kind: 'hls',
      src: 'https://zoocams.elpasozoo.org/BridgeStanton1.m3u8',
      credit: 'City of El Paso',
      creditUrl: 'https://www2.elpasotexas.gov/misc/externally_linked/bridges/cameras.html',
      note: 'Stanton DCL / Lerdo — ángulo 1 en vivo',
      label: 'US · Ángulo 1',
    },
    {
      kind: 'hls',
      src: 'https://zoocams.elpasozoo.org/BridgeStanton2.m3u8',
      credit: 'City of El Paso',
      creditUrl: 'https://www2.elpasotexas.gov/misc/externally_linked/bridges/cameras.html',
      note: 'Stanton DCL / Lerdo — ángulo 2 en vivo',
      label: 'US · Ángulo 2',
    },
    {
      kind: 'hls',
      src: 'https://zoocams.elpasozoo.org/BridgeStanton3.m3u8',
      credit: 'City of El Paso',
      creditUrl: 'https://www2.elpasotexas.gov/misc/externally_linked/bridges/cameras.html',
      note: 'Stanton DCL / Lerdo — ángulo 3 en vivo',
      label: 'US · Ángulo 3',
    },
    {
      kind: 'iframe',
      src: 'https://camstreamer.com/embed/iEKDRVOUybuFhtdKJKdRlaILyhMCSyrkEc8b0WgB',
      credit: 'Fideicomiso de Puentes Fronterizos de Chihuahua',
      creditUrl: 'https://www.puentesfronterizos.gob.mx/camaras-en-vivo.php',
      note: 'Lerdo Línea Exprés — vista de norte a sur (lado MX)',
      label: 'MX · N→S',
    },
    {
      kind: 'iframe',
      src: 'https://camstreamer.com/embed/iEHyfOkiGPdnvCO4RYCLZTiFJGGk8InzjI3bXEx4',
      credit: 'Fideicomiso de Puentes Fronterizos de Chihuahua',
      creditUrl: 'https://www.puentesfronterizos.gob.mx/camaras-en-vivo.php',
      note: 'Lerdo Línea Exprés — vista de sur a norte (lado MX)',
      label: 'MX · S→N',
    },
    {
      kind: 'iframe',
      src: 'https://camstreamer.com/embed/ozH8YEP3bIkP22lBFoUUdGgB0sEJ1FNppmmw8wJ4',
      credit: 'Fideicomiso de Puentes Fronterizos de Chihuahua',
      creditUrl: 'https://www.puentesfronterizos.gob.mx/camaras-en-vivo.php',
      note: 'Lerdo Línea Exprés — vista a Malecón (lado MX)',
      label: 'MX · Malecón',
    },
  ],

  // ─── Texas El Paso — BOTA / Córdova-Américas (NEW PORT) ─────────
  // Pass-6 add 2026-04-28: 3 YouTube live streams of the Mexican side
  // republished by puentesfronterizos.gob.mx. NOTE: video IDs may rotate
  // — re-discover via the source page if any 404. Per the source: this
  // bridge "no es administrado por el Fideicomiso" so feeds may be less
  // stable than PDN/Lerdo/Zaragoza.
  '240201': [
    {
      kind: 'youtube',
      src: 'mp3RS0y77tY',
      credit: 'Fideicomiso de Puentes Fronterizos de Chihuahua',
      creditUrl: 'https://www.puentesfronterizos.gob.mx/camaras-en-vivo.php',
      note: 'Córdova-Américas (BOTA) — lado norte (lado MX)',
      label: 'MX · Norte',
    },
    {
      kind: 'youtube',
      src: 'CZM5TpXLzE8',
      credit: 'Fideicomiso de Puentes Fronterizos de Chihuahua',
      creditUrl: 'https://www.puentesfronterizos.gob.mx/camaras-en-vivo.php',
      note: 'Córdova-Américas (BOTA) — lado sur (lado MX)',
      label: 'MX · Sur',
    },
    {
      kind: 'youtube',
      src: 'Y3OESQEXBlI',
      credit: 'Fideicomiso de Puentes Fronterizos de Chihuahua',
      creditUrl: 'https://www.puentesfronterizos.gob.mx/camaras-en-vivo.php',
      note: 'Córdova-Américas (BOTA) — vista Av. Rafael (lado MX)',
      label: 'MX · Av. Rafael',
    },
  ],

  // ─── Texas Tornillo — Marcelino Serna (NEW PORT) ────────────────
  // Pass-6 add 2026-04-28: 2 MX-side CamStreamer/YouTube angles via
  // puentesfronterizos.gob.mx. No US-side cam known yet.
  '240401': [
    {
      kind: 'iframe',
      src: 'https://camstreamer.com/embed/pgoN0P9OWpB4C7mWffML3EraMCfHKjDnRGwjQO0p',
      credit: 'Fideicomiso de Puentes Fronterizos de Chihuahua',
      creditUrl: 'https://www.puentesfronterizos.gob.mx/camaras-en-vivo.php',
      note: 'Guadalupe-Tornillo (Marcelino Serna) — vista de norte a sur (lado MX)',
      label: 'MX · N→S',
    },
    {
      kind: 'iframe',
      src: 'https://camstreamer.com/embed/uixDU3cVNl3OkKDDdEqOIkoiuBMeD2mSznGq0wUu',
      credit: 'Fideicomiso de Puentes Fronterizos de Chihuahua',
      creditUrl: 'https://www.puentesfronterizos.gob.mx/camaras-en-vivo.php',
      note: 'Guadalupe-Tornillo (Marcelino Serna) — vista de sur a norte (lado MX)',
      label: 'MX · S→N',
    },
  ],

  // ─── Texas Del Rio — Cd Acuña ↔ Del Rio (NEW PORT) ──────────────
  // Pass-6 add 2026-04-28: City of Del Rio publishes 2 ipcamlive feeds
  // (same publisher pattern as Eagle Pass + Brownsville) plus a YouTube
  // live embed of the bridge livestream. Source:
  // https://www.cityofdelrio.com/government/departments/international-bridge
  '230201': [
    {
      kind: 'iframe',
      src: 'https://www.ipcamlive.com/player/player.php?alias=5da4899f1d893&autoplay=1',
      credit: 'City of Del Rio',
      creditUrl: 'https://www.cityofdelrio.com/government/departments/international-bridge',
      note: 'Del Rio International Bridge — ángulo 1 en vivo',
      label: 'US · Ángulo 1',
    },
    {
      kind: 'iframe',
      src: 'https://www.ipcamlive.com/player/player.php?alias=5dd41e07c9949&autoplay=1',
      credit: 'City of Del Rio',
      creditUrl: 'https://www.cityofdelrio.com/government/departments/international-bridge',
      note: 'Del Rio International Bridge — ángulo 2 en vivo',
      label: 'US · Ángulo 2',
    },
    {
      kind: 'youtube',
      src: 'lLXXxbzjdx8',
      credit: 'City of Del Rio',
      creditUrl: 'https://www.cityofdelrio.com/government/departments/international-bridge',
      note: 'Bridge Livestream — feed embedded by City of Del Rio',
      label: 'US · Livestream',
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

// Live video (HLS, YouTube live, or embedded live-stream iframe) is Pro-gated.
// Snapshot JPEGs (`kind: 'image'`) stay free as an acquisition surface.
// Locked 2026-04-17 per Diego's F)b pick.
export function isProFeed(feed: CameraFeed): boolean {
  return feed.kind === 'hls' || feed.kind === 'youtube' || feed.kind === 'iframe'
}

// Returns true if a port has at least one free (snapshot) feed — used to
// decide whether the default tab for a free user should jump to the first
// snapshot angle instead of a locked tab.
export function hasFreeFeed(portId: string): boolean {
  return (BRIDGE_CAMERAS[portId] ?? []).some((f) => !isProFeed(f))
}

// Returns true if the port offers at least one Pro-tier live video feed.
// Powers the "🔒 Pro live cam" chip on home / mapa / camaras tiles for
// free users so they see what they unlock by installing.
export function hasProLiveCamera(portId: string): boolean {
  return (BRIDGE_CAMERAS[portId] ?? []).some(isProFeed)
}
