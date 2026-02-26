import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { parseTLEs, fetchWithRetry } from '../utils.js'

// ─── parseTLEs ────────────────────────────────────────────────────────────────

const VALID_TLE_BLOCK = `ISS (ZARYA)
1 25544U 98067A   24001.50000000  .00001234  00000-0  12345-4 0  9990
2 25544  51.6416 247.4627 0006703 130.5360 325.0288 15.50377579432135
HUBBLE SPACE TELESCOPE
1 20580U 90037B   24001.50000000  .00001234  00000-0  12345-4 0  9990
2 20580  28.4693 123.4567 0002345  90.1234 270.0000 15.09876543210987
`

describe('parseTLEs', () => {
  it('returns one record per valid TLE triplet', () => {
    const records = parseTLEs(VALID_TLE_BLOCK)
    expect(records).toHaveLength(2)
  })

  it('attaches the satellite name to each record', () => {
    const records = parseTLEs(VALID_TLE_BLOCK)
    expect(records[0].name).toBe('ISS (ZARYA)')
    expect(records[1].name).toBe('HUBBLE SPACE TELESCOPE')
  })

  it('produces a satrec object with expected fields', () => {
    const records = parseTLEs(VALID_TLE_BLOCK)
    const { satrec } = records[0]
    // satellite.js satrec always has satnum
    expect(satrec).toHaveProperty('satnum')
    // error code 0 means a valid parse
    expect(satrec.error).toBe(0)
  })

  it('returns an empty array for empty input', () => {
    expect(parseTLEs('')).toEqual([])
    expect(parseTLEs('   \n  ')).toEqual([])
  })

  it('silently skips malformed lines', () => {
    const garbled = `GOOD SAT
1 25544U 98067A   24001.50000000  .00001234  00000-0  12345-4 0  9990
2 25544  51.6416 247.4627 0006703 130.5360 325.0288 15.50377579432135
NOT A TLE
just some random text here
also random
`
    const records = parseTLEs(garbled)
    expect(records).toHaveLength(1)
    expect(records[0].name).toBe('GOOD SAT')
  })
})

// ─── fetchWithRetry ───────────────────────────────────────────────────────────

describe('fetchWithRetry', () => {
  beforeEach(() => {
    vi.useFakeTimers()
  })

  afterEach(() => {
    vi.restoreAllMocks()
    vi.useRealTimers()
  })

  it('returns the response on first success', async () => {
    const mockRes = { ok: true, status: 200 }
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue(mockRes))

    const res = await fetchWithRetry('https://example.com/data')
    expect(res).toBe(mockRes)
    expect(fetch).toHaveBeenCalledTimes(1)
  })

  it('retries on HTTP error and succeeds on second attempt', async () => {
    const mockRes = { ok: true, status: 200 }
    vi.stubGlobal(
      'fetch',
      vi.fn().mockResolvedValueOnce({ ok: false, status: 503 }).mockResolvedValueOnce(mockRes)
    )

    const promise = fetchWithRetry('https://example.com/data', {}, 3, 5000)
    // advance past the first back-off delay (1000ms * 2^0 = 1000ms)
    await vi.advanceTimersByTimeAsync(1100)
    const res = await promise
    expect(res).toBe(mockRes)
    expect(fetch).toHaveBeenCalledTimes(2)
  })

  it('throws after exhausting all retries', async () => {
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue({ ok: false, status: 500 }))

    const promise = fetchWithRetry('https://example.com/data', {}, 2, 5000)
    // Register the rejection handler BEFORE advancing timers so there is no
    // window where the rejected promise has no handler attached.
    const assertion = expect(promise).rejects.toThrow('HTTP 500')
    await vi.advanceTimersByTimeAsync(5000)
    await assertion
    expect(fetch).toHaveBeenCalledTimes(2)
  })
})
