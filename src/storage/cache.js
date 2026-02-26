// ─── Dataset Cache Manager ──────────────────────────────────────────────────────
// Wraps db.js cache store with TTL expiry, pinning, and registry integration.
import { cacheGet, cacheSet, cacheDelete } from './db.js'
import { getDatasetConfig } from '../data/datasetRegistry.js'
import { fetchWithRetry } from '../utils.js'
import { emitAudit } from '../utils/auditLog.js'

export async function getCached(key, ttlMs) {
    try {
        const row = await cacheGet(key)
        if (!row) return null
        const { value } = row
        if (!value || !value.fetchedAt) return null

        // If pinned, expires in the year 9999
        if (value.pinned) return value

        // TTL check
        if (Date.now() > value.fetchedAt + ttlMs) return null // expired
        return value
    } catch {
        return null
    }
}

export async function setCached(key, data, ttlMs, source = 'remote', pinned = false) {
    const fetchedAt = Date.now()
    const expiresAt = pinned ? Infinity : fetchedAt + ttlMs
    try {
        await cacheSet(key, { data, fetchedAt, expiresAt, source, pinned })
    } catch {
        /* non-fatal */
    }
}

export async function deleteCached(key) {
    await cacheDelete(key)
}

export async function pinDataset(id) {
    const row = await cacheGet(id)
    if (row && row.value) {
        row.value.pinned = true
        row.value.expiresAt = Infinity
        await cacheSet(id, row.value)
        emitAudit('data', 'DATASET_PINNED', `Pinned dataset ${id} for offline use`)
    }
}

export async function unpinDataset(id) {
    const row = await cacheGet(id)
    if (row && row.value) {
        row.value.pinned = false
        const conf = getDatasetConfig(id)
        row.value.expiresAt = row.value.fetchedAt + (conf ? conf.cacheTtlMs : 0)
        await cacheSet(id, row.value)
        emitAudit('data', 'DATASET_UNPINNED', `Unpinned dataset ${id}`)
    }
}

export async function importCustomDataset(id, rawData) {
    emitAudit('data', 'DATASET_IMPORTED', `User imported custom bundle for ${id}`)
    await setCached(id, rawData, Infinity, 'custom', true)
}

/**
 * Fetch a dataset following the fallback chain:
 * Custom Pinned -> Cache (if valid) -> Bundled -> Remote -> Remote Fallbacks
 */
export async function getOrFetchDataset(id, options = {}) {
    const forceRefresh = options.forceRefresh || false
    const config = getDatasetConfig(id)
    if (!config) throw new Error(`Unknown dataset ${id}`)

    // 1. Check cache (handles pins and TTL internally)
    if (!forceRefresh) {
        const cached = await getCached(id, config.cacheTtlMs)
        if (cached) return cached
    }

    // 2. If it's a bundled-only format (like Ne_110m), fetch local immediately
    if (config.bundledUrl && !config.remoteUrl) {
        const res = await fetch(config.bundledUrl)
        if (!res.ok) throw new Error(`Failed to load bundled ${id}`)
        let data
        if (config.format === 'geojson') data = await res.json()
        else data = await res.text()

        await setCached(id, data, config.cacheTtlMs, 'bundled', true) // Auto-pin bundled
        return { data, source: 'bundled', fetchedAt: Date.now(), expiresAt: Infinity, pinned: true }
    }

    // 3. Try Remote / Proxy
    try {
        const res = await fetchWithRetry(config.remoteUrl, {}, 2, 10000)
        let data
        if (config.format === 'geojson' || config.format === 'json') data = await res.json()
        else data = await res.text()

        await setCached(id, data, config.cacheTtlMs, 'remote', false)
        emitAudit('data', 'DATASET_FETCHED', `Successfully fetched ${id} from proxy`)
        return { data, source: 'remote', fetchedAt: Date.now(), expiresAt: Date.now() + config.cacheTtlMs, pinned: false }
    } catch {
        // 4. Try Fallbacks
        if (config.fallbackUrls && config.fallbackUrls.length > 0) {
            for (const url of config.fallbackUrls) {
                try {
                    const res = await fetchWithRetry(url, {}, 1, 10000)
                    let data
                    if (config.format === 'geojson' || config.format === 'json') data = await res.json()
                    else data = await res.text()

                    await setCached(id, data, config.cacheTtlMs, 'fallback', false)
                    emitAudit('data', 'DATASET_FETCHED_FALLBACK', `Proxy failed, fetched ${id} from fallback ${url}`)
                    return { data, source: 'fallback', fetchedAt: Date.now(), expiresAt: Date.now() + config.cacheTtlMs, pinned: false }
                } catch {
                    /* Try next if multiple */
                }
            }
        }

        // 5. If everything fails, try to return stale cache before crashing
        const stale = await cacheGet(id)
        if (stale && stale.value) {
            emitAudit('error', 'DATASET_FETCH_FAILED', `Fetch failed for ${id}. Using stale cached data.`)
            return { ...stale.value, source: 'stale_cache' }
        }

        emitAudit('error', 'DATASET_UNAVAILABLE', `Completely failed to load ${id}`)
        throw new Error(`Dataset ${id} unavailable. Offline and no cache.`)
    }
}

/** Returns a human-readable "expires in Xm" or "expired Xm ago" string */
export function expiresIn(expiresAt) {
    if (!expiresAt) return 'unknown'
    if (expiresAt === Infinity) return 'Pinned (Never)'
    const diff = expiresAt - Date.now()
    if (diff <= 0) {
        const ago = Math.round(-diff / 60_000)
        return `expired ${ago}m ago`
    }
    const mins = Math.round(diff / 60_000)
    if (mins < 60) return `${mins}m`
    return `${Math.round(mins / 60)}h ${mins % 60}m`
}

/** Returns a human-readable "last fetched Xm ago" string */
export function lastFetched(fetchedAt) {
    if (!fetchedAt) return 'never'
    const diff = Date.now() - fetchedAt
    const mins = Math.round(diff / 60_000)
    if (mins < 1) return 'just now'
    if (mins < 60) return `${mins}m ago`
    return `${Math.round(mins / 60)}h ${mins % 60}m ago`
}
