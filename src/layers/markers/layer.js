// ─── Markers Layer ────────────────────────────────────────────────────────────
// Persists markers to IndexedDB. Each marker has a Cesium entity on the globe.

import * as Cesium from 'cesium'
import { markersGetAll, markerAdd, markerUpdate, markerDelete } from '../../storage/db.js'
import { pulseHud } from '../../utils/pulse.js'

const SEVERITY_COLORS = {
    info: '#00FF9F',
    warning: '#FFD700',
    critical: '#FF4444',
    classified: '#CC00FF',
}

let _viewer = null
let _entities = new Map()  // id → Cesium.Entity
let _markers = []          // in-memory copy
let _onChangeCallbacks = []

function _colorForSeverity(sev) {
    return Cesium.Color.fromCssColorString(SEVERITY_COLORS[sev] || SEVERITY_COLORS.info)
}

function _addEntityForMarker(marker) {
    if (!_viewer) return
    const color = _colorForSeverity(marker.severity)

    const entity = _viewer.entities.add({
        id: `marker_${marker.id}`,
        position: Cesium.Cartesian3.fromDegrees(marker.lon, marker.lat, 500),
        point: {
            pixelSize: 10,
            color,
            outlineColor: color.withAlpha(0.3),
            outlineWidth: 3,
        },
        label: {
            text: marker.title,
            font: '12px monospace',
            fillColor: color,
            style: Cesium.LabelStyle.FILL,
            verticalOrigin: Cesium.VerticalOrigin.BOTTOM,
            pixelOffset: new Cesium.Cartesian2(0, -14),
            show: true,
        },
    })
    _entities.set(marker.id, entity)
}

function _removeEntityForMarker(id) {
    const entity = _entities.get(id)
    if (entity && _viewer) _viewer.entities.remove(entity)
    _entities.delete(id)
}

function _notifyChange() {
    _onChangeCallbacks.forEach(fn => { try { fn([..._markers]) } catch { /* ignore */ } })
}

export const markersLayer = {
    async activate({ viewer }) {
        _viewer = viewer
        const stored = await markersGetAll()
        _markers = stored || []
        _markers.forEach(_addEntityForMarker)
    },

    deactivate() {
        _markers.forEach(m => _removeEntityForMarker(m.id))
        _markers = []
        _entities.clear()
        _onChangeCallbacks = []
        _viewer = null
    },

    getGeometrySnapshot() {
        return {
            points: _markers.map(m => ({
                lon: m.lon, lat: m.lat,
                meta: { title: m.title, severity: m.severity, tags: m.tags },
            })),
        }
    },

    // ── CRUD ──────────────────────────────────────────────────────────────────
    async addMarker({ lon, lat, title, tags = [], notes = '', severity = 'info' }) {
        const id = await markerAdd({ lon, lat, title, tags, notes, severity })
        const marker = { id, lon, lat, title, tags, notes, severity, createdAt: Date.now() }
        _markers.push(marker)
        _addEntityForMarker(marker)
        pulseHud('marker', title)
        _notifyChange()
        return marker
    },

    async updateMarker(id, updates) {
        const idx = _markers.findIndex(m => m.id === id)
        if (idx < 0) return
        const updated = { ..._markers[idx], ...updates }
        await markerUpdate(updated)
        _markers[idx] = updated
        _removeEntityForMarker(id)
        _addEntityForMarker(updated)
        _notifyChange()
    },

    async deleteMarker(id) {
        await markerDelete(id)
        _markers = _markers.filter(m => m.id !== id)
        _removeEntityForMarker(id)
        _notifyChange()
    },

    jumpToMarker(id) {
        const marker = _markers.find(m => m.id === id)
        if (!marker || !_viewer) return
        _viewer.camera.flyTo({
            destination: Cesium.Cartesian3.fromDegrees(marker.lon, marker.lat, 500_000),
            duration: 2,
        })
    },

    getMarkers() { return [..._markers] },
    onChange(fn) { _onChangeCallbacks.push(fn) },
}
