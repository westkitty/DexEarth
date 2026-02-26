import { useState, useEffect } from 'react'
import { Panel, CollapsibleSection, Button, StatusBadge, UI_TOKENS } from '../../components/core.jsx'
import { subscribePerf } from '../../../diagnostics/perfMonitor.js'
import { deactivateSafeMode } from '../../../visuals/styleManager.js'

function fpsColor(fps) {
    if (fps >= 45) return 'success'
    if (fps >= 25) return 'warning'
    return 'error'
}

export default function PerformancePanel() {
    const [perf, setPerf] = useState({
        fps: 60, safeMode: false, topOffender: 'none',
        budgets: {
            points: { current: 0, max: 0 },
            lines: { current: 0, max: 0 },
            labels: { current: 0, max: 0 },
            polygons: { current: 0, max: 0 }
        }
    })

    useEffect(() => {
        return subscribePerf(setPerf)
    }, [])

    const { fps, safeMode, budgets, topOffender } = perf

    return (
        <Panel>
            <CollapsibleSection title="📊 Performance" defaultOpen={false}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '8px' }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                        <span style={{ fontSize: '20px', fontWeight: 'bold', color: UI_TOKENS.textPrimary }}>
                            {fps} <span style={{ fontSize: '10px', color: UI_TOKENS.textSecondary }}>FPS</span>
                        </span>
                        <StatusBadge status={fpsColor(fps)} text={fps >= 45 ? 'SMOOTH' : (fps >= 25 ? 'LAGGY' : 'CRITICAL')} />
                    </div>
                </div>

                <div style={{ marginBottom: '8px', padding: '6px', background: 'rgba(0,0,0,0.2)', border: UI_TOKENS.glassBorder, borderRadius: '4px' }}>
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '4px' }}>
                        <span style={{ fontSize: '10px', color: UI_TOKENS.textSecondary }}>SAFE MODE POLICY</span>
                        <StatusBadge status={safeMode ? 'warning' : 'neutral'} text={safeMode ? 'ACTIVE' : 'STANDBY'} />
                    </div>
                    {safeMode && (
                        <div style={{ marginTop: '6px' }}>
                            <Button variant="warning" onClick={deactivateSafeMode} style={{ width: '100%' }}>
                                OVERRIDE SAFE MODE
                            </Button>
                        </div>
                    )}
                </div>

                <div style={{ fontSize: '10px', color: UI_TOKENS.textSecondary, marginBottom: '4px', textTransform: 'uppercase' }}>
                    Geometry Budgets
                </div>
                <div style={{ display: 'flex', flexDirection: 'column', gap: '4px', marginBottom: '8px' }}>
                    {Object.entries(budgets).map(([key, b]) => {
                        const pct = Math.min(100, Math.round((b.current / b.max) * 100)) || 0
                        const isOver = b.current > b.max
                        return (
                            <div key={key} style={{ display: 'flex', justifyContent: 'space-between', fontSize: '10px', fontFamily: UI_TOKENS.font }}>
                                <span style={{ color: isOver ? UI_TOKENS.textAlert : UI_TOKENS.textPrimary }}>
                                    {key}
                                </span>
                                <span style={{ color: isOver ? UI_TOKENS.textAlert : UI_TOKENS.textMuted }}>
                                    {b.current.toLocaleString()} / {b.max.toLocaleString()} ({pct}%)
                                </span>
                            </div>
                        )
                    })}
                </div>

                {topOffender !== 'none' && (
                    <div style={{ fontSize: '9px', color: UI_TOKENS.textWarn, textAlign: 'right', marginTop: '4px' }}>
                        Heaviest Layer: {topOffender}
                    </div>
                )}
            </CollapsibleSection>
        </Panel>
    )
}
