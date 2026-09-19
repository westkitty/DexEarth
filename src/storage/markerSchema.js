// Shared by authored markers and observation/replay imports. Optional legacy
// metadata may be absent, but present fields must be safe for the marker UI.
export const MAX_MARKERS = 500
export function isValidMarker(marker, requireId = true) {
  return !!(
    marker &&
    Number.isFinite(marker.lon) &&
    Math.abs(marker.lon) <= 180 &&
    Number.isFinite(marker.lat) &&
    Math.abs(marker.lat) <= 90 &&
    typeof marker.title === 'string' &&
    marker.title.length <= 500 &&
    (!requireId ||
      Number.isInteger(marker.id) ||
      (typeof marker.id === 'string' && marker.id.length > 0 && marker.id.length <= 100)) &&
    (marker.tags === undefined ||
      (Array.isArray(marker.tags) &&
        marker.tags.length <= 100 &&
        marker.tags.every(tag => typeof tag === 'string' && tag.length <= 100))) &&
    (marker.notes === undefined ||
      (typeof marker.notes === 'string' && marker.notes.length <= 10000)) &&
    (marker.severity === undefined ||
      ['info', 'warning', 'critical', 'classified'].includes(marker.severity))
  )
}
export function isValidMarkerCollection(markers) {
  return (
    Array.isArray(markers) &&
    markers.length <= MAX_MARKERS &&
    markers.every(marker => isValidMarker(marker)) &&
    new Set(markers.map(marker => String(marker.id))).size === markers.length
  )
}
export function validateMarkerDraft(marker) {
  if (!isValidMarker(marker, false) || !marker.title.trim())
    throw new Error(
      'Invalid marker: use finite longitude (−180…180), latitude (−90…90), a title of 1–500 characters, and valid text metadata.'
    )
  return marker
}
