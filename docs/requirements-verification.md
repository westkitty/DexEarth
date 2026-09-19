# Original-requirements verification

Audit date: **2026-09-19**. Audited the actual source, state wiring, storage,
rendering collections and tests, not just the previous delivery summary.

## Meaning of the results

- **Verified**: implemented, with the evidence named below.
- **Qualified**: implemented with an explicit data/environment limit; the limit
  is not silently counted as a successful live/hardware test.
- **Not applicable here**: an original Mac/master instruction cannot apply to
  this hosted, fixed-branch checkout. This is not a claim it was executed on Mac.

## Current release audit (baseline `17f11cb`)

Started clean with matching local/remote `17f11cbb2f2858952923358210915b862e6a2b02`;
checkpoint `checkpoint-release-17f11cb` preceded edits. The section-by-section
requirement matrix below remains the scope checklist, including explicit
Mac/master, live-source and physical-device exceptions.

**Review/fix passes:** nine initial regression failures exposed watchlist
lost-update/deletion/epoch problems, unsafe durable watch/observer records,
understated cache byte accounting, non-string cache keys and destructive failed
recording startup. Three additional failing cases exposed premature transaction
success acknowledgement, generated marker IDs colliding with legacy string IDs,
and incorrect hour/minute age formatting. Those confirmed defects were fixed:

- Watchlist mutations are serialized locally and use atomic IndexedDB
  read/modify/write against the persisted row. Nickname edits retain newer TLEs;
  refresh preserves concurrent nicknames, selects the newest duplicate input,
  and cannot recreate deleted entries. Invalid durable watch/observer records
  are excluded with a visible warning and remain in storage. The inspector's
  saved-marker observer choices also exclude malformed legacy marker records.
- Remote cache budgeting measures serialized payload size rather than trusting
  an understated/invalid byte hint; custom imports and authored views remain
  excluded from eviction. Hour/minute labels now use whole hours, not rounded-up
  hours plus the original remainder.
- Recording startup validates its capture before replacing the previous session
  or stopping playback. A failed start preserves exportable local work.
- Legacy write wrappers now wait for transaction completion and reject aborts
  that occur after an individual request succeeds. Generated numeric marker IDs
  skip retained string aliases without deleting the legacy records.

**Clean validation passes:** added tests for separate connections, failed update
recovery, duplicate TLE input, multiple marker aliases and generated cache-budget
fixtures all passed without another source change. Full local CI and both browser
suites then passed on the same application revision. The expanded browser audit
checks watchlist epoch/nickname preservation, deletion, and corrupt-record
warnings without erasure. **No additional defects were found in these final
passes. This is evidence of tested correctness, not proof of universal absence
of bugs.**

Current results: **220 tests / 25 files**, including 25 new release-audit cases;
all **77 original tests** pass in their separate seven-file rerun. Lint,
formatting, production build and full local CI pass. Both browser suites have
zero page errors; the layer audit also detects Cesium render-stop errors.
The original offline, four-viewport, Safe Mode, layer/overlay/analysis/channel
checks were rerun, not inherited from a previous report.

Evidence: `/home/user/dexearth-release-evidence/`; logs:
`/home/user/dexearth-release-*.log`, outside Git. Application JS 444.70 kB /
143.17 kB gzip, excluding Cesium/assets. Existing mixed-import warnings remain
non-fatal. No dependency, private configuration or Mac-wrapper changes.
Physical-device performance, sustained FPS, genuine upstream freshness and
optional authenticated FIRMS success remain unverified. Final explicit staging,
commit/non-force push and independent SHA equality are reported separately for
`arena/01a0b75b-dexearth`; master is untouched and local CI is not hosted CI.

## Previous iterative verification (baseline `e9f02e6`)

Started with clean, matching local/remote `e9f02e6b19b9cf64672c693f1fe0a4ec3c204da7`;
checkpoint `checkpoint-iterative-e9f02e6` preceded edits. This request was handled
as an iterative review rather than repeating a previous test result:

