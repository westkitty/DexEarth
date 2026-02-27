import { useState, useCallback } from 'react'
import { threatIndexLayer, PRESET_WEIGHTS } from '../../../layers/threatIndex/layer.js'
import * as registry from '../../../state/layerRegistry.js'

const S = {
    panel: { fontFamily: 'monospace', fontSize: '11px', color: '#FF2200', padding: '8px 0', borderTop: '1px solid #FF220022', marginTop: '6px' },
    label: { color: '#FF8866', fontSize: '10px', marginBottom: '2px' },
    row: { display: 'flex', alignItems: 'center', gap: '6px', marginBottom: '4px', flexWrap: 'wrap' },
    btn: { background: '#0d1520', border: '1px solid #FF220055', color: '#FF2200', fontFamily: 'monospace', fontSize: '10px', cursor: 'pointer', padding: '2px 7px', borderRadius: '2px' },
    slider: { width: '100%', accentColor: '#FF2200' },
}

export default function ThreatIndexPanel({ viewer }) {
    const [isActive, setIsActive] = useState(false)
    const [weights, setWeights] = useState({ thermal: 0.8, seismic: 0.1, maritime: 0.1 })
    const [preset, setPreset] = useState('wildfire')

    const _recompute = (w) => {
        const snapshots = {
            thermal: registry.getGeometrySnapshot('THERMAL_FIRES') || { points: [] },
            seismic: registry.getGeometrySnapshot('SEISMIC_GRID') || { points: [] },
            maritime: registry.getGeometrySnapshot('MARITIME_LANES') || { lines: [] },
            tectonic: registry.getGeometrySnapshot('TECTONIC_PLATES') || { lines: [] },
        }
        threatIndexLayer.setWeights(w)
        threatIndexLayer.recompute(snapshots)
    }

    const activate = useCallback(() => {
        if (!viewer || isActive) return
        threatIndexLayer.activate({ viewer })
        setIsActive(true)
        _recompute(weights)
    }, [viewer, isActive, weights])

    const deactivate = useCallback(() => {
        threatIndexLayer.deactivate()
        setIsActive(false)
    }, [])

    const handleWeight = useCallback((key, val) => {
        const newW = { ...weights, [key]: val }
        setWeights(newW)
        if (isActive) _recompute(newW)
    }, [weights, isActive])

    const applyPreset = useCallback((name) => {
        setPreset(name)
        const w = PRESET_WEIGHTS[name] || PRESET_WEIGHTS.wildfire
        setWeights(w)
        if (isActive) _recompute(w)
    }, [isActive])

    return (
        <div style={{ ...S.panel, position: 'relative' }}>
            <img
                src="/assets/DexEarth_icon_threat.png"
                style={{ position: 'absolute', top: '50%', left: '50%', transform: 'translate(-50%, -50%)', opacity: 0.3, pointerEvents: 'none', width: '200px', height: '200px', objectFit: 'contain', zIndex: 0 }}
                alt=""
            />
            <div style={{ ...S.label, fontWeight: 'bold', marginBottom: '6px', position: 'relative', zIndex: 1 }}>◉ THREAT INDEX</div>

            <div style={S.row}>
                <button style={{ ...S.btn, ...(isActive ? { background: '#FF220022', border: '1px solid #FF2200' } : {}) }}
                    onClick={isActive ? deactivate : activate}>
                    {isActive ? '■ DEACTIVATE' : '▶ ACTIVATE'}
                </button>
                {isActive && <button style={S.btn} onClick={() => _recompute(weights)}>↺ Recompute</button>}
            </div>

            {isActive && (
                <>
                    <div style={S.row}>
                        {Object.keys(PRESET_WEIGHTS).map(name => (
                            <button key={name}
                                style={{ ...S.btn, ...(preset === name ? { background: '#FF220022', border: '1px solid #FF2200' } : {}) }}
                                onClick={() => applyPreset(name)}>
                                {name}
                            </button>
                        ))}
                    </div>

                    {[['thermal', '🔥 Thermal'], ['seismic', '⚡ Seismic'], ['maritime', '🚢 Maritime']].map(([key, label]) => (
                        <div key={key}>
                            <div style={S.label}>{label}: {(weights[key] * 100).toFixed(0)}%</div>
                            <input type="range" min={0} max={100} value={Math.round(weights[key] * 100)}
                                onChange={e => handleWeight(key, parseInt(e.target.value) / 100)}
                                style={S.slider} />
                        </div>
                    ))}
                </>
            )}
        </div>
    )
}
