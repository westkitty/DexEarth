// ─── BroadcastChannel Sync ────────────────────────────────────────────────────
// Same-device multi-tab synchronization: camera, time, layer toggles.
// Uses the native BroadcastChannel API (no server needed).

const CHANNEL_NAME = 'dexearth'
let _channel = null
let _isLeader = true
let _viewer = null
let _getTimeMs = null
let _getToggles = null
let _applyState = null

const MSG_TYPES = {
    STATE: 'state',
    LEADER_CLAIM: 'leader_claim',
    FOLLOWER_ACK: 'follower_ack',
}

function _getCameraState() {
    if (!_viewer) return null
    try {
        const cam = _viewer.camera
        return {
            lon: Cesium.Math ? undefined : undefined,  // handled below
            raw: {
                position: cam.positionWC.toArray?.() || [cam.positionWC.x, cam.positionWC.y, cam.positionWC.z],
                heading: cam.heading,
                pitch: cam.pitch,
                roll: cam.roll,
            },
        }
    } catch { return null }
}

function _broadcast() {
    if (!_isLeader || !_channel) return
    try {
        const msg = {
            type: MSG_TYPES.STATE,
            timeMs: _getTimeMs?.(),
            toggles: _getToggles?.(),
            camera: _getCameraState(),
            ts: Date.now(),
        }
        _channel.postMessage(msg)
    } catch { /* ignore */ }
}

function _applyBroadcast(msg) {
    if (_isLeader) return  // leaders don't follow
    if (msg.type !== MSG_TYPES.STATE) return
    _applyState?.(msg)
}

export const broadcastSync = {
    init({ viewer, isLeader = true, getTimeMs, getToggles, applyState }) {
        _viewer = viewer
        _isLeader = isLeader
        _getTimeMs = getTimeMs
        _getToggles = getToggles
        _applyState = applyState

        if (_channel) { _channel.close() }
        try {
            _channel = new BroadcastChannel(CHANNEL_NAME)
            _channel.onmessage = e => _applyBroadcast(e.data)
            if (isLeader) {
                _channel.postMessage({ type: MSG_TYPES.LEADER_CLAIM })
            }
        } catch {
            console.warn('[BroadcastSync] BroadcastChannel not supported')
        }
    },

    setLeader(v) {
        _isLeader = v
        if (v) _channel?.postMessage({ type: MSG_TYPES.LEADER_CLAIM })
    },

    broadcast: _broadcast,

    destroy() {
        _channel?.close()
        _channel = null
    },
}

// Import Cesium lazily to avoid circular deps
import * as Cesium from 'cesium'
