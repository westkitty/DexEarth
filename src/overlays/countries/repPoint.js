// ─── Representative Point Computation ────────────────────────────────────────
// For each country, find a good interior point for label placement.

/**
 * Signed area of a ring (shoelace).
 */
export function ringArea(ring) {
    let a = 0
    for (let i = 0, j = ring.length - 1; i < ring.length; j = i++) {
        a += (ring[j][0] + ring[i][0]) * (ring[j][1] - ring[i][1])
    }
    return a / 2
}

/**
 * Centroid of a polygon ring.
 * @returns {[number,number]|null}
 */
export function ringCentroid(ring) {
    let cx = 0, cy = 0, a = 0
    for (let i = 0, j = ring.length - 1; i < ring.length; j = i++) {
        const f = ring[j][0] * ring[i][1] - ring[i][0] * ring[j][1]
        cx += (ring[j][0] + ring[i][0]) * f
        cy += (ring[j][1] + ring[i][1]) * f
        a += f
    }
    a /= 2
    if (Math.abs(a) < 1e-12) return null
    return [cx / (6 * a), cy / (6 * a)]
}

/**
 * Point-inside-polygon test (ray casting).
 */
export function pointInRing(pt, ring) {
    const [px, py] = pt
    let inside = false
    for (let i = 0, j = ring.length - 1; i < ring.length; j = i++) {
        const [xi, yi] = ring[i]; const [xj, yj] = ring[j]
        if (yi > py !== yj > py && px < ((xj - xi) * (py - yi)) / (yj - yi) + xi)
            inside = !inside
    }
    return inside
}

/**
 * Compute bbox over multiple rings.
 * Handles antimeridian naively (just min/max – good enough for labels).
 */
export function ringsBbox(rings) {
    let minLon = Infinity, maxLon = -Infinity, minLat = Infinity, maxLat = -Infinity
    for (const ring of rings) {
        for (const [lon, lat] of ring) {
            if (lon < minLon) minLon = lon
            if (lon > maxLon) maxLon = lon
            if (lat < minLat) minLat = lat
            if (lat > maxLat) maxLat = lat
        }
    }
    return [minLon, minLat, maxLon, maxLat]
}

/**
 * Extract all rings from a GeoJSON geometry (Polygon or MultiPolygon).
 * Returns [{exterior: ring, holes: [ring...]}]
 */
export function extractPolygons(geometry) {
    if (!geometry) return []
    if (geometry.type === 'Polygon') {
        return [{ exterior: geometry.coordinates[0], holes: geometry.coordinates.slice(1) }]
    }
    if (geometry.type === 'MultiPolygon') {
        return geometry.coordinates.map(poly => ({ exterior: poly[0], holes: poly.slice(1) }))
    }
    return []
}

/**
 * Find the polygon with the largest absolute exterior area.
 */
export function largestPolygon(polygons) {
    let best = null, bestArea = 0
    for (const poly of polygons) {
        const a = Math.abs(ringArea(poly.exterior))
        if (a > bestArea) { best = poly; bestArea = a }
    }
    return best
}

/**
 * Compute a reliable representative point for a GeoJSON feature:
 * 1. Centroid of largest exterior ring — if it's inside, use it.
 * 2. Bbox center — if inside, use it.
 * 3. Grid search 5×5 inside bbox — pick first interior point.
 * 4. Fallback to bbox center.
 * @param {object} feature GeoJSON feature
 * @returns {[number,number]} [lon, lat]
 */
export function computeRepPoint(feature) {
    const polys = extractPolygons(feature.geometry)
    if (!polys.length) return null
    const poly = largestPolygon(polys)
    if (!poly) return null
    const ring = poly.exterior

    // 1. Centroid
    const c = ringCentroid(ring)
    if (c && isFinite(c[0]) && isFinite(c[1]) && pointInRing(c, ring)) return c

    // 2. Bbox center
    const [minLon, minLat, maxLon, maxLat] = ringsBbox([ring])
    const center = [(minLon + maxLon) / 2, (minLat + maxLat) / 2]
    if (pointInRing(center, ring)) return center

    // 3. Grid search
    for (let i = 1; i < 6; i++) {
        for (let j = 1; j < 6; j++) {
            const pt = [
                minLon + (maxLon - minLon) * i / 6,
                minLat + (maxLat - minLat) * j / 6,
            ]
            if (pointInRing(pt, ring)) return pt
        }
    }
    return center // last resort
}
