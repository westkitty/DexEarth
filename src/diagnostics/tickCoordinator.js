// ─── Tick Coordinator ────────────────────────────────────────────────────────
// Centralized background task manager to govern work budgets and avoid UI jank.

const _fastTasks = new Map()
const _slowTasks = new Map()
const _rebuildTasks = new Map()

let _fastInt = null
let _slowInt = null
let _rebuildTimeouts = new Map()

/**
 * Register a fast task (~4 Hz).
 * Use for animations, rapid telemetry updates.
 */
export function registerFast(id, fn) {
    _fastTasks.set(id, fn)
}

/**
 * Register a slow task (~1 Hz).
 * Use for garbage collection, heavy data syncs, or background checks.
 */
export function registerSlow(id, fn) {
    _slowTasks.set(id, fn)
}

/**
 * Register a rebuilding task (debounced).
 * Call the returned function to schedule a run. It won't execute until it stops
 * being called for `debounceMs`. Useful for avoiding massive recalculations on resize/move.
 */
export function registerRebuild(id, fn, debounceMs = 250) {
    _rebuildTasks.set(id, { fn, debounceMs })
    return () => {
        const existing = _rebuildTimeouts.get(id)
        if (existing) clearTimeout(existing)
        _rebuildTimeouts.set(id, setTimeout(() => {
            fn()
            _rebuildTimeouts.delete(id)
        }, debounceMs))
    }
}

export function unregister(id) {
    _fastTasks.delete(id)
    _slowTasks.delete(id)
    _rebuildTasks.delete(id)
    const t = _rebuildTimeouts.get(id)
    if (t) clearTimeout(t)
    _rebuildTimeouts.delete(id)
}

/** Start the coordinator loops */
export function start() {
    if (!_fastInt) {
        _fastInt = setInterval(() => {
            for (const [id, fn] of _fastTasks) {
                try { fn() } catch (err) { console.error(`FastTask ${id} error:`, err) }
            }
        }, 250) // 4 Hz
    }

    if (!_slowInt) {
        _slowInt = setInterval(() => {
            for (const [id, fn] of _slowTasks) {
                try { fn() } catch (err) { console.error(`SlowTask ${id} error:`, err) }
            }
        }, 1000) // 1 Hz
    }
}

/** Stop all loops (e.g. going entirely idle) */
export function stop() {
    if (_fastInt) { clearInterval(_fastInt); _fastInt = null }
    if (_slowInt) { clearInterval(_slowInt); _slowInt = null }
    for (const [, timer] of _rebuildTimeouts) {
        clearTimeout(timer)
    }
    _rebuildTimeouts.clear()
}
