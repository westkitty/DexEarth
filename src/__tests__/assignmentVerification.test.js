import { afterEach, describe, expect, it, vi } from 'vitest'
import { getOrbitState, updateOrbit, updateOrbitFilter } from '../state/orbitStore.js'
import { subscribeSessionEvents } from '../state/sessionEvents.js'
import { ReplayController, validateReplay } from '../state/replay.js'
import { createObservation, validateWorkspace } from '../storage/observations.js'
import { workspace } from './fixtures/workspace.js'

const defaults = workspace().orbit.filters
afterEach(() => updateOrbit({ filters: { ...defaults } }))

describe('assignment: filters remain recordable and saveable', () => {
  it.each([
    ['minAlt', 400, 'maxAlt', 100, 400],
    ['maxAlt', 100, 'minAlt', 400, 100],
    ['minInclination', 100, 'maxInclination', 40, 100],
    ['maxInclination', 40, 'minInclination', 100, 40],
  ])('keeps %s and its paired bound ordered', (key, value, other, old, expected) => {
    updateOrbit({ filters: { ...defaults, [other]: old } })
    updateOrbitFilter(key, value)
    expect(getOrbitState().filters[key]).toBe(value)
    expect(getOrbitState().filters[other]).toBe(expected)
    const w = workspace()
    w.orbit.filters = getOrbitState().filters
    expect(() => createObservation('Filtered', w)).not.toThrow()
  })
  it('does not emit a state an active recording cannot validate', () => {
    const capture = () => {
      const w = workspace()
      w.orbit.filters = getOrbitState().filters
      return w
    }
    const r = new ReplayController({ capture, apply: vi.fn() })
    r.start()
    const unsubscribe = subscribeSessionEvents(e => r.record(e))
    try {
      updateOrbitFilter('minAlt', 400)
      expect(() => updateOrbitFilter('maxAlt', 100)).not.toThrow()
      updateOrbitFilter('minInclination', 100)
      expect(() => updateOrbitFilter('maxInclination', 40)).not.toThrow()
      r.stop()
      expect(() => validateReplay(r.session)).not.toThrow()
      expect(r.session.events).toHaveLength(5)
    } finally {
      unsubscribe()
    }
  })
  it('rejects nonfinite inputs without poisoning existing filters', () => {
    const before = structuredClone(getOrbitState().filters)
    updateOrbitFilter('minAlt', NaN)
    updateOrbitFilter('maxInclination', Infinity)
    expect(getOrbitState().filters).toEqual(before)
  })
  it('clamps numeric limits and preserves independent search/shell/watch filters', () => {
    updateOrbitFilter('maxAlt', 200000)
    updateOrbitFilter('minInclination', -50)
    updateOrbitFilter('search', 'ISS')
    updateOrbitFilter('orbit', 'LEO')
    updateOrbitFilter('watchedOnly', true)
    expect(getOrbitState().filters).toMatchObject({
      maxAlt: 100000,
      minInclination: 0,
      search: 'ISS',
      orbit: 'LEO',
      watchedOnly: true,
    })
  })
})

it('refuses marker IDs that collide after Cesium string serialization', () => {
  const w = workspace()
  w.markers = [
    { id: 1, title: 'number', lon: 0, lat: 0 },
    { id: '1', title: 'string', lon: 1, lat: 1 },
  ]
  expect(() => validateWorkspace(w)).toThrow()
})

it.each([
  { tags: 'not an array' },
  { tags: [null] },
  { tags: [17] },
  { tags: ['x'.repeat(101)] },
  { notes: {} },
  { severity: {} },
])('refuses marker metadata unsafe for the rendered tools: %j', patch => {
  const w = workspace()
  w.markers = [{ id: 1, title: 'Imported marker', lon: 0, lat: 0, ...patch }]
  expect(() => validateWorkspace(w)).toThrow()
})
