// ─── UI Store (Panels and Tools) ─────────────────────────────────────────────
let _subscribers = []

export const uiStore = {
    activeTool: 'none',   // 'none', 'marker', 'geofence', etc.
    openPanels: {},       // { 'airRadar': true, 'styles': false }
}

function _notify() { _subscribers.forEach(f => f({ ...uiStore })) }

export function subscribeUiStore(fn) {
    _subscribers.push(fn)
    return () => { _subscribers = _subscribers.filter(f => f !== fn) }
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
