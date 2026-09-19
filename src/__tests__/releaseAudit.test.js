import { beforeEach, describe, it, expect, vi } from 'vitest'
import { IDBFactory } from 'fake-indexeddb'
import { readFileSync } from 'node:fs'
import { parseTLEs } from '../utils.js'
import { ReplayController } from '../state/replay.js'
import { workspace } from './fixtures/workspace.js'
import { evictionKeys } from '../storage/cachePolicy.js'
const record = parseTLEs(readFileSync('public/data/tle/starter.tle', 'utf8'))[0]
const newer = { ...record, satrec: { ...record.satrec, jdsatepoch: record.satrec.jdsatepoch + 2 } }
let db, orbit
beforeEach(async () => {
  vi.resetModules()
  vi.stubGlobal('indexedDB', new IDBFactory())
  db = await import('../storage/db.js')
  orbit = await import('../state/orbitStore.js')
})
describe('watchlist release invariants', () => {
  it('nickname edits cannot replace newer saved elements with an older record', async () => {
    await orbit.watchSatellite(newer, 'Original nickname')
    const savedAt = orbit.getOrbitState().watchlist[0].savedAt
    await orbit.watchSatellite(record, 'Renamed locally')
    const saved = (await db.userRecords('watchlist'))[0]
    expect(saved.record.satrec.jdsatepoch).toBe(newer.satrec.jdsatepoch)
    expect(saved.nickname).toBe('Renamed locally')
    expect(saved.savedAt).toBe(savedAt)
  })
  it('refresh cannot recreate an entry deleted in another connection', async () => {
    await orbit.watchSatellite(record)
    await db.userDelete('watchlist', String(record.satrec.satnum))
    await orbit.refreshWatchedElements([newer])
    expect(await db.userRecords('watchlist')).toEqual([])
    expect(orbit.getOrbitState().watchlist).toEqual([])
  })
  it('refresh preserves a nickname changed outside stale local state', async () => {
    await orbit.watchSatellite(record, 'Old nickname')
    const item = (await db.userRecords('watchlist'))[0]
    await db.userPut('watchlist', { ...item, nickname: 'Changed in other tab' })
    await orbit.refreshWatchedElements([newer])
    expect((await db.userRecords('watchlist'))[0].nickname).toBe('Changed in other tab')
  })
  it('overlapping refreshes cannot roll the TLE epoch backwards', async () => {
    await orbit.watchSatellite(record)
    const middle = {
      ...record,
      satrec: { ...record.satrec, jdsatepoch: record.satrec.jdsatepoch + 1 },
    }
    await Promise.all([
      orbit.refreshWatchedElements([newer]),
      orbit.refreshWatchedElements([middle]),
    ])
    expect((await db.userRecords('watchlist'))[0].record.satrec.jdsatepoch).toBe(
      newer.satrec.jdsatepoch
    )
  })
  it('invalid durable watch/observer records do not reach the inspector and are not deleted', async () => {
    await db.userPut('watchlist', { id: 'bad', name: {}, record: null })
    await db.userPut('preferences', { id: 'observer', value: { lat: NaN, lon: 1, name: {} } })
    await orbit.initWatchlist()
    expect(orbit.getOrbitState().watchlist).toEqual([])
    expect(orbit.getOrbitState().observer).toBeNull()
    expect(await db.userRecords('watchlist')).toHaveLength(1)
    expect(orbit.getOrbitState().storageWarning).toContain('not loaded')
  })
})
describe('bounded cache and transactional replay startup', () => {
  it.each([1, -10, NaN, Infinity, 'tiny'])(
    'does not trust invalid/understated cache bytes %s',
    bytes => {
      const rows = [{ key: 'remote', value: { source: 'remote', data: 'x'.repeat(1000), bytes } }]
      expect(evictionKeys(rows, 100, 24)).toEqual(['remote'])
    }
  )
  it('handles non-string cache keys without throwing or evicting authored data', () => {
    const rows = [
      { key: 1, value: { source: 'remote', data: 'fixture' } },
      { key: 'viewStore:home', value: { data: 'authored' } },
      { key: 'custom', value: { source: 'custom', data: 'authored' } },
    ]
    expect(evictionKeys(rows, 0, 0)).toEqual([1])
  })
  it('failed recording startup preserves the prior exportable session', () => {
    let available = true
    const r = new ReplayController({
      capture: () => {
        if (!available) throw new Error('Globe not ready')
        return workspace()
      },
      apply: vi.fn(),
    })
    r.start()
    r.stop()
    const previous = r.session
    available = false
    expect(() => r.start()).toThrow('Globe not ready')
    expect(r.session).toBe(previous)
    expect(r.recording).toBe(false)
  })
})

it('generated marker IDs cannot collide with retained legacy string IDs', async () => {
  await db.markerUpdate({ id: '1', title: 'Legacy marker', lon: 0, lat: 0 })
  const id = await db.markerAdd({ title: 'New marker', lon: 1, lat: 1 })
  expect(String(id)).not.toBe('1')
  const rows = await db.markersGetAll()
  expect(rows).toHaveLength(2)
  expect(new Set(rows.map(row => String(row.id))).size).toBe(2)
})

