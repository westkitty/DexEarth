import { emitSessionEvent } from '../state/sessionEvents.js'
const active = new Map()
// Retention and freshness are separate: corrupt or future capture times must
// not bypass a TTL comparison through JavaScript's NaN coercion.
export function hasFreshTimestamps(record, now = Date.now()) {
  if (
    !record ||
    !Number.isFinite(record.fetchedAt) ||
    record.fetchedAt <= 0 ||
    record.fetchedAt > now
  )
    return false
  const expiryValid =
    Number.isFinite(record.expiresAt) ||
    (record.source === 'custom' && record.expiresAt === Infinity)
  return expiryValid && record.expiresAt > now && record.expiresAt > record.fetchedAt
}
export function datasetState(record, now = Date.now()) {
  if (record?.missingKey) return 'OPTIONAL KEY MISSING'
  if (!record?.source || record.source === 'error' || record.source === 'unavailable')
    return 'UNAVAILABLE'
  if (record.source === 'bundled') return 'BUNDLED FALLBACK'
  if (!hasFreshTimestamps(record, now) || record.source === 'stale_cache') return 'STALE'
  return record.origin === 'network' ? 'LIVE/FRESH' : 'CACHED'
}
export function publishDataset(id, record) {
  const next = { ...record, id }
  const previous = active.get(id)
  active.set(id, next)
  if (
    !previous ||
    datasetState(previous) !== datasetState(next) ||
    previous.fetchedAt !== next.fetchedAt
  ) {
    emitSessionEvent(
      'dataset',
      {
        id,
        state: datasetState(next),
        source: next.source,
        fetchedAt: next.fetchedAt || null,
        expiresAt: Number.isFinite(next.expiresAt) ? next.expiresAt : null,
      },
      next.origin === 'network' ? 'REMOTE OBSERVATION' : 'DATA PROVENANCE'
    )
  }
  return next
}
export function datasetReferences() {
  return [...active.values()].map(({ id, source, origin, fetchedAt, expiresAt, missingKey }) => ({
    id,
    source,
    origin,
    fetchedAt: fetchedAt || null,
    expiresAt: Number.isFinite(expiresAt) ? expiresAt : null,
    missingKey: !!missingKey,
    historicalSnapshot: false,
  }))
}
export function getActiveDataset(id) {
  return active.get(id)
}
