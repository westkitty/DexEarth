import { useState, useEffect, useCallback, useRef } from 'react'
import * as tc from '../../../state/timeController.js'

const { MODES } = tc

const STYLE = {
    panel: {
        fontFamily: 'monospace',
        fontSize: '11px',
        color: '#00FF9F',
        padding: '8px 0',
        borderTop: '1px solid #00FF9F22',
        marginTop: '6px',
    },
    label: { color: '#88FFCC', fontSize: '10px', marginBottom: '3px' },
    row: { display: 'flex', alignItems: 'center', gap: '6px', marginBottom: '4px' },
    btn: {
        background: '#0d1520',
        border: '1px solid #00FF9F55',
        color: '#00FF9F',
        fontFamily: 'monospace',
        fontSize: '10px',
        cursor: 'pointer',
        padding: '2px 7px',
        borderRadius: '2px',
    },
    btnActive: {
        background: '#00FF9F22',
        border: '1px solid #00FF9F',
        color: '#00FF9F',
    },
    input: {
        background: '#0d1520',
        border: '1px solid #00FF9F44',
        color: '#00FF9F',
        fontFamily: 'monospace',
        fontSize: '10px',
        padding: '2px 5px',
        width: '120px',
        borderRadius: '2px',
    },
    slider: { width: '100%', accentColor: '#00FF9F' },
    select: {
        background: '#0d1520',
        border: '1px solid #00FF9F44',
        color: '#00FF9F',
        fontFamily: 'monospace',
        fontSize: '10px',
        padding: '2px 4px',
    },
}

