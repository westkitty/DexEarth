// ─── Country Labels Builder ───────────────────────────────────────────────────
// Creates a Cesium LabelCollection with screen-space collision avoidance.

import * as Cesium from 'cesium'
import { computeRepPoint } from './repPoint.js'

const DEFAULT_LABEL_STYLE = {
    color: '#FFFFFF',
    outlineColor: '#000000',
    fontSize: 11,
    outlineWidth: 2,
}

/**
 * Estimate pixel width for a label string (rough but fast).
 */
function estimateLabelWidth(text, fontSize) {
    return text.length * fontSize * 0.62
}

/**
 * Screen-space collision check. Returns true if newRect overlaps any existing rect.
 * @param {{x,y,w,h}} newRect
 * @param {Array<{x,y,w,h}>} accepted
 */
export function rectsOverlap(newRect, accepted) {
    const { x, y, w, h } = newRect
    const pad = 4  // extra padding between labels
    for (const r of accepted) {
        if (
            x < r.x + r.w + pad &&
            x + w + pad > r.x &&
            y < r.y + r.h + pad &&
            y + h + pad > r.y
        ) return true
    }
    return false
}

/**
 * Build a LabelCollection with camera-height LOD and collision avoidance.
 *
 * @param {object} opts
 * @param {Array} opts.features         Full GeoJSON feature array
 * @param {Cesium.Viewer} opts.viewer
 * @param {number} opts.altM            Current camera altitude in metres
 * @param {number} opts.maxLabels       Cap on rendered labels
 * @param {object} opts.style           {color, outlineColor, fontSize, outlineWidth}
 * @param {string|null} opts.highlight  Country name to force-show highlighted
 * @returns {Cesium.LabelCollection}
 */
export function buildLabelCollection({ features, viewer, altM, maxLabels = 200, style = {}, highlight = null }) {
    const s = { ...DEFAULT_LABEL_STYLE, ...style }
    const fs = s.fontSize
    const fillColor = Cesium.Color.fromCssColorString(s.color)
    const outColor = Cesium.Color.fromCssColorString(s.outlineColor)

    // LOD: at high altitude show only larger countries (approximate by ring point count)
    const minRingLen = altM > 5_000_000 ? 40 : altM > 2_000_000 ? 15 : 0

    const col = new Cesium.LabelCollection()
    const accepted = []
    let rendered = 0

    for (const feature of features) {
        if (rendered >= maxLabels) break
        const p = feature.properties || {}
        const name = p.NAME || p.ADMIN || ''
        if (!name) continue

        // LOD filter: skip tiny countries at high zoom
        const pointCount = feature.geometry?.coordinates?.[0]?.length
            || feature.geometry?.coordinates?.[0]?.[0]?.length || 0
        if (pointCount < minRingLen && name !== highlight) continue

        const rp = computeRepPoint(feature)
        if (!rp) continue

        // Project to screen
        const cart3 = Cesium.Cartesian3.fromDegrees(rp[0], rp[1], 500)
        const screenPt = Cesium.SceneTransforms.wgs84ToWindowCoordinates(viewer.scene, cart3)
        if (!screenPt) continue // behind globe

        const w = estimateLabelWidth(name, fs)
        const h = fs + 4
        const rect = { x: screenPt.x - w / 2, y: screenPt.y - h / 2, w, h }

        const isHighlighted = name === highlight
        if (!isHighlighted && rectsOverlap(rect, accepted)) continue
        accepted.push(rect)

        const isHighlightedCountry = name === highlight
        col.add({
            position: Cesium.Cartesian3.fromDegrees(rp[0], rp[1], 600),
            text: name,
            font: `${isHighlightedCountry ? fs + 2 : fs}px 'JetBrains Mono', monospace`,
            fillColor: isHighlightedCountry ? Cesium.Color.YELLOW : fillColor,
            outlineColor: outColor,
            outlineWidth: s.outlineWidth,
            style: Cesium.LabelStyle.FILL_AND_OUTLINE,
            horizontalOrigin: Cesium.HorizontalOrigin.CENTER,
            verticalOrigin: Cesium.VerticalOrigin.CENTER,
            scaleByDistance: new Cesium.NearFarScalar(500_000, 1.1, 15_000_000, 0.5),
            translucencyByDistance: new Cesium.NearFarScalar(100_000, 1.0, 20_000_000, 0.0),
            id: { type: 'label', name },
        })
        rendered++
    }

    return col
}
