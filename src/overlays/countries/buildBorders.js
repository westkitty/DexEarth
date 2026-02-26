// ─── Country Borders Builder ──────────────────────────────────────────────────
// Creates a Cesium PolylineCollection from GeoJSON country boundaries.

import * as Cesium from 'cesium'

const DEFAULT_STYLE = {
    color: '#00FFCC',
    alpha: 0.55,
    width: 1.2,
    glow: false,
}

/**
 * Extract exterior rings from GeoJSON geometry (handles Polygon + MultiPolygon).
 * Skips holes by default. Optionally wraps antimeridian splits.
 */
function extractExteriorRings(geometry) {
    if (!geometry) return []
    if (geometry.type === 'Polygon') return [geometry.coordinates[0]]
    if (geometry.type === 'MultiPolygon') return geometry.coordinates.map(p => p[0])
    return []
}

/**
 * Build Cesium Cartesian3 positions from a ring, clamped slightly above surface.
 */
function ringToPositions(ring, altitude = 150) {
    return ring.map(([lon, lat]) => Cesium.Cartesian3.fromDegrees(lon, lat, altitude))
}

/**
 * Build a PolylineCollection from GeoJSON features.
 * @param {Array} features - GeoJSON features
 * @param {object} style - {color, alpha, width, glow}
 * @returns {Cesium.PolylineCollection}
 */
export function buildBorderCollection(features, style = {}) {
    const s = { ...DEFAULT_STYLE, ...style }
    const color = Cesium.Color.fromCssColorString(s.color).withAlpha(s.alpha)
    const col = new Cesium.PolylineCollection()

    for (const feature of features) {
        const rings = extractExteriorRings(feature.geometry)
        for (const ring of rings) {
            if (ring.length < 2) continue
            const positions = ringToPositions(ring)
            if (positions.length < 2) continue

            let material
            if (s.glow) {
                material = Cesium.Material.fromType('PolylineGlow', {
                    glowPower: 0.15,
                    color,
                })
            } else {
                material = Cesium.Material.fromType('Color', { color })
            }

            col.add({
                positions,
                width: s.width,
                material,
                id: { type: 'border', name: feature.properties?.NAME || feature.properties?.ADMIN || '' },
            })
        }
    }
    return col
}

/**
 * Update an existing PolylineCollection's style (color/alpha/width/glow).
 * Much cheaper than rebuilding the whole collection.
 */
export function updateBorderStyle(collection, style = {}) {
    const s = { ...DEFAULT_STYLE, ...style }
    const color = Cesium.Color.fromCssColorString(s.color).withAlpha(s.alpha)
    for (let i = 0; i < collection.length; i++) {
        const line = collection.get(i)
        line.width = s.width
        if (s.glow) {
            line.material = Cesium.Material.fromType('PolylineGlow', { glowPower: 0.15, color })
        } else {
            line.material = Cesium.Material.fromType('Color', { color })
        }
    }
}

/**
 * Highlight a country's border by name (makes it brighter + thicker temporarily).
 * Returns a restore function.
 */
export function highlightBorder(collection, name, highlightColor = '#FFFF00') {
    const hColor = Cesium.Color.fromCssColorString(highlightColor).withAlpha(1.0)
    const restored = []
    for (let i = 0; i < collection.length; i++) {
        const line = collection.get(i)
        if (line.id?.name === name) {
            const origMat = line.material
            const origWidth = line.width
            line.material = Cesium.Material.fromType('Color', { color: hColor })
            line.width = Math.max(line.width * 2.5, 3)
            restored.push({ line, origMat, origWidth })
        }
    }
    return () => {
        for (const { line, origMat, origWidth } of restored) {
            line.material = origMat
            line.width = origWidth
        }
    }
}
