# Original-requirements verification

Audit date: **2026-09-19**. Audited the actual source, state wiring, storage,
rendering collections and tests, not just the previous delivery summary.

## Meaning of the results

- **Verified**: implemented, with the evidence named below.
- **Qualified**: implemented with an explicit data/environment limit; the limit
  is not silently counted as a successful live/hardware test.
- **Not applicable here**: an original Mac/master instruction cannot apply to
  this hosted, fixed-branch checkout. This is not a claim it was executed on Mac.

The remote branch already contained `56c5dcb`. This turn's restored local history
pointed at `058c73a`, although every working file was byte-for-byte identical to
`56c5dcb`. After checking every tracked blob, a **mixed reset to the fetched
published commit** aligned local Git metadata without changing working files.
A fresh local checkpoint, `checkpoint-audit-56c5dcb`, preceded the audit fixes.
No force-push, branch switch, secret access or wrapper-file modification is needed.

## Requirement-by-requirement matrix

| Original section                 | Result                                  | Actual implementation and verification                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                           |
| -------------------------------- | --------------------------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| **0. Environment/worktree gate** | Verified / environment exception        | `/home/user/DexEarth`, `arena/01a0b75b-dexearth`, origin `westkitty/DexEarth`; status/log/remote checked. `/Users/andrew/DexEarth` and `master` are not this session's path/branch. Private `.env` and Mac wrapper contents were not accessed; only `.env.example` is configuration documentation.                                                                                                                                                                                                                                                                               |
| **1. Protected boundaries**      | Verified with live-source qualification | React 19, Cesium and satellite.js retained in package manifest. All ten primary toggles and ten Phase II feature surfaces are reachable. No login, analytics, tracking, paid dependency or required API key added. FIRMS stays optional. IndexedDB/BroadcastChannel remain local. Country/state/province overlays, Time Controller, Safe Mode, seismic/cascade/correlation/threat/cinematic systems were inspected and exercised as described below. Real remote-source freshness is **not** established by fixtures.                                                            |
| **2A. Satellite inspector**      | Verified                                | `orbitalFacts`, `propagateRecord` and `SatellitesPanel`: catalog ID/name, class, controller-time lat/lon/altitude/speed, period/inclination, estimated apsides, epoch/age, selected-element provenance and stale warnings. Browser selected ISS, rendered details; unit tests cover invalid/old elements. No ownership/classification metadata inferred.                                                                                                                                                                                                                         |
| **2B. Orbit paths**              | Verified                                | `buildSelectedPaths` builds selected-only past/future arcs, 5–180 minutes; sample cap 181/direction, 15-second controller-time rebuild buckets. Actual Cesium collection contains paths on selection and zero paths after deselection. Layer unload removes its two collections, timer and picking handler.                                                                                                                                                                                                                                                                      |
| **2C. Ground track**             | Verified                                | Ground projection at surface altitude, antimeridian/gap splitting, selected point emphasis and white current-sample cross. Same selected-only sample bounds; no per-layer track explosion. Pure bounds/dateline tests and browser path rendering. Cross/track follows the path refresh cadence, not sub-second precision tracking.                                                                                                                                                                                                                                               |
| **2D. Orbital filters**          | Verified                                | LEO/MEO/GEO/OTHER, name/catalog search, altitude and inclination bands, watchlist subset. Selected object is prioritized. GEO means near-geosynchronous, not proof of stationary or military status.                                                                                                                                                                                                                                                                                                                                                                             |
| **2E. Pass prediction**          | Verified / prediction limits            | `predictPasses`, stored observer coordinates or chosen saved marker, identity, start/max/set/duration. UI requests 24h above 10°, 30-second sampling; helper bounded at 48h/32 windows. Browser results and deterministic unit test. Explicitly current-TLE predictions, not official tracking or optical visibility.                                                                                                                                                                                                                                                            |
| **3. Durable watchlist**         | Verified                                | Dedicated IDB `watchlist` store; add/remove/nickname, jump, cached-element propagation/age, next-pass computation at saved observer. Tests reinitialize the store, retain nickname/observer through cache clearing and refuse replacement by an older epoch. Browser reload preserves watchlist. No account sync.                                                                                                                                                                                                                                                                |
| **4. Saved observations**        | Verified / view-snapshot scope          | Version-1 schema, local CRUD, metadata/notes, camera, primary toggles, controller time/mode/speed, selected satellite/watch subset/filter/path state, markers, overlay visibility/preset, local simulation/cascade state and dataset references. Browser covers save/load/duplicate/rename/confirmed delete/export/import/corrupt refusal. Restoration unit checks camera/layers/time and unchanged active-data timestamps. Marker snapshots are temporary, not destructive imports. Does not freeze remote data or resume cinematic animation/retain a precomputed threat grid. |
| **5. Offline catalog/startup**   | Verified / installation qualification   | All six states in `datasetStatus`, source/fetch/age/TTL/fallback/active-origin UI. Bundled globe/borders/TLE, persisted local records and permitted remote caches. Production browser fully disconnected, reloaded and accessed saved observation/watchlist. Initial installation or local server is required; no first-visit-offline claim. Bundled assets never receive invented remote fetch times.                                                                                                                                                                           |
| **6. Bounded cache**             | Verified                                | Record v2, source TTL, last-use, 24-record/32-MiB payload budget, soft retention preferences, individual/all remote clear. Startup also evicts oversized legacy cache. IDB v2→v3 migration moves legacy views out of cache. Tests verify expiration/fallback, eviction and user-data preservation; clearing cannot delete user stores. Active in-memory datasets may remain visible until unload/reload.                                                                                                                                                                         |
| **7. Replay sessions**           | Verified / historical limitation        | Durable `replays`, bounded 30m/600 states/8 MiB/20 sessions, start/stop/play/pause/scrub/step/speed/reset/export/import and exit restoration. Key states cover clock, camera move-end, toggles, selection, markers, local seismic/cascades. First event offset and backwards wall-clock handling fixed; same-offset events can be individually stepped. Historical remote data is explicitly unavailable (`references-only`); dynamic flight/USGS/FIRMS layers hidden during replay. No claim of unrecorded telemetry reconstruction. Geofence database is not rewound.          |
| **8. Event timeline**            | Verified                                | Bounded chronological stream: observation loads, selection, predicted pass windows, geofence alerts, seismic/cascade actions, dataset transitions. Text categories and colors distinguish `REMOTE OBSERVATION`, `LOCAL SIMULATION`, `LOCAL PREDICTION` and provenance/UI events. Browser asserts seismic and cascade categories.                                                                                                                                                                                                                                                 |
| **9. Tablet/mobile**             | Verified in browser only                | Real responsive React/Cesium UI, bounded sheets, scrollable details, collapsible timeline, safe-area styles and touch picking. Coarse-pointer controls have 44px target minima; new and repaired overlay controls have labels. Production smoke uses touch-capable Chromium at 390×844, 768×1024, 1024×1366 and 1440×1000, asserting drawer bounds/no document horizontal overflow. **No physical device was used.**                                                                                                                                                             |
| **10. Performance/Safe Mode**    | Verified bounds, not FPS                | One orbital renderer; 500-point hard cap, 80 in Safe Mode, selected/watch priority, selected-only paths, ≤31 past samples and suspended future/ground tracks under Safe Mode. Single-flight TLE fetches, 2Hz point updates, generation guards, disposal. Path bounds tested including NaN input; actual collection cleanup and Safe Mode UI tested. Primary analytic geometry is explicitly sampled/bounded, not complete-source analysis.                                                                                                                                       |
| **11. Tests**                    | Verified                                | Original 77 tests retained. Orbital classification/determinism/passes/path/dateline/invalid/stale; observation round-trip/version/corruption/restoration/truth; TTL/state/bounds/migration/user separation; replay order/pause/scrub/step/time/size limits; drawer/selection/subscription tests. Added requirement-regression and real fake-IDB watchlist/legacy-cache coverage in this audit.                                                                                                                                                                                   |
| **12. Validation**               | Verified                                | `lint`, `format:check`, `test:run`, `build`, then `ci`; production browser smoke plus added development layer/overlay fixture audit. See current counts/results in `OPERATIONAL_STATE.md`. Tests make no real-source-freshness claim.                                                                                                                                                                                                                                                                                                                                            |
| **13. Documentation**            | Verified                                | Root `OPERATIONAL_STATE.md` exists, README and orbital/overlay guides updated; this matrix now maps every original numbered section to evidence and limitations.                                                                                                                                                                                                                                                                                                                                                                                                                 |
| **14. Acceptance**               | Qualified                               | Source implementation and local/fixture workflows verified. Physical hardware, sustained FPS, actual upstream availability/freshness and an authenticated optional FIRMS success path remain unverified. Do not equate fixture-backed layer operation with real live-source acceptance.                                                                                                                                                                                                                                                                                          |
| **15. Git delivery**             | Verified by final delivery gate         | Explicit-path stage, diff check, commit and non-force push to the fixed session branch. Final report supplies hash and independent `ls-remote` equality. `.env` and unrelated Mac wrapper paths excluded. `master` is intentionally not pushed.                                                                                                                                                                                                                                                                                                                                  |
| **16. Final report**             | Delivered with commit                   | Feature verification, fixes, command/browser results, operational-state updates, hash/push verification and outstanding hardware/live-source paths summarized to the user.                                                                                                                                                                                                                                                                                                                                                                                                       |

