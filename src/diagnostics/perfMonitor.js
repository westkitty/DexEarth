// ─── Performance Monitor ────────────────────────────────────────────────────────
// Centralized FPS tracking and entity budgeting to guard against crashes.
import { emitAudit } from '../utils/auditLog.js'
import { styleManagerState } from '../visuals/styleManager.js'

let _rafId = null
let _fpsSamples = []
let _onUpdate = []
let _telemetryRef = null // To monitor max entities

export const perfState = {
    fps: 60,
    safeMode: false,
    budgets: {
        points: { current: 0, max: 50_000 },
        lines: { current: 0, max: 10_000 },
        labels: { current: 0, max: 2_000 },
        polygons: { current: 0, max: 1_000 },
    },
    topOffender: 'none'
}

export function subscribePerf(fn) {
    _onUpdate.push(fn)
    fn({ ...perfState })
    return () => { _onUpdate = _onUpdate.filter(f => f !== fn) }
}

function _notify() {
    _onUpdate.forEach(fn => fn({ ...perfState }))
}

// Map layer identifiers to their prominent geometry types to rough-estimate counts
// This avoids deep inspection of Cesium Collections every frame.
function _estimateEntities(telemetry) {
    let pts = 0, lines = 0, lbls = 0, polys = 0
    let highestCount = 0
    let offender = 'none'

    for (const [layer, count] of Object.entries(telemetry)) {
        if (!count) continue
        if (count > highestCount) {
            highestCount = count
            offender = layer
        }

        switch (layer) {
            case 'AIR_RADAR': pts += count; break
            case 'ORBITAL_MATH': pts += count; lines += count; break
            case 'THERMAL_FIRES': pts += count; break
            case 'SEISMIC_SIM': pts += count; polys += count; break
            case 'MARITIME_LANES': lines += (count * 2); break
            case 'FIBER_CABLES': lines += (count * 5); break
            case 'TECTONIC_PLATES': lines += (count * 4); break
            case 'THREAT_INDEX': polys += count; break
            default: break
        }
    }

    // Country overlays are tracked separately via window globals or store, 
    // but we add a rough guess if the toggle is known
    if (window._dexEarthCountryActive) {
        polys += 300; lines += 1000; lbls += 150
    }

    perfState.budgets.points.current = pts
    perfState.budgets.lines.current = lines
    perfState.budgets.labels.current = lbls
    perfState.budgets.polygons.current = polys
    perfState.topOffender = offender
}

export function initPerfMonitor(telemetryStateRef) {
    _telemetryRef = telemetryStateRef
    let last = performance.now()

    const tick = () => {
        const now = performance.now()
        const dt = now - last; last = now
        const fps = dt > 0 ? 1000 / dt : 60
        _fpsSamples.push(fps)
        if (_fpsSamples.length > 60) _fpsSamples.shift()

        if (_fpsSamples.length >= 60) {
            const avg = Math.round(_fpsSamples.reduce((a, b) => a + b, 0) / _fpsSamples.length)

            // Only update downstream if changed or every 30 frames
            if (avg !== perfState.fps || Math.random() < 0.05) {
                perfState.fps = avg

                // Read from styleManager but enforce
                perfState.safeMode = styleManagerState.safeModeActive

                if (_telemetryRef && _telemetryRef.current) {
                    _estimateEntities(_telemetryRef.current)
                }

                // Check Hard Budgets
                if (!perfState.safeMode) {
                    const overDraw = (perfState.budgets.points.current > perfState.budgets.points.max) ||
                        (perfState.budgets.lines.current > perfState.budgets.lines.max)

                    if (avg < 20 || overDraw) {
                        try {
                            // styleManager listens internally to monitor its own FPS dropping,
                            // but we can proactively trigger it if we exceed hard budgets regardless of FPS.
                            if (overDraw && window._dexEarthTriggerSafeMode) {
                                window._dexEarthTriggerSafeMode()
                                emitAudit('perf', 'SAFE_MODE_TRIGGERED', `Geometry budget exceeded by ${perfState.topOffender}`)
                            }
                        } catch { /* ignore if not wired */ }
                    }
                }

                _notify()
            }
        }
        _rafId = requestAnimationFrame(tick)
    }
    _rafId = requestAnimationFrame(tick)
}

export function stopPerfMonitor() {
    if (_rafId) cancelAnimationFrame(_rafId)
    _rafId = null
    _fpsSamples = []
}
