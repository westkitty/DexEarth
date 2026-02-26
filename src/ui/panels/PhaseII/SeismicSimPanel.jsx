import { useState, useEffect, useCallback } from 'react'
import { seismicSimLayer, PRESETS } from '../../../layers/seismicSim/layer.js'
import * as tc from '../../../state/timeController.js'

const S = {
    panel: { fontFamily: 'monospace', fontSize: '11px', color: '#FF8C00', padding: '8px 0', borderTop: '1px solid #FF8C0022', marginTop: '6px' },
    label: { color: '#FFBB88', fontSize: '10px', marginBottom: '2px' },
    row: { display: 'flex', alignItems: 'center', gap: '6px', marginBottom: '4px', flexWrap: 'wrap' },
    btn: { background: '#0d1520', border: '1px solid #FF8C0055', color: '#FF8C00', fontFamily: 'monospace', fontSize: '10px', cursor: 'pointer', padding: '2px 7px', borderRadius: '2px' },
    input: { background: '#0d1520', border: '1px solid #FF8C0044', color: '#FF8C00', fontFamily: 'monospace', fontSize: '10px', padding: '2px 5px', width: '70px', borderRadius: '2px' },
}

export default function SeismicSimPanel({ viewer }) {
    const [isActive, setIsActive] = useState(false)
    const [events, setEvents] = useState([])
    const [lon, setLon] = useState('143.0')
    const [lat, setLat] = useState('37.5')
    const [mag, setMag] = useState('7.5')
    const [depth, setDepth] = useState('30')
    const [tel, setTel] = useState({ events: 0, rings: 0 })

    useEffect(() => {
        seismicSimLayer.onTelemetry(t => setTel(t))
    }, [])

    const activate = useCallback(async () => {
        if (!viewer || isActive) return
        seismicSimLayer.activate({ viewer })
        setIsActive(true)
    }, [viewer, isActive])

    const deactivate = useCallback(() => {
        seismicSimLayer.deactivate()
        setIsActive(false)
        setEvents([])
    }, [])

    const addEvent = useCallback((preset) => {
        const params = preset
            ? (typeof PRESETS[preset] === 'function' ? PRESETS[preset]() : PRESETS[preset])
            : { lon: parseFloat(lon), lat: parseFloat(lat), mag: parseFloat(mag), depthKm: parseFloat(depth), originMs: tc.getTimeMs() }
        if (!isActive) return
        const ev = seismicSimLayer.addEvent({ ...params, originMs: params.originMs ?? tc.getTimeMs() })
        setEvents(seismicSimLayer.getEvents())
        return ev
    }, [isActive, lon, lat, mag, depth])

    const removeEvent = useCallback((id) => {
        seismicSimLayer.removeEvent(id)
        setEvents(seismicSimLayer.getEvents())
    }, [])

    return (
        <div style={S.panel}>
            <div style={{ ...S.label, fontWeight: 'bold', marginBottom: '6px' }}>⚡ SEISMIC SIM</div>

            <div style={S.row}>
                <button style={{ ...S.btn, ...(isActive ? { background: '#FF8C0022', border: '1px solid #FF8C00' } : {}) }}
                    onClick={isActive ? deactivate : activate}>
                    {isActive ? '■ DEACTIVATE' : '▶ ACTIVATE'}
                </button>
                {isActive && <span style={{ color: '#FFBB88', fontSize: '10px' }}>Events: {tel.events} | Rings: {tel.rings}</span>}
            </div>

            {isActive && (
                <>
                    {/* Presets */}
                    <div style={S.row}>
                        {Object.entries(PRESETS).map(([key, val]) => (
                            <button key={key} style={S.btn} onClick={() => addEvent(key)}>
                                {typeof val === 'function' ? '🎲 Random' : val.label.split(' ')[0]}
                            </button>
                        ))}
                    </div>

                    {/* Manual entry */}
                    <div style={{ ...S.row, flexWrap: 'wrap', gap: '4px' }}>
                        <div><div style={S.label}>Lon</div><input style={S.input} value={lon} onChange={e => setLon(e.target.value)} /></div>
                        <div><div style={S.label}>Lat</div><input style={S.input} value={lat} onChange={e => setLat(e.target.value)} /></div>
                        <div><div style={S.label}>M</div><input style={{ ...S.input, width: '40px' }} value={mag} onChange={e => setMag(e.target.value)} /></div>
                        <div><div style={S.label}>Depth(km)</div><input style={{ ...S.input, width: '50px' }} value={depth} onChange={e => setDepth(e.target.value)} /></div>
                    </div>
                    <div style={S.row}>
                        <button style={S.btn} onClick={() => addEvent(null)}>+ Add Event (now)</button>
                        <button style={{ ...S.btn, color: '#FF4444' }} onClick={() => { seismicSimLayer.clearEvents(); setEvents([]) }}>Clear All</button>
                    </div>

                    {/* Event list */}
                    {events.map(ev => (
                        <div key={ev.id} style={{ ...S.row, color: '#FFBB88', fontSize: '10px', borderBottom: '1px solid #FF8C0011', paddingBottom: '3px' }}>
                            <span>M{ev.mag} @ {ev.lon.toFixed(1)},{ev.lat.toFixed(1)}</span>
                            <button style={{ ...S.btn, padding: '1px 5px', fontSize: '9px' }} onClick={() => removeEvent(ev.id)}>✕</button>
                        </div>
                    ))}
                </>
            )}
        </div>
    )
}
