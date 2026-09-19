import { isValidMarker, MAX_MARKERS } from '../storage/markerSchema.js'

// A safe in-memory view of authored records, independent of temporary snapshots.
// Legacy malformed/excess records stay in IndexedDB; this never deletes them.
let markers = []
let warning = ''
const listeners = new Set()
const notify = () => listeners.forEach(fn => fn(warning))
export function setSavedMarkers(records) {
  const source = Array.isArray(records) ? records : []
  const ids = new Set()
  markers = structuredClone(
    source.filter(marker => {
      if (!isValidMarker(marker) || ids.size >= MAX_MARKERS || ids.has(String(marker.id)))
        return false
      ids.add(String(marker.id))
      return true
    })
  )
  const omitted = source.length - markers.length
  warning = omitted
    ? `${omitted} saved marker(s) not displayed: invalid, duplicate, or over the 500-marker display limit. Original records remain in local storage.`
    : ''
  notify()
  return warning
}
export function getSavedMarkers() {
  return structuredClone(markers)
}
export function getSavedMarkerWarning() {
  return warning
}
export function subscribeSavedMarkers(fn) {
  listeners.add(fn)
  return () => listeners.delete(fn)
}
export function rememberSavedMarker(marker) {
  if (!isValidMarker(marker)) return
  const index = markers.findIndex(m => String(m.id) === String(marker.id))
  if (index >= 0) markers[index] = structuredClone(marker)
  else if (markers.length < MAX_MARKERS) markers.push(structuredClone(marker))
  notify()
}
export function forgetSavedMarker(id) {
  markers = markers.filter(m => String(m.id) !== String(id))
  notify()
}