1. **Persistence/lifecycle pass:** regressions confirmed non-atomic capacity
   checks and unsafe legacy marker loading (six failing cases before fixes).
   Observation/watchlist/replay insertion limits and marker-add capacity now
   use a single IndexedDB readwrite transaction, preserving updates at capacity.
   Replay autosave acknowledges only a committed write, coalesces pending ticks,
   retries failures every five seconds and clears its warning after recovery.
   Malformed/duplicate/excess legacy markers are omitted from the display and
   capture with an explicit warning, not deleted from storage. Failed marker
   activation can be retried. A separate authored-marker snapshot stays current
   across hiding the layer or completing a write while a temporary snapshot is
   displayed; temporary edits cannot overwrite the authored snapshot.
2. **Runtime-input pass:** 16 failing cases exposed invalid manual seismic and
   clock values entering recordable state. Shared simulation validation now
   rejects invalid coordinates/magnitude/depth/time before mutation; the form
   rejects blanks/numeric-prefix garbage with recoverable errors. Time Controller
   ignores invalid time/speed/step input and rejects inherited property names as
   modes. Replay-clock advancement is bounded and cannot reverse due to a
   backwards wall-clock adjustment. The controlled time slider no longer supplies
   both `value` and `defaultValue`.
3. **Final verification pass:** additional independent-connection capacity,
   failed-write recovery, saved-marker isolation and lifecycle tests passed without
   another source fix. Full local CI and both expanded browser suites passed.
   **No additional defects were found in this reviewed/tested scope. This is not
   proof that every possible input, platform or execution path is bug-free.**

Current totals: **195 tests / 24 files**, 34 cases beyond the prior 161. The
original seven baseline suites were separately rerun: **77 / 77 pass**. Lint,
format check, production build and full local CI pass. Both browser suites report
zero page errors; the layer suite additionally detects Cesium render-stop errors.
New browser checks exercise invalid simulation input, retained corrupt legacy
marker fixtures with warnings, and actual timer autosave recovery after deleting
one entry from a full 20-replay store. The final store remains exactly 20 records.

The original requirement matrix below is still the acceptance checklist. Satellite
inspector/paths/tracks/filters/passes, watchlist/observer, versioned observations,
truthful offline/cache states and migration, bounded local replay/timeline,
responsive UI/Safe Mode and existing layer/overlay/analysis/channel integrations
are covered by source plus current unit/browser evidence. Physical devices,
sustained FPS, true upstream freshness and authenticated optional FIRMS success
remain unverified, not implicitly accepted by fixture or emulation results.

Current evidence: `/home/user/dexearth-iterative-evidence/`; logs:
`/home/user/dexearth-iterative-*.log` (outside Git). Application JS 442.20 kB /
142.40 kB gzip, excluding Cesium/assets. Existing mixed-import warnings remain
non-fatal. No dependencies, secrets, Mac wrappers or rendering engine changed.
Delivery is explicit-path staging, commit and non-force push to the fixed Arena
branch, followed by independent remote SHA equality; the final report gives the
commit. Master is not updated, and local CI is not GitHub-hosted CI.

## Previous complete recheck (published baseline `f6999e0`)

The remote still held `f6999e0133e48994f419d2bb09183ded8e6247a1`.
The restored checkout's Git metadata pointed at `058c73a`, but **all 158 files
in the published commit matched the working files byte-for-byte**. After a
checkpoint, a mixed reset aligned local history/index with the fetched commit
without writing working files. `checkpoint-final-audit-f6999e0` precedes this
patch. The actual branch remains `arena/01a0b75b-dexearth`, not master.

The original section-by-section matrix below was rechecked against the current
implementation and fresh evidence. Orbital inspection/paths/filters/predictions,
watchlist/observer persistence, observation/replay formats and restoration,
truthful cache/catalog states and migration, the categorized timeline, responsive
controls, Safe Mode and existing layer/overlay integrations remain implemented.
Acceptance still distinguishes these local/fixture checks from unavailable
physical-device, live-source and authenticated optional FIRMS checks.

This pass found and corrected marker validation gaps affecting observations,
replay and the preserved Tools UI:

- Optional imported tags/notes/severity were not type-checked; malformed tags
  could crash marker search. `markerSchema.js` now supplies the shared validation
  used by observation/replay workspaces and direct marker snapshots. Omitted
  legacy metadata is accepted; malformed present metadata is rejected.
