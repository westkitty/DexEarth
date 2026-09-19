# Orbital intelligence, observations and local replay

## Getting started

1. Open **Satellites → Activate satellites** (also controls `ORBITAL_MATH`).
2. Select by name/catalog ID or tap a point on the globe. Picking uses a 20-pixel
   neighborhood. The inspector derives its facts from the loaded TLE; it does not
   infer ownership, purpose or military status.
3. Enable the selected orbit and ground track. Gray is past, green future, gold
   surface projection, white cross current sub-satellite position. Deselection
   or unloading clears the paths. Filters are under the collapsible filter section.
4. Save an observer using coordinates or a saved marker, then predict passes.
   The 24-hour window starts at **Time Controller time**, not necessarily now.
5. Add satellites to the local watchlist. A nickname and saved elements survive
   reload. Newer loaded TLE epochs replace older watchlist elements; reopening a
   panel does not refresh an element's epoch.
6. Open **Views** for versioned observation sets and **Replay** for local sessions.
   **Tools** exposes existing markers, geofences, cascade, correlation and tours.

## Orbital truth and bounds

- Positions and speed: satellite.js SGP4, ECI → geodetic with GMST, deterministic
  for the same elements and timestamp. Each propagation uses an isolated satrec.
- Period, inclination and mean-element perigee/apogee are derived estimates.
  LEO: apogee below 2,000 km; MEO: perigee at least 2,000 km and apogee below
  35,786 km; GEO: near-sidereal period and low eccentricity. GEO does **not**
  establish that a satellite is geostationary. Other geometries are `OTHER`.
- Element age refers to the TLE epoch, not download time. Beyond ±14 days is
  flagged stale for analysis. Propagation is still available with a warning;
  this is not an accuracy guarantee. Invalid/decayed propagation returns unavailable.
- The inherited starter file contains **unverified historical starter elements**.
  Its provenance is bundled fallback, never live tracking. No new orbital data
  was fabricated or substituted for failed remote requests in this phase.
- Only one selected object gets paths. Each direction is 5–180 minutes and at
  most 181 samples. Dateline crossings and invalid samples break segments.
  Paths rebuild at most once per 15 seconds of controller time or config change,
  not each animation frame. Satellite points update twice per second, cap 500.
- Safe Mode: cap 80 points, prioritizing the selected object and watchlist;
  past path ≤31 samples; future paths and full ground tracks suspended.
- Passes: 10° minimum elevation, 30-second samples, at most 24 hours in the UI
  (helper hard limit 48 hours, 32 windows). Already-visible and truncated windows
  are labeled. Results omit refraction, terrain, weather, sunlight and optical
  visibility. Times can be off by at least a sample interval and much more for
  old elements. These are local predictions, not official precision tracking.

## Storage and offline operation

IndexedDB `dexearth`, schema **3**, adds `observations`, `watchlist`, `replays`,
`preferences`. Upgrade from v2 retains all existing stores and moves the legacy
`viewStore:home` / `viewStore:savedViews` keys out of disposable cache.

Remote cache record version **2** includes fetch/expiry, source, byte estimate,
last-used time and a retention preference. It is bounded to **24 records / 32 MiB
of payloads**. Older unpinned records go first; pins can still be evicted at the
hard limit. Pinning does not extend freshness. Legacy infinite-expiry pins are
normalized to a source TTL. Clearing remote cache excludes custom imports and
all user stores, and does not change a dataset already rendered in memory.

Catalog states:

| State                | Meaning                                                                                                      |
| -------------------- | ------------------------------------------------------------------------------------------------------------ |
| LIVE/FRESH           | Successful network retrieval within transport TTL; not proof of recent TLE epoch or complete global coverage |
| CACHED               | Retained record inside TTL; not fetched in this session                                                      |
| BUNDLED FALLBACK     | Shipped static asset; no remote fetch timestamp is invented                                                  |
| STALE                | Expired data, including explicit failed-network stale fallback                                               |
| UNAVAILABLE          | No usable active/cached record, or source not loaded                                                         |
| OPTIONAL KEY MISSING | Optional FIRMS configuration absent                                                                          |

