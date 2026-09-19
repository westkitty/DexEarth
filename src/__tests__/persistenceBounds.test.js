import { beforeEach, describe, expect, it, vi } from 'vitest'
import { IDBFactory } from 'fake-indexeddb'
let db
beforeEach(async () => {
  vi.resetModules()
  vi.stubGlobal('indexedDB', new IDBFactory())
  db = await import('../storage/db.js')
})
describe('durable record capacity is atomic', () => {
  it.each([
    ['observations', 100],
    ['watchlist', 100],
    ['replays', 20],
  ])('%s admits only one competing insertion into its last slot', async (store, limit) => {
    await Promise.all(
      Array.from({ length: limit - 1 }, (_, i) => db.userPut(store, { id: `row-${i}` }))
    )
    const results = await Promise.allSettled([
      db.userPut(store, { id: 'last-a' }),
      db.userPut(store, { id: 'last-b' }),
    ])
    expect(results.filter(r => r.status === 'fulfilled')).toHaveLength(1)
    expect(results.filter(r => r.status === 'rejected')).toHaveLength(1)
    expect(await db.userRecords(store)).toHaveLength(limit)
    await db.userPut(store, { id: 'row-0', name: 'Updated at capacity' })
    expect((await db.userRecords(store)).find(r => r.id === 'row-0').name).toBe(
      'Updated at capacity'
    )
    await db.userDelete(store, 'row-0')
    await db.userPut(store, { id: 'replacement' })
    expect(await db.userRecords(store)).toHaveLength(limit)
  })
  it('does not apply authored-record capacity to preferences or remote cache', async () => {
    await Promise.all(
      Array.from({ length: 105 }, (_, i) => db.userPut('preferences', { id: `pref-${i}` }))
    )
    expect(await db.userRecords('preferences')).toHaveLength(105)
    await expect(db.userPut('cache', { id: 'not-authored' })).rejects.toThrow('Not a user store')
  })
})
it('serializes capacity decisions across independent database connections', async () => {
  for (let i = 0; i < 19; i++) await db.userPut('replays', { id: String(i) })
  vi.resetModules()
  const otherConnection = await import('../storage/db.js')
  const results = await Promise.allSettled([
    db.userPut('replays', { id: 'tab-a' }),
    otherConnection.userPut('replays', { id: 'tab-b' }),
  ])
  expect(results.filter(r => r.status === 'fulfilled')).toHaveLength(1)
  expect(await db.userRecords('replays')).toHaveLength(20)
})
it('enforces the marker bound in durable storage, not just the mounted layer', async () => {
  for (let i = 0; i < 499; i++) await db.markerAdd({ lon: 1, lat: 2, title: String(i) })
  const results = await Promise.allSettled([
    db.markerAdd({ lon: 1, lat: 2, title: 'Last a' }),
    db.markerAdd({ lon: 1, lat: 2, title: 'Last b' }),
  ])
  expect(results.filter(r => r.status === 'fulfilled')).toHaveLength(1)
  expect(await db.markersGetAll()).toHaveLength(500)
})
it('rejects invalid keys and can still commit a subsequent valid record', async () => {
  await expect(db.userPut('observations', { name: 'No key' })).rejects.toThrow()
  await db.userPut('observations', { id: 'good' })
  expect(await db.userRecords('observations')).toEqual([{ id: 'good' }])
})