- Marker creation/updates now validate coordinates and text before writing to
  storage or changing geometry. Coordinate form parsing no longer accepts a
  numeric prefix such as `12junk`; blank/out-of-range values produce inline
  errors, retain the entered form and allow correction. Storage failures in
  marker activation/deletion are surfaced instead of unhandled rejections.
- The 500-marker add bound now reserves pending writes, so concurrent adds cannot
  both take the last slot. Invalid snapshot input is rejected before clearing
  the current scene. These guards do not erase existing authored records or
  attempt an automatic repair of arbitrary corrupt legacy storage.

**Regression evidence:** all 15 added cases failed against the prior code; after
fixes, **161 tests / 20 files pass**. The original seven files were separately
rerun: **77 / 77 pass**. Fresh lint, format check, production build and full local
CI pass. Both browser suites pass with zero page errors; the layer suite also
reports no Cesium render-stop errors. Production smoke additionally tests bad
marker coordinates, retained input/correction, and malformed-metadata refusal.
Offline reload, four requested viewport sizes, Safe Mode, all primary toggles,
analysis/simulation wiring, country/state overlays and BroadcastChannel passed
under the same explicitly qualified browser/fixture conditions.

Current evidence: `/home/user/dexearth-final-evidence/` and
`/home/user/dexearth-final-*.log` outside Git. Dependencies were reinstalled from
the unchanged lockfile; browser tooling was installed outside the repository.
Application JS: 439.78 kB / 141.26 kB gzip, excluding Cesium/assets. Existing
mixed-import warnings remain non-fatal. Protected private/Mac wrapper paths and
runtime dependencies are unchanged. Commit/push and independent remote SHA
verification are performed after the final staging audit and reported separately.

During the previous audit, the remote branch already contained `56c5dcb`. Its restored local history
pointed at `058c73a`, although every working file was byte-for-byte identical to
`56c5dcb`. After checking every tracked blob, a **mixed reset to the fetched
published commit** aligned local Git metadata without changing working files.
A fresh local checkpoint, `checkpoint-audit-56c5dcb`, preceded the audit fixes.
No force-push, branch switch, secret access or wrapper-file modification is needed.

## Previous assignment check (baseline `10e9615`)

Started from clean, matching local/remote `10e9615`; checkpoint
`checkpoint-assignment-10e9615` preceded tracked edits. Rechecked the original
requirements against actual source, UI wiring, storage and executable tests,
not merely the previous report. The requirement matrix below remains the scope
checklist; **verified does not mean every edge case or physical device has been
exhaustively tested**. This check found gaps in previously verified surfaces:

- **Orbital filters + observation/replay integration:** crossing a minimum and
  maximum produced an invalid workspace, breaking save/record validation. UI
  edits now go through `updateOrbitFilter`, adjusting the paired bound before
  subscribers or the recorder see it. Nonfinite numeric edits are ignored;
  search/shell/watch filters remain independent. The UI explains paired bounds.
- **Pass predictions:** maximum elevation was shown but its computed UTC time
  was missing. Both are now displayed alongside rise/start, set/end and duration.
- **Validated imports:** numeric/string marker IDs such as `1` and `"1"` passed
  uniqueness validation but collide in Cesium's string entity IDs. Validation
  now uses the same string identity before any workspace is applied.
- **Marker snapshot restoration/lifecycle:** pending IndexedDB loads or writes
  could replace or alter a restored observation snapshot, refill an unloaded
  layer, or leave entities in an old viewer. Generation guards now discard stale
  render completions and switching viewers cleans the previous entities. An
  already-requested persistent write still completes in storage; it does not
  mutate the newly displayed temporary snapshot. No saved data is deleted merely
  because a snapshot is restored.

Added `assignmentVerification.test.js` and `markerLifecycle.test.js` (15 cases).
The production browser script now crosses both filter ranges **while recording**,
checks valid values in the downloaded replay, asserts displayed pass-peak UTC,
and refuses colliding-marker imports without adding a saved observation.

**Fresh evidence:** 146 tests / 20 files; lint, formatting, build and full local CI
pass. The seven original baseline test files were also run separately: all
77 original tests pass. Both browser suites pass with zero page errors; the layer
suite additionally detects Cesium render-stop errors. It checks all ten primary
toggles, path cleanup, analysis/simulation wiring, overlays and BroadcastChannel.
Production checks include offline persistence, Safe Mode and all four requested
viewport sizes. Browser/remote-fixture tests do not establish physical device
performance, genuine upstream freshness or authenticated optional FIRMS success.

