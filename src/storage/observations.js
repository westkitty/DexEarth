import { userRecords, userPut, userDelete } from './db.js'
export const OBSERVATION_VERSION = 1
export const MAX_IMPORT_BYTES = 8 * 1024 * 1024
const modes = ['LIVE', 'MANUAL', 'REPLAY']
const finite = (n, min, max) => Number.isFinite(n) && n >= min && n <= max
const fail = () => {
  throw new Error('Invalid or unsupported DexEarth observation')
}
export function validateWorkspace(w) {
  if (!w || !w.camera || !w.time || !w.orbit || !Array.isArray(w.layers)) fail()
  if (typeof w.satelliteActive !== 'boolean') fail()
  const c = w.camera
  if (
    !finite(c.lon, -180, 180) ||
    !finite(c.lat, -90, 90) ||
    !finite(c.alt, -1000, 1e10) ||
    !['heading', 'pitch', 'roll'].every(k => finite(c[k], -7, 7))
  )
    fail()
  if (
    !modes.includes(w.time.mode) ||
    !finite(w.time.timeMs, -8e15, 8e15) ||
    !finite(w.time.speed, 0, 1000)
  )
    fail()
  const layerIds = [
    'AIR_RADAR',
    'ORBITAL_MATH',
    'SEISMIC_GRID',
    'THERMAL_FIRES',
    'MARITIME_LANES',
    'FIBER_CABLES',
    'TECTONIC_PLATES',
    'CLOUD_SYSTEMS',
    'SOLAR_SYNC',
    'VISUAL_FX',
  ]
  if (w.layers.length > 20 || !w.layers.every(id => layerIds.includes(id))) fail()
  if (
    !Array.isArray(w.markers) ||
    w.markers.length > 500 ||
    !w.markers.every(
      m =>
        m &&
        finite(m.lon, -180, 180) &&
        finite(m.lat, -90, 90) &&
        typeof m.title === 'string' &&
        m.title.length <= 500 &&
        (Number.isInteger(m.id) || typeof m.id === 'string')
    )
  )
    fail()
  if (new Set(w.markers.map(m => String(m.id))).size !== w.markers.length) fail()
  if (
    !Array.isArray(w.datasets) ||
    w.datasets.length > 100 ||
    !w.datasets.every(d => d && typeof d.id === 'string' && d.historicalSnapshot === false)
  )
    fail()
  if (
    !Array.isArray(w.simulations) ||
    w.simulations.length > 100 ||
    !w.simulations.every(
      e =>
        e &&
        finite(e.lon, -180, 180) &&
        finite(e.lat, -90, 90) &&
        finite(e.mag, 0, 12) &&
        finite(e.depthKm, 0, 1000) &&
        finite(e.originMs, -8e15, 8e15)
    )
  )
    fail()
  if (
    !Array.isArray(w.cascades) ||
    w.cascades.length > 20 ||
    !w.cascades.every(c => ['cable_sever', 'satellite_loss', 'regional_disruption'].includes(c))
  )
    fail()
  if (!['REALISTIC', 'CEL_SHADED', 'HOLOGRAM', 'WIREFRAME', 'NIGHT_OPS'].includes(w.style)) fail()
  if (
    !w.overlays ||
    !['borders', 'labels', 'followLabels'].every(k => typeof w.overlays[k] === 'boolean')
  )
    fail()
  const o = w.orbit,
    f = o.filters
  if (o.selectedId !== null && (typeof o.selectedId !== 'string' || o.selectedId.length > 20))
    fail()
  if (
    !finite(o.minutes, 5, 180) ||
    typeof o.showPath !== 'boolean' ||
    typeof o.showGround !== 'boolean' ||
    !f ||
    typeof f.search !== 'string' ||
    f.search.length > 100 ||
    !['ALL', 'LEO', 'MEO', 'GEO', 'OTHER'].includes(f.orbit) ||
    !finite(f.minAlt, 0, 100000) ||
    !finite(f.maxAlt, f.minAlt, 100000) ||
    !finite(f.minInclination, 0, 180) ||
    !finite(f.maxInclination, f.minInclination, 180) ||
    typeof f.watchedOnly !== 'boolean'
  )
    fail()
  if (
    !Array.isArray(o.watchIds) ||
    o.watchIds.length > 100 ||
    !o.watchIds.every(id => typeof id === 'string')
  )
    fail()
  return w
}
export function validateObservation(value) {
  if (
    value?.format !== 'DexEarth.Observation' ||
    value.version !== OBSERVATION_VERSION ||
    typeof value.id !== 'string' ||
    value.id.length > 100 ||
    typeof value.name !== 'string' ||
    !value.name.trim() ||
    value.name.length > 160 ||
    typeof value.notes !== 'string' ||
    value.notes.length > 10000 ||
    !Number.isFinite(value.createdAt) ||
    !Number.isFinite(value.updatedAt)
  )
    fail()
  validateWorkspace(value.workspace)
  if (new Blob([JSON.stringify(value)]).size > MAX_IMPORT_BYTES) fail()
  return value
}
export function parseObservation(text) {
  if (new Blob([text]).size > MAX_IMPORT_BYTES) throw new Error('Import exceeds 8 MiB')
  return validateObservation(JSON.parse(text))
}
export function createObservation(name, workspace, notes = '') {
  return validateObservation({
    format: 'DexEarth.Observation',
    version: 1,
    id: crypto.randomUUID(),
    name: name.trim(),
    notes,
    createdAt: Date.now(),
    updatedAt: Date.now(),
    workspace: structuredClone(workspace),
  })
}
export async function saveObservation(value) {
  validateObservation(value)
  const rows = await userRecords('observations')
  if (rows.length >= 100 && !rows.some(r => r.id === value.id))
    throw new Error('Limit: 100 observation sets')
  await userPut('observations', value)
  return value
}
export const listObservations = () => userRecords('observations')
export const deleteObservation = id => userDelete('observations', id)
export function downloadJson(value, filename) {
  const url = URL.createObjectURL(
    // Keep the wire encoding identical to the size-validated encoding. Pretty
    // printing a nearly full session can otherwise make its own import fail.
    new Blob([JSON.stringify(value)], { type: 'application/json' })
  )
  const a = document.createElement('a')
  a.href = url
  a.download = filename
  a.click()
  setTimeout(() => URL.revokeObjectURL(url), 1000)
}
