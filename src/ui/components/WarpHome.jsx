// ─── Warp Home Button ────────────────────────────────────────────────────────
import { useEffect, useState } from 'react'
import * as Cesium from 'cesium'
import { viewStore, subscribeViewStore } from '../../../state/viewStore.js'
import { uiStore } from '../../../state/uiStore.js'

export default function WarpHome({ viewer }) {
    const [store, setStore] = useState(viewStore)

    useEffect(() => subscribeViewStore(setStore), [])

    const onClick = () => {
        if (!viewer) return

        // Cancel active tools
        if (uiStore && uiStore.activeTool !== 'none') {
            uiStore.setActiveTool('none')
        }

        const h = store.home
        const dest = Cesium.Cartesian3.fromDegrees(h.destination[0], h.destination[1], h.destination[2])
        const pitch = Cesium.Math.toRadians(h.orientation.pitch)
        const heading = Cesium.Math.toRadians(h.orientation.heading)
        const roll = Cesium.Math.toRadians(h.orientation.roll)

        const duration = store.flyMode === 'fast' ? 0.5 :
            store.flyMode === 'cinematic' ? 4.0 : 2.0

        viewer.camera.flyTo({
            destination: dest,
            orientation: { heading, pitch, roll },
            duration
        })
    }

    return (
        <button
            onClick={onClick}
            title="Warp Home (Michigan) & Cancel Tools"
            style={{
                position: 'fixed',
                bottom: '24px',
                left: '24px',
                zIndex: 50,
                width: '40px',
                height: '40px',
                borderRadius: '20px',
                background: 'rgba(8, 11, 15, 0.75)',
                backdropFilter: 'blur(16px)',
                WebkitBackdropFilter: 'blur(16px)',
                border: '1px solid rgba(0, 255, 159, 0.4)',
                boxShadow: '0 0 12px rgba(0, 255, 159, 0.2)',
                color: '#00FF9F',
                fontSize: '18px',
                cursor: 'pointer',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                transition: 'all 150ms ease',
            }}
            onMouseEnter={e => {
                e.currentTarget.style.background = 'rgba(0, 255, 159, 0.15)'
                e.currentTarget.style.transform = 'scale(1.05)'
            }}
            onMouseLeave={e => {
                e.currentTarget.style.background = 'rgba(8, 11, 15, 0.75)'
                e.currentTarget.style.transform = 'scale(1)'
            }}
        >
            ❖ {/* Diamond icon suited for tactical UI */}
        </button>
    )
}
