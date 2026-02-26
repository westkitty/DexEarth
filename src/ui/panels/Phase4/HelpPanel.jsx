import { useState, useEffect } from 'react'
import { Panel, CollapsibleSection, UI_TOKENS } from '../../components/core.jsx'
import DiagnosticsPanel from './DiagnosticsPanel.jsx'

export default function HelpPanel() {
    const [helpData, setHelpData] = useState([])
    const [loading, setLoading] = useState(true)

    useEffect(() => {
        const fetchHelp = async () => {
            try {
                const res = await fetch('/data/help-content.json')
                if (res.ok) {
                    const data = await res.json()
                    setHelpData(data.sections || [])
                }
            } catch (err) {
                console.error('Failed to load help content:', err)
            } finally {
                setLoading(false)
            }
        }
        fetchHelp()
    }, [])

    return (
        <Panel>
            <CollapsibleSection title="ℹ️ Operator Manual" color="#AAAAAA" defaultOpen={false}>
                {loading ? (
                    <div style={{ color: UI_TOKENS.textMuted, fontSize: '11px', fontStyle: 'italic' }}>
                        Loading manual...
                    </div>
                ) : helpData.length === 0 ? (
                    <div style={{ color: UI_TOKENS.textMuted, fontSize: '11px' }}>
                        Manual unavailable offline.
                    </div>
                ) : (
                    <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
                        {helpData.map((sec, i) => (
                            <div key={sec.id || i} style={{
                                background: 'rgba(255,255,255,0.03)',
                                border: '1px solid rgba(255,255,255,0.05)',
                                borderRadius: '4px',
                                padding: '6px 8px'
                            }}>
                                <div style={{
                                    color: UI_TOKENS.primary,
                                    fontSize: '11px',
                                    fontWeight: 'bold',
                                    marginBottom: '4px',
                                    textTransform: 'uppercase',
                                    letterSpacing: '0.05em'
                                }}>
                                    {sec.title}
                                </div>
                                <div style={{
                                    color: UI_TOKENS.textSecondary,
                                    fontSize: '11px',
                                    lineHeight: '1.4',
                                    whiteSpace: 'pre-wrap'
                                }}>
                                    {sec.content}
                                </div>
                            </div>
                        ))}
                    </div>
                )}
            </CollapsibleSection>

            <div style={{ marginTop: '8px' }}>
                <DiagnosticsPanel />
            </div>
        </Panel>
    )
}
