import { orbitalFacts } from './orbital.js'
import { parseTLEs, fetchWithRetry } from '../../utils.js'
import { getCached, setCached } from '../../storage/cache.js'
import { cacheGet } from '../../storage/db.js'
import { publishDataset } from '../../data/datasetStatus.js'
import * as settings from '../../state/settingsStore.js'
let pending = null
export function loadTLEs(options = {}) {
  if (pending) return pending
  pending = load(options)
    .then(result => {
      publishDataset('tle_data', result)
      return result
    })
    .finally(() => {
      pending = null
    })
  return pending
}
async function load({ remoteUrl, forceRefresh = false } = {}) {
  const ttl = (settings.get('tleTtlHours') || 12) * 3600000
  const bundledOnly = settings.get('satelliteUseBundled') === true
  const hydrate = row => {
    const records = typeof row.data === 'string' ? parseTLEs(row.data) : row.data
    return Array.isArray(records)
      ? records.filter(
          r => typeof r?.name === 'string' && r.satrec?.satnum != null && orbitalFacts(r)
        )
      : []
  }
  if (!bundledOnly && !forceRefresh) {
    const cached = await getCached('tle_data', ttl)
    if (cached && hydrate(cached)?.length)
      return { ...cached, records: hydrate(cached), origin: 'cache' }
  }
  if (!bundledOnly) {
    try {
      const res = await fetchWithRetry(
        remoteUrl || settings.get('satelliteRemoteUrl') || '/proxy/tle',
        {},
        1,
        8000
      )
      const text = await res.text()
      const records = parseTLEs(text)
      if (!records.length) throw new Error('No valid TLE records')
      const fetchedAt = Date.now()
      await setCached('tle_data', text, ttl)
      return { records, source: 'remote', origin: 'network', fetchedAt, expiresAt: fetchedAt + ttl }
    } catch {
      /* failure is reflected by fallback origin; never refresh old timestamps */
    }
    try {
      const stale = (await cacheGet('tle_data'))?.value
      if (stale && hydrate(stale)?.length)
        return { ...stale, records: hydrate(stale), source: 'stale_cache', origin: 'cache' }
    } catch {
      /* IDB unavailable: bundled still works */
    }
  }
  try {
    const res = await fetch('/data/tle/starter.tle')
    if (!res.ok) throw new Error('Bundle unavailable')
    const records = parseTLEs(await res.text())
    if (!records.length) throw new Error('Bundle contains no valid TLE records')
    return { records, source: 'bundled', origin: 'bundle', fetchedAt: null, expiresAt: null }
  } catch {
    return { records: [], source: 'unavailable', fetchedAt: null, expiresAt: null }
  }
}
