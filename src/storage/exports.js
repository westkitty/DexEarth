// ─── Scenario Export/Import ───────────────────────────────────────────────────
import { emitAudit } from '../utils/auditLog.js'

export function exportScenario(viewer, toggles, name = 'DexEarth Scenario') {
    if (!viewer || viewer.isDestroyed()) return null

    const cam = {
        position: {
            longitude: viewer.camera.positionCartographic.longitude,
            latitude: viewer.camera.positionCartographic.latitude,
            height: viewer.camera.positionCartographic.height
        },
        heading: viewer.camera.heading,
        pitch: viewer.camera.pitch,
        roll: viewer.camera.roll
    }

    const activeLayers = Object.entries(toggles || {})
        .filter(([, isActive]) => isActive)
        .map(([id]) => id)

    const payload = {
        version: 1,
        appName: 'DexEarth',
        name,
        timestamp: Date.now(),
        camera: cam,
        layers: activeLayers
    }

    const jsonStr = JSON.stringify(payload, null, 2)
    const blob = new Blob([jsonStr], { type: 'application/json' })
    const url = URL.createObjectURL(blob)

    const a = document.createElement('a')
    a.href = url
    a.download = `dexearth_scenario_${Date.now()}.json`
    document.body.appendChild(a)
    a.click()
    document.body.removeChild(a)
    URL.revokeObjectURL(url)

    emitAudit('ui', 'SCENARIO_EXPORTED', `Exported scenario: ${name}`)
    return payload
}

export async function importScenarioFile(file) {
    return new Promise((resolve, reject) => {
        const reader = new FileReader()
        reader.onload = (e) => {
            try {
                const json = JSON.parse(e.target.result)
                if (json.appName !== 'DexEarth' || !json.camera || !json.layers) {
                    throw new Error('Invalid DexEarth scenario format')
                }
                emitAudit('ui', 'SCENARIO_IMPORTED', `Imported scenario: ${json.name || 'Unnamed'}`)
                resolve(json)
            } catch (err) {
                reject(err)
            }
        }
        reader.onerror = () => reject(new Error('Failed to read file'))
        reader.readAsText(file)
    })
}
