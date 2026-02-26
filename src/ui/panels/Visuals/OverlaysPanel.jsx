// ─── Overlays Panel ───────────────────────────────────────────────────────────
import { useEffect, useState, useCallback, useMemo } from 'react'
import {
    countryBordersLayer, countryLabelsLayer, countryFollowLabelsLayer,
    settings as overlaySettings, selectCountry, clearSelection, flyToCountry,
} from '../../../overlays/countries/index.js'
import { loadCountryIndex } from '../../../overlays/countries/loadGeojson.js'

const S = {
    label: { color: '#AAFFCC', fontFamily: 'monospace', fontSize: '10px', letterSpacing: '0.05em' },
    row: { display: 'flex', alignItems: 'center', gap: '6px', marginBottom: '5px' },
    input: {
        background: 'transparent', border: '1px solid #00FF9F33', color: '#00FF9F',
        fontFamily: 'monospace', fontSize: '10px', borderRadius: '2px', padding: '2px 5px', width: '100%',
    },
    btn: {
        background: 'transparent', border: '1px solid #00FF9F44', color: '#00FF9F88',
        fontFamily: 'monospace', fontSize: '9px', cursor: 'pointer', padding: '1px 6px', borderRadius: '2px',
    },
    slider: { width: '100%', accentColor: '#00FF9F', cursor: 'pointer' },
    result: {
        color: '#00FF9F', fontFamily: 'monospace', fontSize: '10px', cursor: 'pointer',
        padding: '2px 4px', marginBottom: '2px',
    },
    selected: {
        background: '#00FF9F22', borderLeft: '2px solid #00FF9F',
        padding: '4px 6px', fontFamily: 'monospace', fontSize: '10px', color: '#00FF9F',
        marginBottom: '6px',
    },
}

export default function OverlaysPanel({ viewer }) {
    const [borders, setBorders] = useState(false)
    const [labels, setLabels] = useState(false)
    const [follow, setFollow] = useState(false)
    const [density, setDensity] = useState(200)
    const [followDensity, setFollowDensity] = useState(80)
    const [searchQ, setSearchQ] = useState('')
    const [selected, setSelected] = useState(null)
    const [index, setIndex] = useState([])
    const [borderWidth, setBorderWidth] = useState(1.2)
    const [borderGlow, setBorderGlow] = useState(false)

    // Load country index for search
    useEffect(() => {
        loadCountryIndex().then(setIndex)
        overlaySettings.onSelectionChange = (name) => setSelected(name)
    }, [])

    // Search results — derived directly from searchQ and index (no effect needed)
    const searchResults = useMemo(() => {
        if (!searchQ.trim()) return []
        const q = searchQ.toLowerCase()
        return index.filter(e => e.name.toLowerCase().includes(q)).slice(0, 8)
    }, [searchQ, index])

    const toggleBorders = useCallback(async () => {
        if (!viewer) return
        if (!borders) {
            await countryBordersLayer.activate({ viewer })
            setBorders(true)
        } else {
            countryBordersLayer.deactivate()
            setBorders(false)
        }
    }, [borders, viewer])

    const toggleLabels = useCallback(async () => {
        if (!viewer) return
        if (!labels) {
            await countryLabelsLayer.activate({ viewer })
            setLabels(true)
        } else {
            countryLabelsLayer.deactivate()
            setLabels(false)
        }
    }, [labels, viewer])

    const toggleFollow = useCallback(async () => {
        if (!viewer) return
        if (!follow) {
            await countryFollowLabelsLayer.activate({ viewer })
            setFollow(true)
        } else {
            countryFollowLabelsLayer.deactivate()
            setFollow(false)
        }
    }, [follow, viewer])

    const onBorderWidthChange = (v) => {
        setBorderWidth(v)
        countryBordersLayer.setStyle({ width: v })
    }

    const onGlowChange = (v) => {
        setBorderGlow(v)
        countryBordersLayer.setStyle({ glow: v })
    }

    const onDensityChange = (v) => {
        setDensity(v)
        countryLabelsLayer.setMaxLabels(v)
    }

    const onFollowDensityChange = (v) => {
        setFollowDensity(v)
        countryFollowLabelsLayer.setMaxLabels(v)
    }

    const onSelectResult = (entry) => {
        setSearchQ(entry.name)
        selectCountry(entry.name)
        flyToCountry(entry.name, viewer)
    }

    const onClearSelection = () => {
        clearSelection()
        setSelected(null)
    }

    return (
        <div style={{ padding: '4px 0', color: '#AAFFCC' }}>
            {/* Borders */}
            <div style={S.row}>
                <input type="checkbox" checked={borders} onChange={toggleBorders} />
                <span style={S.label}>Country Borders</span>
            </div>
            {borders && (
                <div style={{ paddingLeft: '16px', marginBottom: '6px' }}>
                    <div style={{ ...S.row, gap: '4px' }}>
                        <span style={{ ...S.label, color: '#AAFFCC88' }}>Width</span>
                        <input type="range" min={1} max={4} step={0.1} value={borderWidth}
                            onChange={e => onBorderWidthChange(+e.target.value)} style={S.slider} />
                    </div>
                    <div style={S.row}>
                        <input type="checkbox" checked={borderGlow} onChange={e => onGlowChange(e.target.checked)} />
                        <span style={{ ...S.label, color: '#AAFFCC88' }}>Glow</span>
                    </div>
                </div>
            )}

            {/* Inside Labels */}
            <div style={S.row}>
                <input type="checkbox" checked={labels} onChange={toggleLabels} />
                <span style={S.label}>Country Labels (Inside)</span>
            </div>
            {labels && (
                <div style={{ paddingLeft: '16px', marginBottom: '6px' }}>
                    <span style={{ ...S.label, color: '#AAFFCC88' }}>Density {density}</span>
                    <input type="range" min={20} max={500} step={10} value={density}
                        onChange={e => onDensityChange(+e.target.value)} style={S.slider} />
                </div>
            )}

            {/* Follow Labels */}
            <div style={S.row}>
                <input type="checkbox" checked={follow} onChange={toggleFollow} />
                <span style={S.label}>Labels (Follow Borders)</span>
            </div>
            {follow && (
                <div style={{ paddingLeft: '16px', marginBottom: '6px' }}>
                    <span style={{ ...S.label, color: '#AAFFCC88' }}>Density {followDensity}</span>
                    <input type="range" min={10} max={150} step={5} value={followDensity}
                        onChange={e => onFollowDensityChange(+e.target.value)} style={S.slider} />
                </div>
            )}

            {/* Selection info */}
            {selected && (
                <div style={S.selected}>
                    📍 {selected}
                    <span style={{ marginLeft: '8px', cursor: 'pointer', color: '#FF4444' }}
                        onClick={onClearSelection}>✕</span>
                    <button style={{ ...S.btn, marginLeft: '8px' }}
                        onClick={() => flyToCountry(selected, viewer)}>Fly To</button>
                </div>
            )}

            {/* Search */}
            <div style={{ marginTop: '6px' }}>
                <input
                    style={S.input}
                    placeholder="Search country..."
                    value={searchQ}
                    onChange={e => setSearchQ(e.target.value)}
                />
                {searchResults.map(r => (
                    <div key={r.iso_a3 || r.name} style={S.result} onClick={() => onSelectResult(r)}>
                        {r.name} <span style={{ color: '#AAFFCC55' }}>{r.iso_a2}</span>
                    </div>
                ))}
            </div>
        </div>
    )
}
