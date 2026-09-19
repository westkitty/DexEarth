import { it, expect, vi } from 'vitest'
import { IDBFactory } from 'fake-indexeddb'
import { readFileSync } from 'node:fs'
import { parseTLEs } from '../utils.js'
import {
  initWatchlist,
  getOrbitState,
  watchSatellite,
  unwatchSatellite,
  saveObserver,
  refreshWatchedElements,
} from '../state/orbitStore.js'
import { clearRemoteCache, setCached, enforceCacheBounds } from '../storage/cache.js'
import { userRecords, cacheSet, cacheGetAll, markerAdd, markersGetAll } from '../storage/db.js'
it('retains watchlist, nickname and observer across reinitialization and cache clear; only newer elements replace them', async () => {
  vi.stubGlobal('indexedDB', new IDBFactory())
  const record = parseTLEs(readFileSync('public/data/tle/starter.tle', 'utf8'))[0]
  await watchSatellite(record, 'Local ISS')
  await saveObserver({ lon: -74, lat: 40.7, name: 'Observer' })
  await setCached('tle_data', 'remote fixture', 1000)
  await clearRemoteCache()
  await initWatchlist()
  expect(getOrbitState().watchlist[0].nickname).toBe('Local ISS')
  expect(getOrbitState().observer.name).toBe('Observer')
  const newer = {
    ...record,
    satrec: { ...record.satrec, jdsatepoch: record.satrec.jdsatepoch + 1 },
  }
  await refreshWatchedElements([newer])
  await refreshWatchedElements([record])
  await initWatchlist()
  expect(getOrbitState().watchlist[0].record.satrec.jdsatepoch).toBe(newer.satrec.jdsatepoch)
  await unwatchSatellite(String(record.satrec.satnum))
  expect(await userRecords('watchlist')).toEqual([])
})
it('evicts an oversized legacy remote cache on startup without touching markers or preferences', async () => {
  await markerAdd({ lon: 1, lat: 1, title: 'Keep' })
  for (let i = 0; i < 30; i++)
    await cacheSet(`legacy-${i}`, {
      source: 'remote',
      data: 'fixture',
      fetchedAt: i + 1,
      lastUsedAt: i + 1,
      bytes: 1024,
    })
  await enforceCacheBounds()
  expect(await cacheGetAll()).toHaveLength(24)
  expect((await markersGetAll())[0].title).toBe('Keep')
  expect((await userRecords('preferences')).some(r => r.id === 'observer')).toBe(true)
})
