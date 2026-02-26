// ─── Alerts Layer ─────────────────────────────────────────────────────────────
// Geofences (circle + polygon), watch sources, alert log in IndexedDB.

import * as Cesium from 'cesium'
import { geofencesGetAll, geofenceAdd, geofenceDelete, alertLogAdd, alertLogGetAll, alertLogClear } from '../../storage/db.js'
import { pointInCircle, pointInPolygon } from '../../utils/geo.js'
import { pulseHud } from '../../utils/pulse.js'

let _viewer = null
let _handler = null
let _geofences = []
let _geofenceEntities = new Map()
let _alertLog = []
let _isDrawing = false
let _drawType = null   // 'circle' | 'polygon'
let _drawVertices = []
let _drawPolylineEntity = null
let _soundEnabled = false
let _watchSources = []  // array of { id, getGeometrySnapshot } objects (layer refs)
let _onLogChange = []
let _onGeofenceChange = []
let _onStatusChange = []

// ── Geofence visualization ────────────────────────────────────────────────────
function _buildCirclePositions(lon, lat, radiusKm, numPts = 64) {
    const positions = []
    const R = 6_371
    const angR = radiusKm / R
    for (let i = 0; i <= numPts; i++) {
        const angle = (i / numPts) * 2 * Math.PI
        const cosLat = Math.cos((lat * Math.PI) / 180)
        const dLon = (angR / (cosLat || 0.001)) * Math.cos(angle)
        const dLat = angR * Math.sin(angle)
        positions.push(Cesium.Cartesian3.fromDegrees(
            lon + (dLon * 180) / Math.PI,
            lat + (dLat * 180) / Math.PI,
            200
        ))
    }
    return positions
}

function _addGeofenceEntity(gf) {
    if (!_viewer) return
    const color = Cesium.Color.fromCssColorString('#FFD700').withAlpha(0.7)
    let entity
    if (gf.type === 'circle') {
        entity = _viewer.entities.add({
            id: `geofence_${gf.id}`,
            polyline: {
                positions: _buildCirclePositions(gf.lon, gf.lat, gf.radiusKm),
                width: 2,
                material: new Cesium.ColorMaterialProperty(color),
            },
        })
    } else {
        const coords = [...gf.polygon, gf.polygon[0]]
        entity = _viewer.entities.add({
            id: `geofence_${gf.id}`,
            polyline: {
                positions: coords.map(([lo, la]) => Cesium.Cartesian3.fromDegrees(lo, la, 200)),
                width: 2,
                material: new Cesium.ColorMaterialProperty(color),
            },
        })
    }
    _geofenceEntities.set(gf.id, entity)
}

function _removeGeofenceEntity(id) {
    const e = _geofenceEntities.get(id)
    if (e && _viewer) _viewer.entities.remove(e)
    _geofenceEntities.delete(id)
}

// ── Check incursions ──────────────────────────────────────────────────────────
function _checkWatchSources(timeMs) {
    for (const src of _watchSources) {
        const snap = src.getGeometrySnapshot?.()
        if (!snap?.points) continue
        for (const pt of snap.points) {
            for (const gf of _geofences) {
                let inside = false
                if (gf.type === 'circle') {
                    inside = pointInCircle(pt.lon, pt.lat, gf.lon, gf.lat, gf.radiusKm)
                } else if (gf.type === 'polygon') {
                    inside = pointInPolygon(pt.lon, pt.lat, gf.polygon)
                }
                if (inside) {
                    // Simple rate-limit: one alert per gf+target per minute
                    const key = `${gf.id}_${pt.meta?.name || `${pt.lon.toFixed(1)}_${pt.lat.toFixed(1)}`}`
                    if (_recentAlerts.has(key)) continue
                    _recentAlerts.set(key, timeMs)
                    setTimeout(() => _recentAlerts.delete(key), 60_000)

                    const entry = {
                        type: 'entry',
                        gfId: gf.id,
                        gfName: gf.name,
                        source: src.id,
                        target: pt.meta?.name || 'unknown',
                        lon: pt.lon, lat: pt.lat,
                        timeMs,
                    }
                    alertLogAdd(entry).then(id => {
                        _alertLog.push({ ...entry, id })
                        _notifyLogChange()
                        pulseHud('alert', `${src.id}: ${entry.target} in ${gf.name}`)
                        if (_soundEnabled) _playBeep()
                    })
                }
            }
        }
    }
}

const _recentAlerts = new Map()

function _playBeep() {
    try {
        const ctx = new (window.AudioContext || window.webkitAudioContext)()
        const osc = ctx.createOscillator()
        const gain = ctx.createGain()
        osc.connect(gain); gain.connect(ctx.destination)
        osc.frequency.value = 880
        gain.gain.setValueAtTime(0.1, ctx.currentTime)
        gain.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + 0.3)
        osc.start(); osc.stop(ctx.currentTime + 0.3)
    } catch { /* ignore */ }
}

