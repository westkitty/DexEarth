// ─── Style Manager ────────────────────────────────────────────────────────────
// Single source of truth for global render styles.
// Applies and removes Cesium PostProcessStages, globe settings, overlay styles.

import { applyOverlayStyle, rebuildAllOverlays } from '../overlays/countries/index.js'
import { realisticPreset } from './presets/realistic.js'
import { celShadedPreset } from './presets/celShaded.js'
import { hologramPreset } from './presets/hologram.js'
import { wireframePreset } from './presets/wireframe.js'
import { nightOpsPreset } from './presets/nightOps.js'

export const PRESETS = {
    REALISTIC: realisticPreset,
    CEL_SHADED: celShadedPreset,
    HOLOGRAM: hologramPreset,
    WIREFRAME: wireframePreset,
    NIGHT_OPS: nightOpsPreset,
}

// ── State ─────────────────────────────────────────────────────────────────────
let _viewer = null
let _currentPresetId = 'REALISTIC'
let _presetParams = {}  // per-preset slider overrides
let _activeStages = []  // track added PostProcessStages for safe removal
let _gridPrimitive = null
let _onStateChange = []

// Safe Mode
let _safeModeActive = false
let _fpsSamples = []
let _rafId = null

export const styleManagerState = {
    presetId: 'REALISTIC',
    safeModeActive: false,
    fps: 0,
    postFxEnabled: true,
}

// ── Internal ──────────────────────────────────────────────────────────────────
function _notify() {
    _onStateChange.forEach(fn => { try { fn({ ...styleManagerState }) } catch { /* ignore */ } })
}

function _removeActiveStages() {
    if (!_viewer) return
    for (const stage of _activeStages) {
        try {
            // Find and remove from postProcessStages
            const stages = _viewer.scene.postProcessStages
            if (stages.contains(stage)) stages.remove(stage)
        } catch { /* ignore */ }
    }
    _activeStages = []
}

function _removeGridPrimitive() {
    if (_gridPrimitive && _viewer) {
        try { _viewer.scene.primitives.remove(_gridPrimitive) } catch { /* ignore */ }
        _gridPrimitive = null
    }
}

function _applyGlobeDefaults() {
    if (!_viewer) return
    const scene = _viewer.scene
    scene.globe.enableLighting = false
    scene.globe.showGroundAtmosphere = false
    scene.fog.enabled = false
    scene.sky = scene.skyBox || null
    if (scene.skyAtmosphere) scene.skyAtmosphere.show = false
}

// ── FPS Monitor ───────────────────────────────────────────────────────────────
function _startFpsMonitor() {
    if (_rafId) return
    let last = performance.now()
    const tick = () => {
        const now = performance.now()
        const dt = now - last; last = now
        const fps = dt > 0 ? 1000 / dt : 60
        _fpsSamples.push(fps)
        if (_fpsSamples.length > 60) _fpsSamples.shift()
        if (_fpsSamples.length >= 60) {
            const avg = _fpsSamples.reduce((a, b) => a + b, 0) / _fpsSamples.length
            styleManagerState.fps = Math.round(avg)
            if (avg < 25 && !_safeModeActive) {
                _activateSafeMode()
            }
        }
        _rafId = requestAnimationFrame(tick)
    }
    _rafId = requestAnimationFrame(tick)
}

function _stopFpsMonitor() {
    if (_rafId) { cancelAnimationFrame(_rafId); _rafId = null }
    _fpsSamples = []
}

function _activateSafeMode() {
    _safeModeActive = true
    styleManagerState.safeModeActive = true
    styleManagerState.postFxEnabled = false
    // Remove expensive stages
    _removeActiveStages()
    // Update any preset that reacts to safe mode
    const preset = PRESETS[_currentPresetId]
    if (preset?.onSafeModeEnter) preset.onSafeModeEnter(_viewer)
    _notify()
}

export function deactivateSafeMode() {
    _safeModeActive = false
    styleManagerState.safeModeActive = false
    styleManagerState.postFxEnabled = true
    _fpsSamples = []
    // Re-apply current preset
    applyPreset(_currentPresetId)
}

// ── Public API ────────────────────────────────────────────────────────────────

export function init(viewer) {
    _viewer = viewer
    _startFpsMonitor()
    applyPreset('REALISTIC')
}

export function applyPreset(presetId, params = {}) {
    if (!_viewer) return
    const preset = PRESETS[presetId]
    if (!preset) return

    // Tear down previous preset
    _removeActiveStages()
    _removeGridPrimitive()
    const prev = PRESETS[_currentPresetId]
    if (prev?.deactivate) prev.deactivate(_viewer)

    _currentPresetId = presetId
    styleManagerState.presetId = presetId

    // Merge preset defaults with any user overrides
    _presetParams[presetId] = { ...preset.defaults, ..._presetParams[presetId], ...params }
    const p = _presetParams[presetId]

    // Reset globe to defaults
    _applyGlobeDefaults()

    if (!_safeModeActive || preset.isCheap) {
        // Apply the preset
        const result = preset.activate(_viewer, p)
        if (result?.stages) _activeStages.push(...result.stages)
        if (result?.gridPrimitive) _gridPrimitive = result.gridPrimitive
        styleManagerState.postFxEnabled = !!result?.stages?.length || false
    } else {
        preset.activateLite?.(_viewer, p)
        styleManagerState.postFxEnabled = false
    }

    // Update overlay styling to match preset
    applyOverlayStyle(preset.borderStyle || {}, preset.labelStyle || {})
    rebuildAllOverlays()

    _notify()
}

export function updatePresetParam(key, value) {
    if (!_currentPresetId) return
    _presetParams[_currentPresetId] = {
        ..._presetParams[_currentPresetId],
        [key]: value,
    }
    applyPreset(_currentPresetId, _presetParams[_currentPresetId])
}

export function getPresetParams() {
    return {
        ...PRESETS[_currentPresetId]?.defaults,
        ..._presetParams[_currentPresetId],
    }
}

export function getCurrentPresetId() { return _currentPresetId }

export function onStateChange(fn) {
    _onStateChange.push(fn)
    return () => { _onStateChange = _onStateChange.filter(f => f !== fn) }
}

export function destroy() {
    _stopFpsMonitor()
    _removeActiveStages()
    _removeGridPrimitive()
    _viewer = null
}
