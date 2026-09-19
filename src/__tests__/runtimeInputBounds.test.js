import { beforeEach, afterEach, describe, it, expect, vi } from 'vitest'
import { seismicSimLayer } from '../layers/seismicSim/layer.js'
import * as tc from '../state/timeController.js'
vi.mock('../utils/pulse.js', () => ({ pulseHud: vi.fn() }))
beforeEach(() => {
  vi.stubGlobal('requestAnimationFrame', vi.fn())
  vi.stubGlobal('cancelAnimationFrame', vi.fn())
  tc.setMode('MANUAL')
  tc.setManualTime(1700000000000)
  tc.setReplaySpeed(1)
  seismicSimLayer.clearEvents()
})
afterEach(() => {
  tc.setMode('LIVE')
  vi.unstubAllGlobals()
})
const event = { lon: 1, lat: 2, mag: 6, depthKm: 10, originMs: 1700000000000 }
describe('local input cannot poison captured workspace state', () => {
  it.each([
    { lon: NaN },
    { lat: 91 },
    { mag: 13 },
    { mag: -1 },
    { depthKm: 1001 },
    { originMs: Infinity },
  ])('rejects invalid seismic parameters %j without an event', patch => {
    expect(seismicSimLayer.addEvent({ ...event, ...patch })).toBeNull()
    expect(seismicSimLayer.getEvents()).toEqual([])
  })
  it('accepts boundary values and enforces the existing simulation cap', () => {
    for (let i = 0; i < 100; i++)
      expect(seismicSimLayer.addEvent({ ...event, mag: 12 })).not.toBeNull()
    expect(seismicSimLayer.addEvent(event)).toBeNull()
    expect(seismicSimLayer.getEvents()).toHaveLength(100)
  })
  it.each([NaN, Infinity, 9e15, 'tomorrow'])(
    'rejects invalid controller time %s without changing the clock',
    value => {
      const initial = tc.getTimeMs()
      tc.setManualTime(value)
      expect(tc.getTimeMs()).toBe(initial)
      tc.setSessionTime(value)
      expect(tc.getMode()).toBe('MANUAL')
      expect(tc.getTimeMs()).toBe(initial)
    }
  )
  it.each([NaN, Infinity, -1, 1001])('rejects unsupported replay speed %s', value => {
    tc.setReplaySpeed(value)
    expect(tc.getReplaySpeed()).toBe(1)
  })
  it('rejects an invalid step without switching mode or time', () => {
    const time = tc.getTimeMs()
    tc.step(NaN)
    expect(tc.getTimeMs()).toBe(time)
    tc.setStepSize(NaN)
    expect(tc.getStepSize()).toBe(60000)
  })
  it('rejects prototype property names as time modes', () => {
    expect(() => tc.setMode('toString')).toThrow()
    expect(tc.getMode()).toBe('MANUAL')
  })
})
