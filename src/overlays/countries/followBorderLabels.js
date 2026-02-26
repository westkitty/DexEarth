// ─── Border-Following Labels (Mode 1) ────────────────────────────────────────
// Places country name labels rotated to align with the longest border segment.
// Uses canvas-drawn text as a Billboard image for rotation support.

import * as Cesium from 'cesium'
import { extractPolygons, largestPolygon } from './repPoint.js'

const CANVAS_CACHE = new Map()

/**
 * Compute bearing in radians from point A→B (lon/lat in degrees).
 * Returns value in [0, 2π).
 */
export function bearing(lonA, latA, lonB, latB) {
    const DEG = Math.PI / 180
    const dLon = (lonB - lonA) * DEG
    const φ1 = latA * DEG, φ2 = latB * DEG
    const x = Math.sin(dLon) * Math.cos(φ2)
    const y = Math.cos(φ1) * Math.sin(φ2) - Math.sin(φ1) * Math.cos(φ2) * Math.cos(dLon)
    return (Math.atan2(x, y) + 2 * Math.PI) % (2 * Math.PI)
}

/**
 * Length of a polyline segment in degrees² (good enough for choosing longest).
 */
function segmentLengthSq(ring, i) {
    const [x0, y0] = ring[i]; const [x1, y1] = ring[(i + 1) % ring.length]
    const dx = x1 - x0, dy = y1 - y0
    return dx * dx + dy * dy
}

/**
 * Find the mid-point and bearing of the longest straight segment in the ring.
 */
function longestSegmentMidBearing(ring) {
    let bestIdx = 0, bestLen = 0
    for (let i = 0; i < ring.length - 1; i++) {
        const len = segmentLengthSq(ring, i)
        if (len > bestLen) { bestLen = len; bestIdx = i }
    }
    const [x0, y0] = ring[bestIdx]; const [x1, y1] = ring[(bestIdx + 1) % ring.length]
    const mid = [(x0 + x1) / 2, (y0 + y1) / 2]
    let b = bearing(x0, y0, x1, y1)
    // Ensure text reads left-to-right (flip if pointing into left half-circle)
    if (b > Math.PI / 2 && b < (3 * Math.PI) / 2) b += Math.PI
    return { mid, bearing: b % (2 * Math.PI) }
}

/**
 * Draw text on canvas and return a Data URL.
 * Uses a simple off-screen canvas for maximum compat.
 */
function makeTextCanvas(text, fontSize = 12, color = '#00FFCC', outlineColor = '#000000', offset = 0) {
    const key = `${text}|${fontSize}|${color}|${outlineColor}|${offset}`
    if (CANVAS_CACHE.has(key)) return CANVAS_CACHE.get(key)

    const canvas = document.createElement('canvas')
    const ctx = canvas.getContext('2d')
    const font = `bold ${fontSize}px 'JetBrains Mono', monospace`
    ctx.font = font
    const w = Math.ceil(ctx.measureText(text).width) + 16
    const h = fontSize + 12
    canvas.width = w; canvas.height = h
    ctx.font = font
    ctx.textBaseline = 'middle'
    ctx.textAlign = 'center'
    // Outline
    ctx.strokeStyle = outlineColor
    ctx.lineWidth = 3
    ctx.lineJoin = 'round'
    ctx.strokeText(text, w / 2, h / 2)
    // Fill
    ctx.fillStyle = color
    ctx.fillText(text, w / 2, h / 2)

    const url = canvas.toDataURL()
    CANVAS_CACHE.set(key, url)
    return url
}

/**
 * Build a BillboardCollection with border-aligned text labels.
 */
export function buildFollowBorderLabels({ features, viewer, altM, maxLabels = 80, style = {}, highlight = null, offset = 0 }) {
    const fontSize = style.fontSize || 11
    const color = style.color || '#00FFCC'
    const outlineColor = style.outlineColor || '#000000'

    // LOD: fewer labels zoomed way out
    const minRingLen = altM > 5_000_000 ? 60 : altM > 2_000_000 ? 20 : 0

    const col = new Cesium.BillboardCollection({ scene: viewer.scene })
    let rendered = 0

    for (const feature of features) {
        if (rendered >= maxLabels) break
        const p = feature.properties || {}
        const name = p.NAME || p.ADMIN || ''
        if (!name) continue

        const polys = extractPolygons(feature.geometry)
        if (!polys.length) continue
        const largest = largestPolygon(polys)
        if (!largest) continue
        const ring = largest.exterior

        if (ring.length < minRingLen && name !== highlight) continue

        const { mid, bearing: b } = longestSegmentMidBearing(ring)

        const isHighlight = name === highlight
        const fs = isHighlight ? fontSize + 2 : fontSize
        const c = isHighlight ? '#FFFF00' : color
        const dataUrl = makeTextCanvas(name, fs, c, outlineColor, offset)

        col.add({
            position: Cesium.Cartesian3.fromDegrees(mid[0], mid[1], 300 + offset),
            image: dataUrl,
            rotation: -b,   // Cesium billboards rotate CCW; negate for E-of-N convention
            alignedAxis: Cesium.Cartesian3.UNIT_Z,
            scaleByDistance: new Cesium.NearFarScalar(800_000, 1.1, 12_000_000, 0.4),
            translucencyByDistance: new Cesium.NearFarScalar(200_000, 1.0, 18_000_000, 0.0),
            id: { type: 'follow_label', name },
        })
        rendered++
    }

    return col
}
