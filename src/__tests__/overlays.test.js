// ─── Overlay Unit Tests ───────────────────────────────────────────────────────
import { describe, it, expect } from 'vitest'
import { ringArea, ringCentroid, pointInRing, ringsBbox, computeRepPoint } from '../overlays/countries/repPoint.js'
import { rectsOverlap } from '../overlays/countries/buildLabels.js'
import { bearing } from '../overlays/countries/followBorderLabels.js'

// ── ringArea ──────────────────────────────────────────────────────────────────
describe('ringArea', () => {
    it('computes positive area for CCW square', () => {
        const sq = [[0, 0], [4, 0], [4, 4], [0, 4], [0, 0]]
        // shoelace for CCW gives positive
        expect(Math.abs(ringArea(sq))).toBeCloseTo(16, 1)
    })
    it('returns near-zero for a line', () => {
        const line = [[0, 0], [1, 0], [2, 0], [0, 0]]
        expect(Math.abs(ringArea(line))).toBeLessThan(0.001)
    })
})

// ── ringCentroid ──────────────────────────────────────────────────────────────
describe('ringCentroid', () => {
    it('returns center of a unit square', () => {
        const sq = [[0, 0], [2, 0], [2, 2], [0, 2], [0, 0]]
        const c = ringCentroid(sq)
        expect(c).not.toBeNull()
        expect(c[0]).toBeCloseTo(1, 1)
        expect(c[1]).toBeCloseTo(1, 1)
    })
    it('returns null for degenerate ring', () => {
        const deg = [[0, 0], [1, 0], [0, 0]]
        expect(ringCentroid(deg)).toBeNull()
    })
})

// ── pointInRing ───────────────────────────────────────────────────────────────
describe('pointInRing', () => {
    const sq = [[0, 0], [10, 0], [10, 10], [0, 10], [0, 0]]
    it('detects interior point', () => {
        expect(pointInRing([5, 5], sq)).toBe(true)
    })
    it('detects exterior point', () => {
        expect(pointInRing([15, 5], sq)).toBe(false)
    })
    it('detects corner-adjacent exterior', () => {
        expect(pointInRing([-1, -1], sq)).toBe(false)
    })
})

// ── ringsBbox ─────────────────────────────────────────────────────────────────
describe('ringsBbox', () => {
    it('returns correct bbox', () => {
        const rings = [[[0, 10], [20, 0], [10, 5], [0, 10]]]
        const [minLon, minLat, maxLon, maxLat] = ringsBbox(rings)
        expect(minLon).toBe(0); expect(minLat).toBe(0)
        expect(maxLon).toBe(20); expect(maxLat).toBe(10)
    })
    it('handles antimeridian-ish case (values kept as-is)', () => {
        const rings = [[[-179, 0], [179, 0], [0, 10], [-179, 0]]]
        const [minLon, , maxLon] = ringsBbox(rings)  // [minLon, minLat, maxLon, maxLat]
        expect(minLon).toBe(-179); expect(maxLon).toBe(179)
    })
})

// ── computeRepPoint ───────────────────────────────────────────────────────────
describe('computeRepPoint', () => {
    it('returns a point for a Polygon feature', () => {
        const feature = {
            geometry: {
                type: 'Polygon',
                coordinates: [[[0, 0], [10, 0], [10, 10], [0, 10], [0, 0]]],
            },
            properties: { NAME: 'Test' },
        }
        const rp = computeRepPoint(feature)
        expect(rp).not.toBeNull()
        expect(rp.length).toBe(2)
    })
    it('returns a point for a MultiPolygon feature', () => {
        const feature = {
            geometry: {
                type: 'MultiPolygon',
                coordinates: [[[[0, 0], [5, 0], [5, 5], [0, 5], [0, 0]]], [[[20, 0], [25, 0], [25, 5], [20, 5], [20, 0]]]],
            },
            properties: {},
        }
        const rp = computeRepPoint(feature)
        expect(rp).not.toBeNull()
    })
    it('returns null for null geometry', () => {
        const feature = { geometry: null, properties: {} }
        expect(computeRepPoint(feature)).toBeNull()
    })
})

// ── rectsOverlap ──────────────────────────────────────────────────────────────
describe('rectsOverlap', () => {
    it('detects overlap', () => {
        const accepted = [{ x: 0, y: 0, w: 100, h: 20 }]
        expect(rectsOverlap({ x: 50, y: 5, w: 80, h: 15 }, accepted)).toBe(true)
    })
    it('allows non-overlapping', () => {
        const accepted = [{ x: 0, y: 0, w: 100, h: 20 }]
        expect(rectsOverlap({ x: 200, y: 200, w: 80, h: 15 }, accepted)).toBe(false)
    })
    it('returns false on empty accepted list', () => {
        expect(rectsOverlap({ x: 0, y: 0, w: 100, h: 20 }, [])).toBe(false)
    })
})

// ── bearing ───────────────────────────────────────────────────────────────────
describe('bearing', () => {
    it('returns ~0 for northward direction', () => {
        const b = bearing(0, 0, 0, 10)
        expect(b).toBeCloseTo(0, 1) // due north
    })
    it('returns ~π/2 for eastward direction', () => {
        const b = bearing(0, 0, 10, 0)
        expect(b).toBeCloseTo(Math.PI / 2, 0)
    })
    it('result is in [0, 2π)', () => {
        for (const [la, lo, lb, lob] of [[0, 0, 5, 5], [0, 0, -5, 5], [0, 0, -5, -5], [0, 0, 5, -5]]) {
            const b = bearing(la, lo, lb, lob)
            expect(b).toBeGreaterThanOrEqual(0)
            expect(b).toBeLessThan(2 * Math.PI)
        }
    })
})
