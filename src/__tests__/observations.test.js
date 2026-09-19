import { describe, it, expect } from 'vitest'
import { createObservation, parseObservation } from '../storage/observations.js'
import { workspace } from './fixtures/workspace.js'
import { datasetState } from '../data/datasetStatus.js'
describe('observation format', () => {
  it('round trips camera, layers, clock and source timestamps without mutation', () => {
    const w = workspace(),
      o = createObservation('Test', w, 'local notes')
    const parsed = parseObservation(JSON.stringify(o))
    expect(parsed.workspace).toEqual(w)
    expect(parsed.version).toBe(1)
    expect(datasetState(parsed.workspace.datasets[0])).toBe('BUNDLED FALLBACK')
    parsed.workspace.camera.lon = 45
    expect(w.camera.lon).toBe(10)
  })
  it.each(['{', '{}', '{"version":2}'])('refuses corrupt/unknown formats %s', text =>
    expect(() => parseObservation(text)).toThrow()
  )
  it('refuses bad ranges, executable layer names, and claimed historical snapshots', () => {
    const o = createObservation('Good', workspace())
    o.workspace.camera.lat = 200
    expect(() => parseObservation(JSON.stringify(o))).toThrow()
    o.workspace = workspace()
    o.workspace.layers.push('__proto__')
    expect(() => parseObservation(JSON.stringify(o))).toThrow()
    o.workspace = workspace()
    o.workspace.datasets[0].historicalSnapshot = true
    expect(() => parseObservation(JSON.stringify(o))).toThrow()
  })
})
