// ─── Satellite Renderer ───────────────────────────────────────────────────────
// Manages a reusable PointPrimitiveCollection and ground track polylines.

import * as Cesium from 'cesium'
import * as satellite from 'satellite.js'

// LEO/MEO/GEO classification from mean motion (rev/day, stored in satrec.no rad/min)
// MEO if period 2h-24h, GEO if ~24h+
function classifyOrbit(satrec) {
    // satrec.no is in rad/min
    const periodMin = (2 * Math.PI) / satrec.no
    if (periodMin < 128) return 'LEO'   // < ~2h8m
    if (periodMin < 1410) return 'MEO'  // < ~23.5h
    return 'GEO'
}

const ORBIT_COLORS = {
    LEO: Cesium.Color.fromCssColorString('#00CFFF').withAlpha(0.85),
    MEO: Cesium.Color.fromCssColorString('#AAFFAA').withAlpha(0.85),
    GEO: Cesium.Color.fromCssColorString('#FF9900').withAlpha(0.85),
}

/**
 * Propagate all satellites and update the point collection.
 * @param {Cesium.PointPrimitiveCollection} points
 * @param {Array<{name, satrec}>} tleRecords
 * @param {Date} now
 * @param {number} cap - max satellites to render
 * @param {string} [nameFilter] - substring filter
 * @returns {Array<{name, lon, lat, alt, orbit}>} propagated positions for snapshot
 */
export function propagateSatellites(points, tleRecords, now, cap, nameFilter = '') {
    points.removeAll()
    const gmst = satellite.gstime(now)

    const result = []
    const filter = nameFilter.trim().toLowerCase()
    let rendered = 0

    for (const { name, satrec } of tleRecords) {
        if (rendered >= cap) break
        if (filter && !name.toLowerCase().includes(filter)) continue

        try {
            const pv = satellite.propagate(satrec, now)
            if (!pv.position) continue
            const geo = satellite.eciToGeodetic(pv.position, gmst)
            const lon = satellite.degreesLong(geo.longitude)
            const lat = satellite.degreesLat(geo.latitude)
            const alt = geo.height * 1000 // km → m

            if (!isFinite(lon) || !isFinite(lat) || !isFinite(alt)) continue

            const orbit = classifyOrbit(satrec)
            const color = ORBIT_COLORS[orbit]

            points.add({
                position: Cesium.Cartesian3.fromDegrees(lon, lat, Math.max(alt, 100_000)),
                color,
                pixelSize: orbit === 'GEO' ? 5 : 3,
                outlineColor: color.withAlpha(0.15),
                outlineWidth: 1,
                id: name,
            })
            rendered++

            result.push({
                name, lon, lat, alt,
                orbit,
                velocity: pv.velocity,
                inclinationDeg: satrec.inclo * (180 / Math.PI),
            })
        } catch {
            /* skip bad record */
        }
    }

    return result
}

/**
 * Build ground tracks for the next 90 minutes for up to `cap` satellites.
 * Returns a PolylineCollection that the caller should add/remove from the scene.
 * @param {Cesium.PolylineCollection} trackLines
 * @param {Array<{name, satrec}>} tleRecords
 * @param {Date} now
 * @param {number} cap - max ground tracks
 * @param {number} samples - points per track (default 45)
 * @param {string} [nameFilter]
 */
export function buildGroundTracks(trackLines, tleRecords, now, cap, samples = 45, nameFilter = '') {
    trackLines.removeAll()
    const stepMs = (90 * 60 * 1000) / samples
    const filter = nameFilter.trim().toLowerCase()
    let count = 0

    for (const { name, satrec } of tleRecords) {
        if (count >= cap) break
        if (filter && !name.toLowerCase().includes(filter)) continue

        const positions = []
        for (let i = 0; i < samples; i++) {
            const t = new Date(now.getTime() + i * stepMs)
            try {
                const pv = satellite.propagate(satrec, t)
                if (!pv.position) continue
                const gmst = satellite.gstime(t)
                const geo = satellite.eciToGeodetic(pv.position, gmst)
                const lon = satellite.degreesLong(geo.longitude)
                const lat = satellite.degreesLat(geo.latitude)
                const alt = geo.height * 1000

                if (isFinite(lon) && isFinite(lat) && isFinite(alt)) {
                    positions.push(Cesium.Cartesian3.fromDegrees(lon, lat, Math.max(alt, 100_000)))
                }
            } catch { /* ignore */ }
        }

        if (positions.length >= 2) {
            trackLines.add({
                positions,
                width: 1,
                material: Cesium.Material.fromType('Color', {
                    color: Cesium.Color.fromCssColorString('#00CFFF').withAlpha(0.2),
                }),
            })
            count++
        }
    }

    return count
}
