// ─── Global Audit Log ─────────────────────────────────────────────────────────
import { auditAdd, auditGetAll, auditClear } from '../storage/db.js'

let _events = []
let _subscribers = []
const MAX_EVENTS = 500

/**
 * Emit an audit event.
 * @param {'ui'|'data'|'layer'|'perf'|'error'} category 
 * @param {string} event e.g., 'LAYER_TOGGLED', 'SAFE_MODE_TRIGGERED'
 * @param {string} detail descriptive text
 * @param {object} [metadata]
 */
export async function emitAudit(category, event, detail, metadata = {}) {
    const entry = {
        timeMs: Date.now(),
        category,
        event,
        detail,
        ...metadata,
    }

    // Memory cache for immediate UI sync
    _events.unshift(entry)
    if (_events.length > MAX_EVENTS) _events.length = MAX_EVENTS
    _notify()

    // Persist to IDB
    try {
        await auditAdd(entry)
    } catch { /* ignore IDB failure to prevent cascading crashes */ }
}

export async function loadAuditHistory() {
    try {
        const stored = await auditGetAll()
        // Sort descending by time
        stored.sort((a, b) => b.timeMs - a.timeMs)
        _events = stored.slice(0, MAX_EVENTS)
        _notify()
    } catch { /* ignore */ }
}

export async function clearAuditHistory() {
    _events = []
    _notify()
    await auditClear()
}

export function subscribeAudit(fn) {
    _subscribers.push(fn)
    fn([..._events])
    return () => { _subscribers = _subscribers.filter(f => f !== fn) }
}

function _notify() {
    const snapshot = [..._events]
    _subscribers.forEach(f => f(snapshot))
}

export function getAuditEvents() {
    return [..._events]
}
