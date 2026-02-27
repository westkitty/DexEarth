import { useState, useEffect } from 'react'
import { Panel, CollapsibleSection, Button, StatusBadge, UI_TOKENS } from '../../components/core.jsx'
import { getRegisteredDatasets } from '../../../data/datasetRegistry.js'
import { getCached, pinDataset, unpinDataset, importCustomDataset, deleteCached, lastFetched } from '../../../storage/cache.js'

export default function DatasetManagerPanel() {
    const datasets = getRegisteredDatasets()
    const [state, setState] = useState({})
    const [tick, setTick] = useState(0)
    const [now, setNow] = useState(0)

    useEffect(() => {
        const loadStatus = async () => {
            const newState = {}
            for (const ds of datasets) {
                // Peek at cache ignoring TTL to see if it exists
                const cached = await getCached(ds.id, Infinity)
                newState[ds.id] = cached || null
            }
            setState(newState)
        }
        loadStatus()

        // Refresh UI every 10s for TTL countdowns
        const t = setInterval(() => {
            setTick(x => x + 1)
            setNow(Date.now())
        }, 10_000)
        return () => clearInterval(t)
    }, [tick, datasets]) // Include datasets to satisfy exhaustive-deps, though it's static

    const refreshDatasetRow = () => {
        setTick(x => x + 1)
        setTimeout(() => setNow(Date.now()), 0) // avoid putting it directly in render pass triggers
    }

    const handlePin = async (id, isPinned) => {
        if (isPinned) await unpinDataset(id)
        else await pinDataset(id)
        refreshDatasetRow()
    }

    const handleClear = async (id) => {
        await deleteCached(id)
        refreshDatasetRow()
    }

    const handleImportFile = async (e, id) => {
        const file = e.target.files[0]
        if (!file) return
        const reader = new FileReader()
        reader.onload = async (ev) => {
            let data = ev.target.result
            try {
                // If it's a JSON/GeoJSON dataset, parse it first to ensure valid data
                const ds = datasets.find(d => d.id === id)
                if (ds.format === 'geojson' || ds.format === 'json') {
                    data = JSON.parse(data)
                }
                await importCustomDataset(id, data)
                refreshDatasetRow()
            } catch (err) {
                console.error("Failed to parse imported dataset:", err)
                alert("Invalid format for this dataset.")
            }
        }
        reader.readAsText(file)
    }

    return (
        <Panel style={{ position: 'relative' }}>
            <div style={{ position: 'relative', zIndex: 1 }}>
                <CollapsibleSection title="📦 Dataset Manager" defaultOpen={false}>
                    <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
                        {datasets.map(ds => {
                            const status = state[ds.id]
                            const isPinned = status && status.pinned
                            const isExpired = status && status.expiresAt !== Infinity && status.expiresAt < now
                            const source = status ? status.source : 'none'

                            let badgeType = 'neutral'
                            if (isPinned || source === 'bundled') badgeType = 'success'
                            else if (isExpired) badgeType = 'error'
                            else if (source !== 'none') badgeType = 'success'

                            return (
                                <div key={ds.id} style={{
                                    border: UI_TOKENS.glassBorder, padding: '6px', borderRadius: '4px',
                                    background: 'rgba(0,0,0,0.2)'
                                }}>
                                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '4px' }}>
                                        <span style={{ fontSize: '11px', color: UI_TOKENS.textPrimary, fontWeight: 'bold' }}>
                                            {ds.name}
                                        </span>
                                        <StatusBadge
                                            status={badgeType}
                                            text={source === 'none' ? 'MISSING' : (isPinned ? 'PINNED' : source.toUpperCase() + (isExpired ? ' (EXP)' : ''))}
                                        />
                                    </div>

                                    <div style={{ fontSize: '9px', color: UI_TOKENS.textSecondary, marginBottom: '6px' }}>
                                        Size: {ds.sizeEstimate} • Impact on Safe Mode: {ds.safeModeImpact}
                                        <br />
                                        {status && !isPinned ? `Last fetched: ${lastFetched(status.fetchedAt)}` : null}
                                    </div>

                                    <div style={{ display: 'flex', gap: '4px', flexWrap: 'wrap' }}>
                                        <Button
                                            variant={isPinned ? "warning" : "default"}
                                            onClick={() => handlePin(ds.id, isPinned)}
                                            disabled={!status && !ds.bundledUrl}
                                        >
                                            {isPinned ? 'UNPIN' : 'PIN TO CACHE'}
                                        </Button>

                                        {status && !status.pinned && (
                                            <Button variant="danger" onClick={() => handleClear(ds.id)}>CLEAR</Button>
                                        )}

                                        <label style={{ cursor: 'pointer', display: 'inline-block' }}>
                                            <div style={{
                                                background: 'rgba(0,0,0,0.3)', border: `1px solid rgba(0,255,159,0.4)`,
                                                color: '#00FF9F', padding: '4px 8px', borderRadius: '3px',
                                                fontFamily: UI_TOKENS.font, fontSize: '10px',
                                                transition: 'all 150ms ease',
                                            }}>
                                                IMPORT CUSTOM
                                            </div>
                                            <input
                                                type="file"
                                                accept={ds.format === 'geojson' ? '.json,.geojson' : '*/*'}
                                                style={{ display: 'none' }}
                                                onChange={(e) => handleImportFile(e, ds.id)}
                                            />
                                        </label>
                                    </div>
                                </div>
                            )
                        })}
                    </div>
                </CollapsibleSection>
            </div>
        </Panel>
    )
}
