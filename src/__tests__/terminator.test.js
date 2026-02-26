import { describe, it, expect } from 'vitest'
import { getSubsolarPoint, buildTerminatorPolylineStable } from '../utils/terminator.js'

describe('getSubsolarPoint', () => {
    it('returns lon in [-180, 180] and lat in [-90, 90]', () => {
        const { lon, lat } = getSubsolarPoint(Date.now())
        expect(lon).toBeGreaterThanOrEqual(-180)
        expect(lon).toBeLessThanOrEqual(180)
        expect(lat).toBeGreaterThanOrEqual(-90)
        expect(lat).toBeLessThanOrEqual(90)
    })

    it('returns lat between -23.5 and 23.5 (within tropics)', () => {
        // The sun's declination never exceeds ~23.5° (obliquity of ecliptic)
        const { lat } = getSubsolarPoint(Date.now())
        expect(lat).toBeGreaterThanOrEqual(-24)
        expect(lat).toBeLessThanOrEqual(24)
    })

    it('returns different positions for different times', () => {
        const p1 = getSubsolarPoint(0)
        const p2 = getSubsolarPoint(3_600_000) // 1 hour later
        // Earth rotates ~15°/hour, so lon should differ
        const lonDiff = Math.abs(p2.lon - p1.lon)
        // Allow for wrap-around
        const wrapped = Math.min(lonDiff, 360 - lonDiff)
        expect(wrapped).toBeGreaterThan(10) // at least 10° change per hour
    })

    it('at J2000 epoch, sun is near Capricorn (winter solstice +6d)', () => {
        // J2000.0 = 2000-01-01 12:00 TT ≈ 2000-01-01T11:58:56Z
        // Sun near dec -23° in early January
        const j2000 = Date.UTC(2000, 0, 1, 12, 0, 0)
        const { lat } = getSubsolarPoint(j2000)
        expect(lat).toBeLessThan(-15) // Southern hemisphere in January
    })

    it('at June solstice, sun is near Tropic of Cancer', () => {
        const jun21 = Date.UTC(2024, 5, 21, 12, 0, 0)
        const { lat } = getSubsolarPoint(jun21)
        expect(lat).toBeGreaterThan(15) // Northern hemisphere in June
    })
})

describe('buildTerminatorPolylineStable', () => {
    it('returns exactly ceil(360/stepDeg)+1 points for stepDeg=3', () => {
        const pts = buildTerminatorPolylineStable(Date.now(), 3)
        // steps = 360/3 = 120, plus closing point = 121
        expect(pts.length).toBe(121)
    })

    it('returns array of [lon, lat] pairs', () => {
        const pts = buildTerminatorPolylineStable(Date.now(), 10)
        expect(Array.isArray(pts)).toBe(true)
        for (const [lon, lat] of pts) {
            expect(isFinite(lon)).toBe(true)
            expect(isFinite(lat)).toBe(true)
            expect(lon).toBeGreaterThanOrEqual(-180)
            expect(lon).toBeLessThanOrEqual(180)
            expect(lat).toBeGreaterThanOrEqual(-90)
            expect(lat).toBeLessThanOrEqual(90)
        }
    })

    it('spans approximately the full latitude range', () => {
        // Terminator is a great circle — its points should cover from ~-90 to ~+90 lat
        const pts = buildTerminatorPolylineStable(Date.UTC(2024, 0, 1, 0, 0, 0), 5)
        const lats = pts.map(([, la]) => la)
        const minLat = Math.min(...lats)
        const maxLat = Math.max(...lats)
        expect(maxLat - minLat).toBeGreaterThan(120) // should span >120° in latitude (stepped sampling)
    })

    it('different times produce different subsolar points and thus different terminators', async () => {
        // Compare subsolar points (which are the centers of the terminators)
        // January (sun near -23°) vs June (sun near +23°) should differ
        const jan = getSubsolarPoint(Date.UTC(2024, 0, 1))
        const jun = getSubsolarPoint(Date.UTC(2024, 5, 21))
        expect(Math.abs(jun.lat - jan.lat)).toBeGreaterThan(30) // should differ by ~46°
    })
})
