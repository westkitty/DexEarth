// ─── Cinematic Controller ─────────────────────────────────────────────────────
// Predefined camera tours with keyframe interpolation via Cesium flyTo.

import * as Cesium from 'cesium'

const TOURS = {
    fiberBackbone: {
        id: 'fiberBackbone',
        label: 'Global Fiber Backbone',
        keyframes: [
            { lon: -20, lat: 40, alt: 8_000_000, duration: 3 },
            { lon: -40, lat: 35, alt: 4_000_000, duration: 4 },
            { lon: -70, lat: 10, alt: 3_000_000, duration: 4 },
            { lon: 10, lat: 50, alt: 6_000_000, duration: 5 },
            { lon: 70, lat: 20, alt: 5_000_000, duration: 4 },
            { lon: 120, lat: 10, alt: 4_000_000, duration: 4 },
            { lon: 10, lat: -5, alt: 20_000_000, duration: 5 },  // back to globe
        ],
    },
    tectonicFireRing: {
        id: 'tectonicFireRing',
        label: 'Tectonic Fire Ring',
        keyframes: [
            { lon: -150, lat: 60, alt: 5_000_000, duration: 3 },
            { lon: -100, lat: 15, alt: 4_000_000, duration: 4 },
            { lon: -75, lat: -35, alt: 4_000_000, duration: 4 },
            { lon: 145, lat: -40, alt: 4_000_000, duration: 5 },
            { lon: 145, lat: 40, alt: 4_000_000, duration: 4 },
            { lon: -170, lat: 50, alt: 4_000_000, duration: 4 },
            { lon: 10, lat: 0, alt: 20_000_000, duration: 5 },
        ],
    },
    stormBelts: {
        id: 'stormBelts',
        label: 'Storm Belts',
        keyframes: [
            { lon: 0, lat: 60, alt: 8_000_000, duration: 3 },
            { lon: -30, lat: 45, alt: 5_000_000, duration: 4 },
            { lon: -60, lat: 8, alt: 4_000_000, duration: 4 },
            { lon: -30, lat: -45, alt: 5_000_000, duration: 4 },
            { lon: 90, lat: -55, alt: 6_000_000, duration: 5 },
            { lon: 10, lat: 0, alt: 20_000_000, duration: 5 },
        ],
    },
    orbitalShell: {
        id: 'orbitalShell',
        label: 'Orbital Shell',
        keyframes: [
            { lon: 0, lat: 0, alt: 25_000_000, duration: 3 },
            { lon: 90, lat: 30, alt: 22_000_000, duration: 5 },
            { lon: 180, lat: -20, alt: 22_000_000, duration: 5 },
            { lon: -90, lat: 50, alt: 22_000_000, duration: 5 },
            { lon: 0, lat: 0, alt: 20_000_000, duration: 4 },
        ],
    },
}

let _viewer = null
let _playing = false
let _currentTourId = null
let _keyframeIdx = 0
let _speed = 1.0
let _savedCamera = null
let _onStateChange = []

function _notifyState() {
    const state = {
        playing: _playing,
        tourId: _currentTourId,
        keyframeIdx: _keyframeIdx,
        speed: _speed,
    }
    _onStateChange.forEach(fn => { try { fn(state) } catch { /* ignore */ } })
}

async function _playKeyframe(tour) {
    if (!_playing || !_viewer) return
    if (_keyframeIdx >= tour.keyframes.length) {
        _playing = false
        _notifyState()
        return
    }
    const kf = tour.keyframes[_keyframeIdx]
    await new Promise(resolve => {
        _viewer.camera.flyTo({
            destination: Cesium.Cartesian3.fromDegrees(kf.lon, kf.lat, kf.alt),
            orientation: {
                heading: Cesium.Math.toRadians(0),
                pitch: Cesium.Math.toRadians(-45),
                roll: 0,
            },
            duration: kf.duration / _speed,
            complete: resolve,
            cancel: resolve,
        })
    })
    if (_playing) {
        _keyframeIdx++
        _notifyState()
        _playKeyframe(tour)
    }
}

export const cinematicController = {
    init(viewer) { _viewer = viewer },

    getTours() { return Object.values(TOURS) },

    play(tourId) {
        const tour = TOURS[tourId]
        if (!tour || !_viewer) return

        // Save current camera
        _savedCamera = {
            destination: _viewer.camera.positionWC.clone(),
            orientation: {
                heading: _viewer.camera.heading,
                pitch: _viewer.camera.pitch,
                roll: _viewer.camera.roll,
            },
        }

        _currentTourId = tourId
        _keyframeIdx = 0
        _playing = true
        _notifyState()
        _playKeyframe(tour)
    },

    pause() {
        _playing = false
        _viewer?.camera.cancelFlight()
        _notifyState()
    },

    resume() {
        if (!_currentTourId) return
        const tour = TOURS[_currentTourId]
        if (!tour) return
        _playing = true
        _notifyState()
        _playKeyframe(tour)
    },

    stop() {
        _playing = false
        _viewer?.camera.cancelFlight()
        _currentTourId = null
        _keyframeIdx = 0
        _notifyState()
        // Restore camera
        if (_savedCamera && _viewer) {
            _viewer.camera.flyTo({ ..._savedCamera, duration: 1.5 })
            _savedCamera = null
        }
    },

    skipForward() {
        if (!_currentTourId) return
        const tour = TOURS[_currentTourId]
        _viewer?.camera.cancelFlight()
        _keyframeIdx = Math.min(_keyframeIdx + 1, tour.keyframes.length - 1)
        _notifyState()
        if (_playing) _playKeyframe(tour)
    },

    setSpeed(s) { _speed = Math.max(0.25, Math.min(4, s)) },

    isPlaying() { return _playing },

    onStateChange(fn) { _onStateChange.push(fn) },
}
