import { markersLayer } from '../layers/markers/layer.js'
import { describe, it, expect, vi } from 'vitest'
import { workspace } from './fixtures/workspace.js'
vi.mock('../layers/satellites/layer.js', () => ({
  satellitesLayer: { isActive: () => true, activate: vi.fn(), deactivate: vi.fn() },
}))
vi.mock('../layers/markers/layer.js', () => ({
  markersLayer: {
    getMarkers: vi.fn(() => []),
    isActive: vi.fn(() => false),
    showSnapshot: vi.fn(),
  },
}))
vi.mock('../layers/seismicSim/layer.js', () => ({
  seismicSimLayer: { getEvents: () => [], activate: vi.fn(), restoreEvents: vi.fn() },
}))
vi.mock('../layers/cascade/model.js', () => ({
  cascadeModel: { getState: () => ({ activeEvents: [] }), restoreEvents: vi.fn() },
}))
vi.mock('../visuals/styleManager.js', () => ({
  getCurrentPresetId: () => 'REALISTIC',
  applyPreset: vi.fn(),
}))
vi.mock('../overlays/countries/index.js', () => ({
  settings: { borders: false, labels: false, followLabels: false },
  countryBordersLayer: {},
  countryLabelsLayer: {},
  countryFollowLabelsLayer: {},
}))
import { configureWorkspace, applyWorkspace, captureWorkspace } from '../state/workspace.js'
import { getMode, getTimeMs } from '../state/timeController.js'
import { publishDataset, getActiveDataset } from '../data/datasetStatus.js'
describe('workspace restoration integration', () => {
  it('captures the displayed marker snapshot rather than substituting persistent records', () => {
    configureWorkspace({
      viewer: {
        isDestroyed: () => false,
        camera: {
          positionCartographic: { longitude: 0, latitude: 0, height: 1 },
          heading: 0,
          pitch: 0,
          roll: 0,
        },
      },
      toggles: {},
      restoreLayers: vi.fn(),
    })
    markersLayer.isActive.mockReturnValueOnce(true)
    markersLayer.getMarkers.mockReturnValueOnce([
      { id: 'snapshot-1', title: 'Visible snapshot', lon: 1, lat: 2 },
    ])
    expect(captureWorkspace().markers[0].title).toBe('Visible snapshot')
  })
  it('restores camera/layers/clock, preserving active dataset timestamps', () => {
    const setView = vi.fn(),
      restoreLayers = vi.fn(),
      w = workspace()
    configureWorkspace({
      viewer: {
        isDestroyed: () => false,
        camera: {
          setView,
          positionCartographic: { longitude: 0, latitude: 0, height: 1 },
          heading: 0,
          pitch: 0,
          roll: 0,
        },
      },
      toggles: { ORBITAL_MATH: true },
      restoreLayers,
    })
    publishDataset('tle_data', { source: 'stale_cache', fetchedAt: 100, expiresAt: 200 })
    applyWorkspace(w)
    expect(setView).toHaveBeenCalledOnce()
    expect(restoreLayers).toHaveBeenCalledWith(['ORBITAL_MATH'])
    expect(getMode()).toBe('MANUAL')
    expect(getTimeMs()).toBe(w.time.timeMs)
    expect(getActiveDataset('tle_data').fetchedAt).toBe(100)
    expect(captureWorkspace().datasets.find(d => d.id === 'tle_data').fetchedAt).toBe(100)
    w.layers.push('AIR_RADAR')
    applyWorkspace(w, { replay: true, elapsed: 500 })
    expect(restoreLayers).toHaveBeenLastCalledWith(['ORBITAL_MATH'])
    expect(getMode()).toBe('REPLAY')
    expect(getTimeMs()).toBe(w.time.timeMs)
  })
})
