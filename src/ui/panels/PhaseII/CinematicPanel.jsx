import { useState, useEffect } from 'react'
import { cinematicController } from '../../../layers/cinematic/controller.js'

const S = {
    panel: { fontFamily: 'monospace', fontSize: '11px', color: '#AAFFAA', padding: '8px 0', borderTop: '1px solid #AAFFAA22', marginTop: '6px' },
    label: { color: '#CCFFCC', fontSize: '10px', marginBottom: '2px' },
    row: { display: 'flex', alignItems: 'center', gap: '6px', marginBottom: '4px', flexWrap: 'wrap' },
    btn: { background: '#0d1520', border: '1px solid #AAFFAA55', color: '#AAFFAA', fontFamily: 'monospace', fontSize: '10px', cursor: 'pointer', padding: '2px 7px', borderRadius: '2px' },
    slider: { width: '80px', accentColor: '#AAFFAA' },
}

export default function CinematicPanel({ viewer }) {
    const [state, setState] = useState({ playing: false, tourId: null })
    const [speed, setSpeed] = useState(1)
    const tours = cinematicController.getTours()

    useEffect(() => {
        cinematicController.init(viewer)
        cinematicController.onStateChange(setState)
    }, [viewer])

    return (
        <div style={S.panel}>
            <div style={{ ...S.label, fontWeight: 'bold', marginBottom: '6px' }}>🎬 CINEMATIC</div>

            <div style={{ ...S.row, flexWrap: 'wrap' }}>
                {tours.map(tour => (
                    <button key={tour.id}
                        style={{ ...S.btn, ...(state.tourId === tour.id && state.playing ? { background: '#AAFFAA22', border: '1px solid #AAFFAA' } : {}) }}
                        onClick={() => cinematicController.play(tour.id)}>
                        ▶ {tour.label}
                    </button>
                ))}
            </div>

            <div style={S.row}>
                {state.playing
                    ? <button style={S.btn} onClick={() => cinematicController.pause()}>⏸ Pause</button>
                    : state.tourId && <button style={S.btn} onClick={() => cinematicController.resume()}>▶ Resume</button>
                }
                {state.tourId && (
                    <>
                        <button style={S.btn} onClick={() => cinematicController.skipForward()}>⏭ Skip</button>
                        <button style={{ ...S.btn, color: '#FF4444' }} onClick={() => cinematicController.stop()}>■ Exit Tour</button>
                    </>
                )}
            </div>

            <div style={S.row}>
                <span style={S.label}>Speed: {speed}×</span>
                <input type="range" min={25} max={400} step={25} value={speed * 100}
                    onChange={e => { const v = parseInt(e.target.value) / 100; setSpeed(v); cinematicController.setSpeed(v) }}
                    style={S.slider} />
            </div>

            {state.tourId && (
                <div style={{ color: '#CCFFCC', fontSize: '10px' }}>
                    Tour: {state.tourId} | Frame: {state.keyframeIdx + 1}
                </div>
            )}
        </div>
    )
}
