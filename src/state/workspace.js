import * as Cesium from 'cesium'
import * as tc from './timeController.js'
import { getOrbitState, updateOrbit } from './orbitStore.js'
import { datasetReferences } from '../data/datasetStatus.js'
import { markersLayer } from '../layers/markers/layer.js'
import { seismicSimLayer } from '../layers/seismicSim/layer.js'
import { cascadeModel } from '../layers/cascade/model.js'
import { satellitesLayer } from '../layers/satellites/layer.js'
import {
  settings as overlays,
  countryBordersLayer,
  countryLabelsLayer,
  countryFollowLabelsLayer,
} from '../overlays/countries/index.js'
import { applyPreset, getCurrentPresetId } from '../visuals/styleManager.js'
import { validateWorkspace } from '../storage/observations.js'
import { withoutRecording, emitSessionEvent } from './sessionEvents.js'
let context = null
let lastApplied = ''
let savedMarkers = []
export function configureWorkspace(value) {
  context = value
}
export function setSavedMarkers(markers) {
  savedMarkers = markers
}
export function captureWorkspace() {
  if (!context?.viewer || context.viewer.isDestroyed()) throw new Error('Globe not ready')
  const c = context.viewer.camera,
    p = c.positionCartographic,
    o = getOrbitState()
  return {
    camera: {
      lon: Cesium.Math.toDegrees(p.longitude),
      lat: Cesium.Math.toDegrees(p.latitude),
      alt: p.height,
      heading: c.heading,
      pitch: c.pitch,
      roll: c.roll,
    },
    layers: Object.keys(context.toggles).filter(id => context.toggles[id]),
    satelliteActive: satellitesLayer.isActive(),
    time: { mode: tc.getMode(), timeMs: tc.getTimeMs(), speed: tc.getReplaySpeed() },
    orbit: {
      selectedId: o.selectedId,
      filters: { ...o.filters },
      minutes: o.minutes,
      showPath: o.showPath,
      showGround: o.showGround,
      watchIds: o.watchSubset || o.watchlist.map(w => w.id),
    },
    markers: structuredClone(markersLayer.isActive() ? markersLayer.getMarkers() : savedMarkers),
    overlays: {
      borders: overlays.borders,
      labels: overlays.labels,
      followLabels: overlays.followLabels,
    },
    style: getCurrentPresetId(),
    simulations: seismicSimLayer.getEvents(),
    cascades: cascadeModel.getState().activeEvents.map(e => e.eventId),
    datasets: datasetReferences(),
  }
}
export function applyWorkspace(workspace, { replay = false, elapsed = 0 } = {}) {
  validateWorkspace(workspace)
  if (!context?.viewer || context.viewer.isDestroyed()) throw new Error('Globe not ready')
  const { viewer } = context
  return withoutRecording(() => {
    const w = workspace
    if (replay)
      tc.setSessionTime(
        w.time.timeMs +
          (w.time.mode === 'MANUAL' ? 0 : elapsed * (w.time.mode === 'REPLAY' ? w.time.speed : 1))
      )
    else {
      tc.setMode(w.time.mode)
      if (w.time.mode !== 'LIVE') tc.setManualTime(w.time.timeMs)
      tc.setReplaySpeed(w.time.speed)
    }
    const key = JSON.stringify({ ...w, time: null, datasets: null })
    if (replay && key === lastApplied) return
    lastApplied = replay ? key : ''
    viewer.camera.setView({
      destination: Cesium.Cartesian3.fromDegrees(w.camera.lon, w.camera.lat, w.camera.alt),
      orientation: w.camera,
    })
    const layers = replay
      ? w.layers.filter(id => !['AIR_RADAR', 'SEISMIC_GRID', 'THERMAL_FIRES'].includes(id))
      : w.layers
    context.restoreLayers(layers)
    updateOrbit({
      watchSubset: w.orbit.watchIds,
      selectedId: w.orbit.selectedId,
      filters: w.orbit.filters,
      minutes: w.orbit.minutes,
      showPath: w.orbit.showPath,
      showGround: w.orbit.showGround,
    })
    if (w.satelliteActive) satellitesLayer.activate({ viewer })
    else satellitesLayer.deactivate()
    markersLayer.showSnapshot(viewer, w.markers)
    if (getCurrentPresetId() !== w.style) applyPreset(w.style)
    for (const [id, layer] of [
      ['borders', countryBordersLayer],
      ['labels', countryLabelsLayer],
      ['followLabels', countryFollowLabelsLayer],
    ]) {
      if (overlays[id] !== w.overlays[id]) {
        if (w.overlays[id]) layer.activate({ viewer }).catch(() => {})
        else layer.deactivate()
      }
    }
    if (w.simulations.length) seismicSimLayer.activate({ viewer })
    seismicSimLayer.restoreEvents(w.simulations)
    cascadeModel.restoreEvents(w.cascades)
  })
}
export function loadObservationView(observation) {
  applyWorkspace(observation.workspace)
  emitSessionEvent('observation-loaded', { name: observation.name })
}
