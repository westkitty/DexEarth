// ─── Country Overlay Layer API ────────────────────────────────────────────────
// Manages COUNTRY_BORDERS, COUNTRY_LABELS, and COUNTRY_LABELS_FOLLOW layers.
// Follows the same activate/deactivate/tick pattern as Phase II layers.

import * as Cesium from 'cesium'
import { loadCountryGeojson, loadCountryIndex, detailByAltitude } from './loadGeojson.js'
import { buildBorderCollection, highlightBorder } from './buildBorders.js'
import { buildLabelCollection } from './buildLabels.js'
import { buildFollowBorderLabels } from './followBorderLabels.js'

// ── State ─────────────────────────────────────────────────────────────────────
let _viewer = null
let _features = []       // current detail level features
let _currentDetail = null
let _countryIndex = []

// Collections managed per layer
let _borderCollection = null
let _labelCollection = null
let _followCollection = null
let _handler = null       // ScreenSpaceEventHandler for click picking

// Settings
export const settings = {
    borders: false,
    labels: false,
    followLabels: false,
    borderStyle: { color: '#00FFCC', alpha: 0.55, width: 1.2, glow: false },
    labelStyle: { color: '#FFFFFF', outlineColor: '#000000', fontSize: 11, outlineWidth: 2 },
    maxLabels: 200,
    maxFollowLabels: 80,
    followLabelOffset: 0,
    selectedCountry: null,
    onSelectionChange: null,  // callback(countryName, feature|null)
}

let _restoreHighlight = null
let _debounceTimer = null

// ── Internal helpers ───────────────────────────────────────────────────────────

function _currentAlt() {
    if (!_viewer) return 10_000_000
    try {
        return _viewer.camera.positionCartographic.height
    } catch { return 10_000_000 }
}

function _removePrimitive(col) {
    if (col && _viewer) {
        try { _viewer.scene.primitives.remove(col) } catch { /* ignore */ }
    }
}

function _rebuildBorders() {
    _removePrimitive(_borderCollection)
    if (!settings.borders || !_viewer || !_features.length) { _borderCollection = null; return }
    _borderCollection = buildBorderCollection(_features, settings.borderStyle)
    _viewer.scene.primitives.add(_borderCollection)
    // Re-apply highlight if selection exists
    if (settings.selectedCountry && _borderCollection) {
        _restoreHighlight?.()
        _restoreHighlight = highlightBorder(_borderCollection, settings.selectedCountry)
    }
}

function _rebuildLabels() {
    _removePrimitive(_labelCollection)
    if (!settings.labels || !_viewer || !_features.length) { _labelCollection = null; return }
    const altM = _currentAlt()
    _labelCollection = buildLabelCollection({
        features: _features,
        viewer: _viewer,
        altM,
        maxLabels: settings.maxLabels,
        style: settings.labelStyle,
        highlight: settings.selectedCountry,
    })
    _viewer.scene.primitives.add(_labelCollection)
}

function _rebuildFollowLabels() {
    _removePrimitive(_followCollection)
    if (!settings.followLabels || !_viewer || !_features.length) { _followCollection = null; return }
    const altM = _currentAlt()
    _followCollection = buildFollowBorderLabels({
        features: _features,
        viewer: _viewer,
        altM,
        maxLabels: settings.maxFollowLabels,
        style: settings.labelStyle,
        highlight: settings.selectedCountry,
        offset: settings.followLabelOffset,
    })
    _viewer.scene.primitives.add(_followCollection)
}

async function _ensureGeojson() {
    if (!_viewer) return
    const altM = _currentAlt()
    const detail = detailByAltitude(altM)
    if (detail === _currentDetail && _features.length > 0) return
    try {
        const gj = await loadCountryGeojson(detail)
        _features = gj.features || []
        _currentDetail = detail
    } catch (err) {
        console.warn('[CountryOverlay] GeoJSON load failed:', err.message)
        _features = []
    }
}

function _rebuildAll() {
    _rebuildBorders()
    _rebuildLabels()
    _rebuildFollowLabels()
}

function _scheduleRebuild() {
    clearTimeout(_debounceTimer)
    _debounceTimer = setTimeout(async () => {
        await _ensureGeojson()
        _rebuildAll()
    }, 300)
}

// ── Click picking ──────────────────────────────────────────────────────────────

function _setupClickHandler() {
    if (!_viewer) return
    _handler = new Cesium.ScreenSpaceEventHandler(_viewer.scene.canvas)
    _handler.setInputAction(click => {
        const picked = _viewer.scene.pick(click.position)
        if (!picked) return
        const id = picked?.id || picked?.primitive?.id
        if (!id) return
        if (id.type === 'border' || id.type === 'label' || id.type === 'follow_label') {
            selectCountry(id.name)
        }
    }, Cesium.ScreenSpaceEventType.LEFT_CLICK)
}

