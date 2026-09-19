import { describe, it, expect, vi, afterEach } from 'vitest'
import { getCached, fetchedTimestamp, lastFetched } from '../storage/cache.js'
import { datasetState } from '../data/datasetStatus.js'
import { ReplayController } from '../state/replay.js'
import { workspace } from './fixtures/workspace.js'
import {
  createObservation,
  parseObservation,
  MAX_IMPORT_BYTES,
  downloadJson,
} from '../storage/observations.js'
import { cacheGet } from '../storage/db.js'
vi.mock('../storage/db.js', () => ({ cacheGet: vi.fn(), cacheSet: vi.fn() }))
afterEach(() => {
  vi.restoreAllMocks()
  vi.unstubAllGlobals()
  vi.useRealTimers()
})

describe('freshness boundaries under corrupted records', () => {
  it.each([Infinity, -Infinity, NaN, 1e30, 'not a date'])(
    'catalog can display invalid timestamp %s without crashing',
    value => {
      expect(fetchedTimestamp(value)).toBe('unknown / not a remote fetch')
      expect(lastFetched(value)).not.toBe('just now')
    }
  )
  it.each([
    ['NaN expiry', { expiresAt: NaN }],
    ['nonnumeric expiry', { expiresAt: 'later' }],
    ['infinite external expiry', { expiresAt: Infinity }],
    ['NaN capture time', { fetchedAt: NaN }],
    ['future capture time', { fetchedAt: 3000 }],
  ])('does not treat %s as fresh/cached', async (_label, patch) => {
    vi.spyOn(Date, 'now').mockReturnValue(2000)
    const value = {
      version: 2,
      source: 'remote',
      origin: 'network',
      data: 'fixture',
      fetchedAt: 1000,
      expiresAt: 5000,
      ...patch,
    }
    cacheGet.mockResolvedValueOnce({ key: 'fixture', value })
    expect(await getCached('fixture', 1000)).toBeNull()
    expect(datasetState(value, 2000)).toBe('STALE')
  })
  it('refuses a NaN TTL instead of defeating expiry checks', async () => {
    cacheGet.mockResolvedValueOnce({
      value: {
        version: 2,
        data: 'fixture',
        source: 'remote',
        fetchedAt: Date.now(),
        expiresAt: Date.now() + 10000,
      },
    })
    expect(await getCached('fixture', NaN)).toBeNull()
  })
})

describe('durable export and replay state boundaries', () => {
  it('refusing an invalid replay import leaves a recording intact', () => {
    const r = new ReplayController({ capture: workspace, apply: vi.fn() })
    r.start()
    const previous = r.session
    expect(() => r.load({ format: 'invalid' })).toThrow()
    expect(r.session).toBe(previous)
    expect(r.recording).toBe(true)
  })
  it('distinguishes playback ticks from explicit scrub restoration', () => {
    let now = 1000
    const apply = vi.fn(),
      r = new ReplayController({ capture: workspace, apply, now: () => now })
    r.start()
    now = 2000
    r.stop()
    r.scrub(0)
    expect(apply).toHaveBeenLastCalledWith(workspace(), 0)
    r.play()
    now = 2100
    r.tick()
    expect(apply).toHaveBeenLastCalledWith(workspace(), 100, { continuous: true })
    r.pause()
    r.scrub(100)
    expect(apply).toHaveBeenLastCalledWith(workspace(), 100)
  })
  it('exports a near-limit observation that its own importer can read', async () => {
    vi.useFakeTimers()
    const w = workspace()
    w.markers = Array.from({ length: 500 }, (_, id) => ({ id, lon: 1, lat: 2, title: 'fixture' }))
    const o = createObservation('Near limit', w)
    o.padding = ''
    const baseSize = new Blob([JSON.stringify(o)]).size
    o.padding = 'x'.repeat(MAX_IMPORT_BYTES - baseSize - 64)
    expect(new Blob([JSON.stringify(o, null, 2)]).size).toBeGreaterThan(MAX_IMPORT_BYTES)
    let exported
    vi.spyOn(URL, 'createObjectURL').mockImplementation(blob => {
      exported = blob
      return 'blob:fixture'
    })
    vi.spyOn(URL, 'revokeObjectURL').mockImplementation(() => {})
    const click = vi.fn()
    vi.stubGlobal('document', { createElement: () => ({ click }) })
    downloadJson(o, 'observation.json')
    expect(click).toHaveBeenCalledOnce()
    expect(exported.size).toBeLessThanOrEqual(MAX_IMPORT_BYTES)
    expect(parseObservation(await exported.text()).name).toBe('Near limit')
    vi.runAllTimers()
    expect(URL.revokeObjectURL).toHaveBeenCalledWith('blob:fixture')
  })
})
