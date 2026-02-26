import { useState, useEffect } from 'react'
import { cascadeModel } from '../../../layers/cascade/model.js'

const S = {
    panel: { fontFamily: 'monospace', fontSize: '11px', color: '#FF00FF', padding: '8px 0', borderTop: '1px solid #FF00FF22', marginTop: '6px' },
    label: { color: '#FF88FF', fontSize: '10px', marginBottom: '2px' },
    row: { display: 'flex', alignItems: 'center', gap: '6px', marginBottom: '4px', flexWrap: 'wrap' },
    btn: { background: '#0d1520', border: '1px solid #FF00FF55', color: '#FF00FF', fontFamily: 'monospace', fontSize: '10px', cursor: 'pointer', padding: '2px 7px', borderRadius: '2px' },
}

export default function CascadePanel() {
    const [state, setState] = useState(() => cascadeModel.getState())
    const events = cascadeModel.getEventDefs()

    useEffect(() => cascadeModel.onChange(setState), [])

    const isActive = (id) => state.activeEvents.some(e => e.eventId === id)

    return (
        <div style={S.panel}>
            <div style={{ ...S.label, fontWeight: 'bold', marginBottom: '6px' }}>⛓ CASCADE</div>

            <div style={S.row}>
                {events.map(ev => (
                    <button key={ev.id}
                        style={{ ...S.btn, ...(isActive(ev.id) ? { background: '#FF00FF22', border: '1px solid #FF00FF' } : {}) }}
                        onClick={() => isActive(ev.id) ? cascadeModel.cancelEvent(ev.id) : cascadeModel.triggerEvent(ev.id)}>
                        {isActive(ev.id) ? '■' : '▶'} {ev.label}
                    </button>
                ))}
                {state.activeEvents.length > 0 && (
                    <button style={{ ...S.btn, color: '#FF4444', border: '1px solid #FF444455' }} onClick={() => cascadeModel.reset()}>
                        Reset All
                    </button>
                )}
            </div>

            {/* Explain panel: causal chains */}
            {state.causalChains.length > 0 && (
                <div style={{ border: '1px solid #FF00FF22', borderRadius: '3px', padding: '5px', marginTop: '4px' }}>
                    <div style={{ ...S.label, fontWeight: 'bold' }}>Causal Chains</div>
                    {state.causalChains.map((c, i) => (
                        <div key={i} style={{ fontSize: '10px', color: '#FF88FF', marginBottom: '3px', borderBottom: '1px solid #FF00FF11', paddingBottom: '2px' }}>
                            <span style={{ color: '#FF00FF' }}>{c.from}</span>
                            <span style={{ color: '#888' }}> → </span>
                            <span style={{ color: '#FFAAFF' }}>{c.to}</span>
                            <span style={{ color: '#886688', marginLeft: '4px' }}>[{c.effect}]</span>
                        </div>
                    ))}
                </div>
            )}

            {state.activeEvents.length === 0 && (
                <div style={{ color: '#FF88FF88', fontSize: '10px' }}>No active cascade events</div>
            )}
        </div>
    )
}