// ── Public API ────────────────────────────────────────────────────────────────

export function selectCountry(name) {
    settings.selectedCountry = name
    // Refresh highlight on borders
    _restoreHighlight?.()
    _restoreHighlight = null
    if (_borderCollection && name) {
        _restoreHighlight = highlightBorder(_borderCollection, name)
    }
    // Rebuild labels to reflect highlight
    _rebuildLabels()
    _rebuildFollowLabels()
    // Notify UI
    if (settings.onSelectionChange) {
        const feature = _features.find(f => {
            const p = f.properties || {}
            return (p.NAME || p.ADMIN) === name
        })
        settings.onSelectionChange(name, feature)
    }
}

export function clearSelection() {
    _restoreHighlight?.()
    _restoreHighlight = null
    settings.selectedCountry = null
    _rebuildLabels()
    _rebuildFollowLabels()
    if (settings.onSelectionChange) settings.onSelectionChange(null, null)
}

export async function flyToCountry(name, viewer = _viewer) {
    if (!viewer) return
    const idx = await loadCountryIndex()
    const entry = idx.find(e => e.name === name)
    if (!entry) return
    const [minLon, minLat, maxLon, maxLat] = entry.bbox || [-180, -90, 180, 90]
    viewer.camera.flyTo({
        destination: Cesium.Rectangle.fromDegrees(minLon, minLat, maxLon, maxLat),
        duration: 2,
    })
}

// ── Layer interfaces ───────────────────────────────────────────────────────────

export const countryBordersLayer = {
    async activate({ viewer }) {
        _viewer = viewer
        settings.borders = true
        await _ensureGeojson()
        _rebuildBorders()
        _setupClickHandler()
    },
    deactivate() {
        _removePrimitive(_borderCollection)
        _borderCollection = null
        settings.borders = false
        if (!settings.labels && !settings.followLabels) _destroyHandler()
    },
    setStyle(style) {
        Object.assign(settings.borderStyle, style)
        _rebuildBorders()
    },
}

export const countryLabelsLayer = {
    async activate({ viewer }) {
        _viewer = viewer
        settings.labels = true
        await _ensureGeojson()
        _rebuildLabels()
        if (!_handler) _setupClickHandler()
        // Listen for camera move
        viewer.camera.moveEnd.addEventListener(_scheduleRebuild)
    },
    deactivate() {
        _removePrimitive(_labelCollection)
        _labelCollection = null
        settings.labels = false
        if (_viewer) _viewer.camera.moveEnd.removeEventListener(_scheduleRebuild)
        if (!settings.borders && !settings.followLabels) _destroyHandler()
    },
    tick() { /* labels update via camera.moveEnd, not tick */ },
    setStyle(style) { Object.assign(settings.labelStyle, style); _rebuildLabels() },
    setMaxLabels(n) { settings.maxLabels = n; _rebuildLabels() },
}

export const countryFollowLabelsLayer = {
    async activate({ viewer }) {
        _viewer = viewer
        settings.followLabels = true
        await _ensureGeojson()
        _rebuildFollowLabels()
        if (!_handler) _setupClickHandler()
        viewer.camera.moveEnd.addEventListener(_scheduleRebuild)
    },
    deactivate() {
        _removePrimitive(_followCollection)
        _followCollection = null
        settings.followLabels = false
        if (_viewer) _viewer.camera.moveEnd.removeEventListener(_scheduleRebuild)
        if (!settings.borders && !settings.labels) _destroyHandler()
    },
    tick() { /* updates via camera.moveEnd */ },
    setStyle(style) { Object.assign(settings.labelStyle, style); _rebuildFollowLabels() },
    setMaxLabels(n) { settings.maxFollowLabels = n; _rebuildFollowLabels() },
    setOffset(px) { settings.followLabelOffset = px; _rebuildFollowLabels() },
}

function _destroyHandler() {
    if (_handler) { _handler.destroy(); _handler = null }
}

/** Force a full rebuild of all active overlays (called by style manager on preset change). */
export function rebuildAllOverlays() {
    _rebuildAll()
}

/** Update border style used by style manager. */
export function applyOverlayStyle(borderStyle = {}, labelStyle = {}) {
    Object.assign(settings.borderStyle, borderStyle)
    Object.assign(settings.labelStyle, labelStyle)
    _rebuildAll()
}

/** Get current features for external use (correlation engine etc). */
export function getCountryFeatures() { return _features }
