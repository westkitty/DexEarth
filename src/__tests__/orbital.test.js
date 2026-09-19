import { describe, it, expect } from 'vitest'
import { readFileSync } from 'node:fs'
import { parseTLEs } from '../utils.js'
import {
  orbitalFacts,
  classifyOrbit,
  propagateRecord,
  samplePath,
  splitDateline,
  predictPasses,
  elevationAt,
} from '../layers/satellites/orbital.js'
const record = parseTLEs(readFileSync('public/data/tle/starter.tle', 'utf8'))[0]
const epoch = orbitalFacts(record).epochMs

describe('orbital intelligence (fixtures, not live data)', () => {
  it('classifies shells without calling highly elliptical orbits GEO', () => {
    expect(classifyOrbit({ periodMin: 93, perigeeKm: 400, apogeeKm: 430 })).toBe('LEO')
    expect(classifyOrbit({ periodMin: 720, perigeeKm: 20000, apogeeKm: 20200 })).toBe('MEO')
    expect(classifyOrbit({ periodMin: 1436, perigeeKm: 35700, apogeeKm: 35800 })).toBe('GEO')
    expect(
      classifyOrbit({ periodMin: 1800, perigeeKm: 1000, apogeeKm: 80000, eccentricity: 0.7 })
    ).toBe('OTHER')
    expect(classifyOrbit({ periodMin: NaN })).toBe('UNKNOWN')
  })
  it('propagates deterministically, including after out-of-order queries', () => {
    const a = propagateRecord(record, epoch)
    propagateRecord(record, epoch + 86400000)
    expect(propagateRecord(record, epoch)).toEqual(a)
    expect(a.altKm).toBeGreaterThan(100)
    expect(a.velocityKmS).toBeGreaterThan(5)
  })
  it('keeps age tied to TLE epoch, and rejects invalid records', () => {
    expect(orbitalFacts(record, epoch + 15 * 86400000).stale).toBe(true)
    expect(propagateRecord({ satrec: { no: NaN } }, epoch)).toBeNull()
    expect(propagateRecord(record, NaN)).toBeNull()
    expect(parseTLEs('bad\n1 rubbish\n2 rubbish')).toHaveLength(0)
  })
  it('bounds duration and sampling, with reduced Safe Mode resolution', () => {
    const path = samplePath(record, epoch, { minutes: 1000000, samples: 1000000 })
    expect(path).toHaveLength(181)
    expect(path.at(-1).timeMs - epoch).toBe(180 * 60000)
    expect(samplePath(record, epoch, { samples: 1000, safeMode: true })).toHaveLength(31)
    expect(samplePath(record, epoch, { direction: -1 }).at(-1).timeMs).toBeLessThan(epoch)
  })
  it('splits dateline and propagation gaps without bridging them', () => {
    const pts = [170, 179, -179, -170].map(lon => ({ lon, lat: 0 }))
    expect(splitDateline(pts)).toEqual([pts.slice(0, 2), pts.slice(2)])
    expect(splitDateline([pts[0], pts[1], null, pts[2], pts[3]])).toHaveLength(2)
  })
  it('predicts bounded, repeatable passes with observer identity and elevation', () => {
    const sub = propagateRecord(record, epoch),
      observer = { lon: sub.lon, lat: sub.lat, name: 'fixture observer' }
    expect(elevationAt(record, observer, epoch)).toBeGreaterThan(89)
    const passes = predictPasses(record, observer, epoch)
    expect(passes.length).toBeGreaterThan(0)
    expect(passes).toEqual(predictPasses(record, observer, epoch))
    expect(passes[0].clippedStart).toBe(true)
    expect(passes[0].observer).toEqual(observer)
    expect(passes[0].durationSeconds).toBeGreaterThan(0)
    expect(predictPasses(record, { lon: 999, lat: 0 }, epoch)).toEqual([])
  })
})