function _notifyLogChange() { _onLogChange.forEach(fn => { try { fn([..._alertLog]) } catch { /* ignore */ } }) }
function _notifyGeofenceChange() { _onGeofenceChange.forEach(fn => { try { fn([..._geofences]) } catch { /* ignore */ } }) }

// ── Drawing handler ───────────────────────────────────────────────────────────
function _setupDrawing() {
    if (!_viewer) return
    _handler = new Cesium.ScreenSpaceEventHandler(_viewer.scene.canvas)
    _handler.setInputAction(movement => {
        if (!_isDrawing) return
        const ray = _viewer.camera.getPickRay(movement.position)
        const cart = _viewer.scene.globe.pick(ray, _viewer.scene)
        if (!cart) return
        const carto = Cesium.Ellipsoid.WGS84.cartesianToCartographic(cart)
        const lon = Cesium.Math.toDegrees(carto.longitude)
        const lat = Cesium.Math.toDegrees(carto.latitude)

        if (_drawType === 'polygon') {
            _drawVertices.push([lon, lat])
            _updateDrawPolyline()
        }
    }, Cesium.ScreenSpaceEventType.LEFT_CLICK)
}

function _updateDrawPolyline() {
    if (_drawPolylineEntity && _viewer) {
        _viewer.entities.remove(_drawPolylineEntity)
        _drawPolylineEntity = null
    }
    if (_drawVertices.length < 2) return
    _drawPolylineEntity = _viewer.entities.add({
        polyline: {
            positions: [..._drawVertices, _drawVertices[0]].map(
                ([lo, la]) => Cesium.Cartesian3.fromDegrees(lo, la, 200)
            ),
            width: 2,
            material: new Cesium.ColorMaterialProperty(Cesium.Color.fromCssColorString('#FFD700').withAlpha(0.5)),
        },
    })
}

function _clearDraw() {
    _isDrawing = false
    _drawVertices = []
    if (_drawPolylineEntity && _viewer) {
        _viewer.entities.remove(_drawPolylineEntity)
        _drawPolylineEntity = null
    }
}

// ── Public API ────────────────────────────────────────────────────────────────
export const alertsLayer = {
    async activate({ viewer }) {
        _viewer = viewer
        const [gfs, log] = await Promise.all([geofencesGetAll(), alertLogGetAll()])
        _geofences = gfs || []
        _alertLog = log || []
        _geofences.forEach(_addGeofenceEntity)
        _setupDrawing()
        _notifyGeofenceChange()
        _notifyLogChange()
    },

    deactivate() {
        _geofences.forEach(gf => _removeGeofenceEntity(gf.id))
        _clearDraw()
        if (_handler) { _handler.destroy(); _handler = null }
        _viewer = null
        _watchSources = []
    },

    tick({ timeMs }) {
        _checkWatchSources(timeMs)
    },

    // ── Geofence management ───────────────────────────────────────────────────
    async addCircleGeofence({ name, lon, lat, radiusKm }) {
        const id = await geofenceAdd({ type: 'circle', name, lon, lat, radiusKm })
        const gf = { id, type: 'circle', name, lon, lat, radiusKm }
        _geofences.push(gf)
        _addGeofenceEntity(gf)
        _notifyGeofenceChange()
    },

    startDrawPolygon() {
        _isDrawing = true
        _drawType = 'polygon'
        _drawVertices = []
    },

    async finishPolygon(name) {
        if (_drawVertices.length < 3) { _clearDraw(); return }
        const polygon = [..._drawVertices]
        const id = await geofenceAdd({ type: 'polygon', name, polygon })
        const gf = { id, type: 'polygon', name, polygon }
        _geofences.push(gf)
        _addGeofenceEntity(gf)
        _clearDraw()
        _notifyGeofenceChange()
    },

    async deleteGeofence(id) {
        await geofenceDelete(id)
        _geofences = _geofences.filter(g => g.id !== id)
        _removeGeofenceEntity(id)
        _notifyGeofenceChange()
    },

    // ── Watch sources ─────────────────────────────────────────────────────────
    addWatchSource(src) {
        if (!_watchSources.find(s => s.id === src.id)) _watchSources.push(src)
    },
    removeWatchSource(id) { _watchSources = _watchSources.filter(s => s.id !== id) },

    // ── Alert log ─────────────────────────────────────────────────────────────
    async clearLog() {
        await alertLogClear()
        _alertLog = []
        _notifyLogChange()
    },

    exportLog() {
        const blob = new Blob([JSON.stringify(_alertLog, null, 2)], { type: 'application/json' })
        const url = URL.createObjectURL(blob)
        const a = document.createElement('a'); a.href = url; a.download = 'dexearth_alerts.json'
        a.click(); setTimeout(() => URL.revokeObjectURL(url), 1000)
    },

    setSoundEnabled(v) { _soundEnabled = v },
    getAlertLog() { return [..._alertLog] },
    getGeofences() { return [..._geofences] },
    onLogChange(fn) { _onLogChange.push(fn) },
    onGeofenceChange(fn) { _onGeofenceChange.push(fn) },
}
