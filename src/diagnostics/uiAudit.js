// ─── UI Audit ─────────────────────────────────────────────────────────────────
// Enumerates registered controls and logs missing handlers.

const _registry = {}
let _subscribers = []

export function registerControl(id, description, isBound) {
    _registry[id] = { description, isBound, timestamp: Date.now() }
    _notify()
}

export function getAuditReport() {
    const report = {
        total: 0,
        bound: 0,
        unbound: 0,
        unboundList: []
    }

    for (const [id, data] of Object.entries(_registry)) {
        report.total++
        if (data.isBound) {
            report.bound++
        } else {
            report.unbound++
            report.unboundList.push({ id, description: data.description })
        }
    }

    return report
}

function _notify() {
    _subscribers.forEach(fn => { try { fn(getAuditReport()) } catch { /* ignore */ } })
}

export function subscribeToAudit(fn) {
    _subscribers.push(fn)
    fn(getAuditReport())
    return () => { _subscribers = _subscribers.filter(f => f !== fn) }
}
