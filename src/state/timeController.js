// ─── Time Controller ────────────────────────────────────────────────────────
// Single source of truth for app time. Supports LIVE, MANUAL, and REPLAY modes.
// All time-dependent Phase II layers consume this.

const MODES = { LIVE: 'LIVE', MANUAL: 'MANUAL', REPLAY: 'REPLAY' }

let _mode = MODES.LIVE
let _manualTimeMs = Date.now()
let _replayTimeMs = Date.now()
let _replaySpeed = 1.0 // multiplier (1 = real-time)
let _replayLastWall = Date.now()
let _replayRafId = null
let _subscribers = new Set()
let _stepSizeMs = 60_000 // default 1 minute

function _notify() {
  const t = getTimeMs()
  _subscribers.forEach(fn => {
    try { fn(t) } catch { /* never crash */ }
  })
}

function _stopReplay() {
  if (_replayRafId !== null) {
    cancelAnimationFrame(_replayRafId)
    _replayRafId = null
  }
}

function _startReplay() {
  _stopReplay()
  _replayLastWall = Date.now()
  const tick = () => {
    const now = Date.now()
    const wallDt = now - _replayLastWall
    _replayLastWall = now
    _replayTimeMs += wallDt * _replaySpeed
    _notify()
    _replayRafId = requestAnimationFrame(tick)
  }
  _replayRafId = requestAnimationFrame(tick)
}

// ── Public API ────────────────────────────────────────────────────────────────

export function getMode() { return _mode }

export function getTimeMs() {
  if (_mode === MODES.LIVE) return Date.now()
  if (_mode === MODES.MANUAL) return _manualTimeMs
  return _replayTimeMs
}

export function setMode(mode) {
  if (!MODES[mode]) throw new Error(`Unknown mode: ${mode}`)
  _stopReplay()
  if (mode === MODES.LIVE) {
    _manualTimeMs = Date.now()
    _replayTimeMs = Date.now()
  } else if (mode === MODES.REPLAY) {
    _replayTimeMs = getTimeMs()
    _replayLastWall = Date.now()
    _startReplay()
  }
  _mode = mode
  _notify()
}

export function setManualTime(ms) {
  _manualTimeMs = ms
  _replayTimeMs = ms
  _notify()  // always notify — callers set mode before calling
}

export function setReplaySpeed(speed) {
  _replaySpeed = speed
}

export function getReplaySpeed() { return _replaySpeed }

export function step(offsetMs) {
  if (_mode !== MODES.MANUAL) setMode(MODES.MANUAL)
  setManualTime(getTimeMs() + offsetMs)
}

export function resetToNow() {
  _stopReplay()
  _manualTimeMs = Date.now()
  _replayTimeMs = Date.now()
  if (_mode !== MODES.LIVE) setMode(MODES.LIVE)
  _notify()
}

export function setStepSize(ms) { _stepSizeMs = ms }
export function getStepSize() { return _stepSizeMs }

export function subscribe(fn) {
  _subscribers.add(fn)
  return () => _subscribers.delete(fn)
}

// Convenience: formatted UTC string from any ms timestamp
export function fmtUtc(ms) {
  const d = new Date(ms)
  const pad = n => String(n).padStart(2, '0')
  return (
    `${d.getUTCFullYear()}-${pad(d.getUTCMonth() + 1)}-${pad(d.getUTCDate())} ` +
    `${pad(d.getUTCHours())}:${pad(d.getUTCMinutes())}:${pad(d.getUTCSeconds())} UTC`
  )
}

export function fmtLocal(ms) {
  return new Date(ms).toLocaleString()
}

export { MODES }
