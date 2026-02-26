// ─── Layer Registry ───────────────────────────────────────────────────────────
// Manages Phase II layers with standard lifecycle methods.
// Existing Phase I layers in App.jsx are NOT touched.

/** @type {Map<string, LayerRegistration>} */
const _registry = new Map()

/**
 * Register a Phase II layer.
 * @param {string} id
 * @param {object} layer - must implement activate, deactivate, tick (optional), getGeometrySnapshot (optional), applyDegradation (optional)
 * @param {object} meta - { name, category, hasGeometry, defaultEnabled, perfCost }
 */
export function registerLayer(id, layer, meta = {}) {
    _registry.set(id, { id, layer, meta, active: false, status: 'idle', degradation: null })
}

export function getLayer(id) { return _registry.get(id) }

export function getAllLayers() { return [..._registry.values()] }

export function isActive(id) {
    const reg = _registry.get(id)
    return reg ? reg.active : false
}

export function getStatus(id) {
    const reg = _registry.get(id)
    return reg ? reg.status : 'idle'
}

export function setStatus(id, status) {
    const reg = _registry.get(id)
    if (reg) reg.status = status
}

/**
 * Activates a registered layer.
 * @param {string} id
 * @param {object} ctx - { viewer, getTimeMs, storage, settings }
 */
export async function activateRegisteredLayer(id, ctx) {
    const reg = _registry.get(id)
    if (!reg || reg.active) return
    reg.status = 'loading'
    try {
        await reg.layer.activate(ctx)
        reg.active = true
        reg.status = 'active'
    } catch (err) {
        console.error(`[LayerRegistry] Failed to activate ${id}:`, err)
        reg.status = 'error'
    }
}

export async function deactivateRegisteredLayer(id) {
    const reg = _registry.get(id)
    if (!reg || !reg.active) return
    try {
        await reg.layer.deactivate()
    } catch (err) {
        console.warn(`[LayerRegistry] Error deactivating ${id}:`, err)
    }
    reg.active = false
    reg.status = 'idle'
    reg.degradation = null
}

/**
 * Calls tick() on all active layers.
 * @param {number} timeMs
 * @param {number} dtMs
 */
export function tickAllLayers(timeMs, dtMs) {
    for (const reg of _registry.values()) {
        if (reg.active && typeof reg.layer.tick === 'function') {
            try { reg.layer.tick({ timeMs, dtMs }) } catch { /* layer tick error */ }
        }
    }
}

/**
 * Applies a degradation profile to a layer (from Cascade model).
 * @param {string} id
 * @param {object|null} profile - null to clear degradation
 */
export function applyDegradation(id, profile) {
    const reg = _registry.get(id)
    if (!reg) return
    reg.degradation = profile
    if (reg.active && typeof reg.layer.applyDegradation === 'function') {
        reg.layer.applyDegradation(profile)
    }
    reg.status = profile ? 'degraded' : (reg.active ? 'active' : 'idle')
}

/**
 * Returns geometry snapshot from a layer if it supports it.
 * @param {string} id
 * @returns {{ points?: Array, lines?: Array } | null}
 */
export function getGeometrySnapshot(id) {
    const reg = _registry.get(id)
    if (!reg || !reg.active) return null
    if (typeof reg.layer.getGeometrySnapshot === 'function') {
        try { return reg.layer.getGeometrySnapshot() } catch { return null }
    }
    return null
}
