// ─── UI Store (Panels and Tools) ─────────────────────────────────────────────
const _subscribers = new Set()

export const uiStore = {
  activeTool: 'none', // 'none', 'marker', 'geofence', etc.
  openPanels: {}, // { 'airRadar': true, 'styles': false }
}

function _notify() {
  _subscribers.forEach(f => f({ ...uiStore }))
}

export function subscribeUiStore(fn) {
  _subscribers.add(fn)
  return () => {
    _subscribers.delete(fn)
  }
}

export function setActiveTool(tool) {
  uiStore.activeTool = tool
  _notify()
}

export function setPanelOpen(id, isOpen) {
  uiStore.openPanels[id] = isOpen
  _notify()
}

// Global escape listener
if (typeof window !== 'undefined') {
  window.addEventListener('keydown', e => {
    if (e.key === 'Escape' && uiStore.activeTool !== 'none') {
      setActiveTool('none')
    }
  })
}

// One active sheet keeps the globe accessible on narrow screens.
export function toggleDrawer(current, id) {
  return current[id] ? {} : { [id]: true }
}
