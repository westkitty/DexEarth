// ─── Night-Ops Preset ─────────────────────────────────────────────────────────
// Tactical dark mode: reduced atmosphere, emphasis on glowing overlays.

import * as Cesium from 'cesium'

const NIGHTOPS_FRAG = `
uniform sampler2D colorTexture;
uniform float vignetteStrength;
in vec2 v_textureCoordinates;
void main() {
  vec4 col = texture(colorTexture, v_textureCoordinates);
  // Desaturate slightly
  float lum = dot(col.rgb, vec3(0.299, 0.587, 0.114));
  col.rgb = mix(col.rgb, vec3(lum), 0.35);
  // Green tint push
  col.rgb *= vec3(0.8, 1.1, 0.8);
  // Vignette
  vec2 uvr = v_textureCoordinates - 0.5;
  float v = 1.0 - dot(uvr, uvr) * vignetteStrength;
  col.rgb *= clamp(v, 0.0, 1.0);
  out_FragColor = col;
}
`

export const nightOpsPreset = {
    id: 'NIGHT_OPS',
    label: 'Night-Ops',
    isCheap: false,
    defaults: {
        vignetteStrength: 2.2,
        atmosphereBrightness: 0.4,
    },
    borderStyle: { color: '#00FF44', alpha: 0.7, width: 1.2, glow: true },
    labelStyle: { color: '#00FF44', outlineColor: '#001100', fontSize: 10 },

    activate(viewer, params) {
        const scene = viewer.scene
        if (scene.skyAtmosphere) {
            scene.skyAtmosphere.show = true
            scene.skyAtmosphere.atmosphereLightIntensity = params.atmosphereBrightness
        }
        scene.globe.enableLighting = true
        scene.globe.atmosphereLightIntensity = 0.5

        const stages = []
        try {
            const stage = new Cesium.PostProcessStage({
                name: 'dex_nightops',
                fragmentShader: NIGHTOPS_FRAG,
                uniforms: {
                    vignetteStrength: () => params.vignetteStrength,
                },
            })
            scene.postProcessStages.add(stage)
            stages.push(stage)
        } catch (err) {
            console.warn('[NightOps] PostProcessStage failed:', err.message)
        }
        return { stages }
    },

    activateLite(viewer) {
        viewer.scene.globe.enableLighting = true
        viewer.scene.globe.atmosphereLightIntensity = 0.5
        if (viewer.scene.skyAtmosphere) viewer.scene.skyAtmosphere.show = false
    },

    deactivate(viewer) {
        viewer.scene.globe.enableLighting = false
        viewer.scene.globe.atmosphereLightIntensity = 2.0
        if (viewer.scene.skyAtmosphere) viewer.scene.skyAtmosphere.show = false
    },

    onSafeModeEnter(viewer) {
        if (viewer.scene.skyAtmosphere) viewer.scene.skyAtmosphere.show = false
    },
}
