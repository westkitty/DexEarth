import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'

// timeController uses requestAnimationFrame and Date.now() — mock both
describe('timeController', () => {
    let tc

    beforeEach(async () => {
        vi.useFakeTimers()
        vi.stubGlobal('requestAnimationFrame', vi.fn(cb => { setTimeout(cb, 16); return 1 }))
        vi.stubGlobal('cancelAnimationFrame', vi.fn())
        // Fresh import each time by resetting module
        vi.resetModules()
        tc = await import('../state/timeController.js')
    })

    afterEach(() => {
        vi.restoreAllMocks()
        vi.useRealTimers()
    })

    it('LIVE mode returns approximately Date.now()', () => {
        tc.setMode('LIVE')
        const t = tc.getTimeMs()
        const now = Date.now()
        expect(Math.abs(t - now)).toBeLessThan(100)
    })

    it('MANUAL mode returns the set value exactly', () => {
        tc.setMode('MANUAL')
        const target = 1_700_000_000_000
        tc.setManualTime(target)
        expect(tc.getTimeMs()).toBe(target)
    })

    it('setMode switches modes correctly', () => {
        tc.setMode('MANUAL')
        expect(tc.getMode()).toBe('MANUAL')
        tc.setMode('LIVE')
        expect(tc.getMode()).toBe('LIVE')
    })

    it('step advances manual time by the correct offset', () => {
        tc.setMode('MANUAL')
        const base = 1_700_000_000_000
        tc.setManualTime(base)
        tc.step(60_000)
        expect(tc.getTimeMs()).toBe(base + 60_000)
    })

    it('step backwards works', () => {
        tc.setMode('MANUAL')
        const base = 1_700_000_000_000
        tc.setManualTime(base)
        tc.step(-3_600_000)
        expect(tc.getTimeMs()).toBe(base - 3_600_000)
    })

    it('subscribe fires on setManualTime', () => {
        tc.setMode('MANUAL')
        const cb = vi.fn()
        tc.subscribe(cb)
        tc.setManualTime(12345)
        expect(cb).toHaveBeenCalledWith(12345)
    })

    it('unsubscribe stops notifications', () => {
        tc.setMode('MANUAL')
        const cb = vi.fn()
        const unsub = tc.subscribe(cb)
        unsub()
        tc.setManualTime(99999)
        expect(cb).not.toHaveBeenCalled()
    })

    it('fmtUtc returns a UTC string', () => {
        const s = tc.fmtUtc(Date.UTC(2024, 0, 1, 12, 0, 0))
        expect(s).toContain('UTC')
        expect(s).toContain('2024')
    })

    it('resetToNow switches to LIVE mode', () => {
        tc.setMode('MANUAL')
        tc.resetToNow()
        expect(tc.getMode()).toBe('LIVE')
    })
})
