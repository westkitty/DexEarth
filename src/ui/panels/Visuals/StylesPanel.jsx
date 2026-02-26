// ─── Styles Panel ─────────────────────────────────────────────────────────────
import { useEffect, useState } from 'react'
import {
    PRESETS, applyPreset, updatePresetParam, getPresetParams, getCurrentPresetId,
    onStateChange, deactivateSafeMode, setStarfieldIntensity, setCloudMode
} from '../../../visuals/styleManager.js'
import { viewStore, setFlyMode, subscribeViewStore } from '../../../state/viewStore.js'

const PRESET_META = [
    { id: 'REALISTIC', label: '🌍 Realistic', color: '#4488FF' },
    { id: 'CEL_SHADED', label: '🎨 Cel-Shaded', color: '#FF8833' },
    { id: 'HOLOGRAM', label: '🔵 Hologram', color: '#00FFFF' },
    { id: 'WIREFRAME', label: '🔲 Wireframe', color: '#00FF88' },
    { id: 'NIGHT_OPS', label: '🌑 Night-Ops', color: '#00FF44' },
]

const PRESET_SLIDERS = {
    REALISTIC: [
        { key: 'lightIntensity', label: 'Light Intensity', min: 0.5, max: 5, step: 0.1 },
        { key: 'fogDensity', label: 'Fog Density', min: 0, max: 0.002, step: 0.00005 },
    ],
    CEL_SHADED: [
        { key: 'edgeStrength', label: 'Edge Strength', min: 0, max: 8, step: 0.1 },
        { key: 'posterize', label: 'Posterize Levels', min: 2, max: 12, step: 1 },
    ],
    HOLOGRAM: [
        { key: 'scanlineIntensity', label: 'Scanlines', min: 0, max: 1.5, step: 0.05 },
        { key: 'jitter', label: 'Jitter', min: 0, max: 2, step: 0.05 },
    ],
    WIREFRAME: [
        { key: 'gridOpacity', label: 'Grid Opacity', min: 0.05, max: 0.8, step: 0.05 },
    ],
    NIGHT_OPS: [
        { key: 'vignetteStrength', label: 'Vignette', min: 0.5, max: 5, step: 0.1 },
        { key: 'atmosphereBrightness', label: 'Atmosphere', min: 0, max: 1, step: 0.05 },
    ],
}

const S = {
    label: { color: '#AAFFCC', fontFamily: 'monospace', fontSize: '10px', letterSpacing: '0.05em' },
    presetBtn: (active, color) => ({
        display: 'block', width: '100%', textAlign: 'left',
        background: active ? `${color}22` : 'transparent',
        border: `1px solid ${active ? color : color + '44'}`,
        color: active ? color : color + '88',
        fontFamily: 'monospace', fontSize: '10px', cursor: 'pointer',
        padding: '3px 8px', borderRadius: '2px', marginBottom: '3px',
    }),
    slider: { width: '100%', accentColor: '#00FF9F', cursor: 'pointer' },
    hudRow: { display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginTop: '4px' },
    safeMode: (active) => ({
        color: active ? '#FF4444' : '#AAFFCC88',
        fontFamily: 'monospace', fontSize: '9px',
        border: `1px solid ${active ? '#FF4444' : '#00FF9F22'}`,
        padding: '1px 5px', borderRadius: '2px',
    }),
}

