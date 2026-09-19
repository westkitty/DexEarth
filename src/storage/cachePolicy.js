export const CACHE_VERSION = 2
export const CACHE_MAX_BYTES = 32 * 1024 * 1024
export const CACHE_MAX_RECORDS = 24
export function isRemoteRecord(row) {
  return (
    row?.key != null &&
    !(typeof row.key === 'string' && row.key.startsWith('viewStore:')) &&
    row.value?.data !== undefined &&
    row.value.source !== 'custom'
  )
}
function payloadBytes(value) {
  try {
    const actual = new Blob([JSON.stringify(value.data)]).size
    const hint =
      Number.isFinite(value.bytes) && value.bytes > 0
        ? Math.min(value.bytes, CACHE_MAX_BYTES + 1)
        : 0
    return Math.max(actual, hint)
  } catch {
    // Unsupported/corrupt remote payload: evict rather than bypass the budget.
    return CACHE_MAX_BYTES + 1
  }
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
  const sizes = new Map(remote.map(r => [r, payloadBytes(r.value)]))
  let bytes = remote.reduce((n, r) => n + sizes.get(r), 0)
  let count = remote.length
  const keys = []
  for (const r of remote) {
    if (bytes <= maxBytes && count <= maxRecords) break
    keys.push(r.key)
    count--
    bytes -= sizes.get(r)
  }
  return keys
}
