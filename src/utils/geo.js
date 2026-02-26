// ─── Geo Utilities ────────────────────────────────────────────────────────────
// Pure math helpers for distance, grid bucketing, and spatial clustering.
// No Cesium dependency — safe to unit test.

const DEG2RAD = Math.PI / 180
const EARTH_RADIUS_KM = 6371

/** Haversine great-circle distance in kilometres */
export function haversineKm(lon1, lat1, lon2, lat2) {
    const dLat = (lat2 - lat1) * DEG2RAD
    const dLon = (lon2 - lon1) * DEG2RAD
    const a =
        Math.sin(dLat / 2) ** 2 +
        Math.cos(lat1 * DEG2RAD) * Math.cos(lat2 * DEG2RAD) * Math.sin(dLon / 2) ** 2
    return 2 * EARTH_RADIUS_KM * Math.asin(Math.sqrt(a))
}

/**
 * Euclidean approximation: point to line segment, in km.
 * Sufficient for small distances (< ~500km). Input in degrees.
 */
export function pointToSegmentDistKm(px, py, ax, ay, bx, by) {
    // project to km-ish flat space (equirectangular)
    const cosLat = Math.cos(((ay + py) / 2) * DEG2RAD)
    const pxk = px * cosLat, pyk = py
    const axk = ax * cosLat, ayk = ay
    const bxk = bx * cosLat, byk = by

    const abx = bxk - axk, aby = byk - ayk
    const lenSq = abx * abx + aby * aby
    if (lenSq === 0) return haversineKm(px, py, ax, ay)

    const t = Math.max(0, Math.min(1, ((pxk - axk) * abx + (pyk - ayk) * aby) / lenSq))
    const closestX = axk + t * abx
    const closestY = ayk + t * aby
    const dx = (pxk - closestX) * EARTH_RADIUS_KM * DEG2RAD
    const dy = (pyk - closestY) * EARTH_RADIUS_KM * DEG2RAD
    return Math.sqrt(dx * dx + dy * dy)
}

/**
 * Returns a string bucket key for a lon/lat point given a grid cell size in degrees.
 * E.g. gridBucket(10.3, 45.7, 2) → "10_44"
 */
export function gridBucket(lon, lat, degSize) {
    const bLon = Math.floor(lon / degSize) * degSize
    const bLat = Math.floor(lat / degSize) * degSize
    return `${bLon}_${bLat}`
}

/**
 * Simple grid-based clustering.
 * @param {Array<{lon:number, lat:number}>} points
 * @param {number} bucketDeg
 * @returns {Array<{lon:number, lat:number, count:number}>} cluster centroids
 */
export function clusterPoints(points, bucketDeg = 2) {
    const buckets = new Map()
    for (const p of points) {
        const key = gridBucket(p.lon, p.lat, bucketDeg)
        if (!buckets.has(key)) buckets.set(key, { sumLon: 0, sumLat: 0, count: 0 })
        const b = buckets.get(key)
        b.sumLon += p.lon
        b.sumLat += p.lat
        b.count++
    }
    return [...buckets.values()].map(b => ({
        lon: b.sumLon / b.count,
        lat: b.sumLat / b.count,
        count: b.count,
    }))
}

/**
 * Point-in-circle geofence check.
 * @returns {boolean}
 */
export function pointInCircle(lon, lat, centerLon, centerLat, radiusKm) {
    return haversineKm(lon, lat, centerLon, centerLat) <= radiusKm
}

/**
 * Point-in-polygon test (ray casting, equirectangular).
 * @param {number} lon
 * @param {number} lat
 * @param {Array<[number,number]>} polygon  [[lon,lat], ...]
 */
export function pointInPolygon(lon, lat, polygon) {
    let inside = false
    const n = polygon.length
    for (let i = 0, j = n - 1; i < n; j = i++) {
        const [xi, yi] = polygon[i]
        const [xj, yj] = polygon[j]
        const intersects =
            yi > lat !== yj > lat && lon < ((xj - xi) * (lat - yi)) / (yj - yi) + xi
        if (intersects) inside = !inside
    }
    return inside
}
