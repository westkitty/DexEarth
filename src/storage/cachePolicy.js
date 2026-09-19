export const CACHE_VERSION = 2
export const CACHE_MAX_BYTES = 32 * 1024 * 1024
export const CACHE_MAX_RECORDS = 24
export function isRemoteRecord(row) {
  return (
    !row.key.startsWith('viewStore:') &&
    row.value?.data !== undefined &&
    row.value.source !== 'custom'
  )
}
export function evictionKeys(rows, maxBytes = CACHE_MAX_BYTES, maxRecords = CACHE_MAX_RECORDS) {
  const remote = rows
    .filter(isRemoteRecord)
    .sort(
      (a, b) =>
        Number(!!a.value.pinned) - Number(!!b.value.pinned) ||
        (a.value.lastUsedAt || a.value.fetchedAt || 0) -
          (b.value.lastUsedAt || b.value.fetchedAt || 0)
    )
  let bytes = remote.reduce(
    (n, r) => n + (r.value.bytes || new Blob([JSON.stringify(r.value)]).size),
    0
  )
  let count = remote.length
  const keys = []
  for (const r of remote) {
    if (bytes <= maxBytes && count <= maxRecords) break
    keys.push(r.key)
    count--
    bytes -= r.value.bytes || new Blob([JSON.stringify(r.value)]).size
  }
  return keys
}
