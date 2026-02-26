import { useState, useEffect } from 'react'
import { performanceHud } from '../../../layers/performance/hud.js'

const S = {
    panel: { fontFamily: 'monospace', fontSize: '11px', color: '#FFFF00', padding: '8px 0', borderTop: '1px solid #FFFF0022', marginTop: '6px' },
    label: { color: '#FFFFAA', fontSize: '10px', marginBottom: '2px' },
    row: { display: 'flex', alignItems: 'center', gap: '6px', marginBottom: '4px', flexWrap: 'wrap' },
    btn: { background: '#0d1520', border: '1px solid #FFFF0055', color: '#FFFF00', fontFamily: 'monospace', fontSize: '10px', cursor: 'pointer', padding: '2px 7px', borderRadius: '2px' },
}

function fpsColor(fps) {
    if (fps >= 40) return '#00FF9F'
    if (fps >= 20) return '#FFD700'
    return '#FF4444'
}

export default function PerformancePanel({ viewer }) {
    const [stats, setStats] = useState({ fps: 0, totalPrimitives: 0, safeModeActive: false })

    useEffect(() => {
        if (!viewer) return
        performanceHud.init(viewer)
        performanceHud.onUpdate(setStats)
        return () => performanceHud.stop()
    }, [viewer])

    const { fps, totalPrimitives, safeModeActive } = stats

    return (
        <div style={S.panel}>
            <div style={{ ...S.label, fontWeight: 'bold', marginBottom: '6px' }}>📊 PERFORMANCE</div>

            <div style={S.row}>
                <span style={{ color: fpsColor(fps), fontSize: '14px', fontWeight: 'bold' }}>{fps} FPS</span>
                <span style={{ color: '#FFFFAA', fontSize: '10px' }}>Primitives: {totalPrimitives}</span>
            </div>

            <div style={S.row}>
                <span style={{ color: safeModeActive ? '#FF4444' : '#00FF9F', fontWeight: 'bold', fontSize: '10px' }}>
                    Safe Mode: {safeModeActive ? '⚠ ACTIVE' : '✓ OFF'}
                </span>
                {safeModeActive
                    ? <button style={{ ...S.btn, color: '#00FF9F' }} onClick={() => performanceHud.deactivateSafeMode()}>Disable</button>
                    : <button style={{ ...S.btn, color: '#FFD700' }} onClick={() => performanceHud.activateSafeMode()}>Force On</button>
                }
            </div>

            {fps < 20 && fps > 0 && !safeModeActive && (
                <div style={{ color: '#FF4444', fontSize: '10px' }}>Low FPS detected — Safe Mode will auto-trigger</div>
            )}
        </div>
    )
}