export default function TimeControllerPanel({ viewer }) {
    const [mode, setModeState] = useState(tc.getMode())
    const [displayTime, setDisplayTime] = useState(tc.getTimeMs())
    const [speed, setSpeed] = useState(tc.getReplaySpeed())
    const [stepSize, setStepSize] = useState(tc.getStepSize())
    const [sunlight, setSunlight] = useState(false)
    const [terminator, setTerminator] = useState(false)
    const [terminatorOpacity, setTerminatorOpacity] = useState(0.7)
    const [terminatorWidth, setTerminatorWidth] = useState(2)
    const terminatorRef = useRef(null)

    // Subscribe to time changes
    useEffect(() => {
        const unsub = tc.subscribe(t => setDisplayTime(t))
        // Also poll in LIVE mode for smooth display
        const iv = setInterval(() => {
            if (tc.getMode() === MODES.LIVE) setDisplayTime(Date.now())
        }, 1000)
        return () => { unsub(); clearInterval(iv) }
    }, [])

    const handleMode = useCallback((newMode) => {
        tc.setMode(newMode)
        setModeState(newMode)
    }, [])

    const handleSlider = useCallback((e) => {
        // Slider covers ±7 days from now
        const now = Date.now()
        const val = (parseInt(e.target.value, 10) / 1000) * 7 * 86_400_000
        tc.setManualTime(now + val)
    }, [])

    const handleStep = useCallback((dir) => {
        tc.step(dir * stepSize)
        setModeState(MODES.MANUAL)
    }, [stepSize])

    const handleSunlight = useCallback((v) => {
        setSunlight(v)
        if (viewer?.scene?.globe) viewer.scene.globe.enableLighting = v
    }, [viewer])

    // Terminator rendering
    useEffect(() => {
        if (!viewer) return
        import('../../../utils/terminator.js').then(({ buildTerminatorPolylineStable }) => {
            import('cesium').then((Cesium) => {
                const updateTerminator = (timeMs) => {
                    if (terminatorRef.current) {
                        try { viewer.scene.primitives.remove(terminatorRef.current) } catch { /* ignore */ }
                        terminatorRef.current = null
                    }
                    if (!terminator) return
                    const pts = buildTerminatorPolylineStable(timeMs)
                    const positions = pts.map(([lo, la]) =>
                        Cesium.Cartesian3.fromDegrees(lo, la, 2000)
                    )
                    const lines = new Cesium.PolylineCollection()
                    lines.add({
                        positions,
                        width: terminatorWidth,
                        material: Cesium.Material.fromType('Color', {
                            color: Cesium.Color.fromCssColorString('#FFFFFF').withAlpha(terminatorOpacity),
                        }),
                    })
                    viewer.scene.primitives.add(lines)
                    terminatorRef.current = lines
                }

                const unsub = tc.subscribe(updateTerminator)
                updateTerminator(tc.getTimeMs())
                return () => {
                    unsub()
                    if (terminatorRef.current) {
                        try { viewer.scene.primitives.remove(terminatorRef.current) } catch { /* ignore */ }
                        terminatorRef.current = null
                    }
                }
            })
        })
    }, [viewer, terminator, terminatorOpacity, terminatorWidth])

    const btnStyle = (active) => active ? { ...STYLE.btn, ...STYLE.btnActive } : STYLE.btn
    const sliderPct = () => {
        const now = Date.now()
        const range = 7 * 86_400_000
        const offset = displayTime - now
        return Math.round((offset / range) * 1000)
    }

    return (
        <div style={STYLE.panel}>
            <div style={{ ...STYLE.label, fontWeight: 'bold', marginBottom: '6px' }}>⏱ TIME CONTROLLER</div>

            {/* UTC Display */}
            <div style={{ ...STYLE.row, flexDirection: 'column', alignItems: 'flex-start', gap: '2px', marginBottom: '6px' }}>
                <div style={{ color: '#FFFFFF', fontSize: '11px', fontWeight: 'bold' }}>{tc.fmtUtc(displayTime)}</div>
                <div style={{ color: '#88FFCC', fontSize: '10px' }}>{tc.fmtLocal(displayTime)}</div>
            </div>

            {/* Mode buttons */}
            <div style={STYLE.row}>
                {['LIVE', 'MANUAL', 'REPLAY'].map(m => (
                    <button key={m} style={btnStyle(mode === m)} onClick={() => handleMode(m)}>{m}</button>
                ))}
                <button style={STYLE.btn} onClick={() => { tc.resetToNow(); setModeState(MODES.LIVE) }}>↺ NOW</button>
            </div>

            {/* Manual scrub slider */}
            {mode !== MODES.LIVE && (
                <div style={{ marginBottom: '4px' }}>
                    <div style={STYLE.label}>Scrub (±7d)</div>
                    <input type="range" min={-1000} max={1000} defaultValue={0}
                        value={sliderPct()}
                        onChange={handleSlider} style={STYLE.slider} />
                    <div style={STYLE.row}>
                        <button style={STYLE.btn} onClick={() => handleStep(-1)}>◀ Step</button>
                        <select style={STYLE.select} value={stepSize}
                            onChange={e => { const v = parseInt(e.target.value); setStepSize(v); tc.setStepSize(v) }}>
                            <option value={60000}>1m</option>
                            <option value={600000}>10m</option>
                            <option value={3600000}>1h</option>
                            <option value={86400000}>1d</option>
                        </select>
                        <button style={STYLE.btn} onClick={() => handleStep(1)}>Step ▶</button>
                    </div>
                </div>
            )}

            {/* Replay speed */}
            {mode === MODES.REPLAY && (
                <div style={{ marginBottom: '4px' }}>
                    <div style={STYLE.label}>Speed: {speed}×</div>
                    <input type="range" min={1} max={100} value={speed}
                        onChange={e => { const v = parseInt(e.target.value); setSpeed(v); tc.setReplaySpeed(v) }}
                        style={STYLE.slider} />
                </div>
            )}

            {/* Terminator + Sunlight */}
            <div style={STYLE.row}>
                <label style={{ display: 'flex', alignItems: 'center', gap: '4px', cursor: 'pointer' }}>
                    <input type="checkbox" checked={terminator} onChange={e => setTerminator(e.target.checked)} />
                    <span style={{ color: '#88FFCC' }}>Terminator</span>
                </label>
                <label style={{ display: 'flex', alignItems: 'center', gap: '4px', cursor: 'pointer' }}>
                    <input type="checkbox" checked={sunlight} onChange={e => handleSunlight(e.target.checked)} />
                    <span style={{ color: '#88FFCC' }}>Sunlight</span>
                </label>
            </div>

            {terminator && (
                <div style={{ paddingLeft: '8px' }}>
                    <div style={STYLE.label}>Opacity</div>
                    <input type="range" min={1} max={10} value={Math.round(terminatorOpacity * 10)}
                        onChange={e => setTerminatorOpacity(parseInt(e.target.value) / 10)}
                        style={{ ...STYLE.slider, width: '80px' }} />
                    <div style={STYLE.label}>Width: {terminatorWidth}px</div>
                    <input type="range" min={1} max={6} value={terminatorWidth}
                        onChange={e => setTerminatorWidth(parseInt(e.target.value))}
                        style={{ ...STYLE.slider, width: '80px' }} />
                </div>
            )}
        </div>
    )
}