Flights, USGS, cables and tectonic plates use the shared coalesced cache loader;
FIRMS uses it only when configured. The flight proxy reports failure if every
region fails rather than returning a fresh-looking empty success. TLE requests
are single-flight: fresh cache → attempted network → stale cache → bundle;
explicit bundled-only mode bypasses remote/cache. Source failure never changes
old fetch timestamps. Dataset states are independent from observation imports.

The base globe uses Cesium's bundled Natural Earth II textures (lower resolution
than remote imagery). Borders and starter TLE are bundled. With a running local
server no internet is needed. The production build also generates a finite
service-worker manifest **after Cesium asset copying completes**. After its first
successful installation, the timeline says “Offline assets ready”; the deployment
can then reload completely disconnected. The shell (~35 MiB, versioned separately
from IndexedDB) caches only build assets, never proxy/API responses or credentials.
First-ever disconnected visits cannot download the app. Service workers require
HTTPS or localhost; private browsing/quota eviction can remove local storage.
Export important authored data. `npm run dev` does not install a worker.

## Observation format v1

`format: "DexEarth.Observation"`, `version: 1`, UUID, name, notes, created/updated
wall-clock timestamps and `workspace`:

- camera longitude/latitude in degrees, altitude in meters, orientation radians;
- primary layer IDs plus satellite-active state;
- controller mode/time/speed;
- selected catalog ID, watchlist subset IDs, filters and path controls;
- marker snapshot, country-overlay visibility and render preset;
- local seismic events and active cascade IDs;
- dataset source/fetch/expiry references (`historicalSnapshot: false`).

Save, duplicate, rename, confirmed delete, export and import are local only.
Imports validate version, finite ranges, array/size bounds and known layers.
Limit: 100 sets; import ≤8 MiB. Imported IDs are replaced to avoid overwriting an
existing set. Loading restores the **view/configuration**. It never publishes
snapshot references into the active dataset catalog or resets source ages.
Markers are shown as a temporary snapshot: editing them cannot delete stored
user markers. Deactivate/reactivate Markers to return to persistent markers.
Watchlist subsets refer to local IDs, not a remote account; importing a set does
not import missing TLE records or reconstruct absent external data.

## Replay format v1

`format: "DexEarth.Replay"`, `version: 1`, UUID, name, `startedAt`, `duration`,
`externalData: "references-only"`, ordered events. Each event has a sequence,
wall-time offset, category/type and bounded full local workspace key state.

- Max 30 minutes, 600 key states, 8 MiB; 20 saved sessions.
- Start/stop, play/pause, scrub, previous/step, 0.25–16×, reset, exit/restore view,
  JSON import/export and durable local sessions.
- Records controller changes, camera move-end positions, layer changes,
  satellite selection/filters, marker interactions, seismic and cascade actions,
  dataset transitions and pass-prediction events.
- Backwards scrub restores the last complete key state, rather than accumulating
  actions. Equal offsets use sequence order. Camera gestures are key positions,
  not frame-by-frame animation. Pausing cannot leave an independent clock RAF running.
- Geofence interactions appear as timeline/key-state boundaries; the geofence
  database itself is **not rewound**. Observation sets also leave saved geofences intact.
- There are **no retained historical remote snapshots in format v1**. Dynamic
  aircraft, USGS and FIRMS layers are hidden during replay. Static geometry may
  use currently available datasets. Satellite positions are derived from currently
  loaded/watchlisted TLEs, not historical telemetry. A persistent replay warning
  states this limitation. Dataset references are provenance only.
- The chronological timeline distinguishes `LOCAL SIMULATION` (orange),
  `REMOTE OBSERVATION` (blue), `LOCAL PREDICTION`, `DATA PROVENANCE` and local UI
  interactions. It keeps 200 events in memory and displays the most recent 40.

## Validation and known limits

`npm run test:run` covers pure orbital math, cache truth/bounds, IndexedDB migration,
observation validation/restoration, replay ordering/clock/bounds, drawer and
subscription state. Fixtures are not evidence of live external freshness.

For repeatable browser validation:

```sh
npm run build
npm run preview -- --host 0.0.0.0
npx playwright install chromium
npm run test:browser
```

