// ─── Cascade Model ────────────────────────────────────────────────────────────
// Dependency-based failure propagation between layers. Fully reversible.

import config from './cascadeConfig.json'
import { applyDegradation, setStatus, getStatus } from '../../state/layerRegistry.js'

let _activeEvents = []   // { eventId, triggeredAt, label }
let _onChange = []

function _notifyChange() {
    _onChange.forEach(fn => { try { fn(getState()) } catch { /* ignore */ } })
}

function _applyEvent(eventId) {
    const evDef = config.events.find(e => e.id === eventId)
    if (!evDef) return

    const profile = config.degradationProfiles[eventId] || {}
    for (const [layerId, degradation] of Object.entries(profile)) {
        applyDegradation(layerId, degradation)
    }
    // Also mark affected layers if not in degradationProfiles
    for (const layerId of (evDef.affects || [])) {
        if (!profile[layerId]) {
            // Mark status as degraded without changing render params
            setStatus(layerId, 'degraded')
        }
    }
}

function _removeEvent(eventId) {
    const evDef = config.events.find(e => e.id === eventId)
    if (!evDef) return
    const profile = config.degradationProfiles[eventId] || {}
    for (const layerId of Object.keys(profile)) {
        applyDegradation(layerId, null)
    }
    for (const layerId of (evDef.affects || [])) {
        if (getStatus(layerId) === 'degraded') setStatus(layerId, 'active')
    }
}

function _rebuildState() {
    // Reapply all active events in order
    for (const ev of _activeEvents) {
        _applyEvent(ev.eventId)
    }
}

// ── Causal chain explanation ──────────────────────────────────────────────────
function _getCausalChain(eventId) {
    const evDef = config.events.find(e => e.id === eventId)
    if (!evDef) return []
    const chain = []
    const profile = config.degradationProfiles[eventId] || {}
    for (const layerId of (evDef.affects || [])) {
        const deg = profile[layerId]
        chain.push({
            from: `EVENT: ${evDef.label}`,
            to: layerId,
            effect: deg ? JSON.stringify(deg) : 'status → degraded',
        })
    }
    return chain
}

// ── Public API ────────────────────────────────────────────────────────────────
export const cascadeModel = {
    triggerEvent(eventId) {
        if (_activeEvents.find(e => e.eventId === eventId)) return  // already active
        const evDef = config.events.find(e => e.id === eventId)
        if (!evDef) return
        _activeEvents.push({ eventId, triggeredAt: Date.now(), label: evDef.label })
        _applyEvent(eventId)
        _notifyChange()
    },

    cancelEvent(eventId) {
        _activeEvents = _activeEvents.filter(e => e.eventId !== eventId)
        _removeEvent(eventId)
        _rebuildState()
        _notifyChange()
    },

    reset() {
        const ids = _activeEvents.map(e => e.eventId)
        _activeEvents = []
        ids.forEach(_removeEvent)
        _notifyChange()
    },

    getState() { return getState() },
    getEventDefs() { return config.events },
    getCausalChain: _getCausalChain,
    onChange(fn) { _onChange.push(fn) },
}

function getState() {
    return {
        activeEvents: [..._activeEvents],
        causalChains: _activeEvents.flatMap(e => _getCausalChain(e.eventId)),
    }
}
