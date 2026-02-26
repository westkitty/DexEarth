// ─── Threat Index Layer ───────────────────────────────────────────────────────
// Global 2° grid scoring from active layer data. Renders as Cesium heat rectangles.

import * as Cesium from 'cesium'
import { haversineKm } from '../../utils/geo.js'

const GRID_DEG = 2       // cell size in degrees
const MAX_CELLS_RENDER = 800  // performance cap on rendered cells

// Default weights (0–1)
export const PRESET_WEIGHTS = {
    wildfire: { thermal: 0.8, seismic: 0.1, maritime: 0.1 },
    geopolitical: { thermal: 0.2, seismic: 0.2, maritime: 0.6 },
    seismic: { thermal: 0.1, seismic: 0.8, maritime: 0.1 },
}

let _viewer = null
let _primitive = null
let _weights = { ...PRESET_WEIGHTS.wildfire }
let _onScore = null
let _lastCells = []

function _buildGrid() {
    const cells = []
    for (let lon = -180; lon < 180; lon += GRID_DEG) {
        for (let lat = -90; lat < 90; lat += GRID_DEG) {
            cells.push({ lon, lat, score: 0 })
        }
    }
    return cells
}

function _scoreCell(cell, snapshots) {
    const { lon, lat } = cell
    const cx = lon + GRID_DEG / 2
    const cy = lat + GRID_DEG / 2
    let score = 0

    // Thermal fires: count points in cell
    const thermal = snapshots.thermal || { points: [] }
    let thermalCount = 0
    for (const p of thermal.points) {
        if (p.lon >= lon && p.lon < lon + GRID_DEG && p.lat >= lat && p.lat < lat + GRID_DEG) {
            thermalCount++
        }
    }
    score += Math.min(thermalCount / 5, 1) * _weights.thermal

    // Seismic events: proximity to cell center
    const seismic = snapshots.seismic || { points: [] }
    for (const p of seismic.points) {
        const d = haversineKm(cx, cy, p.lon, p.lat)
        if (d < 500) {
            const mag = p.meta?.mag || 3
            score += Math.min((mag / 9) * (1 - d / 500), 0.8) * _weights.seismic
        }
    }

    // Maritime lanes: lines that pass through region
    const maritime = snapshots.maritime || { lines: [] }
    for (const line of maritime.lines) {
        for (const [lox, lay] of line.coords) {
            if (lox >= lon && lox < lon + GRID_DEG && lay >= lat && lay < lat + GRID_DEG) {
                score += 0.3 * _weights.maritime
                break
            }
        }
    }

    // Tectonic plates proximity
    const tectonic = snapshots.tectonic || { lines: [] }
    let nearTectonic = Infinity
    for (const line of tectonic.lines) {
        for (const [lox, lay] of (line.coords || [])) {
            const d = haversineKm(cx, cy, lox, lay)
            if (d < nearTectonic) nearTectonic = d
        }
    }
    if (nearTectonic < 800) {
        score += (1 - nearTectonic / 800) * 0.4 * _weights.seismic
    }

    return Math.min(score, 1)
}

function _rebuildPrimitive(scoredCells) {
    if (_primitive) {
        try { _viewer.scene.primitives.remove(_primitive) } catch { /* ignore */ }
        _primitive = null
    }
    if (!_viewer) return

    // Only render high-score cells, sorted descending
    const threshold = 0.05
    const filtered = scoredCells
        .filter(c => c.score > threshold)
        .sort((a, b) => b.score - a.score)
        .slice(0, MAX_CELLS_RENDER)

    if (filtered.length === 0) return

    const instances = []
    for (const cell of filtered) {
        const alpha = Math.min(cell.score * 0.75, 0.7)
        const color = _scoreColor(cell.score).withAlpha(alpha)
        instances.push(new Cesium.GeometryInstance({
            geometry: new Cesium.RectangleGeometry({
                rectangle: Cesium.Rectangle.fromDegrees(
                    cell.lon, cell.lat,
                    cell.lon + GRID_DEG, cell.lat + GRID_DEG
                ),
                height: 500,
            }),
            attributes: {
                color: Cesium.ColorGeometryInstanceAttribute.fromColor(color),
            },
        }))
    }

    try {
        _primitive = new Cesium.Primitive({
            geometryInstances: instances,
            appearance: new Cesium.PerInstanceColorAppearance({
                translucent: true,
                flat: true,
            }),
            releaseGeometryInstances: false,
        })
        _viewer.scene.primitives.add(_primitive)
    } catch (err) {
        console.warn('[ThreatIndex] Primitive creation failed:', err.message)
    }
}

function _scoreColor(score) {
    // Green → Yellow → Red
    if (score < 0.33) return Cesium.Color.fromCssColorString('#00FF66')
    if (score < 0.66) return Cesium.Color.fromCssColorString('#FFD700')
    return Cesium.Color.fromCssColorString('#FF2200')
}

export const threatIndexLayer = {
    activate({ viewer }) {
        _viewer = viewer
    },

    deactivate() {
        if (_primitive && _viewer) {
            try { _viewer.scene.primitives.remove(_primitive) } catch { /* ignore */ }
        }
        _primitive = null
        _viewer = null
        _lastCells = []
    },

    /**
     * Recompute the heat grid from geometry snapshots.
     * Call this when layer snapshots change.
     */
    recompute(snapshots) {
        const cells = _buildGrid()
        const scored = cells.map(c => ({ ...c, score: _scoreCell(c, snapshots) }))
        _lastCells = scored
        _rebuildPrimitive(scored)
        if (_onScore) _onScore(scored)
    },

    setWeights(w) {
        _weights = { ...w }
    },

    setPreset(name) {
        if (PRESET_WEIGHTS[name]) _weights = { ...PRESET_WEIGHTS[name] }
    },

    getCellAtLonLat(lon, lat) {
        const cell = _lastCells.find(c =>
            lon >= c.lon && lon < c.lon + GRID_DEG &&
            lat >= c.lat && lat < c.lat + GRID_DEG
        )
        return cell || null
    },

    onScore(fn) { _onScore = fn },
}
