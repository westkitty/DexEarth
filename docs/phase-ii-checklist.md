# Phase II: Zero-Cost Intelligence Suite — Checklist

Generated: 2026-02-25

## Feature Status

| Feature | Module | Status | Notes |
|---------|--------|--------|-------|
| A) Time Controller | `src/state/timeController.js` | ✅ Complete | LIVE/MANUAL/REPLAY modes |
| A) Solar Terminator | `src/utils/terminator.js` + panel | ✅ Complete | Stable great-circle math, no external libs |
| A) Sunlight Shading | TimeControllerPanel.jsx | ✅ Complete | `globe.enableLighting` toggle |
| B) Satellites Layer | `src/layers/satellites/` | ✅ Complete | LEO/MEO/GEO classification, bundled TLE |
| B) Bundled TLE data | `public/data/tle/starter.tle` | ✅ Complete | 26 representative satellites |
| B) Satellite caching | `src/storage/cache.js` + IndexedDB | ✅ Complete | 12h TTL, Last fetch, Expires UI |
| B) Ground tracks | `render.js` | ✅ Complete | 90min, up to 30 tracks, 45 samples |
| B) Name filter / search | SatellitesPanel.jsx | ✅ Complete | Real-time substring filter |
| C) Seismic Simulation | `src/layers/seismicSim/layer.js` | ✅ Complete | Deterministic P/S rings |
| C) Time scrub compatibility | layer.js tick() | ✅ Complete | Radius computed from elapsed seconds |
| C) Presets | `PRESETS` export | ✅ Complete | Japan, Chile, Alaska, Random |
| D) Cascade Simulator | `src/layers/cascade/` | ✅ Complete | 3 event types, degradation profiles |
| D) Explain panel | CascadePanel.jsx | ✅ Complete | Causal chain display |
| D) Reversible | model.reset() | ✅ Complete | Immediate reset |
| E) Correlation Engine | `src/layers/correlation/tool.js` | ✅ Complete | p2p, p2l, l2l operations |
| E) Geometry snapshot | Per-layer `getGeometrySnapshot()` | ✅ Complete | Satellites, seismic, markers, alerts |
| E) Globe highlight | Cesium entity overlay | ✅ Complete | Up to 200 highlights rendered |
| E) Export JSON | CorrelationPanel.jsx | ✅ Complete | Browser download |
| F) Threat Index | `src/layers/threatIndex/layer.js` | ✅ Complete | 2° grid, 4 source types |
| F) Heat overlay | Cesium RectangleGeometry | ✅ Complete | Capped to 800 cells for perf |
| F) Presets | PRESET_WEIGHTS | ✅ Complete | Wildfire, Geopolitical, Seismic |
| G) Geofence Alerts | `src/layers/alerts/layer.js` | ✅ Complete | Circle + polygon |
| G) Click-to-draw polygon | ScreenSpaceEventHandler | ✅ Complete | Globe click adds vertices |
| G) Alert log | IndexedDB alertLog store | ✅ Complete | Persisted, export JSON |
| H) Markers | `src/layers/markers/layer.js` | ✅ Complete | IndexedDB persisted |
| H) Jump to marker | `viewer.camera.flyTo()` | ✅ Complete | 2s animation |
| I) Cinematic Mode | `src/layers/cinematic/controller.js` | ✅ Complete | 4 tours |
| I) Camera save/restore | controller.js | ✅ Complete | Restores on exit |
| J) Performance HUD | `src/layers/performance/hud.js` | ✅ Complete | RAF-based FPS |
| J) Safe Mode auto-trigger | hud.js | ✅ Complete | Threshold on consecutive low-FPS windows |
| K) Event Pulse Engine | `src/utils/pulse.js` | ✅ Complete | CSS animation overlays |
| L) BroadcastChannel Sync | `src/state/broadcastSync.js` | ✅ Complete | Leader/follower, same-device |
| Tests: terminator math | `__tests__/terminator.test.js` | ✅ Complete | 7 assertions |
| Tests: time controller | `__tests__/timeController.test.js` | ✅ Complete | 8 assertions |
| Tests: geo utils | `__tests__/geo.test.js` | ✅ Complete | 12 assertions |
| Tests: cache TTL | `__tests__/cache.test.js` | ✅ Complete | 7 assertions |
| Demo Mode | PhaseIIRoot.jsx `runDemoMode()` | ✅ Complete | Seeds markers + seismic + cinematic |

## Known Limitations

| Limitation | Impact | Workaround |
|------------|--------|------------|
| Satellite TLE age | Points may drift if bundled TLE > 2 weeks old | Use "Refresh" in Satellites panel to fetch current TLE via `/proxy/tle` |
| CORS on remote TLE | Some TLE mirrors block browsers | All requests go through Vite proxy server; no direct browser fetches |
| Threat Index heat grid | Recomputed only on explicit user trigger | Click ↺ Recompute when layers change |
| Alerts tick rate | Geofence check runs ~3Hz via seismic tick | Rate-limited to 1 alert per geofence-target per minute |
| Ground tracks perf | Building 30×45-sample tracks is O(n) satellite.js calls | Cap defaults: 30 tracks × 45 samples. Reduce in Safe Mode |
| BroadcastChannel scope | Multi-tab sync only works on same device, same browser | By design — no server required |
| Terminator in LIVE mode | Updates every tick (~3Hz) | Throttled via the TimeController subscriber debounce |

## Zero-Cost Summary

All Phase II features operate with:
- **No API keys**
- **No payment or billing accounts**
- **No logins**
- **No paid services**

Data sources used:
| Source | URL | Proxy | Bundled Fallback |
|--------|-----|-------|-----------------|
| TLE orbits | celestrak.org | `/proxy/tle` | `public/data/tle/starter.tle` |
| Air radar | airplanes.live | `/proxy/flights` (existing) | — (graceful error) |
| Seismic | earthquake.usgs.gov | none (public CORS) | — |
| Cables | submarinecablemap.com | `/proxy/cables` (existing) | — |
| Tectonic plates | raw.githubusercontent.com | `/proxy/coastlines` | — |
