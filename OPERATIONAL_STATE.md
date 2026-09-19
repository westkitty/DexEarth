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
- Browser-emulated Chromium 153, software rendering and touch-capable context: bundled online startup,
  selection/inspector, pass prediction, watchlist persistence, observation
  save/duplicate/load/export/import, replay record/play/pause/reset/step/export/import,
  full production reload with browser networking disabled, Safe Mode control. The
  re-audit additionally verifies rename, corrupt-import refusal and confirmed delete.
- Browser-emulated layouts: 390×844, 768×1024, 1024×1366, 1440×1000. Checked bounded
  drawer height, no document horizontal overflow and usable panel controls.
- Browser smoke exposed and fixed offline-manifest/Cesium copy ordering and the
  phone menu inheriting `pointer-events: none`. Successful run had zero page errors.
- Reproducible script: `npm run test:browser` against production preview. Sandbox
  evidence: `/home/user/dexearth-evidence/` (screenshots + JSON report, outside Git).
  Browser CDN installation was blocked; an npm-distributed Chromium binary and
  its packaged libraries enabled validation without adding a production dependency.

Latest complete recheck on 2026-09-19 (published baseline `f6999e0`):

| Command                                                   | Result                                                     |
| --------------------------------------------------------- | ---------------------------------------------------------- |
| `npm run lint`                                            | PASS                                                       |
| `npm run format:check`                                    | PASS                                                       |
| `npm run test:run`                                        | PASS — 161 tests, 20 files (all original 77 preserved)     |
| `npm run build`                                           | PASS — non-failing existing dynamic/static import warnings |
| `npm run ci`                                              | PASS                                                       |
| `npm run test:browser` (configured Chromium path)         | PASS — all smoke checks, zero page errors                  |
| `npm run test:layers` (fresh dev server, remote fixtures) | PASS — zero page/render-stop errors                        |

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

## Second requirement audit

The follow-up user request was audited against every original section (0–16).
See [requirements-verification.md](docs/requirements-verification.md) for the
complete matrix, concrete source/test evidence, fixes and qualified acceptance.

The local checkout's files matched published `56c5dcb` exactly but its restored
Git metadata pointed to the baseline. After comparing all blobs to the remote,
local history/index were aligned without writing working files. Checkpoint
`checkpoint-audit-56c5dcb` precedes this audit's corrections.

Additional defects corrected: zero-offset/monotonic replay recording, same-offset
stepping, reset/step return view, visible marker snapshot preservation, marker
subscription lifecycle, primary-layer analytic geometry/cascade wiring and async
unload guards, actual Time panel effect cleanup, multi-tab role controls, current
Cesium label projection API and shared country/state LOD listener, catalog unknown
and bundled timestamp truth, legacy cache startup eviction, Safe Mode NaN sample
bounds, and coarse-pointer touch target sizes.

Additional verification: `npm run test:layers` against a freshly started development
server with explicitly intercepted remote **fixtures**. Exercised every primary
toggle, actual selected orbit collection cleanup, primary→threat/correlation
geometry, markers/geofences, seismic/cascade categories and reset, cinematic
start/pause, BroadcastChannel delivery, country inside/follow labels and state/
province LOD below 1,500 km, plus application of all five style presets (including
automatic Safe Mode fallbacks). Zero page errors or Cesium render-stop errors.
This does not verify full shader fidelity on a physical GPU or real source freshness.

Second-audit browser evidence is in `/home/user/dexearth-audit-evidence/` outside Git.
The production smoke uses 44px coarse-pointer controls and all four requested
viewports. Software-rendered screenshots needed a longer capture timeout; no FPS
promise is inferred. That audit totaled **114 passing across 17 files**, with the original
77 tests retained. Production and layer browser scripts both pass. Final lint,
format, build and complete CI are rerun before delivery.

## Previous repeated verification (delivered as `10e9615`)

Started clean at published `6d7efad`; local checkpoint
`checkpoint-reverify-6d7efad` preceded edits. Rechecked the original requirement
matrix, runtime restore/cache paths and browser integration. Fixed repeated
explicit replay restoration, validation-before-import mutation, near-limit JSON
export/import consistency, conservative corrupt/future cache timestamp handling,
crash-safe catalog dates and malformed/empty TLE fallbacks. Continuous playback
still reuses unchanged geometry. No protected paths or dependencies changed.