## Defects the second audit found and fixed

1. Recording's first event could have nonzero offset, causing its own exported
   replay to fail import. Initial offset is now exactly zero.
2. Clock adjustments could produce decreasing replay offsets; offsets are now
   monotonic. Step/reset now visit same-offset events by sequence.
3. Reset/step could enter replay without remembering the return view; those
   controls now capture it. Import cannot replace an active recording.
4. Observation save silently replaced a displayed marker snapshot with persistent
   markers. It now saves the captured view. Duplicate marker IDs are rejected.
5. Primary geometry was never registered for threat/correlation. A bounded bridge
   now connects all primary layer IDs; point and line options are available in
   correlation. Cascade refresh-interval degradation now reaches primary loaders.
6. Primary async fetch completions could touch unloaded Cesium collections or
   recreate refresh timers. Generation guards now reject stale completions.
7. Time panel nested promise cleanup leaked subscriptions; it now returns actual
   React cleanup. Its mode/speed display follows external restores. A multi-tab
   leader/follower selector makes existing BroadcastChannel behavior usable.
8. Marker deactivation dropped still-mounted UI subscriptions; unsubscription now
   belongs to the subscribing effect, not to hiding geometry.
9. Country labels called removed `wgs84ToWindowCoordinates`; now use Cesium's
   `worldToWindowCoordinates`. Borders-only zoom now gets the shared LOD camera
   listener; handlers are not duplicated, and label unmount no longer removes the
   listener while borders remain active. Toggle labels improve touch/accessibility.
10. Catalog empty records could appear stale instead of unavailable; missing expiry
    cannot appear fresh. Bundled fetch timestamps stay null. Legacy cache budgets
    are enforced at startup, not only on the next write.
11. A non-finite sample request bypassed Safe Mode's intended default sample count;
    the fallback now respects the 31-sample bound.

## Reproduce the evidence

Production shell and local workflows:

```sh
npm run build
npm run preview -- --host 0.0.0.0 --port 4173
npm run test:browser
```

Expanded fixture-backed layer, analysis, overlay and channel audit (use a freshly
started dev server; do not edit source/HMR during the audit, as module URLs change):

```sh
npm run dev -- --host 0.0.0.0 --port 3000
npm run test:layers
```

Both browser scripts accept `CHROMIUM_PATH` and `DEXEARTH_EVIDENCE`.
`DEXEARTH_URL` controls production; `DEXEARTH_DEV_URL` controls development.
Evidence defaults to ignored `test-results/` subdirectories. This sandbox used
`/home/user/dexearth-audit-evidence/`. Screenshots, downloaded observation/replay
fixtures and browser binaries are not committed. Software-rendered screenshot
capture can be slow; its timeout is 90 seconds, not a claimed frame-rate target.
