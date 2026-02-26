import { describe, it, expect, vi, beforeEach } from 'vitest'
import { getCached, setCached, expiresIn, lastFetched } from '../storage/cache.js'

// Mock the db module
vi.mock('../storage/db.js', () => {
    const store = new Map()
    return {
        cacheGet: vi.fn(async key => store.get(key) ?? undefined),
        cacheSet: vi.fn(async (key, value) => { store.set(key, { key, value }) }),
    }
})

describe('cache TTL helpers', () => {
    beforeEach(() => { vi.clearAllMocks() })

    it('getCached returns null when no record exists', async () => {
        const result = await getCached('nonexistent', 3_600_000)
        expect(result).toBeNull()
    })

    it('setCached then getCached returns data within TTL', async () => {
        await setCached('mykey', { foo: 'bar' }, 3_600_000)
        const result = await getCached('mykey', 3_600_000)
        expect(result).not.toBeNull()
        expect(result.data).toEqual({ foo: 'bar' })
        expect(typeof result.fetchedAt).toBe('number')
        expect(result.expiresAt).toBeGreaterThan(Date.now())
    })

    it('getCached returns null for expired entry', async () => {
        // Plant a fake expired entry via the mock db
        const { cacheGet } = await import('../storage/db.js')
        cacheGet.mockResolvedValueOnce({
            key: 'expired',
            value: { data: 'stale', fetchedAt: Date.now() - 7_200_000, expiresAt: Date.now() - 3_600_000 },
        })
        const result = await getCached('expired', 3_600_000)
        expect(result).toBeNull()
    })
})

describe('expiresIn', () => {
    it('returns "expired X m ago" for past timestamps', () => {
        const past = Date.now() - 2 * 60_000
        const result = expiresIn(past)
        expect(result).toContain('expired')
    })

    it('returns minutes for future timestamps', () => {
        const future = Date.now() + 30 * 60_000
        const result = expiresIn(future)
        expect(result).toContain('30m')
    })

    it('returns "unknown" for null', () => {
        expect(expiresIn(null)).toBe('unknown')
    })
})

describe('lastFetched', () => {
    it('returns "just now" for very recent timestamps', () => {
        expect(lastFetched(Date.now())).toBe('just now')
    })

    it('returns "never" for null', () => {
        expect(lastFetched(null)).toBe('never')
    })

    it('returns minutes for older timestamps', () => {
        const older = Date.now() - 5 * 60_000
        const result = lastFetched(older)
        expect(result).toContain('m ago')
    })
})
