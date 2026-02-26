// ─── Settings Store ──────────────────────────────────────────────────────────
// Persists user preferences to localStorage. Observable via subscribe().

const KEY = 'dexearth_settings_v1'

const DEFAULTS = {
    satelliteCap: 250,
    groundTrackCap: 30,
    groundTrackSamples: 45,
    showGroundTracks: false,
    satelliteRemoteUrl: '/proxy/tle',
    satelliteUseBundled: true,
    tleTtlHours: 12,
    terminatorVisible: false,
    terminatorOpacity: 0.7,
    terminatorWidth: 2,
    sunlightEnabled: false,
    safeModeEnabled: false,
    safeModeAutoTrigger: true,
    safeModeThresholdFps: 20,
    safeModeFrameWindow: 90,
    layoutMode: 'default', // default | split | compact
    broadcastLeader: true,
    demoModeActive: false,
}

let _settings = { ...DEFAULTS }
let _subscribers = new Set()

function _load() {
    try {
        const raw = localStorage.getItem(KEY)
        if (raw) _settings = { ...DEFAULTS, ...JSON.parse(raw) }
    } catch { /* use defaults */ }
}

function _save() {
    try { localStorage.setItem(KEY, JSON.stringify(_settings)) } catch { /* ignore */ }
}

function _notify() {
    _subscribers.forEach(fn => { try { fn({ ..._settings }) } catch { /* subscriber error */ } })
}

_load()

export function get(key) { return _settings[key] }

export function set(key, value) {
    if (!(key in DEFAULTS)) console.warn(`settingsStore: unknown key "${key}"`)
    _settings[key] = value
    _save()
    _notify()
}

export function getAll() { return { ..._settings } }

export function reset() {
    _settings = { ...DEFAULTS }
    _save()
    _notify()
}

export function subscribe(fn) {
    _subscribers.add(fn)
    return () => _subscribers.delete(fn)
}
