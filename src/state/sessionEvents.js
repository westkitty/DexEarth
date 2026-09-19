// Shared chronological local event stream, deliberately separate from remote observations.
const listeners = new Set()
let events = []
let sequence = 0
let suppressed = false
export function emitSessionEvent(type, payload = {}, category = 'LOCAL INTERACTION') {
  if (suppressed) return
  const event = {
    seq: ++sequence,
    at: Date.now(),
    type,
    category,
    payload: structuredClone(payload),
  }
  events = [...events.slice(-199), event]
  listeners.forEach(fn => fn(event))
  return event
}
export function subscribeSessionEvents(fn) {
  listeners.add(fn)
  return () => listeners.delete(fn)
}
export function getSessionEvents() {
  return events
}
export function withoutRecording(fn) {
  const previous = suppressed
  suppressed = true
  try {
    return fn()
  } finally {
    suppressed = previous
  }
}
