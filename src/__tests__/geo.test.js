import { describe, it, expect } from 'vitest'
import {
    haversineKm,
    pointToSegmentDistKm,
    gridBucket,
    clusterPoints,
    pointInCircle,
    pointInPolygon,
} from '../utils/geo.js'

describe('haversineKm', () => {
    it('London to Paris is approximately 340 km', () => {
        const d = haversineKm(-0.12, 51.5, 2.35, 48.85)
        expect(d).toBeGreaterThan(330)
        expect(d).toBeLessThan(360)
    })

    it('same point returns 0', () => {
        expect(haversineKm(10, 20, 10, 20)).toBeCloseTo(0, 3)
    })

    it('equatorial degree is approximately 111 km', () => {
        const d = haversineKm(0, 0, 1, 0)
        expect(d).toBeGreaterThan(110)
        expect(d).toBeLessThan(115)
    })

    it('half-earth distance is pi * R ≈ 20015 km', () => {
        const d = haversineKm(0, 0, 180, 0)
        expect(d).toBeGreaterThan(20000)
        expect(d).toBeLessThan(20050)
    })
})

describe('pointToSegmentDistKm', () => {
    it('point on segment returns near 0', () => {
        // Point midway on segment from (0,0)→(2,0)
        const d = pointToSegmentDistKm(1, 0, 0, 0, 2, 0)
        expect(d).toBeLessThan(1)
    })

    it('point perpendicular to segment returns positive distance', () => {
        // Point at (1,1), segment from (0,0)→(2,0)
        const d = pointToSegmentDistKm(1, 1, 0, 0, 2, 0)
        expect(d).toBeGreaterThan(0)
        expect(d).toBeLessThan(200) // should be roughly 111 km for 1 degree lat
    })

    it('point beyond endpoint clamps to endpoint', () => {
        const d = pointToSegmentDistKm(5, 0, 0, 0, 2, 0)
        // Should be distance from (5,0) to (2,0) ≈ 3 * 111km
        expect(d).toBeGreaterThan(200)
    })
})

describe('gridBucket', () => {
    it('returns a consistent string key', () => {
        const b = gridBucket(10.5, 45.3, 2)
        expect(typeof b).toBe('string')
        expect(b).toBe('10_44')
    })

    it('nearby points get same bucket', () => {
        const b1 = gridBucket(10.1, 45.1, 2)
        const b2 = gridBucket(11.9, 45.9, 2)
        expect(b1).toBe(b2)
    })

    it('points in different cells get different buckets', () => {
        const b1 = gridBucket(10.0, 44.0, 2)
        const b2 = gridBucket(12.1, 46.1, 2)
        expect(b1).not.toBe(b2)
    })
})

describe('clusterPoints', () => {
    it('groups nearby points into same cluster', () => {
        const pts = [
            { lon: 10.1, lat: 45.1 }, { lon: 10.3, lat: 45.2 },
            { lon: 50.1, lat: 10.0 },
        ]
        const clusters = clusterPoints(pts, 2)
        // First two should cluster together
        expect(clusters.length).toBe(2)
        const big = clusters.find(c => c.count === 2)
        expect(big).toBeTruthy()
    })
})

describe('pointInCircle', () => {
    it('returns true for point inside circle', () => {
        expect(pointInCircle(0, 0, 0, 0, 100)).toBe(true)
    })

    it('returns false for point outside circle', () => {
        expect(pointInCircle(10, 10, 0, 0, 100)).toBe(false)
    })
})

describe('pointInPolygon', () => {
    const square = [[0, 0], [10, 0], [10, 10], [0, 10]]
    it('returns true for point inside polygon', () => {
        expect(pointInPolygon(5, 5, square)).toBe(true)
    })

    it('returns false for point outside polygon', () => {
        expect(pointInPolygon(15, 5, square)).toBe(false)
    })
})
