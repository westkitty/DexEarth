// ─── Event Pulse Engine ───────────────────────────────────────────────────────
// Centralized pulse/flash visual utility for alerts, seismic, markers, threats.
// Creates self-removing CSS-animated DOM overlays over the Cesium canvas.

const PULSE_STYLES = {
    alert: { color: '#FF4444', borderColor: '#FF0000', label: '⚠' },
    seismic: { color: '#FF8C00', borderColor: '#FF6600', label: '⚡' },
    marker: { color: '#00FF9F', borderColor: '#00CC77', label: '📍' },
    threat: { color: '#FF00FF', borderColor: '#CC00CC', label: '◈' },
}

let _container = null

function _ensureContainer() {
    if (_container) return _container
    _container = document.createElement('div')
    _container.id = 'dex-pulse-container'
    Object.assign(_container.style, {
        position: 'fixed',
        top: 0, left: 0, right: 0, bottom: 0,
        pointerEvents: 'none',
        zIndex: 500,
        overflow: 'hidden',
    })
    document.body.appendChild(_container)
    return _container
}

/**
 * Show a pulse animation at screen coordinates.
 * @param {'alert'|'seismic'|'marker'|'threat'} type
 * @param {number} screenX
 * @param {number} screenY
 */
export function pulseScreen(type, screenX, screenY) {
    const style = PULSE_STYLES[type] || PULSE_STYLES.alert
    const el = document.createElement('div')
    Object.assign(el.style, {
        position: 'absolute',
        left: `${screenX - 24}px`,
        top: `${screenY - 24}px`,
        width: '48px',
        height: '48px',
        borderRadius: '50%',
        border: `2px solid ${style.borderColor}`,
        background: `${style.color}22`,
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        fontSize: '18px',
        color: style.color,
        animation: 'dex-pulse-anim 1.2s ease-out forwards',
        pointerEvents: 'none',
    })
    el.textContent = style.label
    _ensureContainer().appendChild(el)

    // Ensure keyframe is injected once
    if (!document.getElementById('dex-pulse-keyframes')) {
        const sheet = document.createElement('style')
        sheet.id = 'dex-pulse-keyframes'
        sheet.textContent = `
      @keyframes dex-pulse-anim {
        0%   { transform: scale(0.5); opacity: 1; }
        100% { transform: scale(2.5); opacity: 0; }
      }
    `
        document.head.appendChild(sheet)
    }

    el.addEventListener('animationend', () => el.remove())
}

/**
 * Show a pulse in the corner HUD (by type name only, no map position).
 * @param {'alert'|'seismic'|'marker'|'threat'} type
 * @param {string} message
 */
export function pulseHud(type, message = '') {
    const style = PULSE_STYLES[type] || PULSE_STYLES.alert
    const el = document.createElement('div')
    Object.assign(el.style, {
        position: 'fixed',
        bottom: '60px',
        right: '300px',
        padding: '6px 14px',
        borderRadius: '4px',
        border: `1px solid ${style.borderColor}`,
        background: '#0d1520ee',
        color: style.color,
        fontFamily: 'monospace',
        fontSize: '11px',
        animation: 'dex-hud-fade 3s ease-out forwards',
        pointerEvents: 'none',
        zIndex: 600,
    })
    el.textContent = `${style.label} ${type.toUpperCase()}${message ? ': ' + message : ''}`

    if (!document.getElementById('dex-hud-fade-kf')) {
        const sheet = document.createElement('style')
        sheet.id = 'dex-hud-fade-kf'
        sheet.textContent = `
      @keyframes dex-hud-fade {
        0%   { opacity: 1; transform: translateY(0); }
        70%  { opacity: 1; }
        100% { opacity: 0; transform: translateY(-10px); }
      }
    `
        document.head.appendChild(sheet)
    }

    document.body.appendChild(el)
    el.addEventListener('animationend', () => el.remove())
}
