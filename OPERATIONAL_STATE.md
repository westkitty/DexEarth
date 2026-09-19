# DexEarth operational state

Updated: 2026-09-19 (UTC).

## Identity and baseline

- Project: `westkitty/DexEarth`, React 19 + CesiumJS + satellite.js.
- Checkout: `/home/user/DexEarth`; starting commit `058c73a`.
- Implementation/delivery branch: `arena/01a0b75b-dexearth` (session-fixed; not master).
- Configured origin: `https://github.com/westkitty/DexEarth.git`, same canonical
  repository as the requested SSH URL.
- Reversible local checkpoint tag: `checkpoint-orbital-058c73a`.
- Initial worktree was clean; the Mac-local `.env` and wrapper files described in
  the request were not present in this checkout. None was read, staged or replaced.
- No root operational-state document existed; this file is new.

## Active invariants

Cesium remains rendering authority, satellite.js remains the propagation engine,
all ten primary layer IDs and existing Phase II/III systems are retained. No
login, tracking, paid API, new mandatory remote service or API key requirement.
FIRMS remains optional. IndexedDB and same-device BroadcastChannel remain local.
Source errors and bundled fallbacks never become fresh telemetry.

The original source had one lint error and 85 formatting failures. The unused
border color variable was corrected and baseline source/docs were mechanically
formatted so the existing format gate can run; upstream cartographic data and
local wrapper/private paths are excluded from formatting.

## Implemented capability

- Shared orbital layer replaces duplicate independent satellite pipelines;
  idempotent activation, generation-safe load completion, disposable listeners,
  single-flight TLE retrieval and twice-per-second point updates.
- Derived inspector, selection/search/shell/altitude/inclination/watch filters,
  selected past/future paths and surface track, deterministic observer passes.
- Local watchlist with nicknames and stored elements; newer epochs replace older
  ones. Watchlisted elements are favored over older loaded starter data.
- Versioned observations with validated JSON import/export, local CRUD and
  view/configuration restoration. Dataset provenance is not overwritten.
- Durable bounded local replay with key-state ordering, pause/scrub/step/speed,
  export/import and explicit historical-remote-data limitations.
- Chronological categorized event timeline; simulations are not remote observations.
- Existing dormant Tools panels are reachable again. Shared orbital geometry is
  connected to performance estimates, cascade degradation and geofence checks.
- Touch-safe controls, bounded drawers, mobile panel menu, collapsible timeline,
  safe-area insets and no required hover controls for the new workflow.

## Truth, formats, bounds

- Catalog: `LIVE/FRESH`, `CACHED`, `BUNDLED FALLBACK`, `STALE`, `UNAVAILABLE`,
  `OPTIONAL KEY MISSING`. Fresh means transport TTL, not guaranteed element age
  or complete global observation. Inspector separately flags old TLE epochs.
- Observation: `DexEarth.Observation`, version 1; ≤100 sets, import ≤8 MiB.
  Captures camera, primary toggles, time, satellite/configuration, watch subset,
  marker snapshot, overlay visibility/style, local simulations/cascades and
  provenance references. Restored markers are temporary and do not overwrite
  stored markers. Geofences remain in their persistent store, not rewound.
- Replay: `DexEarth.Replay`, version 1; ≤30 minutes, 600 events, 8 MiB/session,
  20 saved sessions. Local key states, not frame-accurate gesture animation.
  `externalData: references-only`: no historical remote snapshots retained.
  Dynamic aircraft/USGS/FIRMS layers are hidden in replay; orbital calculations
  use available current/watchlisted TLEs. A visible warning states the limitation.
- IndexedDB schema 3; remote-cache records version 2; ≤24 records / 32 MiB payloads.
  Last-use eviction with soft retention preferences. Pins do not defeat expiry.
  User stores and legacy saved views are separate from remote cache clearing.
- Offline: bundled Natural Earth II globe, country/state borders and unverified
  historical starter TLE. Static production shell (~35 MiB) is precached by a
  versioned asset-only worker after Cesium copying. No API responses/keys cached
  by the worker. First-ever offline visits still need app installation/local files.
- Safe Mode: 80 satellite points, selected/watchlisted priority; selected past
  path ≤31 samples; unnecessary future/ground paths suspended. No FPS promise.

## Validation evidence

- Unit fixtures test orbital classification/propagation/pass/path/dateline/stale
  behavior; cache states/expiry/bounds and v2→v3 IndexedDB preservation; observation
  validation and camera/layer/clock restoration without freshness mutation; replay
  order/pause/step/scrub/bounds/limitations; drawer/selection/unsubscribe behavior.
- Browser-emulated Chromium 153, software rendering: bundled online startup,
  selection/inspector, pass prediction, watchlist persistence, observation
  save/duplicate/load/export/import, replay record/play/pause/reset/step/export/import,
  full production reload with browser networking disabled, Safe Mode control.
- Browser-emulated layouts: 390×844, 768×1024, 1024×1366, 1440×1000. Checked bounded
  drawer height, no document horizontal overflow and usable panel controls.
- Browser smoke exposed and fixed offline-manifest/Cesium copy ordering and the
  phone menu inheriting `pointer-events: none`. Successful run had zero page errors.
- Reproducible script: `npm run test:browser` against production preview. Sandbox
  evidence: `/home/user/dexearth-evidence/` (screenshots + JSON report, outside Git).
  Browser CDN installation was blocked; an npm-distributed Chromium binary and
  its packaged libraries enabled validation without adding a production dependency.

Final verification on 2026-09-19:

| Command                                           | Result                                                     |
| ------------------------------------------------- | ---------------------------------------------------------- |
| `npm run lint`                                    | PASS                                                       |
| `npm run format:check`                            | PASS                                                       |
| `npm run test:run`                                | PASS — 104 tests, 15 files (all original 77 preserved)     |
| `npm run build`                                   | PASS — non-failing existing dynamic/static import warnings |
| `npm run ci`                                      | PASS                                                       |
| `npm run test:browser` (configured Chromium path) | PASS — all smoke checks, zero page errors                  |

Delivery verification is reported in the implementation report. See [the detailed guide](docs/orbital-observations-replay.md) for behavior,
units, import validation, limits and instructions.

## Unverified / intentionally limited

- Physical iPad/iPhone/Android hardware, pinch/rotate/tap precision, sustained GPU
  performance, browser quota eviction and mobile multi-tab interactions.
- Real current upstream freshness/availability (CelesTrak, regional aircraft,
  USGS, cables, tectonics, optional FIRMS). Fixture/browser bundle checks are not
  claims of live source freshness. All 20 systems have not been individually
  end-to-end validated against real upstream data.
- No historical remote telemetry reconstruction, precision orbit determination,
  classified metadata inference, optical visibility or terrain-aware pass model.
- Imported observation watchlist subsets cannot materialize absent TLE data.
- Two moderate development-only Vitest/@vitest/mocker audit findings remain;
  compatible dependency updates removed the initial high/critical findings.
  A major Vitest upgrade was not forced. Do not expose the Vitest development
  server to untrusted networks.
