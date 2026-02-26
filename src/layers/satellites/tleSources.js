// ─── TLE Sources ─────────────────────────────────────────────────────────────
// Load order: (1) IndexedDB cache if fresh, (2) Vite proxy remote, (3) bundled fallback.

import { parseTLEs, fetchWithRetry } from '../../utils.js'
import { getCached, setCached } from '../../storage/cache.js'
import * as settings from '../../state/settingsStore.js'

const CACHE_KEY = 'tle_data'
const BUNDLED_PATH = '/data/tle/starter.tle'

/**
 * Load TLEs from cache, remote, or bundled fallback.
 * @param {object} opts
 * @param {string} [opts.remoteUrl] - override remote URL (defaults to settings)
 * @param {boolean} [opts.forceRefresh] - bypass cache
 * @returns {Promise<{ records: Array, source: string, fetchedAt: number, expiresAt: number }>}
 */
export async function loadTLEs({ remoteUrl, forceRefresh = false } = {}) {
    const ttlMs = (settings.get('tleTtlHours') || 12) * 3_600_000

    // 1. Try cache
    if (!forceRefresh) {
        const cached = await getCached(CACHE_KEY, ttlMs)
        if (cached && cached.data && cached.data.length > 0) {
            return { records: cached.data, source: 'cache', fetchedAt: cached.fetchedAt, expiresAt: cached.expiresAt }
        }
    }

    // 2. Try remote (through Vite proxy or user URL)
    const url = remoteUrl || settings.get('satelliteRemoteUrl') || '/proxy/tle'
    if (!settings.get('satelliteUseBundled')) {
        try {
            const res = await fetchWithRetry(url, {}, 2, 20_000)
            const text = await res.text()
            const records = parseTLEs(text)
            if (records.length > 0) {
                const fetchedAt = Date.now()
                const expiresAt = fetchedAt + ttlMs
                await setCached(CACHE_KEY, records, ttlMs)
                return { records, source: 'remote', fetchedAt, expiresAt }
            }
        } catch (err) {
            console.warn('[TLESources] Remote failed, falling back to bundled:', err.message)
        }
    }

    // Try remote anyway if bundled-preference is off, haven't already tried
    if (settings.get('satelliteUseBundled')) {
        try {
            const res = await fetchWithRetry(url, {}, 1, 15_000)
            const text = await res.text()
            const records = parseTLEs(text)
            if (records.length > 0) {
                const fetchedAt = Date.now()
                const expiresAt = fetchedAt + ttlMs
                await setCached(CACHE_KEY, records, ttlMs)
                return { records, source: 'remote', fetchedAt, expiresAt }
            }
        } catch {
            /* fall through to bundled */
        }
    }

    // 3. Bundled fallback
    try {
        const res = await fetch(BUNDLED_PATH)
        const text = await res.text()
        const records = parseTLEs(text)
        const fetchedAt = Date.now()
        return { records, source: 'bundled', fetchedAt, expiresAt: fetchedAt + ttlMs }
    } catch (err) {
        console.error('[TLESources] Bundled fallback also failed:', err.message)
        return { records: [], source: 'error', fetchedAt: Date.now(), expiresAt: 0 }
    }
}
