import { afterEach, describe, expect, it, vi } from 'vitest'
import { markersLayer } from '../layers/markers/layer.js'
import { markersGetAll, markerAdd, markerUpdate, markerDelete } from '../storage/db.js'
vi.mock('../storage/db.js', () => ({
  markersGetAll: vi.fn(),
  markerAdd: vi.fn(),
  markerUpdate: vi.fn(),
  markerDelete: vi.fn(),
}))
vi.mock('../utils/pulse.js', () => ({ pulseHud: vi.fn() }))
const saved = { id: 1, lon: 1, lat: 2, title: 'Persistent marker' }
const snapshot = { id: 'snapshot', lon: 3, lat: 4, title: 'Observation marker' }
function deferred() {
  let resolve
  const promise = new Promise(r => {
    resolve = r
  })
  return { promise, resolve }
}
function viewer() {
  const entities = new Map()
  return {
    isDestroyed: () => false,
    entities: {
      add: vi.fn(entity => {
        if (entities.has(entity.id)) throw new Error('Duplicate Cesium entity ID')
        entities.set(entity.id, entity)
        return entity
      }),
      remove: vi.fn(entity => entities.delete(entity.id)),
    },
    ids: () => [...entities.keys()],
  }
}
afterEach(() => {
  markersLayer.deactivate()
  vi.clearAllMocks()
})

describe('assignment: snapshot restore and unloaded marker lifecycle', () => {
  it('does not overwrite an observation snapshot with a pending persistent load', async () => {
    const load = deferred(),
      v = viewer()
    markersGetAll.mockReturnValueOnce(load.promise)
    const activation = markersLayer.activate({ viewer: v })
    markersLayer.showSnapshot(v, [snapshot])
    load.resolve([saved])
    await activation
    expect(markersLayer.getMarkers()).toEqual([snapshot])
    expect(v.ids()).toEqual(['marker_snapshot'])
    expect(markersLayer.isSnapshot()).toBe(true)
  })
  it('ignores a late activation after deactivation', async () => {
    const load = deferred(),
      v = viewer()
    markersGetAll.mockReturnValueOnce(load.promise)
    const activation = markersLayer.activate({ viewer: v })
    markersLayer.deactivate()
    load.resolve([saved])
    await activation
    expect(markersLayer.getMarkers()).toEqual([])
    expect(v.ids()).toEqual([])
    expect(markersLayer.isActive()).toBe(false)
  })
  it('cleans the previous viewer and rejects its late load after replacement', async () => {
    const first = deferred(),
      a = viewer(),
      b = viewer()
    markersGetAll.mockReturnValueOnce(first.promise).mockResolvedValueOnce([snapshot])
    const activation = markersLayer.activate({ viewer: a })
    await markersLayer.activate({ viewer: b })
    first.resolve([saved])
    await activation
    expect(a.ids()).toEqual([])
    expect(b.ids()).toEqual(['marker_snapshot'])
    expect(markersLayer.getMarkers()).toEqual([snapshot])
  })
  it('removes existing entities when switching viewers', async () => {
    const a = viewer(),
      b = viewer()
    markersGetAll.mockResolvedValue([saved])
    await markersLayer.activate({ viewer: a })
    await markersLayer.activate({ viewer: b })
    expect(a.ids()).toEqual([])
    expect(b.ids()).toEqual(['marker_1'])
  })
  it.each(['add', 'update', 'delete'])(
    'does not apply a pending %s to a newly restored snapshot',
    async operation => {
      const v = viewer(),
        write = deferred()
      markersGetAll.mockResolvedValueOnce([saved])
      await markersLayer.activate({ viewer: v })
      let pending
      if (operation === 'add') {
        markerAdd.mockReturnValueOnce(write.promise)
        pending = markersLayer.addMarker({ ...saved, title: 'New persistent marker' })
      } else if (operation === 'update') {
        markerUpdate.mockReturnValueOnce(write.promise)
        pending = markersLayer.updateMarker(saved.id, { title: 'Updated persistent marker' })
      } else {
        markerDelete.mockReturnValueOnce(write.promise)
        pending = markersLayer.deleteMarker(saved.id)
      }
      markersLayer.showSnapshot(v, [{ ...snapshot, id: saved.id }])
      write.resolve(2)
      await pending
      expect(markersLayer.getMarkers()).toEqual([{ ...snapshot, id: saved.id }])
      expect(v.ids()).toEqual(['marker_1'])
    }
  )
})

