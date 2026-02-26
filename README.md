# DexEarth

![License](https://img.shields.io/badge/License-Unlicense-blue.svg)
![Platform](https://img.shields.io/badge/Platform-Web%20%7C%20Tailscale-lightgrey.svg)
![Stack](https://img.shields.io/badge/Stack-React%20%2B%20CesiumJS-61dafb.svg)
[![CI](https://github.com/westkitty/DexEarth/actions/workflows/ci.yml/badge.svg)](https://github.com/westkitty/DexEarth/actions/workflows/ci.yml)

A tactical geospatial surveillance dashboard running in the browser. Real-time globe with 10 toggleable data layers: live flights, satellites, earthquakes, wildfires, shipping lanes, undersea cables, tectonic plates, 3D clouds, solar terminator, and visual FX. Built on CesiumJS + React 19, designed for Tailscale mesh access from any device on your network.

## Key Features

- **10 live data layers** — independently toggleable, each with status dot and telemetry counter
- **Real-time flights** — aggregates 4 regional [airplanes.live](https://airplanes.live) endpoints into ~5,000+ global aircraft, no API key required
- **Orbital propagation** — satellite.js computes real-time positions from CelesTrak TLEs
- **3D clouds** — Cesium `CloudCollection` with ~450 procedural volumetric cloud sprites distributed across realistic atmospheric bands (ITCZ, storm tracks, polar fronts)
- **Depth system** — polyline layers use dual-collection rendering: dark shadow trace at surface + raised glowing line above, creating visible parallax when tilting the globe
- **Google Earth imagery** — ESRI World Imagery via `UrlTemplateImageryProvider`, no API key
- **Always-on coastlines** — faint tactical green overlay at startup, independent of layer toggles
- **Dark Glass/Cyber HUD** — frosted-glass sidebar, JetBrains Mono, UTC clock, status dots
- **Tailscale-ready** — dev server binds `0.0.0.0:3000`, accessible across your mesh network

## Live Data Sources

| Layer           | Source                               | API Key             |
| --------------- | ------------------------------------ | ------------------- |
| AIR_RADAR       | airplanes.live (4-region aggregator) | None                |
| ORBITAL_MATH    | CelesTrak TLE (GROUP=visual)         | None                |
| SEISMIC_GRID    | USGS Earthquake GeoJSON              | None                |
| THERMAL_FIRES   | NASA FIRMS VIIRS NRT                 | **Required** (free) |
| MARITIME_LANES  | Static embedded waypoints            | None                |
| FIBER_CABLES    | TeleGeography submarine cable map    | None                |
| TECTONIC_PLATES | Fraxen/tectonicplates GeoJSON        | None                |
| CLOUD_SYSTEMS   | Procedural (Cesium CloudCollection)  | None                |
| SOLAR_SYNC      | System clock                         | None                |
| VISUAL_FX       | CSS only                             | None                |

## Installation

**Prerequisites:** Node.js 18+ and npm.

```bash
git clone https://github.com/westkitty/DexEarth.git
cd DexEarth
npm install
npm run dev
```

Open `http://localhost:3000`. Access from Tailscale or LAN via `http://<your-ip>:3000`.

### Build for static hosting

```bash
npm run build
```

> The built app depends on Vite's dev-server proxy for flights, cables, coastlines, and TLEs.
> For production you will need equivalent server-side proxy endpoints.
> See [docs/ARCHITECTURE.md](docs/ARCHITECTURE.md).

## Configuration

### NASA FIRMS key (Thermal Fires layer)

THERMAL_FIRES requires a free NASA FIRMS MAP_KEY. Without it the layer shows `UNAVAILABLE`.

1. Register at <https://firms.modaps.eosdis.nasa.gov/api/map_key/>
2. Copy `.env.example` to `.env` and fill in your key:

```bash
cp .env.example .env
```

1. Verify your environment:

```bash
bash scripts/verify_env.sh
```

## Troubleshooting

| Symptom                          | Fix                                                                    |
| -------------------------------- | ---------------------------------------------------------------------- |
| Globe is black / rendering error | Hard-refresh (`Cmd+Shift+R`). Cesium can fail on first HMR load.       |
| AIR_RADAR shows 0 / UNAVAILABLE  | The Vite dev server must be running (aggregator proxy is server-side). |
| ORBITAL_MATH shows 0 pts         | CelesTrak can be slow. Toggle off/on after 30 s.                       |
| THERMAL_FIRES UNAVAILABLE        | Set `VITE_FIRMS_MAP_KEY` in `.env`.                                    |
| FIBER_CABLES UNAVAILABLE         | TeleGeography API is down or rate-limited. Try again later.            |
| Blank screen on tablet           | Use Chrome; disable hardware acceleration flags if needed.             |

## Governance

This is free and unencumbered software released into the public domain.

Do with it what you want. Fork it. Break it. Make it worse or better. No permission required.

_Remain ungovernable so Dexter approves._

## Architecture

See [docs/ARCHITECTURE.md](docs/ARCHITECTURE.md). Short version:

- **`src/App.jsx`** — Cesium singleton init, layer activate/deactivate dispatch, React HUD
- **`src/utils.js`** — Pure utilities: TLE parser, fetch-with-retry (no Cesium dep, fully testable)
- **`src/config.js`** — Static data: layer definitions, shipping route waypoints
- **`vite.config.js`** — CORS proxies + custom middleware aggregating airplanes.live into `/proxy/flights`
- **`src/index.css`** — Dark Glass/Cyber theme, HUD sidebar, toggle pills, VFX overlays

## Contributing

Bug reports and PRs welcome. See [CONTRIBUTING.md](CONTRIBUTING.md) for setup and workflow.

## License

Public domain. See [LICENSE](LICENSE).
