// ─── Wireframe Preset ─────────────────────────────────────────────────────────
// Technical wire look: dark base + lat/lon grid + borders as primary lines.

import * as Cesium from 'cesium'

function buildLatLonGrid(viewer) {
    const col = new Cesium.PolylineCollection()
    const minorColor = Cesium.Color.fromCssColorString('#00FF88').withAlpha(0.08)
    const majorColor = Cesium.Color.fromCssColorString('#00FF88').withAlpha(0.25)

    for (let lat = -90; lat <= 90; lat += 10) {
        const isMajor = lat % 30 === 0
        const pts = []
        for (let lon = -180; lon <= 180; lon += 5)
            pts.push(Cesium.Cartesian3.fromDegrees(lon, lat, 80))
        col.add({ positions: pts, width: isMajor ? 1.2 : 0.8, material: Cesium.Material.fromType('Color', { color: isMajor ? majorColor : minorColor }) })
    }
    for (let lon = -180; lon <= 180; lon += 10) {
        const isMajor = lon % 30 === 0
        const pts = []
        for (let lat = -90; lat <= 90; lat += 5)
            pts.push(Cesium.Cartesian3.fromDegrees(lon, lat, 80))
        col.add({ positions: pts, width: isMajor ? 1.2 : 0.8, material: Cesium.Material.fromType('Color', { color: isMajor ? majorColor : minorColor }) })
    }
    viewer.scene.primitives.add(col)
    return col
}

export const wireframePreset = {
    id: 'WIREFRAME',
    label: 'Wireframe',
    isCheap: true,  // no PostProcessStage → always works even in safe mode
    defaults: {
        gridOpacity: 0.25,
    },
    borderStyle: { color: '#00FF88', alpha: 0.9, width: 1.5, glow: false },
    labelStyle: { color: '#00FF88', outlineColor: '#001a00', fontSize: 11 },

    activate(viewer) {
        // Dark globe base
        viewer.scene.globe.baseColor = Cesium.Color.fromCssColorString('#050D14')
        if (viewer.scene.skyAtmosphere) viewer.scene.skyAtmosphere.show = false
        if (viewer.scene.fog) viewer.scene.fog.enabled = false

        let gridPrimitive = null
        try { gridPrimitive = buildLatLonGrid(viewer) } catch { /* ignore */ }
        return { stages: [], gridPrimitive }
    },

    deactivate(viewer) {
        viewer.scene.globe.baseColor = Cesium.Color.BLACK
    },
}
