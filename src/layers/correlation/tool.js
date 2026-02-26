// ─── Correlation Tool ─────────────────────────────────────────────────────────
// Computes geometry correlations between any two active layers via geometry snapshots.

import * as Cesium from 'cesium'
import { haversineKm, pointToSegmentDistKm } from '../../utils/geo.js'

const MAX_COMPUTATIONS = 50_000  // hard cap

let _viewer = null
let _highlightEntities = []

function _clearHighlights() {
    if (!_viewer) return
    _highlightEntities.forEach(e => _viewer.entities.remove(e))
    _highlightEntities = []
}

/**
 * Point-to-point correlation.
 */
function correlatePointToPoint(pts1, pts2, radiusKm) {
    const hits = []
    let ops = 0
    for (const a of pts1) {
        for (const b of pts2) {
            ops++
            if (ops > MAX_COMPUTATIONS) return { hits, capped: true }
            const d = haversineKm(a.lon, a.lat, b.lon, b.lat)
            if (d <= radiusKm) hits.push({ a, b, distKm: d })
        }
    }
    return { hits, capped: false }
}

/**
 * Point-to-line correlation.
 */
function correlatePointToLine(pts, lines, radiusKm, sampleEvery = 1) {
    const hits = []
    let ops = 0
    for (const pt of pts) {
        for (const line of lines) {
            const coords = line.coords
            for (let i = 0; i < coords.length - 1; i += sampleEvery) {
                ops++
                if (ops > MAX_COMPUTATIONS) return { hits, capped: true }
                const [ax, ay] = coords[i]
                const [bx, by] = coords[Math.min(i + sampleEvery, coords.length - 1)]
                const d = pointToSegmentDistKm(pt.lon, pt.lat, ax, ay, bx, by)
                if (d <= radiusKm) {
                    hits.push({ point: pt, line, segIdx: i, distKm: d })
                    break  // one hit per line per point is enough
                }
            }
        }
    }
    return { hits, capped: false }
}

/**
 * Line-to-line nearest approach.
 */
function correlateLineToLine(lines1, lines2, radiusKm, sampleEvery = 3) {
    const hits = []
    let ops = 0
    for (const l1 of lines1) {
        for (const l2 of lines2) {
            let nearest = Infinity
            for (let i = 0; i < l1.coords.length; i += sampleEvery) {
                const [px, py] = l1.coords[i]
                for (let j = 0; j < l2.coords.length - 1; j += sampleEvery) {
                    ops++
                    if (ops > MAX_COMPUTATIONS) return { hits, capped: true }
                    const [ax, ay] = l2.coords[j]
                    const [bx, by] = l2.coords[Math.min(j + sampleEvery, l2.coords.length - 1)]
                    const d = pointToSegmentDistKm(px, py, ax, ay, bx, by)
                    if (d < nearest) nearest = d
                }
            }
            if (nearest <= radiusKm) hits.push({ l1, l2, distKm: nearest })
        }
    }
    return { hits, capped: false }
}

/**
 * Highlight correlation hits on the globe.
 */
function _highlightHits(hits, type) {
    _clearHighlights()
    if (!_viewer) return

    const color = Cesium.Color.fromCssColorString('#FF00FF').withAlpha(0.9)
    const done = new Set()

    const addPoint = (lon, lat) => {
        const key = `${lon.toFixed(2)}_${lat.toFixed(2)}`
        if (done.has(key)) return
        done.add(key)
        _highlightEntities.push(_viewer.entities.add({
            position: Cesium.Cartesian3.fromDegrees(lon, lat, 5000),
            point: { pixelSize: 8, color, outlineColor: color.withAlpha(0.3), outlineWidth: 3 },
        }))
    }

    for (const hit of hits.slice(0, 200)) {
        if (type === 'p2p') {
            addPoint(hit.a.lon, hit.a.lat)
            addPoint(hit.b.lon, hit.b.lat)
        } else if (type === 'p2l') {
            addPoint(hit.point.lon, hit.point.lat)
        } else if (type === 'l2l') {
            // mark midpoint of first segment hit
            if (hit.l1.coords.length > 0) {
                const [lo, la] = hit.l1.coords[0]
                addPoint(lo, la)
            }
        }
    }
}

/**
 * Export results as downloadable JSON.
 */
function exportResults(results) {
    const blob = new Blob([JSON.stringify(results, null, 2)], { type: 'application/json' })
    const url = URL.createObjectURL(blob)
    const a = document.createElement('a'); a.href = url; a.download = 'dexearth_correlation.json'
    a.click(); setTimeout(() => URL.revokeObjectURL(url), 1000)
}

// ── Public API ────────────────────────────────────────────────────────────────
export const correlationTool = {
    init(viewer) { _viewer = viewer },

    clearHighlights: _clearHighlights,

    run({ snap1, snap2, operation, radiusKm, sampleEvery = 3 }) {
        const pts1 = (snap1?.points || [])
        const pts2 = (snap2?.points || [])
        const lines1 = (snap1?.lines || [])
        const lines2 = (snap2?.lines || [])

        let result
        if (operation === 'p2p') {
            result = correlatePointToPoint(pts1, pts2, radiusKm)
            _highlightHits(result.hits, 'p2p')
        } else if (operation === 'p2l') {
            result = correlatePointToLine(pts1, lines2.length ? lines2 : lines1, radiusKm, sampleEvery)
            _highlightHits(result.hits, 'p2l')
        } else if (operation === 'l2l') {
            result = correlateLineToLine(lines1, lines2, radiusKm, sampleEvery)
            _highlightHits(result.hits, 'l2l')
        } else {
            return { hits: [], capped: false, error: 'Unknown operation' }
        }

        return { ...result, operation, radiusKm, hitCount: result.hits.length }
    },

    export: exportResults,
}
