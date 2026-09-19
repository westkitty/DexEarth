// Bridge the existing Cesium-owned primary layers into the analytic registry.
// Geometry copies are bounded; they are analysis samples, never a new data source.
import { registerLayer, getLayer } from './layerRegistry.js'
import { LAYER_DEFS } from '../config.js'
const snapshots = new Map()
const validPoint = p =>
  p &&
  Number.isFinite(p.lon) &&
  Number.isFinite(p.lat) &&
  Math.abs(p.lon) <= 180 &&
  Math.abs(p.lat) <= 90
export function boundGeometry(snapshot = {}) {
  const points = (snapshot.points || []).filter(validPoint).slice(0, 1000)
  const lines = []
  let remaining = 4000
  for (const line of (snapshot.lines || []).slice(0, 200)) {
    if (remaining < 2) break
    const coords = (line.coords || [])
      .filter(c => Array.isArray(c) && validPoint({ lon: c[0], lat: c[1] }))
      .slice(0, Math.min(256, remaining))
    if (coords.length < 2) continue
    remaining -= coords.length
    lines.push({ ...line, coords })
  }
  return { points, lines, sampled: true }
}
export function initializePrimaryGeometry(layerData, orbital) {
  snapshots.clear()
  for (const { id } of LAYER_DEFS) {
    registerLayer(
      id,
      {
        getGeometrySnapshot:
          id === 'ORBITAL_MATH'
            ? () => orbital.getGeometrySnapshot()
            : () => snapshots.get(id) || { points: [], lines: [] },
        applyDegradation(profile) {
          layerData[id].degradation = profile
        },
      },
      { hasGeometry: true }
    )
  }
}
export function setPrimaryActive(id, active) {
  const reg = getLayer(id)
  if (reg) {
    reg.active = active
    reg.status = active ? 'loading' : 'idle'
  }
  if (!active) snapshots.delete(id)
}
export function publishPrimaryGeometry(id, snapshot) {
  if (!getLayer(id)?.active) return
  snapshots.set(id, boundGeometry(snapshot))
  getLayer(id).status = 'active'
}
export function geojsonSnapshot(json) {
  const points = [],
    lines = []
  for (const feature of json?.features || []) {
    const geometry = feature.geometry
    if (!geometry) continue
    const meta = {
      name: feature.properties?.title || feature.properties?.name || String(feature.id || ''),
      mag: feature.properties?.mag,
    }
    if (geometry.type === 'Point')
      points.push({ lon: geometry.coordinates[0], lat: geometry.coordinates[1], meta })
    if (geometry.type === 'LineString') lines.push({ coords: geometry.coordinates, meta })
    if (geometry.type === 'MultiLineString')
      geometry.coordinates.forEach(coords => lines.push({ coords, meta }))
  }
  return boundGeometry({ points, lines })
}
