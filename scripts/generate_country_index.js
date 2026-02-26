#!/usr/bin/env node
// generate_country_index.js — Run: node scripts/generate_country_index.js
import { readFileSync, writeFileSync } from 'fs'
import { fileURLToPath } from 'url'
import { dirname, join } from 'path'

const __dirname = dirname(fileURLToPath(import.meta.url))
const ROOT = join(__dirname, '..')

function bbox(rings) {
    // rings: array of [[lon,lat], ...]
    let minLon = Infinity, maxLon = -Infinity, minLat = Infinity, maxLat = -Infinity
    for (const ring of rings) {
        for (const [lon, lat] of ring) {
            if (lon < minLon) minLon = lon
            if (lon > maxLon) maxLon = lon
            if (lat < minLat) minLat = lat
            if (lat > maxLat) maxLat = lat
        }
    }
    return [minLon, minLat, maxLon, maxLat].map(v => +v.toFixed(4))
}

function area(ring) {
    let a = 0
    for (let i = 0, j = ring.length - 1; i < ring.length; j = i++) {
        a += (ring[j][0] + ring[i][0]) * (ring[j][1] - ring[i][1])
    }
    return a / 2
}

function centroid(ring) {
    let cx = 0, cy = 0, a = 0
    for (let i = 0, j = ring.length - 1; i < ring.length; j = i++) {
        const f = ring[j][0] * ring[i][1] - ring[i][0] * ring[j][1]
        cx += (ring[j][0] + ring[i][0]) * f
        cy += (ring[j][1] + ring[i][1]) * f
        a += f
    }
    a /= 2
    if (Math.abs(a) < 1e-10) return null
    return [cx / (6 * a), cy / (6 * a)]
}

function pointInRing(pt, ring) {
    const [px, py] = pt
    let inside = false
    for (let i = 0, j = ring.length - 1; i < ring.length; j = i++) {
        const [xi, yi] = ring[i]; const [xj, yj] = ring[j]
        if (yi > py !== yj > py && px < ((xj - xi) * (py - yi)) / (yj - yi) + xi)
            inside = !inside
    }
    return inside
}

function extractRings(geo) {
    const rings = []
    if (!geo) return rings
    if (geo.type === 'Polygon') {
        for (const ring of geo.coordinates) rings.push(ring)
    } else if (geo.type === 'MultiPolygon') {
        for (const poly of geo.coordinates)
            for (const ring of poly) rings.push(ring)
    }
    return rings
}

function largestExteriorRing(geo) {
    let best = null, bestArea = 0
    if (geo.type === 'Polygon') {
        const a = Math.abs(area(geo.coordinates[0]))
        if (a > bestArea) { best = geo.coordinates[0]; bestArea = a }
    } else if (geo.type === 'MultiPolygon') {
        for (const poly of geo.coordinates) {
            const a = Math.abs(area(poly[0]))
            if (a > bestArea) { best = poly[0]; bestArea = a }
        }
    }
    return best
}

function repPoint(feature) {
    const geo = feature.geometry
    if (!geo) return null
    const ring = largestExteriorRing(geo)
    if (!ring) return null
    const c = centroid(ring)
    if (c && isFinite(c[0]) && isFinite(c[1]) && pointInRing(c, ring))
        return [+c[0].toFixed(4), +c[1].toFixed(4)]
    // bbox center
    const [minLon, minLat, maxLon, maxLat] = bbox([ring])
    const center = [(minLon + maxLon) / 2, (minLat + maxLat) / 2]
    if (pointInRing(center, ring)) return [+center[0].toFixed(4), +center[1].toFixed(4)]
    // grid search
    for (let i = 1; i < 6; i++) for (let j = 1; j < 6; j++) {
        const pt = [minLon + (maxLon - minLon) * i / 6, minLat + (maxLat - minLat) * j / 6]
        if (pointInRing(pt, ring)) return [+pt[0].toFixed(4), +pt[1].toFixed(4)]
    }
    return [+center[0].toFixed(4), +center[1].toFixed(4)]
}

const geojsonPath = join(ROOT, 'public/data/borders/ne_110m_admin_0_countries.geojson')
const outPath = join(ROOT, 'public/data/borders/country_index.json')

const geojson = JSON.parse(readFileSync(geojsonPath, 'utf8'))
const index = []

for (const feature of geojson.features) {
    const p = feature.properties || {}
    const name = p.NAME || p.name || p.ADMIN || p.admin || 'Unknown'
    const iso_a2 = (p.ISO_A2 || p.iso_a2 || '').trim()
    const iso_a3 = (p.ISO_A3 || p.iso_a3 || p.ADM0_A3 || '').trim()
    const allRings = extractRings(feature.geometry)
    const b = allRings.length ? bbox(allRings) : null
    const rp = repPoint(feature)
    index.push({ name, iso_a2, iso_a3, bbox: b, repPoint: rp })
}

index.sort((a, b) => a.name.localeCompare(b.name))
writeFileSync(outPath, JSON.stringify(index, null, 2))
console.log(`Generated ${index.length} entries → ${outPath}`)
