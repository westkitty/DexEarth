# Architecture

## Overview

DexEarth is a single-page React app. The globe is rendered by CesiumJS into a fixed `<div>`. A HUD sidebar floats over it in CSS. There is no backend — all data comes from third-party APIs, with CORS issues solved by Vite dev-server proxies.

## File Map

```
src/
  App.jsx         Cesium singleton init, activate/deactivate dispatch, React HUD
  utils.js        Pure helpers: parseTLEs, fetchWithRetry — no Cesium, fully testable
  config.js       Static data: LAYER_DEFS, SHIPPING_ROUTES — no external deps
  index.css       Global styles, HUD, toggle pills, VFX overlays
  main.jsx        React root mount (no StrictMode — prevents double Cesium init)
  __tests__/      Vitest unit tests for utils.js and config.js

vite.config.js    Dev proxy config + custom airplanes.live aggregator middleware
index.html        Shell HTML, JetBrains Mono font, title
```

## Cesium Initialization

The viewer is created once in a `useEffect([], [])` with a `viewerRef.current` guard to prevent double-init during React HMR. Key settings:

- `baseLayer: false` — prevents default Cesium Ion imagery
- `UrlTemplateImageryProvider` — ESRI World Imagery tiles, synchronous constructor (required because Cesium 1.104+ made `ArcGisMapServerImageryProvider` async-only)
- `skyAtmosphere: false` — no blue haze; default `skyBox` left enabled for starfield
- Bloom post-processing enabled for glowing neon line effect

## Layer System

Each layer has a symmetric activate/deactivate pair in `App.jsx`:

- **Activate** — creates Cesium primitives, fetches data, stores refs in `layerDataRef` (a `useRef`, never triggers re-render), starts refresh interval if needed, calls `setLayerStatus` / `setTelemetry` to update HUD
- **Deactivate** — clears interval, removes primitives from `viewer.scene.primitives`, nulls refs

React state (`toggles`, `telemetry`, `layerStatus`) is UI-only. Cesium primitives live in `layerDataRef` and are never touched by React rendering.

## Depth / Shadow System

Polyline layers (cables, tectonic, maritime, seismic) render two `PolylineCollection` primitives:

1. **Shadow** at 600–1000 m — dark (black, alpha 0.15–0.18), wider, flat `Color` material
2. **Main line** at 12,000–20,000 m — neon colored, `PolylineGlow` material

The vertical separation creates visible 3D parallax when the globe is tilted.

## CORS Proxy Strategy

Several upstream APIs don't send `Access-Control-Allow-Origin: *`:

| Endpoint            | Strategy                                                                                     |
| ------------------- | -------------------------------------------------------------------------------------------- |
| `/proxy/flights`    | Custom Vite middleware: 4 parallel airplanes.live regional queries, deduplicated by ICAO hex |
| `/proxy/cables`     | Vite proxy → `www.submarinecablemap.com/api/v3/cable/cable-geo.json`                         |
| `/proxy/coastlines` | Vite proxy → GitHub raw (Natural Earth 110m GeoJSON)                                         |
| `/proxy/tle`        | Vite proxy → CelesTrak NORAD TLE endpoint                                                    |

All proxies run in the Vite dev server process. They are **not available in the production build** (`npm run build`). For production deployment, replace them with Cloudflare Workers, Netlify Functions, or an Express server.

## Cloud System

`CLOUD_SYSTEMS` uses Cesium's native `CloudCollection` API (added in Cesium 1.94). Each `CumulusCloud` has a `maximumSize.z` depth axis, giving it true 3D volume visible when the camera is tilted. ~450 clouds are procedurally distributed across 7 latitude bands modeled on real atmospheric circulation.

## Production Deployment Gap

The current architecture is dev-only. To host publicly:

1. Replace all `/proxy/*` routes with equivalent server-side endpoints (Workers, Lambda, Express)
2. Set `VITE_FIRMS_MAP_KEY` in the build environment
3. Add rate limiting and CORS headers on your proxy layer
