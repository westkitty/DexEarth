import { useState, useEffect } from 'react'
import { Panel, CollapsibleSection, StatusBadge, UI_TOKENS } from '../../components/core.jsx'
import { subscribeToAudit } from '../../../diagnostics/uiAudit.js'
import { DATASETS } from '../../../data/datasetRegistry.js'
import { getOrFetchDataset } from '../../../storage/cache.js'

export default function DiagnosticsPanel() {
    const [auditReport, setAuditReport] = useState({ total: 0, bound: 0, unbound: 0, unboundList: [] })
    const [datasetStatus, setDatasetStatus] = useState([])
    const [loading, setLoading] = useState(true)

    useEffect(() => {
        const unsub = subscribeToAudit(setAuditReport)

        // Check dataset registry vs actual cache status
        const checkDatasets = async () => {
            const results = []
            for (const ds of Object.values(DATASETS)) {
                try {
                    // Try a peek without forcing a fetch
                    const info = await getOrFetchDataset(ds.id, { returnUrlOnly: true })
                    results.push({ id: ds.id, name: ds.name, status: 'OK', source: info.source })
                } catch (err) {
                    results.push({ id: ds.id, name: ds.name, status: 'ERROR', error: err.message })
                }
            }
            setDatasetStatus(results)
            setLoading(false)
        }
        checkDatasets()

        return unsub
    }, [])

    return (
        <Panel>
            <CollapsibleSection title="🛠 System Diagnostics" color={UI_TOKENS.warning} defaultOpen={false}>

                {/* Datasets */}
                <div style={{ marginBottom: '12px' }}>
                    <div style={{ fontSize: '10px', color: UI_TOKENS.textSecondary, marginBottom: '6px' }}>Dataset Resolution</div>
                    {loading ? (
                        <div style={{ fontSize: '9px', color: UI_TOKENS.textMuted }}>Running diagnostics...</div>
                    ) : (
                        <div style={{ display: 'flex', flexDirection: 'column', gap: '4px' }}>
                            {datasetStatus.map(ds => (
                                <div key={ds.id} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                                    <span style={{ fontSize: '9px', color: UI_TOKENS.textPrimary }}>{ds.name}</span>
                                    {ds.status === 'OK' ? (
                                        <StatusBadge status="active" label={ds.source} />
                                    ) : (
                                        <StatusBadge status="error" label="ERR" />
                                    )}
                                </div>
                            ))}
                        </div>
                    )}
                </div>

                {/* UI Bindings */}
                <div>
                    <div style={{ fontSize: '10px', color: UI_TOKENS.textSecondary, marginBottom: '6px', display: 'flex', justifyContent: 'space-between' }}>
                        <span>UI Controls Bound</span>
                        <span>{auditReport.bound} / {auditReport.total}</span>
                    </div>
                    {auditReport.unbound > 0 ? (
                        <div style={{ display: 'flex', flexDirection: 'column', gap: '2px', background: 'rgba(255,0,0,0.1)', padding: '4px', borderRadius: '4px' }}>
                            <div style={{ fontSize: '8px', color: '#ff4444', textTransform: 'uppercase' }}>Missing Handlers:</div>
                            {auditReport.unboundList.map(ub => (
                                <div key={ub.id} style={{ fontSize: '9px', color: '#ff8888' }}>
                                    • {ub.id} ({ub.description})
                                </div>
                            ))}
                        </div>
                    ) : (
                        <div style={{ fontSize: '9px', color: UI_TOKENS.success }}>All registered UI controls are firmly bound.</div>
                    )}
                </div>

            </CollapsibleSection>
        </Panel>
    )
}
