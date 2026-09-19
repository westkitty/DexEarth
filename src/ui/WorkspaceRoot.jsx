import { createReplayAutosave } from '../storage/replayAutosave.js'
import { getSavedMarkerWarning, subscribeSavedMarkers } from '../state/savedMarkers.js'
import { enforceCacheBounds } from '../storage/cache.js'
import { registerLayer, getLayer } from '../state/layerRegistry.js'
import { satellitesLayer } from '../layers/satellites/layer.js'
import { seismicSimLayer } from '../layers/seismicSim/layer.js'
import { markersLayer } from '../layers/markers/layer.js'
import { alertsLayer } from '../layers/alerts/layer.js'
import { useEffect, useRef, useState } from 'react'
import { configureWorkspace, setSavedMarkers } from '../state/workspace.js'
import { initWatchlist } from '../state/orbitStore.js'
import { initViewStore } from '../state/viewStore.js'
import { markersGetAll } from '../storage/db.js'
import {
  emitSessionEvent,
  getSessionEvents,
  subscribeSessionEvents,
} from '../state/sessionEvents.js'
import { replay, subscribeReplay } from '../state/sessionRuntime.js'
import { EXTERNAL_LIMITATION } from '../state/replay.js'
import { broadcastSync } from '../state/broadcastSync.js'
import * as settings from '../state/settingsStore.js'
import * as tc from '../state/timeController.js'
import * as Cesium from 'cesium'

export default function WorkspaceRoot({ viewer, toggles, restoreLayers }) {
  const [events, setEvents] = useState(getSessionEvents)
  const [expanded, setExpanded] = useState(false)
  const [replaying, setReplaying] = useState(false)
  const [storageError, setStorageError] = useState('')
  const [autosaveError, setAutosaveError] = useState('')
  const [markerWarning, setMarkerWarning] = useState(getSavedMarkerWarning)
  useEffect(() => subscribeSavedMarkers(setMarkerWarning), [])
  const [offlineReady, setOfflineReady] = useState(false)
  useEffect(() => {
    const ready = () => setOfflineReady(true)
    window.addEventListener('dexearth:offline-ready', ready)
    return () => window.removeEventListener('dexearth:offline-ready', ready)
  }, [])
  const togglesRef = useRef(toggles)
  useEffect(() => {
    togglesRef.current = toggles
    configureWorkspace({ viewer, toggles, restoreLayers })
    if (viewer) emitSessionEvent('layers', { layers: Object.keys(toggles).filter(k => toggles[k]) })
  }, [viewer, toggles, restoreLayers])
  useEffect(() => {
    Promise.all([
      initWatchlist(),
      initViewStore(),
      markersGetAll().then(setSavedMarkers),
      enforceCacheBounds(),
    ]).catch(() => setStorageError('Local storage unavailable. Saves cannot be guaranteed.'))
    return subscribeSessionEvents(event => {
      setEvents([...getSessionEvents()])
      if (replay.recording) replay.record(event)
    })
  }, [])
  useEffect(() => {
    if (!viewer) return
    const move = () => emitSessionEvent('camera', {})
    const remove = viewer.camera.moveEnd.addEventListener(move)
    const modules = {
      SATELLITES: satellitesLayer,
      SEISMIC_SIM: seismicSimLayer,
      MARKERS: markersLayer,
      ALERTS: alertsLayer,
    }
    for (const [id, layer] of Object.entries(modules)) registerLayer(id, layer)
    let disposed = false
    const autosave = createReplayAutosave({
      onError: error => {
        if (!disposed)
          setAutosaveError(
            `Replay not saved: ${error.message}. Retrying in 5 seconds; export your session as a backup.`
          )
      },
      onSaved: () => {
        if (!disposed) setAutosaveError('')
      },
    })
    const timer = setInterval(() => {
      for (const [id, layer] of Object.entries(modules)) getLayer(id).active = layer.isActive()
      replay.tick()
      void autosave(replay.session, replay.recording)
      broadcastSync.broadcast()
    }, 250)
    broadcastSync.init({
      viewer,
      isLeader: settings.get('broadcastLeader'),
      getTimeMs: tc.getTimeMs,
      getToggles: () => togglesRef.current,
      applyState: msg => {
        if (replay.recording || replay.playing || tc.getMode() === 'REPLAY') return
        if (msg.camera)
          viewer.camera.setView({
            destination: Cesium.Cartesian3.fromDegrees(
              msg.camera.lon,
              msg.camera.lat,
              msg.camera.alt
            ),
            orientation: msg.camera,
          })
        if (msg.toggles) restoreLayers(Object.keys(msg.toggles).filter(k => msg.toggles[k]))
        if (Number.isFinite(msg.timeMs)) {
          tc.setMode('MANUAL')
          tc.setManualTime(msg.timeMs)
        }
      },
    })
    const unsubSettings = settings.subscribe(s => broadcastSync.setLeader(s.broadcastLeader))
    const reflectReplay = () =>
      setReplaying(!replay.recording && !!replay.session && tc.getMode() === 'REPLAY')
    const unsubReplay = subscribeReplay(reflectReplay),
      unsubTime = tc.subscribe(reflectReplay)
    return () => {
      disposed = true
      remove()
      clearInterval(timer)
      unsubSettings()
      unsubReplay()
      unsubTime()
      broadcastSync.destroy()
      replay.pause()
      seismicSimLayer.deactivate()
      markersLayer.deactivate()
      alertsLayer.deactivate()
    }
  }, [viewer, restoreLayers])
  return (
    <aside className="event-timeline" aria-label="Observation timeline">
      <button aria-expanded={expanded} onClick={() => setExpanded(v => !v)}>
        {expanded ? '▾' : '▸'} Timeline · {events.length} events
      </button>
      {offlineReady && expanded && <p>Offline assets ready (production shell)</p>}
      {storageError && <p role="alert">{storageError}</p>}
      {autosaveError && <p role="alert">{autosaveError}</p>}
      {markerWarning && <p role="status">{markerWarning}</p>}
      {replaying && <p className="truth-warning">REPLAY · {EXTERNAL_LIMITATION}</p>}
      {expanded && (
        <ol>
          {events.slice(-40).map(e => (
            <li key={e.seq} data-category={e.category}>
              <time>{new Date(e.at).toISOString().slice(11, 19)}</time>{' '}
              <strong>{e.category}</strong> · {e.type}
              {e.payload.name ? ` · ${e.payload.name}` : ''}
              {e.payload.state ? ` · ${e.payload.state}` : ''}
            </li>
          ))}
        </ol>
      )}
    </aside>
  )
}
