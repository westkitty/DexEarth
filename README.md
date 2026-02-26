# DexEarth

![License](https://img.shields.io/badge/License-Unlicense-blue.svg)
![Platform](https://img.shields.io/badge/Platform-Web%20%7C%20Tailscale-lightgrey.svg)
![Stack](https://img.shields.io/badge/Stack-React%20%2B%20CesiumJS-61dafb.svg)
[![CI](https://github.com/westkitty/DexEarth/actions/workflows/ci.yml/badge.svg)](https://github.com/westkitty/DexEarth/actions/workflows/ci.yml)

A tactical geospatial intelligence dashboard running entirely in the browser. Real-time 3D globe with **20 toggleable data layers** across two phases — live flight radar, satellites, earthquakes, wildfires, seismic simulation, fiber cables, cascade failure modeling, cinematic tours, and more. Zero API keys required for core functionality. Built on CesiumJS + React 19, Vite 7.

---

## Phase I — Live Data Layers

| Layer | Source | API Key |
|-------|--------|---------|
| `AIR_RADAR` | airplanes.live (4-region aggregator) | None |
| `ORBITAL_MATH` | CelesTrak TLE (GROUP=visual) | None |
| `SEISMIC_GRID` | USGS Earthquake GeoJSON | None |
| `THERMAL_FIRES` | NASA FIRMS VIIRS NRT | **Free, required** |
| `MARITIME_LANES` | Static waypoints | None |
| `FIBER_CABLES` | TeleGeography submarine cable map | None |
| `TECTONIC_PLATES` | Fraxen/tectonicplates GeoJSON | None |
| `CLOUD_SYSTEMS` | Procedural (Cesium CloudCollection) | None |
| `SOLAR_SYNC` | System clock | None |
| `VISUAL_FX` | CSS post-processing | None |

---

## Phase II — Zero-Cost Intelligence Suite

All Phase II features operate without API keys, paid services, or logins. Bundled fallback data ensures the app works offline.

### Feature Overview

**⏱ Time Controller**
- LIVE / MANUAL / REPLAY modes with speed multiplier
- Time scrub slider (any historical UTC timestamp)
- Step controls: ±1 min, ±1 hr, ±1 day
- Solar terminator and day/night sunlight toggle driven by the time controller

**🛰 Satellites Layer**
- TLE loading chain: IndexedDB cache → Vite proxy (`/proxy/tle`) → bundled fallback
- 26-satellite bundled dataset for offline use (`public/data/tle/starter.tle`)
- LEO / MEO / GEO orbit classification with color coding (cyan / green / orange)
- Optional 90-minute ground tracks (up to 30 per session)
- Name filter, sat cap slider, refresh button with cache-age display

**⚡ Seismic Simulator**
- Inject seismic events by preset (Japan / Chile / Alaska) or manual lon/lat/mag
- Deterministic P-wave (6 km/s) and S-wave (3.5 km/s) rings — scrub-correct
- PolylineGlow rendering with magnitude-scaled widths and fade-over-time
- Epicenter cross marker; events list with remove

**📍 Markers**
- Globe markers persisted in IndexedDB — survive page refresh
- Severity colors: `info` (green) / `warning` (gold) / `critical` (red) / `classified` (purple)
- Jump-to with 2-second camera flyTo; search/filter bar

**⚠ Alerts & Geofences**
- Circle geofences: enter center + radius
- Polygon geofences: click on globe to draw vertices, finish to save
- Watch layers: any active layer's geometry checked for incursions at ~3 Hz
- Alert log with IndexedDB persistence, JSON export, optional audio alert beep
- Rate-limited: one alert per geofence+target per minute

**⛓ Cascade Simulator**
- Trigger realistic failure events: Cable Sever, Satellite Loss, Regional Disruption
- Propagates degradation parameters to affected layers
- Causal chain panel explains which layers are affected and why
- Fully reversible — Reset All restores all layers immediately

**◈ Correlation Engine**
- Cross-layer proximity matching in 3 modes:
  - **Point→Point**: e.g., satellites near seismic epicenters
  - **Point→Line**: e.g., markers near cable routes
  - **Line→Line**: e.g., shipping lanes near tectonic plates
- Globe highlights for matched pairs (up to 200 rendered)
- JSON export of all correlation hits

**◉ Threat Index**
- Computes a global 2° grid threat score from active layer data
- Sources: thermal fire density, seismic proximity, maritime traffic, tectonic proximity
- 3 weight presets: Wildfire / Geopolitical / Seismic; or manual sliders
- Rendered as color-coded heat rectangles (green → yellow → red)

**🎬 Cinematic Mode**
- 4 predefined camera tours: Global Fiber Backbone, Tectonic Fire Ring, Storm Belts, Orbital Shell
- Keyframe flyTo with configurable speed (0.25×–4×)
- Camera state saved on entry and restored on exit
- Skip forward, pause/resume controls

**📊 Performance HUD**
- Live FPS counter (RAF-based, 1s rolling average)
- Cesium primitive count display
- Safe Mode: auto-triggers at sustained <20 FPS — reduces satellite cap, disables ground tracks
- Manual force-on/off toggle

**🔄 Multi-Tab Sync**
- BroadcastChannel sync across same-device tabs
- Leader broadcasts camera position, time, and layer toggles to followers
- No server required

---

## Installation

**Prerequisites:** Node.js 18+ and npm.

```bash
git clone https://github.com/westkitty/DexEarth.git
cd DexEarth
npm install
npm run dev
```

Open `http://localhost:3000`. Network access via Tailscale or LAN at `http://<your-ip>:3000`.

### Optional: NASA FIRMS key (Thermal Fires layer)

```bash
cp .env.example .env
# Add your free key from https://firms.modaps.eosdis.nasa.gov/api/map_key/
```

---

## Architecture

```
src/
├── App.jsx              # Cesium init, Phase I layers, HUD render, Phase II integration
├── config.js            # Layer defs, shipping routes
├── utils.js             # parseTLEs, fetchWithRetry (Cesium-free, fully tested)
├── state/
│   ├── timeController.js    # LIVE/MANUAL/REPLAY time engine
│   ├── settingsStore.js     # localStorage settings with observable pattern
│   ├── layerRegistry.js     # Phase II layer lifecycle (activate/tick/degrade)
│   └── broadcastSync.js     # BroadcastChannel multi-tab sync
├── storage/
│   ├── db.js                # IndexedDB: cache, markers, geofences, alertLog
│   └── cache.js             # TTL cache helpers
├── utils/
│   ├── terminator.js        # Solar terminator (stable great-circle math, no external libs)
│   ├── geo.js               # Haversine, clustering, geofence checks
│   ├── throttle.js          # throttle/debounce
│   └── pulse.js             # Event Pulse Engine (CSS animation overlays)
├── layers/
│   ├── satellites/          # TLE loading, propagation, ground tracks
│   ├── seismicSim/          # Deterministic P/S-wave rings
│   ├── markers/             # IndexedDB-persisted globe markers
│   ├── alerts/              # Geofences + alert log
│   ├── cascade/             # Failure cascade model
│   ├── correlation/         # Cross-layer proximity matching
│   ├── threatIndex/         # Global heat grid scoring
│   ├── cinematic/           # Camera tour controller
│   └── performance/         # FPS + Safe Mode
└── ui/
    ├── PhaseIIRoot.jsx      # Collapsible Phase II panel container
    └── panels/PhaseII/      # 10 individual feature panels
```

**Dev proxy** (`vite.config.js`): `/proxy/tle`, `/proxy/flights`, `/proxy/cables`, `/proxy/coastlines` — all route through Vite middleware to avoid CORS and aggregate data.

---

## Testing

```bash
npm run test:run    # 59 unit tests — terminator math, geo utils, cache TTL, time controller
npm run lint        # ESLint (0 errors enforced)
```

---

## Troubleshooting

| Symptom | Fix |
|---------|-----|
| Globe is black | Hard-refresh (`Cmd+Shift+R`). Cesium can fail on first HMR load. |
| AIR_RADAR shows 0 | Vite dev server must be running (aggregator proxy is server-side). |
| ORBITAL_MATH shows 0 pts | CelesTrak can be slow. Toggle off/on after 30s. |
| THERMAL_FIRES unavailable | Set `VITE_FIRMS_MAP_KEY` in `.env`. |
| Satellites not loading | Satellites panel → "Refresh" forces a new remote fetch. |
| Low FPS / stuttering | Performance panel → Force Safe Mode on, reduce satellite cap. |
| Blank screen on tablet | Use Chrome; ensure hardware acceleration is on. |

---

## Governance

Public domain. Do with it what you want. Fork it. Break it. Make it worse or better.

_Remain ungovernable so Dexter approves._

## License

Public domain. See [LICENSE](LICENSE).
