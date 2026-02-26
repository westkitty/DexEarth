// ─── Performance HUD ─────────────────────────────────────────────────────────
// FPS monitoring, per-layer primitive counts, and Safe Mode auto-trigger.

let _viewer = null
let _fps = 0
let _frameCount = 0
let _lastFpsTime = Date.now()
let _rafId = null
let _safeModeActive = false
let _lowFpsFrames = 0
let _onUpdate = []
let _safeModeCbs = []

// Safe mode settings (updated externally)
let _fpsTrigger = 20
let _frameWindow = 90  // consecutive low frames before triggering
let _safeModeCaps = {
    satCap: 80,
    groundTrackCap: 5,
    refreshIntervalScale: 3,
    disableBloom: true,
}

let _restoreState = null

function _measureFps() {
    _frameCount++
    const now = Date.now()
    const elapsed = now - _lastFpsTime
    if (elapsed >= 1000) {
        _fps = Math.round((_frameCount * 1000) / elapsed)
        _frameCount = 0
        _lastFpsTime = now
        _checkSafeMode()
        _emitUpdate()
    }
    _rafId = requestAnimationFrame(_measureFps)
}

function _sceneStats() {
    if (!_viewer) return {}
    const primitives = _viewer.scene.primitives
    let total = 0
    try { total = primitives.length } catch { /* ignore */ }
    return { totalPrimitives: total }
}

function _checkSafeMode() {
    const settings = _getSafeSettings()
    if (!settings.autoTrigger) return
    if (_fps < _fpsTrigger && !_safeModeActive) {
        _lowFpsFrames++
        if (_lowFpsFrames >= 3) {  // 3 consecutive 1s-windows below threshold
            _activateSafeMode(true)
        }
    } else {
        _lowFpsFrames = 0
    }
}

let _getSafeSettings = () => ({ autoTrigger: true })

function _emitUpdate() {
    const stats = { fps: _fps, safeModeActive: _safeModeActive, ..._sceneStats() }
    _onUpdate.forEach(fn => { try { fn(stats) } catch { /* ignore */ } })
}

function _activateSafeMode(auto = false) {
    if (_safeModeActive) return
    _safeModeActive = true
    _safeModeCbs.forEach(fn => { try { fn({ active: true, auto }) } catch { /* ignore */ } })
    _emitUpdate()
}

function _deactivateSafeMode() {
    if (!_safeModeActive) return
    _safeModeActive = false
    _lowFpsFrames = 0
    _safeModeCbs.forEach(fn => { try { fn({ active: false }) } catch { /* ignore */ } })
    _emitUpdate()
}

export const performanceHud = {
    init(viewer, getSafeSettings) {
        _viewer = viewer
        if (getSafeSettings) _getSafeSettings = getSafeSettings
        // Reset subscriber and counter state on re-init
        _onUpdate = []
        _safeModeCbs = []
        _lowFpsFrames = 0
        if (_rafId) cancelAnimationFrame(_rafId)
        _lastFpsTime = Date.now()
        _frameCount = 0
        _rafId = requestAnimationFrame(_measureFps)
    },

    stop() {
        if (_rafId) cancelAnimationFrame(_rafId)
        _rafId = null
    },

    getFps() { return _fps },
    isSafeModeActive() { return _safeModeActive },
    activateSafeMode() { _activateSafeMode(false) },
    deactivateSafeMode: _deactivateSafeMode,

    setThresholds({ fpsTrigger, frameWindow } = {}) {
        if (fpsTrigger) _fpsTrigger = fpsTrigger
        if (frameWindow) _frameWindow = frameWindow
    },

    getSafeModeCapSettings() { return { ..._safeModeCaps } },

    onUpdate(fn) { _onUpdate.push(fn) },
    onSafeModeChange(fn) { _safeModeCbs.push(fn) },
}
