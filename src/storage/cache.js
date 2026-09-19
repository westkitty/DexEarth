// ─── Dataset Cache Manager ──────────────────────────────────────────────────────
// Wraps db.js cache store with TTL expiry, pinning, and registry integration.
import { cacheGet, cacheSet, cacheDelete, cacheGetAll } from './db.js'
import { getDatasetConfig } from '../data/datasetRegistry.js'
import { fetchWithRetry } from '../utils.js'
import { CACHE_VERSION, CACHE_MAX_BYTES, evictionKeys, isRemoteRecord } from './cachePolicy.js'
import { publishDataset } from '../data/datasetStatus.js'
import { emitAudit } from '../utils/auditLog.js'

// Older retention pins used Infinity as expiry. Recover a truthful TTL on read.
export function normalizeCacheValue(key, value) {
  if (
    !value ||
    value.version === CACHE_VERSION ||
    value.source === 'custom' ||
    value.source === 'bundled'
  )
    return value
  const ttl = getDatasetConfig(key)?.cacheTtlMs ?? 3600000
  return {
    ...value,
    version: CACHE_VERSION,
    expiresAt: Math.min(value.expiresAt ?? Infinity, (value.fetchedAt || 0) + ttl),
  }
}

export async function getCached(key, ttlMs) {
  try {
    const row = await cacheGet(key)
    if (!row) return null
    const value = normalizeCacheValue(key, row.value)
    if (!value) return null
    if (value.source === 'bundled') return value
    if (!value.fetchedAt) return null

    // Retention pins never override external-data freshness.

    // TTL check
    if (Date.now() >= Math.min(value.expiresAt ?? Infinity, value.fetchedAt + ttlMs)) return null // expired
    value.lastUsedAt = Date.now()
    await cacheSet(key, value)
    return value
  } catch {
    return null
  }
}

let writeQueue = Promise.resolve()
export function setCached(key, data, ttlMs, source = 'remote', pinned = false) {
  const fetchedAt = source === 'bundled' ? null : Date.now()
  const value = {
    version: CACHE_VERSION,
    data,
    fetchedAt,
    expiresAt: source === 'bundled' ? Infinity : fetchedAt + ttlMs,
    source,
    pinned,
    lastUsedAt: Date.now(),
    bytes: new Blob([JSON.stringify(data)]).size,
  }
  if (value.bytes > CACHE_MAX_BYTES) return Promise.resolve(false)
  writeQueue = writeQueue
    .catch(() => {})
    .then(async () => {
      try {
        await cacheSet(key, value)
        const rows = await cacheGetAll()
        for (const old of evictionKeys(rows)) await cacheDelete(old)
        return true
      } catch {
        return false
      }
    })
  return writeQueue
}
export async function enforceCacheBounds() {
  const rows = await cacheGetAll()
  for (const key of evictionKeys(rows)) await cacheDelete(key)
}
export async function inspectCache() {
  return (await cacheGetAll())
    .filter(isRemoteRecord)
    .map(row => ({ ...row, value: normalizeCacheValue(row.key, row.value) }))
}
export async function clearRemoteCache() {
  await writeQueue
  for (const row of await inspectCache()) await cacheDelete(row.key)
}

export async function deleteCached(key) {
  await cacheDelete(key)
}

export async function pinDataset(id) {
  const row = await cacheGet(id)
  if (row && row.value) {
    row.value.pinned = true
    // Pin favors retention only; expiry remains unchanged.
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
const inFlight = new Map()
export function getOrFetchDataset(id, options = {}) {
  if (inFlight.has(id)) return inFlight.get(id)
  const promise = fetchDataset(id, options)
    .then(record => publishDataset(id, record))
    .catch(error => {
      publishDataset(id, { source: 'unavailable' })
      throw error
    })
    .finally(() => inFlight.delete(id))
  inFlight.set(id, promise)
  return promise
}
async function fetchDataset(id, options = {}) {
  const forceRefresh = options.forceRefresh || false
  const config = getDatasetConfig(id)
  if (!config) throw new Error(`Unknown dataset ${id}`)

  // 1. Check cache (handles pins and TTL internally)
  if (!forceRefresh) {
    const cached = await getCached(id, config.cacheTtlMs)
    if (cached) return { ...cached, origin: 'cache' }
  }

  // 2. If it's a bundled-only format (like Ne_110m), fetch local immediately
  if (config.bundledUrl && !config.remoteUrl) {
    const res = await fetch(config.bundledUrl)
    if (!res.ok) throw new Error(`Failed to load bundled ${id}`)
    let data
    if (config.format === 'geojson') data = await res.json()
    else data = await res.text()

    await setCached(id, data, config.cacheTtlMs, 'bundled', true) // Auto-pin bundled
    return { data, source: 'bundled', fetchedAt: null, expiresAt: Infinity, pinned: true }
  }

  // 3. Try Remote / Proxy
  try {
    const res = await fetchWithRetry(options.remoteUrl || config.remoteUrl, {}, 1, 8000)
    let data
    if (config.format === 'geojson' || config.format === 'json') data = await res.json()
    else data = await res.text()

    await setCached(id, data, config.cacheTtlMs, 'remote', false)
    emitAudit('data', 'DATASET_FETCHED', `Successfully fetched ${id} from proxy`)
    return {
      data,
      source: 'remote',
      origin: 'network',
      fetchedAt: Date.now(),
      expiresAt: Date.now() + config.cacheTtlMs,
      pinned: false,
    }
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
          emitAudit(
            'data',
            'DATASET_FETCHED_FALLBACK',
            `Proxy failed, fetched ${id} from fallback ${url}`
          )
          return {
            data,
            source: 'fallback',
            origin: 'network',
            fetchedAt: Date.now(),
            expiresAt: Date.now() + config.cacheTtlMs,
            pinned: false,
          }
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
  if (expiresAt === Infinity) return 'No expiry (static data)'
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
