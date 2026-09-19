import { describe, it, expect, vi, beforeEach } from 'vitest'
import { readFileSync } from 'node:fs'
const tle = readFileSync('public/data/tle/starter.tle', 'utf8')
vi.mock('../storage/cache.js', () => ({ getCached: vi.fn(), setCached: vi.fn() }))
vi.mock('../storage/db.js', () => ({ cacheGet: vi.fn() }))
vi.mock('../state/settingsStore.js', () => ({
  get: vi.fn(key => (key === 'tleTtlHours' ? 12 : false)),
}))
import { loadTLEs } from '../layers/satellites/tleSources.js'
import { getCached } from '../storage/cache.js'
import { cacheGet } from '../storage/db.js'
import { get } from '../state/settingsStore.js'
describe('TLE origin and concurrency', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    get.mockImplementation(key => (key === 'tleTtlHours' ? 12 : false))
    getCached.mockResolvedValue(null)
    cacheGet.mockResolvedValue(null)
  })
  it('coalesces identical concurrent refreshes', async () => {
    const fetcher = vi.fn(async () => ({ ok: true, text: async () => tle }))
    vi.stubGlobal('fetch', fetcher)
    const [a, b] = await Promise.all([
      loadTLEs({ forceRefresh: true }),
      loadTLEs({ forceRefresh: true }),
    ])
    expect(fetcher).toHaveBeenCalledTimes(1)
    expect(a).toBe(b)
    expect(a.origin).toBe('network')
  })
  it('keeps failed-network stale timestamps unchanged', async () => {
    vi.stubGlobal(
      'fetch',
      vi.fn(async () => {
        throw new Error('offline')
      })
    )
    cacheGet.mockResolvedValue({
      value: { data: tle, fetchedAt: 100, expiresAt: 200, source: 'remote' },
    })
    const result = await loadTLEs({ forceRefresh: true })
    expect(result.source).toBe('stale_cache')
    expect(result.fetchedAt).toBe(100)
  })
  it('does not invent a fetch time for bundled starter elements', async () => {
    get.mockImplementation(key => (key === 'satelliteUseBundled' ? true : 12))
    vi.stubGlobal(
      'fetch',
      vi.fn(async () => ({ ok: true, text: async () => tle }))
    )
    const result = await loadTLEs()
    expect(result.source).toBe('bundled')
    expect(result.fetchedAt).toBeNull()
    expect(result.expiresAt).toBeNull()
  })
  it('reports unavailable when even the bundle cannot load', async () => {
    get.mockImplementation(key => (key === 'satelliteUseBundled' ? true : 12))
    vi.stubGlobal(
      'fetch',
      vi.fn(async () => ({ ok: false }))
    )
    expect((await loadTLEs()).source).toBe('unavailable')
  })
})