Evidence: `/home/user/dexearth-assignment-evidence/` and
`/home/user/dexearth-assignment-*.log` (outside Git). Application JS build:
438.54 kB / 140.88 kB gzip, excluding separately served Cesium/assets; existing
mixed-import warnings remain non-fatal. No dependencies, secrets or Mac wrappers
changed. Delivery is by explicit-path commit and non-force push to
`arena/01a0b75b-dexearth`, with an independent remote SHA check reported to the user;
this is not a master update or a claim of GitHub-hosted CI execution.

## Previous re-verification (baseline `6d7efad`)

The repeated verification request started with a clean worktree and matching
local/remote `6d7efad404dbd72ad4105b0ee6dd1b332c3206f7`. The checkpoint
`checkpoint-reverify-6d7efad` was created before changes. The matrix below still
maps the original requirements; source review and both browser suites were
rerun rather than treating the previous results as evidence for the new patch.

Additional defects found and corrected:

1. Repeating an explicit replay scrub/reset after moving the paused camera did
   not restore the same key state. Only continuous playback ticks now reuse
   unchanged geometry; explicit seeks restore it. Viewer replacement also
   invalidates the geometry-reuse key.
2. Invalid replay imports could end a current recording before validation.
   Cloned input is now validated before playback or recording state changes.
3. Pretty-printed exports could exceed their own 8-MiB import limit even when
   the compact record passed validation. Download encoding now matches validation;
   a near-limit Blob download/re-import test also checks URL cleanup.
4. NaN/future timestamps, NaN TTL and infinite external expiry could evade
   freshness comparisons. Shared validation now rejects those records as fresh,
   external cache writes require finite positive TTL, and corrupt catalog dates
   cannot throw during rendering. Authored custom data retains its separate policy.
5. Malformed legacy parsed TLE records could masquerade as usable cache data;
   empty/invalid bundled responses could report fallback success. Invalid cached
   records now fall through, and an unusable bundle reports unavailable.

Regression-first evidence: the initial targeted run failed **9 tests** against
old code. After corrections, **131 tests across 18 files pass**, retaining the
original 77 (17 additional regressions since the previous 114-test audit).
New coverage is in `verificationEdges.test.js`, `workspace.test.js` and
`tleSources.test.js` under `src/__tests__/`.

Fresh results: lint, format check, unit tests, production build and complete local
CI pass. Production offline/workflow/responsive browser smoke and the restarted-dev
fixture layer audit both pass, with zero page errors; the latter also checks for
Cesium render-stop errors. Build output: 437.71 kB application JS / 140.56 kB gzip
(excludes separately served Cesium/assets). Existing mixed-import warnings remain
non-fatal. Browser emulation is not physical-device or upstream-live verification.

Previous evidence (outside Git): `/home/user/dexearth-reverification-evidence/`;
command logs: `/home/user/dexearth-third-*.log`. Earlier evidence directories below
are historical. Explicit staging and remote SHA verification remain the final
Git delivery gate, with the resulting commit reported separately to avoid a
self-referential commit hash in this document. No master update is claimed.

## Requirement-by-requirement matrix

