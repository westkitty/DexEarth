import { afterEach, it, expect, vi } from 'vitest'
import {
  setSavedMarkers,
  getSavedMarkers,
  getSavedMarkerWarning,
  subscribeSavedMarkers,
} from '../state/savedMarkers.js'
import { markersLayer } from '../layers/markers/layer.js'
import { markersGetAll, markerAdd } from '../storage/db.js'
vi.mock('../storage/db.js', () => ({
  markersGetAll: vi.fn(),
  markerAdd: vi.fn(),
  markerUpdate: vi.fn(),
  markerDelete: vi.fn(),
}))
vi.mock('../utils/pulse.js', () => ({ pulseHud: vi.fn() }))
const marker = { id: 1, title: 'Authored', lon: 1, lat: 2 }
const viewer = () => ({
  isDestroyed: () => false,
  entities: { add: value => value, remove: vi.fn() },
})
afterEach(() => {
  markersLayer.deactivate()
  setSavedMarkers([])
  vi.clearAllMocks()
})
it('warns on invalid legacy records while retaining an independent safe capture', () => {
  const rows = [marker, { ...marker, id: '1' }, { ...marker, id: 2, tags: [null] }]
  const original = structuredClone(rows)
  const listener = vi.fn(),
    unsubscribe = subscribeSavedMarkers(listener)
  setSavedMarkers(rows)
  expect(getSavedMarkers()).toEqual([marker])
  expect(getSavedMarkerWarning()).toContain('2 saved marker(s) not displayed')
  expect(rows).toEqual(original)
  const copy = getSavedMarkers()
  copy[0].title = 'Changed outside'
  expect(getSavedMarkers()[0].title).toBe('Authored')
  unsubscribe()
  listener.mockClear()
  setSavedMarkers([marker])
  expect(listener).not.toHaveBeenCalled()
  expect(getSavedMarkerWarning()).toBe('')
})
it('keeps recently authored markers available to captures after hiding their layer', async () => {
  markersGetAll.mockResolvedValueOnce([])
  markerAdd.mockResolvedValueOnce(1)
  await markersLayer.activate({ viewer: viewer() })
  await markersLayer.addMarker(marker)
  markersLayer.deactivate()
  expect(getSavedMarkers()).toMatchObject([marker])
})
it('retains a completed persistent write without mutating a temporary snapshot', async () => {
  let finish
  markersGetAll.mockResolvedValueOnce([])
  markerAdd.mockReturnValueOnce(
    new Promise(resolve => {
      finish = resolve
    })
  )
  const v = viewer()
  await markersLayer.activate({ viewer: v })
  const pending = markersLayer.addMarker(marker)
  markersLayer.showSnapshot(v, [])
  finish(1)
  await pending
  expect(getSavedMarkers()).toMatchObject([marker])
  expect(markersLayer.getMarkers()).toEqual([])
})
it('temporary snapshot edits never replace the saved-marker capture', async () => {
  setSavedMarkers([marker])
  markersLayer.showSnapshot(viewer(), [{ ...marker, title: 'Temporary' }])
  await markersLayer.updateMarker(1, { title: 'Changed temporary' })
  await markersLayer.deleteMarker(1)
  expect(getSavedMarkers()).toEqual([marker])
})