it.each([
  { lon: NaN },
  { lon: 181 },
  { lat: -91 },
  { title: 'x'.repeat(501) },
  { tags: [null] },
  { notes: 'x'.repeat(10001) },
])('rejects invalid local marker fields before storage: %j', async patch => {
  markerAdd.mockResolvedValue(3)
  await expect(markersLayer.addMarker({ ...saved, ...patch })).rejects.toThrow(/marker/i)
  expect(markerAdd).not.toHaveBeenCalled()
  expect(markersLayer.getMarkers()).toEqual([])
})
it('validates marker updates before writing or changing geometry', async () => {
  markersGetAll.mockResolvedValueOnce([saved])
  const v = viewer()
  await markersLayer.activate({ viewer: v })
  await expect(markersLayer.updateMarker(saved.id, { lat: Infinity })).rejects.toThrow(/marker/i)
  expect(markerUpdate).not.toHaveBeenCalled()
  expect(markersLayer.getMarkers()).toEqual([saved])
  expect(v.ids()).toEqual(['marker_1'])
})
it('rejects an invalid snapshot before removing the current displayed markers', () => {
  const v = viewer()
  markersLayer.showSnapshot(v, [snapshot])
  expect(() => markersLayer.showSnapshot(v, [{ ...saved, tags: [null] }])).toThrow(/marker/i)
  expect(markersLayer.getMarkers()).toEqual([snapshot])
  expect(v.ids()).toEqual(['marker_snapshot'])
})
it('reserves the last marker slot before concurrent asynchronous writes', async () => {
  const v = viewer(),
    write = deferred()
  markersGetAll.mockResolvedValueOnce(Array.from({ length: 499 }, (_, id) => ({ ...saved, id })))
  await markersLayer.activate({ viewer: v })
  markerAdd.mockReturnValueOnce(write.promise)
  const last = markersLayer.addMarker(saved)
  try {
    await expect(markersLayer.addMarker(saved)).rejects.toThrow(/500/)
    expect(markerAdd).toHaveBeenCalledTimes(1)
  } finally {
    write.resolve(500)
    await last
  }
  expect(markersLayer.getMarkers()).toHaveLength(500)
})

it('does not render corrupt/duplicate legacy markers or mutate the retained records', async () => {
  const v = viewer()
  const stored = [
    saved,
    { ...saved, id: '1' },
    { ...saved, id: 2, tags: [null] },
    { ...saved, id: 3, lat: NaN },
  ]
  const original = structuredClone(stored)
  markersGetAll.mockResolvedValueOnce(stored)
  await markersLayer.activate({ viewer: v })
  expect(markersLayer.getMarkers()).toEqual([saved])
  expect(v.ids()).toEqual(['marker_1'])
  expect(stored).toEqual(original)
  expect(markerDelete).not.toHaveBeenCalled()
})
it('bounds legacy displayed markers without deleting excess authored records', async () => {
  const v = viewer()
  const stored = Array.from({ length: 502 }, (_, id) => ({ ...saved, id }))
  markersGetAll.mockResolvedValueOnce(stored)
  await markersLayer.activate({ viewer: v })
  expect(markersLayer.getMarkers()).toHaveLength(500)
  expect(v.ids()).toHaveLength(500)
  expect(stored).toHaveLength(502)
  expect(markerDelete).not.toHaveBeenCalled()
})
it('can retry activation after a storage failure instead of remaining falsely active', async () => {
  const v = viewer()
  markersGetAll
    .mockRejectedValueOnce(new Error('Storage interrupted'))
    .mockResolvedValueOnce([saved])
  await expect(markersLayer.activate({ viewer: v })).rejects.toThrow('Storage interrupted')
  expect(markersLayer.isActive()).toBe(false)
  await markersLayer.activate({ viewer: v })
  expect(markersLayer.getMarkers()).toEqual([saved])
})