| Original section                 | Result                                  | Actual implementation and verification                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                       |
| -------------------------------- | --------------------------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| **0. Environment/worktree gate** | Verified / environment exception        | `/home/user/DexEarth`, `arena/01a0b75b-dexearth`, origin `westkitty/DexEarth`; status/log/remote checked. `/Users/andrew/DexEarth` and `master` are not this session's path/branch. Private `.env` and Mac wrapper contents were not accessed; only `.env.example` is configuration documentation.                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                           |
| **1. Protected boundaries**      | Verified with live-source qualification | React 19, Cesium and satellite.js retained in package manifest. All ten primary toggles and ten Phase II feature surfaces are reachable. No login, analytics, tracking, paid dependency or required API key added. FIRMS stays optional. IndexedDB/BroadcastChannel remain local. Country/state/province overlays, Time Controller, Safe Mode, seismic/cascade/correlation/threat/cinematic systems were inspected and exercised as described below. Real remote-source freshness is **not** established by fixtures.                                                                                                                                                                                                                                                                                                                                                                        |
| **2A. Satellite inspector**      | Verified                                | `orbitalFacts`, `propagateRecord` and `SatellitesPanel`: catalog ID/name, class, controller-time lat/lon/altitude/speed, period/inclination, estimated apsides, epoch/age, selected-element provenance and stale warnings. Browser selected ISS, rendered details; unit tests cover invalid/old elements. No ownership/classification metadata inferred.                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                     |
| **2B. Orbit paths**              | Verified                                | `buildSelectedPaths` builds selected-only past/future arcs, 5–180 minutes; sample cap 181/direction, 15-second controller-time rebuild buckets. Actual Cesium collection contains paths on selection and zero paths after deselection. Layer unload removes its two collections, timer and picking handler.                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                  |
| **2C. Ground track**             | Verified                                | Ground projection at surface altitude, antimeridian/gap splitting, selected point emphasis and white current-sample cross. Same selected-only sample bounds; no per-layer track explosion. Pure bounds/dateline tests and browser path rendering. Cross/track follows the path refresh cadence, not sub-second precision tracking.                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                           |
| **2D. Orbital filters**          | Verified                                | LEO/MEO/GEO/OTHER, name/catalog search, altitude and inclination bands, watchlist subset. Paired bounds stay ordered during recording and observation capture; regression and production browser checks cover crossed ranges. Selected object is prioritized. GEO means near-geosynchronous, not proof of stationary or military status.                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                     |
| **2E. Pass prediction**          | Verified / prediction limits            | `predictPasses`, stored observer coordinates or chosen saved marker, identity, start/peak/set UTC times, maximum elevation and duration. UI requests 24h above 10°, 30-second sampling; helper bounded at 48h/32 windows. Browser results and deterministic unit test. Explicitly current-TLE predictions, not official tracking or optical visibility.                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                      |
| **3. Durable watchlist**         | Verified                                | Dedicated IDB `watchlist` store; add/remove/nickname, jump, cached-element propagation/age, next-pass computation at saved observer. Tests reinitialize the store, retain nickname/observer through cache clearing and use atomic persisted-row updates to preserve newer epochs/concurrent nicknames and avoid recreating deletions. Browser reload preserves watchlist. No account sync.                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                   |
| **4. Saved observations**        | Verified / view-snapshot scope          | Version-1 schema, local CRUD, metadata/notes, camera, primary toggles, controller time/mode/speed, selected satellite/watch subset/filter/path state, markers, overlay visibility/preset, local simulation/cascade state and dataset references. Browser covers save/load/duplicate/rename/confirmed delete/export/import/corrupt refusal. Restoration unit checks camera/layers/time and unchanged active-data timestamps. Marker snapshots are temporary, not destructive imports; safe authored-marker capture stays current across layer unloads, while corrupt legacy records remain stored with a display warning; generation guards reject stale load/write render completions and normalized marker IDs cannot collide; shared marker validation rejects unsafe metadata before restore. Does not freeze remote data or resume cinematic animation/retain a precomputed threat grid. |
| **5. Offline catalog/startup**   | Verified / installation qualification   | All six states in `datasetStatus`, source/fetch/age/TTL/fallback/active-origin UI. Bundled globe/borders/TLE, persisted local records and permitted remote caches. Production browser fully disconnected, reloaded and accessed saved observation/watchlist. Initial installation or local server is required; no first-visit-offline claim. Bundled assets never receive invented remote fetch times.                                                                                                                                                                                                                                                                                                                                                                                                                                                                                       |
| **6. Bounded cache**             | Verified                                | Record v2, source TTL, last-use, 24-record/32-MiB payload budget, soft retention preferences, individual/all remote clear. Startup also evicts oversized legacy cache. IDB v2→v3 migration moves legacy views out of cache. Tests verify expiration/fallback, eviction and user-data preservation; clearing cannot delete user stores. Active in-memory datasets may remain visible until unload/reload.                                                                                                                                                                                                                                                                                                                                                                                                                                                                                     |
| **7. Replay sessions**           | Verified / historical limitation        | Durable `replays`, bounded 30m/600 states/8 MiB/20 sessions, start/stop/play/pause/scrub/step/speed/reset/export/import and exit restoration. Atomic insertion capacity and retry-after-failure autosave are tested. Key states cover clock, camera move-end, toggles, selection, markers, local seismic/cascades. First event offset and backwards wall-clock handling fixed; same-offset events can be individually stepped. Historical remote data is explicitly unavailable (`references-only`); dynamic flight/USGS/FIRMS layers hidden during replay. No claim of unrecorded telemetry reconstruction. Geofence database is not rewound.                                                                                                                                                                                                                                               |
| **8. Event timeline**            | Verified                                | Bounded chronological stream: observation loads, selection, predicted pass windows, geofence alerts, seismic/cascade actions, dataset transitions. Text categories and colors distinguish `REMOTE OBSERVATION`, `LOCAL SIMULATION`, `LOCAL PREDICTION` and provenance/UI events. Browser asserts seismic and cascade categories.                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                             |
| **9. Tablet/mobile**             | Verified in browser only                | Real responsive React/Cesium UI, bounded sheets, scrollable details, collapsible timeline, safe-area styles and touch picking. Coarse-pointer controls have 44px target minima; new and repaired overlay controls have labels. Production smoke uses touch-capable Chromium at 390×844, 768×1024, 1024×1366 and 1440×1000, asserting drawer bounds/no document horizontal overflow. **No physical device was used.**                                                                                                                                                                                                                                                                                                                                                                                                                                                                         |
| **10. Performance/Safe Mode**    | Verified bounds, not FPS                | One orbital renderer; 500-point hard cap, 80 in Safe Mode, selected/watch priority, selected-only paths, ≤31 past samples and suspended future/ground tracks under Safe Mode. Single-flight TLE fetches, 2Hz point updates, generation guards, disposal. Path bounds tested including NaN input; actual collection cleanup and Safe Mode UI tested. Primary analytic geometry is explicitly sampled/bounded, not complete-source analysis.                                                                                                                                                                                                                                                                                                                                                                                                                                                   |
| **11. Tests**                    | Verified                                | Original 77 tests retained. Orbital classification/determinism/passes/path/dateline/invalid/stale; observation round-trip/version/corruption/restoration/truth; TTL/state/bounds/migration/user separation; replay order/pause/scrub/step/time/size limits; drawer/selection/subscription tests. Added requirement-regression and real fake-IDB watchlist/legacy-cache coverage in this audit.                                                                                                                                                                                                                                                                                                                                                                                                                                                                                               |
| **12. Validation**               | Verified                                | `lint`, `format:check`, `test:run`, `build`, then `ci`; production browser smoke plus added development layer/overlay fixture audit. See current counts/results in `OPERATIONAL_STATE.md`. Tests make no real-source-freshness claim.                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                        |
| **13. Documentation**            | Verified                                | Root `OPERATIONAL_STATE.md` exists, README and orbital/overlay guides updated; this matrix now maps every original numbered section to evidence and limitations.                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                             |
| **14. Acceptance**               | Qualified                               | Source implementation and local/fixture workflows verified. Physical hardware, sustained FPS, actual upstream availability/freshness and an authenticated optional FIRMS success path remain unverified. Do not equate fixture-backed layer operation with real live-source acceptance.                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                      |
| **15. Git delivery**             | Verified by final delivery gate         | Explicit-path stage, diff check, commit and non-force push to the fixed session branch. Final report supplies hash and independent `ls-remote` equality. `.env` and unrelated Mac wrapper paths excluded. `master` is intentionally not pushed.                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                              |
| **16. Final report**             | Delivered with commit                   | Feature verification, fixes, command/browser results, operational-state updates, hash/push verification and outstanding hardware/live-source paths summarized to the user.                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                   |

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
Evidence defaults to ignored `test-results/` subdirectories. The previous audit used
`/home/user/dexearth-audit-evidence/`; the subsequent run used
`/home/user/dexearth-reverification-evidence/`, and the current assignment check used
`/home/user/dexearth-assignment-evidence/`. Screenshots, downloaded observation/replay
fixtures and browser binaries are not committed. Software-rendered screenshot
capture can be slow; its timeout is 90 seconds, not a claimed frame-rate target.