export default function StylesPanel({ viewer }) {
    const [presetId, setPresetId] = useState(getCurrentPresetId())
    const [params, setParams] = useState(getPresetParams())
    const [fps, setFps] = useState(0)
    const [safeMode, setSafeMode] = useState(false)
    const [postFx, setPostFx] = useState(false)
    const [starfieldIntensity, setStarfieldIntensityState] = useState(1.0)
    const [cloudMode, setCloudModeState] = useState('OFF')
    const [flyMode, setFlyModeState] = useState(viewStore.flyMode)

    useEffect(() => {
        const unsub = onStateChange(state => {
            setPresetId(state.presetId)
            setFps(state.fps)
            setSafeMode(state.safeModeActive)
            setPostFx(state.postFxEnabled)
            setStarfieldIntensityState(state.starfieldIntensity)
            setCloudModeState(state.cloudMode)
            setParams(getPresetParams())
        })
        const unsubView = subscribeViewStore((state) => {
            setFlyModeState(state.flyMode)
        })
        return () => { unsub(); unsubView() }
    }, [])

    const handlePreset = (id) => {
        if (!viewer) return
        applyPreset(id)
        setParams(getPresetParams())
    }

    const handleSlider = (key, value) => {
        updatePresetParam(key, +value)
        setParams(prev => ({ ...prev, [key]: +value }))
    }

    const handleSafeMode = () => {
        if (safeMode) deactivateSafeMode()
        else setSafeMode(true)   // manual on handled via styleManager
    }

    const sliders = PRESET_SLIDERS[presetId] || []

    return (
        <div style={{ padding: '4px 0' }}>
            {/* FPS / PostFX status */}
            <div style={S.hudRow}>
                <span style={{ ...S.label, color: fps < 25 ? '#FF4444' : '#AAFFCC88' }}>
                    FPS: {fps}  PostFX: {postFx ? 'ON' : 'OFF'}
                </span>
                <button style={S.safeMode(safeMode)} onClick={handleSafeMode}>
                    {safeMode ? '⚠ SAFE MODE' : 'Safe Mode'}
                </button>
            </div>

            <div style={{ height: '1px', background: '#00FF9F22', margin: '6px 0' }} />

            {/* Preset buttons */}
            {PRESET_META.map(({ id, label, color }) => (
                <button key={id} style={S.presetBtn(presetId === id, color)}
                    onClick={() => handlePreset(id)}>
                    {presetId === id ? '▶ ' : '  '}{label}
                </button>
            ))}

            {/* Per-preset sliders */}
            {sliders.length > 0 && (
                <div style={{ marginTop: '6px', paddingLeft: '4px' }}>
                    {sliders.map(({ key, label, min, max, step }) => (
                        <div key={key} style={{ marginBottom: '5px' }}>
                            <span style={{ ...S.label, color: '#AAFFCC88' }}>
                                {label}: {typeof params[key] === 'number' ? params[key].toFixed(2) : params[key]}
                            </span>
                            <input type="range" min={min} max={max} step={step} value={params[key] ?? min}
                                onChange={e => handleSlider(key, e.target.value)} style={S.slider} />
                        </div>
                    ))}
                </div>
            )}

            {/* Global Visuals */}
            <div style={{ marginTop: '8px', padding: '6px 4px', background: 'rgba(0,0,0,0.2)', borderRadius: '4px' }}>
                <div style={{ marginBottom: '8px' }}>
                    <span style={{ ...S.label, color: '#AAFFCCaa', display: 'block', marginBottom: '4px' }}>
                        Starfield Intensity: {starfieldIntensity.toFixed(1)}x
                    </span>
                    <input
                        type="range" min="0.5" max="5.0" step="0.1"
                        value={starfieldIntensity}
                        onChange={e => {
                            const val = parseFloat(e.target.value)
                            setStarfieldIntensityState(val)
                            setStarfieldIntensity(val)
                        }}
                        style={S.slider}
                    />
                </div>
                <div>
                    <span style={{ ...S.label, color: '#AAFFCCaa', display: 'block', marginBottom: '4px' }}>
                        Cloud Simulation:
                    </span>
                    <div style={{ display: 'flex', gap: '4px' }}>
                        {['OFF', 'SIMULATED', 'REALISTIC'].map(mode => (
                            <button
                                key={mode}
                                style={{
                                    flex: 1, padding: '4px 0', fontSize: '9px', fontFamily: 'monospace',
                                    cursor: 'pointer', borderRadius: '2px', border: '1px solid',
                                    background: cloudMode === mode ? 'rgba(170, 255, 204, 0.2)' : 'transparent',
                                    borderColor: cloudMode === mode ? '#AAFFCC' : '#AAFFCC44',
                                    color: cloudMode === mode ? '#AAFFCC' : '#AAFFCC88'
                                }}
                                onClick={() => {
                                    setCloudModeState(mode)
                                    setCloudMode(mode)
                                }}
                            >
                                {mode}
                            </button>
                        ))}
                    </div>
                </div>

                <div style={{ marginTop: '8px' }}>
                    <span style={{ ...S.label, color: '#AAFFCCaa', display: 'block', marginBottom: '4px' }}>
                        Camera Fly Mode:
                    </span>
                    <div style={{ display: 'flex', gap: '4px' }}>
                        {['normal', 'fast', 'cinematic'].map(mode => (
                            <button
                                key={mode}
                                style={{
                                    flex: 1, padding: '4px 0', fontSize: '9px', fontFamily: 'monospace',
                                    cursor: 'pointer', borderRadius: '2px', border: '1px solid',
                                    background: flyMode === mode ? 'rgba(170, 255, 204, 0.2)' : 'transparent',
                                    borderColor: flyMode === mode ? '#AAFFCC' : '#AAFFCC44',
                                    color: flyMode === mode ? '#AAFFCC' : '#AAFFCC88',
                                    textTransform: 'uppercase'
                                }}
                                onClick={() => setFlyMode(mode)}
                            >
                                {mode}
                            </button>
                        ))}
                    </div>
                </div>
            </div>

            {/* Reset to defaults */}
            <button
                style={{
                    marginTop: '4px', background: 'transparent', border: '1px solid #FF444422',
                    color: '#FF444466', fontFamily: 'monospace', fontSize: '9px', cursor: 'pointer',
                    padding: '1px 6px', borderRadius: '2px'
                }}
                onClick={() => { applyPreset(presetId); setParams(getPresetParams()) }}>
                Reset Preset
            </button>
        </div>
    )
}
