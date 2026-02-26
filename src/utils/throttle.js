// ─── Throttle & Debounce ──────────────────────────────────────────────────────

/**
 * Returns a throttled version of `fn` that executes at most once every `intervalMs`.
 * The last call within the interval is always executed.
 */
export function throttle(fn, intervalMs) {
    let lastRan = 0
    let pending = null
    return function (...args) {
        const now = Date.now()
        const remaining = intervalMs - (now - lastRan)
        if (remaining <= 0) {
            if (pending) { clearTimeout(pending); pending = null }
            lastRan = now
            fn.apply(this, args)
        } else {
            if (pending) clearTimeout(pending)
            pending = setTimeout(() => {
                lastRan = Date.now()
                pending = null
                fn.apply(this, args)
            }, remaining)
        }
    }
}

/**
 * Returns a debounced version of `fn` that only fires after `delayMs`
 * of inactivity.
 */
export function debounce(fn, delayMs) {
    let timer = null
    return function (...args) {
        clearTimeout(timer)
        timer = setTimeout(() => fn.apply(this, args), delayMs)
    }
}