Regression-first run exposed nine failures; the final suite passes **131 tests
in 18 files**, including 17 new cases. Both browser suites were rerun against the
new production build and a freshly restarted dev server. Requested viewport,
fully offline reload, durable records, local workflows and fixture-backed layer
checks all pass; no page errors or detected Cesium render-stop errors. The table
above records the latest command gates, including complete local CI. This does
not imply GitHub-hosted CI ran on the Arena branch.

Previous browser evidence: `/home/user/dexearth-reverification-evidence/` outside
Git; current logs: `/home/user/dexearth-third-*.log`. Built application JS:
437.71 kB / 140.56 kB gzip, excluding Cesium/assets. All hardware, live-source and
optional authenticated FIRMS limitations above still apply. The final report
supplies the commit and independent remote SHA verification on the fixed branch.

## Previous assignment verification (delivered as `f6999e0`)

Starting local/remote commit: `10e9615`; clean initial worktree, checkpoint
`checkpoint-assignment-10e9615`. The original numbered requirements were checked
against implementation and runnable evidence again. Corrected crossed orbital
filter bounds (invalid saved/recorded workspaces), missing pass-peak UTC display,
marker ID aliases that collide in Cesium, and pending marker load/write render
completions that could overwrite restored snapshots or refill unloaded layers.
Viewer replacement now cleans the old marker entities. Persistent writes already
requested are not cancelled; stale completions cannot edit the new snapshot.

Added 15 tests; **146 tests / 20 files pass**. Separately reran all seven original
baseline test files: **77 / 77 pass**. Full local CI passes. Both browser suites
were rerun on the changed code; production smoke now also records crossed filters,
checks downloaded replay bounds, displays peak-pass UTC and rejects colliding
marker imports. Offline reload, all requested viewports, Safe Mode, fixture-backed
layers/analysis/overlays/channels pass with zero page errors. The layer audit also
reports no Cesium render-stop errors. Existing build import warnings are non-fatal.

Current evidence: `/home/user/dexearth-assignment-evidence/`;
logs: `/home/user/dexearth-assignment-*.log` (all outside Git).
Application JS: 438.54 kB / 140.88 kB gzip, excluding Cesium/assets. No dependency
or protected-path changes. Physical hardware, sustained FPS, live-source freshness
and optional authenticated FIRMS remain unverified, not silently marked passed.
The final delivery report gives the new commit and matching remote SHA on
`arena/01a0b75b-dexearth`; master is untouched.

## Latest complete requirement recheck

Remote `f6999e0` was confirmed first. Restored local Git metadata pointed at the
initial baseline, but comparison of all 158 published files found zero content
differences. A checkpoint and mixed reset aligned local metadata without changing
working files, then `checkpoint-final-audit-f6999e0` preceded the new patch.

Rechecked the requirement matrix and fixed malformed marker metadata imports,
invalid local coordinates/text reaching storage or scene state, and concurrent
adds exceeding the 500-marker bound. Shared validation serves authored markers,
observations and replay snapshots. The form reports recoverable errors, preserves
input and rejects numeric-prefix garbage. Invalid snapshot data is refused before
removing current markers. No automatic deletion/repair of existing authored data.

Fresh results: **161 tests / 20 files pass**; all **77 original tests** also pass
in a separate seven-file run. All 15 new regressions failed before the fixes.
Lint, formatting, production build and full local CI pass. Both browser suites
pass again, including new marker-form correction and invalid metadata import
checks, offline reload, all required viewport sizes and fixture-backed existing
systems. Zero page errors or detected Cesium render-stop errors.

Current evidence: `/home/user/dexearth-final-evidence/`; logs:
`/home/user/dexearth-final-*.log`, outside Git. Application JS 439.78 kB /
141.26 kB gzip (Cesium/assets separate). Existing non-fatal build warnings remain.
Dependencies installed from the unchanged lockfile; external browser tooling is
not a project dependency. All previous physical-device, sustained FPS, genuine
upstream freshness and optional authenticated FIRMS limitations still apply.
Final commit and remote SHA equality are reported after explicit-path staging,
commit and non-force push to the fixed session branch. Master remains untouched.
