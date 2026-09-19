import { describe, it, expect } from 'vitest'
import { evictionKeys } from '../storage/cachePolicy.js'
import { datasetState } from '../data/datasetStatus.js'
describe('cache truth and hard budgets', () => {
  it('does not let retention pins turn stale records fresh', () => {
    expect(datasetState({ source: 'remote', fetchedAt: 10, expiresAt: 20, pinned: true }, 21)).toBe(
      'STALE'
    )
    expect(
      datasetState({ source: 'remote', origin: 'cache', fetchedAt: 10, expiresAt: 20 }, 15)
    ).toBe('CACHED')
    expect(
      datasetState({ source: 'remote', origin: 'network', fetchedAt: 10, expiresAt: 20 }, 15)
    ).toBe('LIVE/FRESH')
    expect(datasetState({ source: 'bundled', fetchedAt: null })).toBe('BUNDLED FALLBACK')
    expect(datasetState({ missingKey: true })).toBe('OPTIONAL KEY MISSING')
    expect(datasetState(null)).toBe('UNAVAILABLE')
  })
  it('evicts oldest remote data; preserves legacy user data and custom imports', () => {
    const rows = [
      { key: 'viewStore:home', value: { data: {}, bytes: 10000 } },
      { key: 'custom', value: { data: {}, source: 'custom', bytes: 10000 } },
      ...[1, 2, 3].map(n => ({
        key: String(n),
        value: { data: {}, source: 'remote', lastUsedAt: n, bytes: 100, pinned: n === 1 },
      })),
    ]
    expect(evictionKeys(rows, 200, 10)).toEqual(['2'])
    expect(evictionKeys(rows, 0, 0)).toEqual(['2', '3', '1'])
  })
})

import { normalizeCacheValue } from '../storage/cache.js'
it('migrates legacy retention pins without pretending they never expire', () => {
  const record = normalizeCacheValue('tle_data', {
    data: 'old',
    source: 'remote',
    pinned: true,
    fetchedAt: 100,
    expiresAt: Infinity,
  })
  expect(record.version).toBe(2)
  expect(record.expiresAt).toBe(100 + 12 * 3600000)
  expect(datasetState(record, record.expiresAt + 1)).toBe('STALE')
})
