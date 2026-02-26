import { useState, useCallback } from 'react'
import { alertsLayer } from '../../../layers/alerts/layer.js'

const S = {
    panel: { fontFamily: 'monospace', fontSize: '11px', color: '#FFD700', padding: '8px 0', borderTop: '1px solid #FFD70022', marginTop: '6px' },
    label: { color: '#FFEEAA', fontSize: '10px', marginBottom: '2px' },
    row: { display: 'flex', alignItems: 'center', gap: '6px', marginBottom: '4px', flexWrap: 'wrap' },
    btn: { background: '#0d1520', border: '1px solid #FFD70055', color: '#FFD700', fontFamily: 'monospace', fontSize: '10px', cursor: 'pointer', padding: '2px 7px', borderRadius: '2px' },
    input: { background: '#0d1520', border: '1px solid #FFD70044', color: '#FFD700', fontFamily: 'monospace', fontSize: '10px', padding: '2px 5px', width: '100px', borderRadius: '2px' },
}

export default function AlertsPanel({ viewer }) {
    const [isActive, setIsActive] = useState(false)
    const [log, setLog] = useState([])
    const [geofences, setGeofences] = useState([])
    const [sound, setSound] = useState(false)
    const [addMode, setAddMode] = useState(null) // 'circle' | 'polygon' | null
    const [circleLon, setCircleLon] = useState('0')
    const [circleLat, setCircleLat] = useState('0')
    const [circleRadius, setCircleRadius] = useState('200')
    const [circleName, setCircleName] = useState('')
    const [polyName, setPolyName] = useState('')

    const activate = useCallback(async () => {
        if (!viewer || isActive) return
        await alertsLayer.activate({ viewer })
        alertsLayer.onLogChange(setLog)
        alertsLayer.onGeofenceChange(setGeofences)
        setLog(alertsLayer.getAlertLog())
        setGeofences(alertsLayer.getGeofences())
        setIsActive(true)
    }, [viewer, isActive])

    const deactivate = useCallback(() => {
        alertsLayer.deactivate()
        setIsActive(false)
        setLog([]); setGeofences([])
    }, [])

    const addCircle = useCallback(async () => {
        await alertsLayer.addCircleGeofence({
            name: circleName || `Circle-${geofences.length + 1}`,
            lon: parseFloat(circleLon), lat: parseFloat(circleLat),
            radiusKm: parseFloat(circleRadius),
        })
        setAddMode(null)
    }, [circleLon, circleLat, circleRadius, circleName, geofences.length])

    const startPolygon = useCallback(() => {
        alertsLayer.startDrawPolygon()
        setAddMode('polygon')
    }, [])

    const finishPolygon = useCallback(async () => {
        await alertsLayer.finishPolygon(polyName || `Polygon-${geofences.length + 1}`)
        setAddMode(null)
    }, [polyName, geofences.length])

    return (
        <div style={S.panel}>
            <div style={{ ...S.label, fontWeight: 'bold', marginBottom: '6px' }}>⚠ ALERTS</div>

            <div style={S.row}>
                <button style={{ ...S.btn, ...(isActive ? { background: '#FFD70022', border: '1px solid #FFD700' } : {}) }}
                    onClick={isActive ? deactivate : activate}>
                    {isActive ? '■ DEACTIVATE' : '▶ ACTIVATE'}
                </button>
                {isActive && (
                    <label style={{ display: 'flex', alignItems: 'center', gap: '4px', cursor: 'pointer', fontSize: '10px', color: '#FFEEAA' }}>
                        <input type="checkbox" checked={sound} onChange={e => { setSound(e.target.checked); alertsLayer.setSoundEnabled(e.target.checked) }} />
                        🔊 Sound
                    </label>
                )}
            </div>

            {isActive && (
                <>
                    <div style={{ ...S.label, fontWeight: 'bold' }}>Geofences ({geofences.length})</div>
                    <div style={S.row}>
                        <button style={S.btn} onClick={() => setAddMode('circle')}>+ Circle</button>
                        <button style={S.btn} onClick={startPolygon}>+ Polygon</button>
                    </div>

                    {addMode === 'circle' && (
                        <div style={{ padding: '5px', border: '1px solid #FFD70022', borderRadius: '3px', marginBottom: '5px' }}>
                            <div style={S.row}>
                                <div><div style={S.label}>Name</div><input style={S.input} value={circleName} onChange={e => setCircleName(e.target.value)} /></div>
                            </div>
                            <div style={S.row}>
                                <div><div style={S.label}>Lon</div><input style={S.input} value={circleLon} onChange={e => setCircleLon(e.target.value)} /></div>
                                <div><div style={S.label}>Lat</div><input style={S.input} value={circleLat} onChange={e => setCircleLat(e.target.value)} /></div>
                                <div><div style={S.label}>Radius(km)</div><input style={S.input} value={circleRadius} onChange={e => setCircleRadius(e.target.value)} /></div>
                            </div>
                            <div style={S.row}>
                                <button style={S.btn} onClick={addCircle}>✓ Add</button>
                                <button style={{ ...S.btn, color: '#FF4444' }} onClick={() => setAddMode(null)}>Cancel</button>
                            </div>
                        </div>
                    )}

                    {addMode === 'polygon' && (
                        <div style={{ padding: '5px', border: '1px solid #FFD70022', borderRadius: '3px', marginBottom: '5px' }}>
                            <div style={{ color: '#FFEEAA', fontSize: '10px', marginBottom: '4px' }}>Click globe to add vertices...</div>
                            <input style={S.input} value={polyName} onChange={e => setPolyName(e.target.value)} placeholder="Polygon name" />
                            <div style={S.row}>
                                <button style={S.btn} onClick={finishPolygon}>✓ Finish</button>
                                <button style={{ ...S.btn, color: '#FF4444' }} onClick={() => setAddMode(null)}>Cancel</button>
                            </div>
                        </div>
                    )}

                    {geofences.map(gf => (
                        <div key={gf.id} style={{ ...S.row, justifyContent: 'space-between', borderBottom: '1px solid #FFD70011', paddingBottom: '2px' }}>
                            <span style={{ color: '#FFEEAA', fontSize: '10px' }}>{gf.name} ({gf.type})</span>
                            <button style={{ ...S.btn, padding: '1px 4px', color: '#FF4444', fontSize: '9px' }}
                                onClick={() => alertsLayer.deleteGeofence(gf.id)}>✕</button>
                        </div>
                    ))}

                    <div style={{ ...S.label, fontWeight: 'bold', marginTop: '6px' }}>Alert Log ({log.length})</div>
                    <div style={S.row}>
                        <button style={S.btn} onClick={() => alertsLayer.clearLog()}>Clear</button>
                        <button style={S.btn} onClick={() => alertsLayer.exportLog()}>Export JSON</button>
                    </div>
                    <div style={{ maxHeight: '100px', overflowY: 'auto' }}>
                        {log.slice(-10).reverse().map((e, i) => (
                            <div key={i} style={{ fontSize: '10px', color: '#FFEEAA', borderBottom: '1px solid #FFD70011', padding: '2px 0' }}>
                                {new Date(e.timeMs).toUTCString().slice(17, 25)} {e.target} → {e.gfName}
                            </div>
                        ))}
                    </div>
                </>
            )}
        </div>
    )
}
