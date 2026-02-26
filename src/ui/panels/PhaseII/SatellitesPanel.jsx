import { useState, useEffect, useCallback } from 'react'
import { satellitesLayer } from '../../../layers/satellites/layer.js'
import * as settings from '../../../state/settingsStore.js'

const S = {
    panel: { fontFamily: 'monospace', fontSize: '11px', color: '#00CFFF', padding: '8px 0', borderTop: '1px solid #00CFFF22', marginTop: '6px' },
    label: { color: '#88CCFF', fontSize: '10px', marginBottom: '2px' },
    row: { display: 'flex', alignItems: 'center', gap: '6px', marginBottom: '4px', flexWrap: 'wrap' },
    btn: { background: '#0d1520', border: '1px solid #00CFFF55', color: '#00CFFF', fontFamily: 'monospace', fontSize: '10px', cursor: 'pointer', padding: '2px 7px', borderRadius: '2px' },
    input: { background: '#0d1520', border: '1px solid #00CFFF44', color: '#00CFFF', fontFamily: 'monospace', fontSize: '10px', padding: '2px 5px', width: '160px', borderRadius: '2px' },
    slider: { width: '100%', accentColor: '#00CFFF' },
    stat: { color: '#88CCFF', fontSize: '10px' },
}

export default function SatellitesPanel({ viewer }) {
    const [isActive, setIsActive] = useState(false)
    const [satCap, setSatCap] = useState(settings.get('satelliteCap') || 250)
    const [nameFilter, setNameFilter] = useState('')
    const [showTracks, setShowTracks] = useState(false)
    const [useBundled, setUseBundled] = useState(true)
    const [remoteUrl, setRemoteUrl] = useState(settings.get('satelliteRemoteUrl') || '/proxy/tle')
    const [cacheInfo, setCacheInfo] = useState({ source: 'none', lastFetchedStr: 'never', expiresInStr: 'unknown' })
    const [telemetry, setTelemetry] = useState({ sats: 0, groundTracks: 0 })

    useEffect(() => {
        satellitesLayer.onTelemetry(t => {
            setTelemetry({ sats: t.sats, groundTracks: t.groundTracks })
            setCacheInfo(satellitesLayer.getCacheInfo())
        })
    }, [])

    const activate = useCallback(async () => {
        if (!viewer || isActive) return
        await satellitesLayer.activate({ viewer })
        setIsActive(true)
    }, [viewer, isActive])

    const deactivate = useCallback(() => {
        satellitesLayer.deactivate()
        setIsActive(false)
    }, [])

    const handleSatCap = useCallback((v) => {
        setSatCap(v)
        settings.set('satelliteCap', v)
        satellitesLayer.setSatCap(v)
    }, [])

    const handleFilter = useCallback((v) => {
        setNameFilter(v)
        satellitesLayer.setNameFilter(v)
    }, [])

    const handleTracks = useCallback((v) => {
        setShowTracks(v)
        satellitesLayer.setShowGroundTracks(v)
    }, [])

    const handleRefresh = useCallback(() => {
        satellitesLayer.refresh()
        setCacheInfo(satellitesLayer.getCacheInfo())
    }, [])

    return (
        <div style={S.panel}>
            <div style={{ ...S.label, fontWeight: 'bold', marginBottom: '6px' }}>🛰 SATELLITES</div>

            <div style={S.row}>
                <button style={{ ...S.btn, ...(isActive ? { background: '#00CFFF22', border: '1px solid #00CFFF' } : {}) }}
                    onClick={isActive ? deactivate : activate}>
                    {isActive ? '■ DEACTIVATE' : '▶ ACTIVATE'}
                </button>
                {isActive && <button style={S.btn} onClick={handleRefresh}>↺ Refresh</button>}
            </div>

            {isActive && (
                <>
                    <div style={S.row}>
                        <span style={S.stat}>Sats: {telemetry.sats} | Tracks: {telemetry.groundTracks}</span>
                    </div>
                    <div style={S.row}>
                        <span style={{ color: '#88CCFF', fontSize: '10px' }}>
                            Src: {cacheInfo.source} | Fetched: {cacheInfo.lastFetchedStr} | Exp: {cacheInfo.expiresInStr}
                        </span>
                    </div>

                    {/* Satellite cap slider */}
                    <div>
                        <div style={S.label}>Sat Cap: {satCap}</div>
                        <input type="range" min={10} max={500} step={10} value={satCap}
                            onChange={e => handleSatCap(parseInt(e.target.value))} style={S.slider} />
                    </div>

                    {/* Name filter */}
                    <div style={{ marginBottom: '4px' }}>
                        <div style={S.label}>Name Filter</div>
                        <input type="text" value={nameFilter} placeholder="e.g. STARLINK"
                            onChange={e => handleFilter(e.target.value)} style={S.input} />
                    </div>

                    {/* Ground tracks */}
                    <div style={S.row}>
                        <label style={{ display: 'flex', alignItems: 'center', gap: '4px', cursor: 'pointer' }}>
                            <input type="checkbox" checked={showTracks} onChange={e => handleTracks(e.target.checked)} />
                            <span style={{ color: '#88CCFF' }}>Ground Tracks (90min)</span>
                        </label>
                    </div>

                    {/* Remote URL */}
                    <div>
                        <label style={{ display: 'flex', alignItems: 'center', gap: '4px', cursor: 'pointer', marginBottom: '3px' }}>
                            <input type="checkbox" checked={!useBundled} onChange={e => {
                                const v = !e.target.checked
                                setUseBundled(v)
                                settings.set('satelliteUseBundled', v)
                            }} />
                            <span style={{ color: '#88CCFF' }}>Use Remote TLE URL</span>
                        </label>
                        {!useBundled && (
                            <input type="text" value={remoteUrl}
                                onChange={e => { setRemoteUrl(e.target.value); settings.set('satelliteRemoteUrl', e.target.value) }}
                                style={S.input} placeholder="/proxy/tle" />
                        )}
                    </div>
                </>
            )}
        </div>
    )
}
