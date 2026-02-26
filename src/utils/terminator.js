// ─── Solar Terminator Math ────────────────────────────────────────────────────
// Self-contained; no external astronomy libraries.
// Returns polyline points [[lon, lat], ...] for the day/night boundary.

const DEG2RAD = Math.PI / 180
const RAD2DEG = 180 / Math.PI

/**
 * Computes the subsolar point (the point on Earth directly under the Sun)
 * for a given UTC timestamp in milliseconds.
 * Returns { lon, lat } in degrees.
 */
export function getSubsolarPoint(ms) {

    // Julian Date
    const JD =
        ms / 86_400_000 + 2_440_587.5

    // Days since J2000.0
    const n = JD - 2_451_545.0

    // Mean longitude of the Sun (degrees)
    const L = (280.46 + 0.9856474 * n) % 360

    // Mean anomaly (degrees)
    const g = (357.528 + 0.9856003 * n) % 360
    const gRad = g * DEG2RAD

    // Ecliptic longitude (degrees)
    const lambda = L + 1.9148 * Math.sin(gRad) + 0.02 * Math.sin(2 * gRad)
    const lambdaRad = lambda * DEG2RAD

    // Obliquity of the ecliptic (degrees) — approximate
    const epsilon = 23.439 - 0.0000004 * n
    const epsilonRad = epsilon * DEG2RAD

    // Right ascension and declination
    const sinDec = Math.sin(epsilonRad) * Math.sin(lambdaRad)
    const dec = Math.asin(sinDec) * RAD2DEG

    // Greenwich Mean Sidereal Time (degrees)
    const GMST = (280.46061837 + 360.98564736629 * (JD - 2_451_545.0)) % 360

    // Sun's hour angle → subsolar longitude
    const RA_deg =
        Math.atan2(Math.cos(epsilonRad) * Math.sin(lambdaRad), Math.cos(lambdaRad)) * RAD2DEG

    let lon = RA_deg - GMST
    // Normalize to [-180, 180]
    lon = ((lon + 540) % 360) - 180

    return { lon, lat: dec }
}

/**
 * Builds the solar terminator as a polyline.
 * The terminator is the great circle 90° from the subsolar point.
 *
 * @param {number} ms - UTC timestamp in milliseconds
 * @param {number} stepDeg - longitude sampling step in degrees (default 3)
 * @returns {Array<[number, number]>} Array of [lon, lat] in degrees
 */
export function buildTerminatorPolyline(ms, stepDeg = 3) {
    const { lon: sunLon, lat: sunLat } = getSubsolarPoint(ms)
    const sunLatRad = sunLat * DEG2RAD

    const points = []
    const steps = Math.round(360 / stepDeg)

    for (let i = 0; i <= steps; i++) {
        const angle = (i / steps) * 2 * Math.PI

        // Terminator parameterized as a great circle perpendicular to the sun direction
        // Using spherical trig: the terminator satisfies sin(lat)sin(sunLat) + cos(lat)cos(sunLat)cos(lon-sunLon) = 0
        // We parameterize by longitude and solve for latitude.
        // Derived from: sun unit vector · point unit vector = 0

        const lon = sunLon + Math.atan2(
            Math.cos(sunLatRad) * Math.sin(angle),
            -Math.sin(sunLatRad) * Math.cos(angle) * Math.cos(angle) - Math.cos(angle)
        ) * RAD2DEG

        const cosLon = Math.cos((lon - sunLon) * DEG2RAD)

        // Terminator latitude: tan(lat) = -cos(lon-sunLon)/tan(sunLat)  [avoiding div by 0]
        let lat
        const tanSunLat = Math.tan(sunLatRad)
        if (Math.abs(tanSunLat) < 1e-10) {
            // Sun near equinox → terminator is a meridian
            lat = (i < steps / 2 ? 1 : -1) * 90
        } else {
            lat = Math.atan(-cosLon / tanSunLat) * RAD2DEG
        }

        // Normalize lon
        let normLon = ((lon + 540) % 360) - 180
        points.push([normLon, Math.max(-89.9, Math.min(89.9, lat))])
    }

    return points
}

/**
 * Alternative approach: sample the terminator by iterating angle around the
 * subsolar-antipodal axis. This is more numerically stable.
 *
 * @param {number} ms
 * @param {number} stepDeg
 * @returns {Array<[number,number]>}
 */
export function buildTerminatorPolylineStable(ms, stepDeg = 3) {
    const { lon: sunLon, lat: sunLat } = getSubsolarPoint(ms)
    // Subsolar point in Cartesian (unit sphere)
    const sunLatRad = sunLat * DEG2RAD
    const sx = Math.cos(sunLatRad) * Math.cos(sunLon * DEG2RAD)
    const sy = Math.cos(sunLatRad) * Math.sin(sunLon * DEG2RAD)
    const sz = Math.sin(sunLatRad)

    // Build two unit vectors perpendicular to the sun direction
    // Use an arbitrary vector not collinear with sun to cross
    const arb = Math.abs(sz) < 0.9 ? [0, 0, 1] : [1, 0, 0]
    const u = normalize(cross([sx, sy, sz], arb))
    const v = normalize(cross([sx, sy, sz], u))

    const steps = Math.round(360 / stepDeg)
    const points = []
    for (let i = 0; i <= steps; i++) {
        const theta = (i / steps) * 2 * Math.PI
        // Point on the great circle 90° from sun
        const px = u[0] * Math.cos(theta) + v[0] * Math.sin(theta)
        const py = u[1] * Math.cos(theta) + v[1] * Math.sin(theta)
        const pz = u[2] * Math.cos(theta) + v[2] * Math.sin(theta)

        const lat = Math.asin(Math.max(-1, Math.min(1, pz))) * RAD2DEG
        const lon = Math.atan2(py, px) * RAD2DEG
        points.push([lon, lat])
    }
    return points
}

function cross([ax, ay, az], [bx, by, bz]) {
    return [ay * bz - az * by, az * bx - ax * bz, ax * by - ay * bx]
}

function normalize([x, y, z]) {
    const len = Math.sqrt(x * x + y * y + z * z)
    if (len < 1e-14) return [0, 0, 1]
    return [x / len, y / len, z / len]
}
