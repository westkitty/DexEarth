// ─── TTL Cache Helpers ────────────────────────────────────────────────────────
// Wraps db.js cache store with TTL expiry logic.

import { cacheGet, cacheSet } from './db.js'

/**
 * @param {string} key
 * @param {number} ttlMs
 * @returns {Promise<{data: any, fetchedAt: number, expiresAt: number} | null>}
 */
export async function getCached(key, ttlMs) {
    try {
        const row = await cacheGet(key)
        if (!row) return null
        const { value } = row
        if (!value || !value.fetchedAt) return null
        if (Date.now() > value.fetchedAt + ttlMs) return null // expired
        return value
    } catch {
        return null
    }
}

/**
 * @param {string} key
 * @param {any} data
 * @param {number} ttlMs
 */
export async function setCached(key, data, ttlMs) {
    const fetchedAt = Date.now()
    const expiresAt = fetchedAt + ttlMs
    try {
        await cacheSet(key, { data, fetchedAt, expiresAt })
    } catch {
        /* non-fatal */
    }
}

/** Returns a human-readable "expires in Xm" or "expired Xm ago" string */
export function expiresIn(expiresAt) {
    if (!expiresAt) return 'unknown'
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
