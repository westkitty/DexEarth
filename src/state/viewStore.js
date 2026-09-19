// ─── View Store (Saved views + Warp Home) ────────────────────────────────────
import { userRecords, userPut } from '../storage/db.js'

let _subscribers = []

// Core state
export const viewStore = {
  home: {
    destination: [-84.5323, 44.0, 2_000_000], // Michigan
    orientation: { heading: 0, pitch: -90, roll: 0 },
  },
  savedViews: {}, // { "1": { name, camera, layers, timestamp }, "2": ... }
  flyMode: 'normal', // 'normal' | 'cinematic' | 'fast'
}

// ── Observers ────────────────────────────────────────────────────────────────
function _notify() {
  _subscribers.forEach(f => f({ ...viewStore }))
}
export function subscribeViewStore(fn) {
  _subscribers.push(fn)
  return () => {
    _subscribers = _subscribers.filter(f => f !== fn)
  }
}

// ── Actions ──────────────────────────────────────────────────────────────────
export function setFlyMode(mode) {
  viewStore.flyMode = mode
  _notify()
}

export function setHome(dest, orient) {
  viewStore.home = { destination: dest, orientation: orient }
  _notify()
  userPut('preferences', { id: 'viewStore:home', value: viewStore.home })
}

export async function saveView(slot, name, cameraState, activeLayers) {
  viewStore.savedViews[slot] = {
    name,
    camera: cameraState,
    layers: activeLayers,
    timestamp: Date.now(),
  }
  _notify()
  await userPut('preferences', { id: 'viewStore:savedViews', value: viewStore.savedViews })
}

export async function deleteView(slot) {
  delete viewStore.savedViews[slot]
  _notify()
  await userPut('preferences', { id: 'viewStore:savedViews', value: viewStore.savedViews })
}

export async function initViewStore() {
  const rows = await userRecords('preferences')
  const home = rows.find(r => r.id === 'viewStore:home')?.value
  if (home) viewStore.home = home

  const views = rows.find(r => r.id === 'viewStore:savedViews')?.value
  if (views) viewStore.savedViews = views

  _notify()
}

// Global hook for keyboard shortcuts is handled in App.jsx or a top-level component,
// since it needs access to the Cesium viewer camera and layer toggles state.
