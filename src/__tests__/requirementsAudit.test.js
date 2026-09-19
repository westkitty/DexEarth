import { describe, it, expect, vi } from 'vitest'
import { ReplayController, validateReplay } from '../state/replay.js'
import { workspace } from './fixtures/workspace.js'
import { createObservation, parseObservation } from '../storage/observations.js'
import { datasetState } from '../data/datasetStatus.js'
import { samplePath } from '../layers/satellites/orbital.js'
import {
  initializePrimaryGeometry,
  publishPrimaryGeometry,
  setPrimaryActive,
  geojsonSnapshot,
  boundGeometry,
} from '../state/primaryGeometry.js'
import { getGeometrySnapshot, applyDegradation, getAllLayers } from '../state/layerRegistry.js'
import { LAYER_DEFS } from '../config.js'

describe('requirement audit regressions', () => {
  it('records a zero-offset initial state even when the wall clock advances during startup', () => {
    let wall = 1000
    const r = new ReplayController({ now: () => wall++, capture: workspace, apply: vi.fn() })
    r.start()
    r.record({ type: 'camera', category: 'LOCAL INTERACTION' })
    r.stop()
    expect(r.session.events[0].offset).toBe(0)
    expect(() => validateReplay(r.session)).not.toThrow()
  })
  it('keeps ordering monotonic when system wall clock moves backwards', () => {
    let wall = 1000
    const r = new ReplayController({ now: () => wall, capture: workspace, apply: vi.fn() })
    r.start()
    wall = 1100
    r.record({ type: 'camera', category: 'LOCAL INTERACTION' })
    wall = 900
    r.record({ type: 'time', category: 'LOCAL INTERACTION' })
    r.stop()
    expect(r.session.events.map(e => e.offset)).toEqual([0, 100, 100])
    expect(() => validateReplay(r.session)).not.toThrow()
  })
  it('steps through same-millisecond local events individually, not just distinct offsets', () => {
    let state = workspace()
    const apply = vi.fn(),
      r = new ReplayController({ now: () => 1000, capture: () => state, apply })
    r.start()
    state = { ...state, style: 'WIREFRAME' }
    r.record({ type: 'style', category: 'LOCAL INTERACTION' })
    r.stop()
    r.reset()
    expect(apply.mock.calls.at(-1)[0].style).toBe('REALISTIC')
    r.step()
    expect(apply.mock.calls.at(-1)[0].style).toBe('WIREFRAME')
    r.step(-1)
    expect(apply.mock.calls.at(-1)[0].style).toBe('REALISTIC')
  })
  it('refuses duplicate marker IDs before Cesium can receive them', () => {
    const o = createObservation('test', workspace())
    o.workspace.markers = [
      { id: 1, title: 'a', lon: 0, lat: 0 },
      { id: 1, title: 'b', lon: 1, lat: 1 },
    ]
    expect(() => parseObservation(JSON.stringify(o))).toThrow()
  })
  it('unknown origin and absent expiry cannot masquerade as fresh data', () => {
    expect(datasetState({})).toBe('UNAVAILABLE')
    expect(datasetState({ source: 'remote', origin: 'network', fetchedAt: Date.now() })).toBe(
      'STALE'
    )
  })
  it('Safe Mode still bounds samples when the caller supplies NaN', () => {
    expect(samplePath(null, 0, { samples: NaN, safeMode: true })).toHaveLength(31)
  })
  it('registers all primary layers and supplies bounded geometry to threat/correlation', () => {
    const data = Object.fromEntries(LAYER_DEFS.map(l => [l.id, {}]))
    initializePrimaryGeometry(data, {
      getGeometrySnapshot: () => ({ points: [{ lon: 1, lat: 2 }] }),
    })
    expect(LAYER_DEFS.every(l => getAllLayers().some(r => r.id === l.id))).toBe(true)
    setPrimaryActive('SEISMIC_GRID', true)
    publishPrimaryGeometry(
      'SEISMIC_GRID',
      geojsonSnapshot({
        features: [
          {
            geometry: { type: 'Point', coordinates: [140, 35] },
            properties: { mag: 6, title: 'fixture' },
          },
        ],
      })
    )
    expect(getGeometrySnapshot('SEISMIC_GRID').points[0].meta.mag).toBe(6)
    applyDegradation('AIR_RADAR', { refreshInterval: 90000 }) // inactive layers retain registry profile only
    setPrimaryActive('AIR_RADAR', true)
    applyDegradation('AIR_RADAR', { refreshInterval: 90000 })
    expect(data.AIR_RADAR.degradation.refreshInterval).toBe(90000)
    setPrimaryActive('SEISMIC_GRID', false)
    expect(getGeometrySnapshot('SEISMIC_GRID')).toBeNull()
    publishPrimaryGeometry('SEISMIC_GRID', { points: [{ lon: 1, lat: 1 }] })
    expect(getGeometrySnapshot('SEISMIC_GRID')).toBeNull()
    const bounded = boundGeometry({
      points: Array.from({ length: 5000 }, () => ({ lon: 0, lat: 0 })),
      lines: Array.from({ length: 1000 }, () => ({
        coords: Array.from({ length: 1000 }, () => [1, 1]),
      })),
    })
    expect(bounded.points).toHaveLength(1000)
    expect(bounded.lines.reduce((n, l) => n + l.coords.length, 0)).toBeLessThanOrEqual(4000)
  })
})
