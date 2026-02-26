// ─── Satellites Layer ─────────────────────────────────────────────────────────
// Phase II registry-compatible layer. Manages TLE loading, rendering, caching.

import * as Cesium from 'cesium'
import { loadTLEs } from './tleSources.js'
import { propagateSatellites, buildGroundTracks } from './render.js'
import { throttle } from '../../utils/throttle.js'
import { expiresIn, lastFetched } from '../../storage/cache.js'

let _viewer = null
let _points = null
let _trackLines = null
let _tleRecords = []
let _propagated = []   // last propagated positions, for geometry snapshot
let _groundTrackCount = 0
let _cacheInfo = { source: 'none', fetchedAt: 0, expiresAt: 0 }
let _nameFilter = ''
let _statusCallbacks = []
let _telemetryCallback = null

// Configurable (updated externally by panel)
let _satCap = 250
let _groundTrackCap = 30
let _groundTrackSamples = 45
let _showGroundTracks = false
let _degradation = null

function _notifyStatus(status) {
    _statusCallbacks.forEach(fn => { try { fn(status) } catch { /* ignore */ } })
}

function _notifyTelemetry() {
    if (_telemetryCallback) {
        _telemetryCallback({
            sats: _propagated.length,
            groundTracks: _groundTrackCount,
            source: _cacheInfo.source,
            fetchedAt: _cacheInfo.fetchedAt,
            expiresAt: _cacheInfo.expiresAt,
        })
    }
}

async function _loadAndRender(forceRefresh = false) {
    _notifyStatus('loading')
    const result = await loadTLEs({ forceRefresh })
    _tleRecords = result.records
    _cacheInfo = { source: result.source, fetchedAt: result.fetchedAt, expiresAt: result.expiresAt }

    if (_tleRecords.length === 0) {
        _notifyStatus('error')
        return
    }

    _render()
    _notifyStatus('active')
}

function _render() {
    if (!_points || !_viewer) return
    const now = new Date()
    const cap = _degradation?.satCap ?? _satCap

    _propagated = propagateSatellites(_points, _tleRecords, now, cap, _nameFilter)

    if (_showGroundTracks && _trackLines) {
        const gtCap = _degradation?.groundTrackCap ?? _groundTrackCap
        _groundTrackCount = buildGroundTracks(_trackLines, _tleRecords, now, gtCap, _groundTrackSamples, _nameFilter)
    } else if (_trackLines) {
        _trackLines.removeAll()
        _groundTrackCount = 0
    }

    _notifyTelemetry()
}

// Throttled tick: update at ~3 Hz in live mode
const _throttledRender = throttle(_render, 333)

// ── Public layer interface ────────────────────────────────────────────────────

export const satellitesLayer = {
    async activate({ viewer }) {
        _viewer = viewer
        _points = new Cesium.PointPrimitiveCollection()
        _trackLines = new Cesium.PolylineCollection()
        viewer.scene.primitives.add(_points)
        viewer.scene.primitives.add(_trackLines)
        await _loadAndRender()
    },

    deactivate() {
        if (_viewer && _points) {
            _viewer.scene.primitives.remove(_points)
            _viewer.scene.primitives.remove(_trackLines)
        }
        _points = null
        _trackLines = null
        _tleRecords = []
        _propagated = []
        _groundTrackCount = 0
        _viewer = null
    },

    tick() {
        if (!_points) return
        // Use throttled render
        _throttledRender()
    },

    getGeometrySnapshot() {
        return {
            points: _propagated.map(p => ({
                lon: p.lon, lat: p.lat,
                meta: { name: p.name, alt: p.alt, orbit: p.orbit },
            })),
        }
    },

    applyDegradation(profile) {
        _degradation = profile
    },

    // Extended API for the UI panel
    async refresh() { await _loadAndRender(true) },
    setSatCap(n) { _satCap = n },
    setGroundTrackCap(n) { _groundTrackCap = n },
    setGroundTrackSamples(n) { _groundTrackSamples = n },
    setShowGroundTracks(v) { _showGroundTracks = v; _render() },
    setNameFilter(f) { _nameFilter = f; _render() },
    getCacheInfo() { return { ..._cacheInfo, expiresInStr: expiresIn(_cacheInfo.expiresAt), lastFetchedStr: lastFetched(_cacheInfo.fetchedAt) } },
    onStatus(fn) { _statusCallbacks.push(fn) },
    onTelemetry(fn) { _telemetryCallback = fn },
}
