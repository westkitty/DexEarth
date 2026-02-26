import { useState, useCallback } from 'react'
import { correlationTool } from '../../../layers/correlation/tool.js'
import * as registry from '../../../state/layerRegistry.js'

const S = {
    panel: { fontFamily: 'monospace', fontSize: '11px', color: '#00FFFF', padding: '8px 0', borderTop: '1px solid #00FFFF22', marginTop: '6px' },
    label: { color: '#88FFFF', fontSize: '10px', marginBottom: '2px' },
    row: { display: 'flex', alignItems: 'center', gap: '6px', marginBottom: '4px', flexWrap: 'wrap' },
    btn: { background: '#0d1520', border: '1px solid #00FFFF55', color: '#00FFFF', fontFamily: 'monospace', fontSize: '10px', cursor: 'pointer', padding: '2px 7px', borderRadius: '2px' },
    select: { background: '#0d1520', border: '1px solid #00FFFF44', color: '#00FFFF', fontFamily: 'monospace', fontSize: '10px', padding: '2px 4px' },
    input: { background: '#0d1520', border: '1px solid #00FFFF44', color: '#00FFFF', fontFamily: 'monospace', fontSize: '10px', padding: '2px 5px', width: '70px', borderRadius: '2px' },
}

const LAYER_OPTS = ['SATELLITES', 'SEISMIC_SIM', 'MARKERS', 'ALERTS', 'AIR_RADAR', 'SEISMIC_GRID', 'THERMAL_FIRES']
const OPS = [
    { id: 'p2p', label: 'Point→Point' },
    { id: 'p2l', label: 'Point→Line' },
    { id: 'l2l', label: 'Line→Line' },
]

export default function CorrelationPanel({ viewer }) {
    const [layer1, setLayer1] = useState(LAYER_OPTS[0])
    const [layer2, setLayer2] = useState(LAYER_OPTS[1])
    const [operation, setOperation] = useState('p2p')
    const [radius, setRadius] = useState('100')
    const [result, setResult] = useState(null)
    const [running, setRunning] = useState(false)

    const run = useCallback(async () => {
        if (!viewer) return
        setRunning(true)
        correlationTool.init(viewer)
        const snap1 = registry.getGeometrySnapshot(layer1)
        const snap2 = registry.getGeometrySnapshot(layer2)
        if (!snap1 && !snap2) {
            setResult({ error: 'No geometry from selected layers. Activate them first.' })
            setRunning(false)
            return
        }
        const res = correlationTool.run({
            snap1: snap1 || { points: [], lines: [] },
            snap2: snap2 || { points: [], lines: [] },
            operation,
            radiusKm: parseFloat(radius) || 100,
        })
        setResult(res)
        setRunning(false)
    }, [viewer, layer1, layer2, operation, radius])

    return (
        <div style={S.panel}>
            <div style={{ ...S.label, fontWeight: 'bold', marginBottom: '6px' }}>◈ CORRELATION</div>

            <div style={S.row}>
                <div>
                    <div style={S.label}>Layer A</div>
                    <select style={S.select} value={layer1} onChange={e => setLayer1(e.target.value)}>
                        {LAYER_OPTS.map(l => <option key={l} value={l}>{l}</option>)}
                    </select>
                </div>
                <div>
                    <div style={S.label}>Layer B</div>
                    <select style={S.select} value={layer2} onChange={e => setLayer2(e.target.value)}>
                        {LAYER_OPTS.map(l => <option key={l} value={l}>{l}</option>)}
                    </select>
                </div>
            </div>

            <div style={S.row}>
                <div>
                    <div style={S.label}>Operation</div>
                    <select style={S.select} value={operation} onChange={e => setOperation(e.target.value)}>
                        {OPS.map(o => <option key={o.id} value={o.id}>{o.label}</option>)}
                    </select>
                </div>
                <div>
                    <div style={S.label}>Radius (km)</div>
                    <input style={S.input} value={radius} onChange={e => setRadius(e.target.value)} />
                </div>
            </div>

            <div style={S.row}>
                <button style={S.btn} onClick={run} disabled={running}>{running ? '⏳ Running...' : '▶ Run'}</button>
                <button style={S.btn} onClick={() => correlationTool.clearHighlights()}>Clear Highlights</button>
                {result?.hitCount > 0 && (
                    <button style={S.btn} onClick={() => correlationTool.export(result)}>Export JSON</button>
                )}
            </div>

            {result && (
                <div style={{ fontSize: '10px', color: result.error ? '#FF4444' : '#88FFFF', marginTop: '4px' }}>
                    {result.error || (
                        <>
                            <span style={{ color: '#00FFFF' }}>{result.hitCount} hits</span>
                            {result.capped && <span style={{ color: '#FFD700' }}> (capped at limit)</span>}
                            <span> within {result.radiusKm}km</span>
                        </>
                    )}
                </div>
            )}
        </div>
    )
}
