// ─── Seismic Simulation Layer ─────────────────────────────────────────────────
// Deterministic ring computation — rings match time scrub exactly.

import * as Cesium from 'cesium'
import { pulseHud } from '../../utils/pulse.js'

// Wave speeds in m/s
const P_SPEED = 6_000   // P-wave: ~6 km/s
const S_SPEED = 3_500   // S-wave: ~3.5 km/s
const MAX_RADIUS_M = 18_000_000 // 18,000 km max visible radius

let _viewer = null
let _lines = null      // PolylineCollection reused
let _events = []       // immutable event objects
let _telemetryCallback = null
let _statusCallbacks = []

let _idCounter = 0

function _nextId() { return `seismic_${++_idCounter}_${Date.now()}` }

/** Build ring positions on the ellipsoid for a given radius */
function buildRingPositions(lon, lat, radiusMeters, numPts = 48, altitude = 1000) {
    const R = 6_371_000 // Earth radius approx in meters
    const angularRadius = radiusMeters / R
    const cosLat = Math.cos((lat * Math.PI) / 180)
    const positions = []
    for (let i = 0; i <= numPts; i++) {
        const angle = (i / numPts) * 2 * Math.PI
        const dLon = (angularRadius / (cosLat || 0.001)) * Math.cos(angle)
        const dLat = angularRadius * Math.sin(angle)
        const ptLon = lon + (dLon * 180) / Math.PI
        const ptLat = Math.max(-89, Math.min(89, lat + (dLat * 180) / Math.PI))
        positions.push(Cesium.Cartesian3.fromDegrees(ptLon, ptLat, altitude))
    }
    return positions
}

function _renderAll(timeMs) {
    if (!_lines) return
    _lines.removeAll()
    let rings = 0

    for (const ev of _events) {
        const elapsed = (timeMs - ev.originMs) / 1000  // seconds
        if (elapsed < 0) continue  // event hasn't happened yet

        const rP = Math.min(elapsed * P_SPEED, MAX_RADIUS_M)
        const rS = Math.min(elapsed * S_SPEED, MAX_RADIUS_M)

        // Magnitude → line width and alpha
        const lineWidth = Math.max(1, ev.mag * 0.6)
        const alphaP = Math.max(0.15, 0.8 - elapsed / 600)  // fade over 10 min
        const alphaS = Math.max(0.2, 0.9 - elapsed / 500)

        // P-wave ring (fast, cyan-white)
        if (rP > 1000) {
            _lines.add({
                positions: buildRingPositions(ev.lon, ev.lat, rP, 60, 2000),
                width: lineWidth,
                material: Cesium.Material.fromType('PolylineGlow', {
                    glowPower: 0.12,
                    color: Cesium.Color.fromCssColorString('#AAFFFF').withAlpha(alphaP),
                }),
            })
            rings++
        }

        // S-wave ring (slower, orange-red)
        if (rS > 1000) {
            _lines.add({
                positions: buildRingPositions(ev.lon, ev.lat, rS, 60, 1200),
                width: lineWidth + 0.5,
                material: Cesium.Material.fromType('PolylineGlow', {
                    glowPower: 0.18,
                    color: Cesium.Color.fromCssColorString('#FF6600').withAlpha(alphaS),
                }),
            })
            rings++
        }

        // Epicenter marker
        _lines.add({
            positions: buildRingPositions(ev.lon, ev.lat, Math.max(ev.mag * 15_000, 30_000), 6, 3000),
            width: 2,
            material: Cesium.Material.fromType('Color', {
                color: Cesium.Color.fromCssColorString('#FF4444').withAlpha(0.9),
            }),
        })
        rings++
    }

    if (_telemetryCallback) {
        _telemetryCallback({ events: _events.length, rings })
    }
}

export const seismicSimLayer = {
    activate({ viewer }) {
        _viewer = viewer
        _lines = new Cesium.PolylineCollection()
        viewer.scene.primitives.add(_lines)
        _notifyStatus('active')
    },

    deactivate() {
        if (_viewer && _lines) {
            _viewer.scene.primitives.remove(_lines)
        }
        _lines = null
        _events = []
        _viewer = null
    },

    tick({ timeMs }) {
        _renderAll(timeMs)
    },

    getGeometrySnapshot() {
        return {
            points: _events.map(ev => ({
                lon: ev.lon, lat: ev.lat,
                meta: { name: `M${ev.mag}@${ev.depthKm}km`, mag: ev.mag, originMs: ev.originMs },
            })),
        }
    },

    // ── Event management ──────────────────────────────────────────────────────
    addEvent({ lon, lat, mag, depthKm, originMs }) {
        const ev = { id: _nextId(), lon, lat, mag: Number(mag), depthKm: Number(depthKm), originMs: Number(originMs) }
        _events.push(ev)
        pulseHud('seismic', `M${ev.mag} @ ${lon.toFixed(1)},${lat.toFixed(1)}`)
        return ev
    },

    removeEvent(id) {
        _events = _events.filter(e => e.id !== id)
    },

    clearEvents() {
        _events = []
    },

    getEvents() { return [..._events] },

    onTelemetry(fn) { _telemetryCallback = fn },
    onStatus(fn) { _statusCallbacks.push(fn) },
}

function _notifyStatus(s) { _statusCallbacks.forEach(fn => { try { fn(s) } catch { /* ignore */ } }) }

// ── Preset events ─────────────────────────────────────────────────────────────
export const PRESETS = {
    japan: { lon: 143.0, lat: 37.5, mag: 7.8, depthKm: 30, label: 'Japan (Tohoku-type)' },
    chile: { lon: -72.5, lat: -36.0, mag: 8.2, depthKm: 25, label: 'Chile (Maule-type)' },
    alaska: { lon: -149.5, lat: 61.2, mag: 7.1, depthKm: 40, label: 'Alaska' },
    random: () => ({
        // Random subduction zone (Pacific Ring of Fire)
        lon: [-145, -130, -106, -82, -73, -69, 143, 145, 150, -178, 171][Math.floor(Math.random() * 11)],
        lat: [58, 40, 14, 8, -17, -32, 37, 43, -5, -52, -40][Math.floor(Math.random() * 11)],
        mag: 5.5 + Math.random() * 2.5,
        depthKm: 10 + Math.floor(Math.random() * 60),
        label: 'Random Subduction',
    }),
}