Override `DEXEARTH_URL`, `DEXEARTH_EVIDENCE`, or `CHROMIUM_PATH` as needed.
Browser evidence defaults to the Git-ignored `test-results/browser/` directory. The smoke covers offline reload,
watchlist persistence, observation/replay import/export and 390×844, 768×1024,
1024×1366, 1440×1000 layouts. It is **browser-emulated**, not physical-device
validation. Software rendering does not establish hardware FPS guarantees.

Remaining limits: no historical remote dataset recording, no optical-visibility
prediction, no remote accounts, no terrain occlusion calculation. True external
source availability/freshness, physical iPad/iPhone/Android GPU and gesture behavior,
and multi-tab leader/follower interaction on physical devices require further
validation. Two moderate development-only Vitest advisories remain after compatible
`npm audit fix`; resolving them requires a major Vitest upgrade and was not forced.

## Follow-up verification

[The original-requirements audit](requirements-verification.md) covers every
numbered request and documents the subsequent verification fixes. `npm run test:layers`
adds fixture-backed browser integration checks against a fresh development server.
It verifies the primary registry bridge used by correlation/threat: at most 1,000
points, 200 lines and 4,000 vertices per snapshot, explicitly labeled sampled local
analysis. It also checks overlays/LOD, cascade reset, cinematic controls and channel
clock delivery. These fixtures are not current-source observations.

Replay now normalizes the first event to zero, clamps backwards wall-clock jumps,
and supports stepping individually through events sharing a timestamp. Time panel
subscriptions clean up on unmount, and its new leader/follower selector exposes the
existing same-origin BroadcastChannel behavior. Country label projection uses the
API provided by Cesium 1.138, with one shared, disposable camera LOD listener.

The preceding repeat audit added regression coverage for explicit repeated replay
seeks versus continuous tick reuse, invalid imports preserving recordings,
near-8-MiB export/import round trips, corrupt/future cache dates and invalid TLE
fallbacks. Exports use compact JSON to honor the validated import size. Malformed
external cache timestamps do not count as fresh, and malformed bundles report
unavailable instead of a successful fallback. That audit passed 131 tests in
18 files; both browser suites were rerun. Physical GPU/device performance and
upstream availability remain unverified.

The previous assignment check passed **146 tests in 20 files**, plus both browser
suites. Editing either orbital range endpoint adjusts its partner to preserve
minimum ≤ maximum; every intermediate recorded/saved workspace stays valid. Pass
results display maximum-elevation UTC as well as elevation. Observation/replay
imports reject marker IDs that would collide after string conversion. Pending
marker storage operations cannot overwrite a newly restored snapshot or populate
an unloaded viewer; already-requested persistent writes still finish in storage.
The original seven test files were also rerun separately (all 77 tests pass).

The preceding requirement recheck passed **161 tests in 20 files**, plus both browser
suites and a separate rerun of all 77 original tests. Marker coordinates must be
finite and within longitude ±180° / latitude ±90°. Authored titles are 1–500
characters; notes up to 10,000; optional tags are an array of up to 100 strings,
up to 100 characters each. Optional severity is one of the existing four labels.
Imports may omit optional legacy metadata, but malformed present fields are
rejected before restoration. String marker IDs are nonempty and at most 100
characters. Pending local adds reserve capacity at the 500-marker limit.
Marker form errors retain entered values so they can be corrected; these checks
do not delete or automatically repair arbitrary pre-existing corrupt records.

The latest iterative verification passes **195 tests in 24 files** plus both
browser suites; its final pass found no additional defects in the tested scope.
Authored-record insertion capacity is transactional: 100 observations, 100
watchlisted satellites, 20 replays and 500 marker additions. Updates at capacity
still work. Replay autosave reports failed writes, retries every five seconds,
and clears its warning only after successful persistence. Export important data
if storage remains unavailable.

Legacy markers with invalid fields, colliding IDs or beyond the display cap are
excluded from rendering/capture with a timeline warning; original records remain
in storage. Authored-marker capture stays available when the layer is hidden,
without being replaced by temporary snapshot edits. Manual seismic inputs use
longitude ±180°, latitude ±90°, magnitude 0–12 and depth 0–1000 km; invalid values
are rejected before recording or rendering. Time Controller rejects invalid
clock/speed/step values without changing valid state. These checks are not a
claim of universal correctness across untested devices or external services.
