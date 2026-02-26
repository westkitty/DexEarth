import { useState, useCallback } from 'react'
import { markersLayer } from '../../../layers/markers/layer.js'

const S = {
    panel: { fontFamily: 'monospace', fontSize: '11px', color: '#00FF9F', padding: '8px 0', borderTop: '1px solid #00FF9F22', marginTop: '6px' },
    label: { color: '#88FFCC', fontSize: '10px', marginBottom: '2px' },
    row: { display: 'flex', alignItems: 'center', gap: '6px', marginBottom: '4px', flexWrap: 'wrap' },
    btn: { background: '#0d1520', border: '1px solid #00FF9F55', color: '#00FF9F', fontFamily: 'monospace', fontSize: '10px', cursor: 'pointer', padding: '2px 7px', borderRadius: '2px' },
    input: { background: '#0d1520', border: '1px solid #00FF9F44', color: '#00FF9F', fontFamily: 'monospace', fontSize: '10px', padding: '2px 5px', width: '120px', borderRadius: '2px' },
    select: { background: '#0d1520', border: '1px solid #00FF9F44', color: '#00FF9F', fontFamily: 'monospace', fontSize: '10px', padding: '2px 4px' },
}

const SEVERITY_COLORS = { info: '#00FF9F', warning: '#FFD700', critical: '#FF4444', classified: '#CC00FF' }

export default function MarkersPanel({ viewer }) {
    const [isActive, setIsActive] = useState(false)
    const [markers, setMarkers] = useState([])
    const [search, setSearch] = useState('')
    const [addLon, setAddLon] = useState('0')
    const [addLat, setAddLat] = useState('0')
    const [addTitle, setAddTitle] = useState('')
    const [addSeverity, setAddSeverity] = useState('info')
    const [addNotes, setAddNotes] = useState('')
    const [showAdd, setShowAdd] = useState(false)

    const activate = useCallback(async () => {
        if (!viewer || isActive) return
        await markersLayer.activate({ viewer })
        markersLayer.onChange(setMarkers)
        setMarkers(markersLayer.getMarkers())
        setIsActive(true)
    }, [viewer, isActive])

    const deactivate = useCallback(() => {
        markersLayer.deactivate()
        setIsActive(false)
        setMarkers([])
    }, [])

    const handleAdd = useCallback(async () => {
        if (!addTitle.trim()) return
        await markersLayer.addMarker({
            lon: parseFloat(addLon), lat: parseFloat(addLat),
            title: addTitle, severity: addSeverity, notes: addNotes, tags: [],
        })
        setAddTitle(''); setAddNotes(''); setShowAdd(false)
    }, [addLon, addLat, addTitle, addSeverity, addNotes])

    const filtered = markers.filter(m =>
        !search || m.title.toLowerCase().includes(search.toLowerCase()) ||
        (m.tags || []).some(t => t.toLowerCase().includes(search.toLowerCase()))
    )

    return (
        <div style={S.panel}>
            <div style={{ ...S.label, fontWeight: 'bold', marginBottom: '6px' }}>📍 MARKERS</div>

            <div style={S.row}>
                <button style={{ ...S.btn, ...(isActive ? { background: '#00FF9F22', border: '1px solid #00FF9F' } : {}) }}
                    onClick={isActive ? deactivate : activate}>
                    {isActive ? '■ DEACTIVATE' : '▶ ACTIVATE'}
                </button>
                {isActive && <button style={S.btn} onClick={() => setShowAdd(v => !v)}>+ Add</button>}
            </div>

            {isActive && showAdd && (
                <div style={{ padding: '6px', border: '1px solid #00FF9F22', borderRadius: '3px', marginBottom: '6px' }}>
                    <div style={S.row}>
                        <div><div style={S.label}>Lon</div><input style={S.input} value={addLon} onChange={e => setAddLon(e.target.value)} /></div>
                        <div><div style={S.label}>Lat</div><input style={S.input} value={addLat} onChange={e => setAddLat(e.target.value)} /></div>
                    </div>
                    <div style={{ marginBottom: '4px' }}>
                        <div style={S.label}>Title</div>
                        <input style={S.input} value={addTitle} onChange={e => setAddTitle(e.target.value)} placeholder="Marker title" />
                    </div>
                    <div style={S.row}>
                        <div style={S.label}>Severity</div>
                        <select style={S.select} value={addSeverity} onChange={e => setAddSeverity(e.target.value)}>
                            {['info', 'warning', 'critical', 'classified'].map(s => <option key={s} value={s}>{s}</option>)}
                        </select>
                    </div>
                    <div style={{ marginBottom: '4px' }}>
                        <div style={S.label}>Notes</div>
                        <textarea style={{ ...S.input, width: '180px', height: '40px', resize: 'vertical' }}
                            value={addNotes} onChange={e => setAddNotes(e.target.value)} placeholder="Markdown notes..." />
                    </div>
                    <button style={S.btn} onClick={handleAdd}>✓ Save Marker</button>
                </div>
            )}

            {isActive && markers.length > 0 && (
                <div style={{ marginBottom: '4px' }}>
                    <input type="text" placeholder="Search..." value={search} onChange={e => setSearch(e.target.value)} style={S.input} />
                </div>
            )}

            {isActive && filtered.map(m => (
                <div key={m.id} style={{ ...S.row, borderBottom: '1px solid #00FF9F11', paddingBottom: '3px', justifyContent: 'space-between' }}>
                    <span style={{ color: SEVERITY_COLORS[m.severity] || '#00FF9F', flex: 1 }}>{m.title}</span>
                    <button style={{ ...S.btn, padding: '1px 5px', fontSize: '9px' }} onClick={() => markersLayer.jumpToMarker(m.id)}>→</button>
                    <button style={{ ...S.btn, padding: '1px 4px', fontSize: '9px', color: '#FF4444' }}
                        onClick={() => markersLayer.deleteMarker(m.id)}>✕</button>
                </div>
            ))}
        </div>
    )
}
