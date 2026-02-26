import { useState, useEffect } from 'react'
import { Panel, CollapsibleSection, Button, StatusBadge, UI_TOKENS } from '../../components/core.jsx'
import { subscribeAudit, clearAuditHistory, loadAuditHistory } from '../../../utils/auditLog.js'

export default function AuditLogPanel() {
    const [events, setEvents] = useState([])
    const [filter, setFilter] = useState('all') // 'all', 'layer', 'data', 'ui', 'perf', 'error'
    const [copied, setCopied] = useState(false)

    useEffect(() => {
        loadAuditHistory()
        return subscribeAudit(setEvents)
    }, [])

    const filtered = events.filter(e => filter === 'all' || e.category === filter)

    const handleCopy = () => {
        const text = JSON.stringify(filtered, null, 2)
        navigator.clipboard.writeText(text)
        setCopied(true)
        setTimeout(() => setCopied(false), 2000)
    }

    const filters = [
        { id: 'all', label: 'ALL' },
        { id: 'layer', label: 'LAYER' },
        { id: 'data', label: 'DATA' },
        { id: 'perf', label: 'PERF' },
        { id: 'error', label: 'ERR' },
    ]

    const getStatusColor = (cat) => {
        if (cat === 'error') return 'error'
        if (cat === 'perf') return 'warning'
        if (cat === 'data') return 'success'
        return 'neutral'
    }

    return (
        <Panel>
            <CollapsibleSection title="📄 Audit Log" defaultOpen={true}>
                {/* Filters */}
                <div style={{ display: 'flex', gap: '4px', marginBottom: '8px', flexWrap: 'wrap' }}>
                    {filters.map(f => (
                        <button
                            key={f.id}
                            onClick={() => setFilter(f.id)}
                            style={{
                                background: filter === f.id ? 'rgba(0, 255, 159, 0.2)' : 'transparent',
                                border: `1px solid ${filter === f.id ? '#00FF9F' : 'rgba(0, 255, 159, 0.2)'}`,
                                color: filter === f.id ? '#00FF9F' : UI_TOKENS.textSecondary,
                                fontSize: '9px', fontFamily: UI_TOKENS.font, padding: '2px 6px',
                                borderRadius: '2px', cursor: 'pointer'
                            }}
                        >
                            {f.label}
                        </button>
                    ))}
                </div>

                {/* Event List */}
                <div style={{
                    maxHeight: '200px', overflowY: 'auto', border: UI_TOKENS.glassBorder,
                    background: 'rgba(0,0,0,0.3)', padding: '4px', borderRadius: '3px',
                    marginBottom: '8px'
                }}>
                    {filtered.length === 0 ? (
                        <div style={{ color: UI_TOKENS.textMuted, fontSize: '10px', padding: '4px', textAlign: 'center' }}>
                            No events found.
                        </div>
                    ) : (
                        filtered.map((ev, i) => (
                            <div key={ev.id || i} style={{
                                padding: '4px', borderBottom: '1px solid rgba(255,255,255,0.05)',
                                fontSize: '9px', fontFamily: UI_TOKENS.font, display: 'flex', flexDirection: 'column', gap: '2px'
                            }}>
                                <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                                    <span style={{ color: UI_TOKENS.textMuted }}>{new Date(ev.timeMs).toLocaleTimeString()}</span>
                                    <StatusBadge status={getStatusColor(ev.category)} text={ev.category} />
                                </div>
                                <div style={{ color: UI_TOKENS.textPrimary, fontWeight: 'bold' }}>{ev.event}</div>
                                <div style={{ color: UI_TOKENS.textSecondary, overflowWrap: 'break-word' }}>{ev.detail}</div>
                            </div>
                        ))
                    )}
                </div>

                {/* Controls */}
                <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                    <Button onClick={clearAuditHistory} variant="danger">CLEAR LOGS</Button>
                    <Button onClick={handleCopy}>{copied ? 'COPIED!' : 'EXPORT JSON'}</Button>
                </div>
            </CollapsibleSection>
        </Panel>
    )
}
