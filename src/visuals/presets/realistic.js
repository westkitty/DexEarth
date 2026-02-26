// ─── Realistic Preset ─────────────────────────────────────────────────────────
import * as Cesium from 'cesium'

export const realisticPreset = {
    id: 'REALISTIC',
    label: 'Realistic',
    isCheap: false,
    defaults: {
        lightIntensity: 2.0,
        fogDensity: 0.0002,
        atmosphereBrightness: 2.5,
        fxaa: true,
    },
    borderStyle: { color: '#88CCFF', alpha: 0.45, width: 1.2, glow: false },
    labelStyle: { color: '#E0F0FF', outlineColor: '#003366', fontSize: 11 },

    activate(viewer, params) {
        const scene = viewer.scene
        scene.globe.enableLighting = true
        scene.globe.atmosphereLightIntensity = params.lightIntensity
        if (scene.fog) { scene.fog.enabled = true; scene.fog.density = params.fogDensity }
        if (scene.skyAtmosphere) {
            scene.skyAtmosphere.show = true
            scene.skyAtmosphere.atmosphereLightIntensity = params.atmosphereBrightness
        }
        const stages = []
        if (params.fxaa && scene.postProcessStages.fxaa) {
            scene.postProcessStages.fxaa.enabled = true
        }
        return { stages }
    },

    deactivate(viewer) {
        const scene = viewer.scene
        scene.globe.enableLighting = false
        if (scene.skyAtmosphere) scene.skyAtmosphere.show = false
        if (scene.fog) scene.fog.enabled = false
        if (scene.postProcessStages.fxaa) scene.postProcessStages.fxaa.enabled = false
    },
}
