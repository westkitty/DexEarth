// ─── Hologram Preset ──────────────────────────────────────────────────────────
// Sci-fi holographic look: cyan/teal color grade + scanlines + grid.

import * as Cesium from 'cesium'

const HOLOGRAM_FRAG = `
uniform sampler2D colorTexture;
uniform float scanlineIntensity;
uniform float jitter;
uniform float time_s;
in vec2 v_textureCoordinates;
void main() {
  vec2 uv = v_textureCoordinates;
  // Subtle horizontal jitter
  float j = sin(uv.y * 800.0 + time_s * 10.0) * 0.0005 * jitter;
  uv.x += j;
  vec4 col = texture(colorTexture, clamp(uv, 0.0, 1.0));
  // Cyan/teal color grade
  col.rgb = col.rgb * vec3(0.4, 1.0, 1.0);
  // Boost brightness
  col.rgb = pow(col.rgb, vec3(0.85));
  // Scanlines
  float scan = sin(v_textureCoordinates.y * czm_viewport.w * 2.0) * 0.5 + 0.5;
  col.rgb *= 1.0 - scanlineIntensity * (1.0 - scan) * 0.4;
  // Edge fade (vignette)
  vec2 uvr = v_textureCoordinates - 0.5;
  float vignette = 1.0 - dot(uvr, uvr) * 1.8;
  col.rgb *= clamp(vignette, 0.0, 1.0);
  out_FragColor = vec4(col.rgb, col.a);
}
`

// Build a lat/lon grid overlay primitive using Cesium polylines
function buildLatLonGrid(viewer) {
    const col = new Cesium.PolylineCollection()
    const gridColor = Cesium.Color.fromCssColorString('#00FFFF').withAlpha(0.12)

    // Latitude lines every 30°
    for (let lat = -60; lat <= 60; lat += 30) {
        const pts = []
        for (let lon = -180; lon <= 180; lon += 5)
            pts.push(Cesium.Cartesian3.fromDegrees(lon, lat, 100))
        col.add({ positions: pts, width: 1, material: Cesium.Material.fromType('Color', { color: gridColor }) })
    }
    // Longitude lines every 30°
    for (let lon = -180; lon <= 180; lon += 30) {
        const pts = []
        for (let lat = -90; lat <= 90; lat += 5)
            pts.push(Cesium.Cartesian3.fromDegrees(lon, lat, 100))
        col.add({ positions: pts, width: 1, material: Cesium.Material.fromType('Color', { color: gridColor }) })
    }
    viewer.scene.primitives.add(col)
    return col
}

export const hologramPreset = {
    id: 'HOLOGRAM',
    label: 'Hologram',
    isCheap: false,
    defaults: {
        scanlineIntensity: 0.7,
        jitter: 0.4,
        showGrid: true,
    },
    borderStyle: { color: '#00FFFF', alpha: 0.85, width: 1.5, glow: true },
    labelStyle: { color: '#00FFFF', outlineColor: '#003333', fontSize: 11 },

    activate(viewer, params) {
        const stages = []
        let gridPrimitive = null

        try {
            let time_s = 0
            const stage = new Cesium.PostProcessStage({
                name: 'dex_hologram',
                fragmentShader: HOLOGRAM_FRAG,
                uniforms: {
                    scanlineIntensity: () => params.scanlineIntensity,
                    jitter: () => params.jitter,
                    time_s: () => { time_s += 0.016; return time_s },
                },
            })
            viewer.scene.postProcessStages.add(stage)
            stages.push(stage)
        } catch (err) {
            console.warn('[Hologram] PostProcessStage failed:', err.message)
        }

        if (params.showGrid) {
            try { gridPrimitive = buildLatLonGrid(viewer) } catch { /* ignore */ }
        }

        return { stages, gridPrimitive }
    },

    activateLite(viewer) {
        // Just color grade globe to bluish; skip PostProcessStage
        if (viewer.scene.skyAtmosphere) viewer.scene.skyAtmosphere.hueShift = 0.4
    },

    deactivate(viewer) {
        if (viewer.scene.skyAtmosphere) viewer.scene.skyAtmosphere.hueShift = 0.0
    },

    onSafeModeEnter(viewer) {
        if (viewer.scene.skyAtmosphere) viewer.scene.skyAtmosphere.hueShift = 0.4
    },
}
