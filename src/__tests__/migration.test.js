import { describe, it, expect, vi } from 'vitest'
import { IDBFactory } from 'fake-indexeddb'
describe('IndexedDB v2 → v3 migration', () => {
  it('preserves markers and migrates legacy viewStore out of evictable cache', async () => {
    vi.stubGlobal('indexedDB', new IDBFactory())
    await new Promise((resolve, reject) => {
      const req = indexedDB.open('dexearth', 2)
      req.onupgradeneeded = () => {
        const db = req.result
        db.createObjectStore('cache', { keyPath: 'key' })
        db.createObjectStore('markers', { keyPath: 'id', autoIncrement: true })
      }
      req.onerror = () => reject(req.error)
      req.onsuccess = () => {
        const db = req.result,
          tx = db.transaction(['cache', 'markers'], 'readwrite')
        tx.objectStore('cache').put({ key: 'viewStore:home', value: { destination: [1, 2, 3] } })
        tx.objectStore('cache').put({
          key: 'tle_data',
          value: { data: 'elements', source: 'remote', fetchedAt: 1, expiresAt: 2 },
        })
        tx.objectStore('markers').put({ id: 1, title: 'User authored', lon: 1, lat: 2 })
        tx.oncomplete = () => {
          db.close()
          resolve()
        }
      }
    })
    vi.resetModules()
    const db = await import('../storage/db.js'),
      cache = await import('../storage/cache.js')
    expect(await db.userRecords('preferences')).toEqual([
      { id: 'viewStore:home', value: { destination: [1, 2, 3] } },
    ])
    expect(await db.cacheGet('viewStore:home')).toBeUndefined()
    await db.userPut('observations', { id: 'saved', name: 'Keep me' })
    await db.userPut('watchlist', { id: '25544' })
    await cache.clearRemoteCache()
    expect(await db.cacheGetAll()).toEqual([])
    expect(await db.markersGetAll()).toHaveLength(1)
    expect(await db.userRecords('observations')).toHaveLength(1)
    expect(await db.userRecords('watchlist')).toHaveLength(1)
    await expect(db.userPut('cache', { id: 'bad' })).rejects.toThrow('Not a user store')
  })
})