it('marker updates reject a transaction that aborts after its request succeeds', async () => {
  await db.markerUpdate({ id: 1, title: 'Original', lon: 0, lat: 0 })
  const { IDBObjectStore } = await import('fake-indexeddb')
  const put = IDBObjectStore.prototype.put
  const spy = vi.spyOn(IDBObjectStore.prototype, 'put').mockImplementation(function (...args) {
    const req = put.apply(this, args)
    req.addEventListener('success', () => this.transaction.abort(), { once: true })
    return req
  })
  try {
    await expect(
      db.markerUpdate({ id: 1, title: 'Not committed', lon: 0, lat: 0 })
    ).rejects.toThrow()
  } finally {
    spy.mockRestore()
  }
  expect((await db.markersGetAll())[0].title).toBe('Original')
})

it('cache age/expiry labels do not round hours up while also retaining remaining minutes', async () => {
  const { lastFetched, expiresIn } = await import('../storage/cache.js')
  const now = Date.now()
  const spy = vi.spyOn(Date, 'now').mockReturnValue(now)
  try {
    expect(lastFetched(now - 90 * 60000)).toBe('1h 30m ago')
    expect(expiresIn(now + 119 * 60000)).toBe('1h 59m')
  } finally {
    spy.mockRestore()
  }
})

it('atomic updates preserve identity, capacity and recovery after an updater throws', async () => {
  await db.userPut('watchlist', { id: 'kept', name: 'Original' })
  await expect(
    db.userUpdate('watchlist', 'kept', () => {
      throw new Error('Rejected update')
    })
  ).rejects.toThrow('Rejected update')
  await expect(db.userUpdate('watchlist', 'kept', () => ({ id: 'changed' }))).rejects.toThrow(
    'preserve'
  )
  expect(await db.userUpdate('watchlist', 'absent', () => undefined)).toBeUndefined()
  await db.userUpdate('watchlist', 'kept', row => ({ ...row, name: 'Committed' }))
  expect(await db.userRecords('watchlist')).toEqual([{ id: 'kept', name: 'Committed' }])
})
it('separate watchlist connections converge on the newest epoch without erasing nickname changes', async () => {
  await orbit.watchSatellite(record, 'First')
  vi.resetModules()
  const other = await import('../state/orbitStore.js')
  await other.initWatchlist()
  await Promise.all([
    orbit.refreshWatchedElements([newer]),
    other.watchSatellite(record, 'Second connection'),
  ])
  const saved = (await db.userRecords('watchlist'))[0]
  expect(saved.record.satrec.jdsatepoch).toBe(newer.satrec.jdsatepoch)
  expect(saved.nickname).toBe('Second connection')
})
it('a failed watchlist action does not poison subsequent queued actions', async () => {
  await expect(orbit.watchSatellite({ name: 'Invalid' })).rejects.toThrow()
  await expect(orbit.saveObserver({ lat: 100, lon: 0, name: 'Invalid' })).rejects.toThrow()
  await orbit.watchSatellite(record, 'Good')
  await orbit.saveObserver({ lat: 40, lon: -74, name: 'Good observer' })
  expect(orbit.getOrbitState().watchlist).toHaveLength(1)
  expect(orbit.getOrbitState().observer.name).toBe('Good observer')
})
it('one refresh with duplicate catalog IDs chooses its newest element set', async () => {
  await orbit.watchSatellite(record)
  await orbit.refreshWatchedElements([newer, null, record, { satrec: {} }])
  expect((await db.userRecords('watchlist'))[0].record.satrec.jdsatepoch).toBe(
    newer.satrec.jdsatepoch
  )
})
it('generated marker keys skip several aliases without deleting any legacy marker', async () => {
  for (let i = 1; i <= 10; i++)
    await db.markerUpdate({ id: String(i), lon: 0, lat: 0, title: `Legacy ${i}` })
  expect(await db.markerAdd({ lon: 1, lat: 1, title: 'Generated' })).toBe(11)
  const rows = await db.markersGetAll()
  expect(rows).toHaveLength(11)
  expect(rows.filter(row => typeof row.id === 'string')).toHaveLength(10)
})
it('a failed start leaves active playback and cursor untouched', () => {
  let ready = true
  const r = new ReplayController({
    capture: () => {
      if (!ready) throw new Error('Unavailable')
      return workspace()
    },
    apply: vi.fn(),
  })
  r.start()
  r.stop()
  r.play()
  const previous = r.session,
    position = r.position
  ready = false
  expect(() => r.start()).toThrow()
  expect(r.session).toBe(previous)
  expect(r.playing).toBe(true)
  expect(r.position).toBe(position)
  r.pause()
})
it.each([1, 19, 47, 103])(
  'measured cache budget holds across generated fixture records (seed %s)',
  seed => {
    const rows = Array.from({ length: 30 }, (_, i) => ({
      key: `remote-${i}`,
      value: {
        source: 'remote',
        data: 'x'.repeat(((i * seed) % 400) + 1),
        bytes: [1, NaN, -5, Infinity][i % 4],
        lastUsedAt: i,
        pinned: i % 3 === 0,
      },
    }))
    rows.push(
      { key: 'viewStore:home', value: { data: 'Keep home' } },
      { key: 'custom', value: { data: 'Keep custom', source: 'custom' } }
    )
    const removed = new Set(evictionKeys(rows, 1000, 5))
    const kept = rows.filter(row => row.key.startsWith('remote-') && !removed.has(row.key))
    expect(kept.length).toBeLessThanOrEqual(5)
    expect(
      kept.reduce((sum, row) => sum + new Blob([JSON.stringify(row.value.data)]).size, 0)
    ).toBeLessThanOrEqual(1000)
    expect(removed.has('viewStore:home')).toBe(false)
    expect(removed.has('custom')).toBe(false)
  }
)
