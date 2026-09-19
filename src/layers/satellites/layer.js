import * as Cesium from 'cesium'
import { orbitalFacts } from './orbital.js'
import { loadTLEs } from './tleSources.js'
import { propagateSatellites, buildSelectedPaths } from './render.js'
import { getTimeMs } from '../../state/timeController.js'
import {
  getOrbitState,
  subscribeOrbit,
  updateOrbit,
  refreshWatchedElements,
} from '../../state/orbitStore.js'
import { styleManagerState } from '../../visuals/styleManager.js'
import { datasetState } from '../../data/datasetStatus.js'
import { expiresIn, lastFetched } from '../../storage/cache.js'
import * as settings from '../../state/settingsStore.js'
let viewer, points, lines, picker, timer, unsubscribe
let records = [],
  propagated = [],
  info = {},
  generation = 0,
  cap = 250,
  degradation = null,
  pathKey = ''
const statuses = new Set(),
  telemetry = new Set()
function notify() {
  telemetry.forEach(fn =>
    fn({ sats: propagated.length, groundTracks: lines?.length || 0, ...info })
  )
}
function allRecords() {
  const merged = new Map(records.map(r => [String(r.satrec.satnum), r]))
  for (const w of getOrbitState().watchlist) {
    if (
      !merged.has(w.id) ||
      (orbitalFacts(w.record)?.epochMs || 0) > (orbitalFacts(merged.get(w.id))?.epochMs || 0)
    )
      merged.set(w.id, w.record)
  }
  return [...merged.values()]
}
function render() {
  if (!viewer || viewer.isDestroyed() || !points) return
  const timeMs = getTimeMs(),
    state = getOrbitState()
  const safe = styleManagerState.safeModeActive || settings.get('safeModeEnabled')
  propagated = propagateSatellites(
    points,
    allRecords(),
    timeMs,
    Math.min(cap, degradation?.satCap ?? cap, safe ? 80 : 500),
    state
  )
  const key = JSON.stringify([
    Math.floor(timeMs / 15000),
    state.selectedId,
    state.minutes,
    state.showPath,
    state.showGround,
    safe,
  ])
  if (key !== pathKey) {
    pathKey = key
    buildSelectedPaths(lines, satellitesLayer.getSelected(), timeMs, state, safe)
  }
  notify()
  viewer.scene.requestRender()
}
async function load(forceRefresh = false) {
  const token = generation
  statuses.forEach(fn => fn('loading'))
  const result = await loadTLEs({ forceRefresh })
  if (token !== generation || !viewer) return
  records = result.records
  refreshWatchedElements(records).catch(() => {})
  info = {
    source: result.source,
    origin: result.origin,
    fetchedAt: result.fetchedAt,
    expiresAt: result.expiresAt,
  }
  pathKey = ''
  render()
  statuses.forEach(fn => fn(records.length ? 'active' : 'error'))
}
export const satellitesLayer = {
  async activate({ viewer: v }) {
    if (viewer === v) return
    if (viewer) this.deactivate()
    viewer = v
    generation++
    cap = settings.get('satelliteCap') || 250
    points = v.scene.primitives.add(new Cesium.PointPrimitiveCollection())
    lines = v.scene.primitives.add(new Cesium.PolylineCollection())
    picker = new Cesium.ScreenSpaceEventHandler(v.scene.canvas)
    picker.setInputAction(({ position }) => {
      const picked = v.scene.drillPick(position, 8, 20, 20).find(p => p.id?.dexSatellite)
      if (picked) updateOrbit({ selectedId: picked.id.dexSatellite })
    }, Cesium.ScreenSpaceEventType.LEFT_CLICK)
    unsubscribe = subscribeOrbit(() => {
      pathKey = ''
      render()
    })
    timer = setInterval(render, 500)
    await load()
  },
  deactivate() {
    generation++
    clearInterval(timer)
    unsubscribe?.()
    picker?.destroy()
    picker = null
    if (viewer && !viewer.isDestroyed()) {
      viewer.scene.primitives.remove(points)
      viewer.scene.primitives.remove(lines)
    }
    viewer = points = lines = null
    records = []
    propagated = []
    pathKey = ''
    notify()
  },
  isActive: () => !!viewer,
  tick: render,
  refresh: () => load(true),
  getRecords: allRecords,
  getSelected: () => allRecords().find(r => String(r.satrec.satnum) === getOrbitState().selectedId),
  getSelectedProvenance() {
    const selected = this.getSelected()
    return selected && records.includes(selected) ? info.source : 'local watchlist elements'
  },
  getPositions: () => propagated,
  getRenderStats: () => ({ points: points?.length || 0, lines: lines?.length || 0 }),
  getGeometrySnapshot: () => ({
    points: propagated.map(p => ({ lon: p.lon, lat: p.lat, meta: p })),
  }),
  applyDegradation(p) {
    degradation = p
  },
  setSatCap(n) {
    cap = Math.max(10, Math.min(500, n))
    settings.set('satelliteCap', cap)
    render()
  },
  setNameFilter(search) {
    updateOrbit({ filters: { ...getOrbitState().filters, search } })
  },
  setShowGroundTracks(showGround) {
    updateOrbit({ showGround })
  },
  getCacheInfo: () => ({
    ...info,
    state: datasetState(info),
    expiresInStr: expiresIn(info.expiresAt),
    lastFetchedStr: lastFetched(info.fetchedAt),
  }),
  onStatus(fn) {
    statuses.add(fn)
    return () => statuses.delete(fn)
  },
  onTelemetry(fn) {
    telemetry.add(fn)
    return () => telemetry.delete(fn)
  },
  jumpTo(id) {
    updateOrbit({ selectedId: id })
    const p = propagated.find(p => p.id === id)
    if (viewer && p)
      viewer.camera.flyTo({
        destination: Cesium.Cartesian3.fromDegrees(p.lon, p.lat, p.altKm * 1000 + 800000),
        duration: 1,
      })
  },
}
