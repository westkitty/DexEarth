// ─── Cel-Shaded Preset ────────────────────────────────────────────────────────
// Edge detection + posterization using Cesium PostProcessStage.

import * as Cesium from 'cesium'

const EDGE_FRAG = `
uniform sampler2D colorTexture;
uniform sampler2D depthTexture;
uniform float edgeStrength;
uniform float posterize;
in vec2 v_textureCoordinates;
void main() {
  vec2 uv = v_textureCoordinates;
  vec2 texelSize = 1.0 / czm_viewport.zw;
  vec4 center = texture(colorTexture, uv);
  vec4 top    = texture(colorTexture, uv + vec2(0.0,  texelSize.y));
  vec4 bottom = texture(colorTexture, uv + vec2(0.0, -texelSize.y));
  vec4 left   = texture(colorTexture, uv + vec2(-texelSize.x, 0.0));
  vec4 right  = texture(colorTexture, uv + vec2( texelSize.x, 0.0));
  vec4 edge = abs(center - top) + abs(center - bottom) + abs(center - left) + abs(center - right);
  float edgeMag = dot(edge.rgb, vec3(0.33));
  // Posterize
  vec3 col = center.rgb;
  col = floor(col * posterize + 0.5) / posterize;
  // Add edge darken
  col = col * (1.0 - edgeMag * edgeStrength);
  out_FragColor = vec4(col, center.a);
}
`

const OUTLINE_FRAG = `
uniform sampler2D colorTexture;
uniform float outlineWidth;
in vec2 v_textureCoordinates;
void main() {
  out_FragColor = texture(colorTexture, v_textureCoordinates);
}
`

export const celShadedPreset = {
    id: 'CEL_SHADED',
    label: 'Cel-Shaded',
    isCheap: false,
    defaults: {
        edgeStrength: 3.5,
        posterize: 4.0,
        contrast: 1.3,
    },
    borderStyle: { color: '#222222', alpha: 0.95, width: 2.5, glow: false },
    labelStyle: { color: '#FFFFFF', outlineColor: '#000000', fontSize: 12 },

    activate(viewer, params) {
        const stages = []
        try {
            const stage = new Cesium.PostProcessStage({
                name: 'dex_cel_shaded',
                fragmentShader: EDGE_FRAG,
                uniforms: {
                    edgeStrength: () => params.edgeStrength,
                    posterize: () => params.posterize,
                },
            })
            viewer.scene.postProcessStages.add(stage)
            stages.push(stage)
        } catch (err) {
            console.warn('[CelShaded] PostProcessStage failed:', err.message)
        }
        return { stages }
    },

    activateLite(viewer) {
        // Safe mode: just adjust contrast via globe, skip PostProcessStage
        viewer.scene.globe.atmosphereLightIntensity = 2.5
    },

    deactivate(viewer) {
        viewer.scene.globe.atmosphereLightIntensity = 2.0
    },

    onSafeModeEnter(viewer) {
        viewer.scene.globe.atmosphereLightIntensity = 2.5
    },
}
