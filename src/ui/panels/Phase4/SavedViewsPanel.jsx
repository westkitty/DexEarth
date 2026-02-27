import { useState, useEffect } from 'react'
import { Panel, CollapsibleSection, Button, UI_TOKENS } from '../../components/core.jsx'
import { subscribeViewStore, saveView, deleteView } from '../../../state/viewStore.js'
import ScenarioPanel from './ScenarioPanel.jsx'

export default function SavedViewsPanel({ viewer, toggles }) {
    const [views, setViews] = useState({})
    const [editing, setEditing] = useState(null)
    const [editName, setEditName] = useState('')

    useEffect(() => {
        return subscribeViewStore((state) => {
            setViews(state.savedViews)
        })
    }, [])

    const handleSaveCurrent = async (slot) => {
        if (!viewer) return

        const cam = {
            position: viewer.camera.positionCartographic.clone(),
            heading: viewer.camera.heading,
            pitch: viewer.camera.pitch,
            roll: viewer.camera.roll
        }

        const activeLayers = Object.entries(toggles || {})
            .filter(([, isActive]) => isActive)
            .map(([id]) => id)

        await saveView(slot, `View ${slot}`, cam, activeLayers)
    }

    const handleDelete = async (slot) => {
        if (confirm(`Delete Saved View ${slot}?`)) {
            await deleteView(slot)
        }
    }

    const startEdit = (slot, currentName) => {
        setEditing(slot)
        setEditName(currentName)
    }

    const saveEdit = async (slot, cam, layers) => {
        if (editName.trim()) {
            await saveView(slot, editName.trim(), cam, layers)
        }
        setEditing(null)
    }

    // Keyboard dispatch is handled in App.jsx, but we provide buttons here too
    const handleLoad = (slot) => {
        // We dispatch a synthetic keyboard event to piggyback on App.jsx's robust loader
        // which already has access to all the layer deactivation/activation dependencies.
        const ev = new KeyboardEvent('keydown', {
            key: slot,
            code: `Digit${slot}`,
            altKey: true,
            shiftKey: false,
            bubbles: true
        })
        window.dispatchEvent(ev)
    }

    return (
        <Panel style={{ position: 'relative' }}>
            <img
                src="/assets/DexEarth_icon_views.png"
                style={{ position: 'absolute', top: '50%', left: '50%', transform: 'translate(-50%, -50%)', opacity: 0.3, pointerEvents: 'none', width: '200px', height: '200px', objectFit: 'contain', zIndex: 0 }}
                alt=""
            />
            <div style={{ position: 'relative', zIndex: 1 }}>
                <CollapsibleSection title="📸 Saved Views" defaultOpen={false}>
                    <div style={{ color: UI_TOKENS.textSecondary, fontSize: '10px', marginBottom: '8px' }}>
                        Keyboard: <kbd style={{ background: '#333', padding: '1px 3px', borderRadius: '2px' }}>Alt+1..9</kbd> to load, <kbd style={{ background: '#333', padding: '1px 3px', borderRadius: '2px' }}>Shift+Alt+1..9</kbd> to save.
                    </div>

                    <div style={{ display: 'flex', flexDirection: 'column', gap: '4px' }}>
                        {[1, 2, 3, 4, 5, 6, 7, 8, 9].map(slot => {
                            const saved = views[String(slot)]
                            const isEditing = editing === String(slot)

                            return (
                                <div key={slot} style={{
                                    display: 'flex', alignItems: 'center', justifyContent: 'space-between',
                                    padding: '4px 6px',
                                    background: saved ? 'rgba(0, 207, 255, 0.05)' : 'rgba(255, 255, 255, 0.02)',
                                    border: `1px solid ${saved ? 'rgba(0, 207, 255, 0.2)' : 'rgba(255, 255, 255, 0.05)'}`,
                                    borderRadius: '4px'
                                }}>
                                    <div style={{ display: 'flex', alignItems: 'center', gap: '8px', flex: 1 }}>
                                        <span style={{ fontSize: '12px', fontWeight: 'bold', color: saved ? UI_TOKENS.textPrimary : UI_TOKENS.textMuted }}>
                                            {slot}
                                        </span>

                                        {isEditing ? (
                                            <input
                                                type="text"
                                                value={editName}
                                                onChange={e => setEditName(e.target.value)}
                                                onKeyDown={e => e.key === 'Enter' && saveEdit(String(slot), saved.camera, saved.layers)}
                                                onBlur={() => saveEdit(String(slot), saved.camera, saved.layers)}
                                                autoFocus
                                                style={{
                                                    background: 'rgba(0,0,0,0.5)', border: `1px solid ${UI_TOKENS.primary}`,
                                                    color: UI_TOKENS.textPrimary, fontSize: '11px', padding: '2px 4px',
                                                    flex: 1, outline: 'none'
                                                }}
                                            />
                                        ) : (
                                            <div
                                                onClick={() => saved ? handleLoad(String(slot)) : handleSaveCurrent(String(slot))}
                                                style={{
                                                    flex: 1, fontSize: '11px', color: saved ? UI_TOKENS.textPrimary : UI_TOKENS.textMuted,
                                                    cursor: 'pointer'
                                                }}
                                                title={saved ? 'Click to load view' : 'Click to save current view'}
                                            >
                                                {saved ? saved.name : 'Empty Slot'}
                                                {saved && (
                                                    <div style={{ fontSize: '9px', color: UI_TOKENS.textSecondary }}>
                                                        {(saved.layers || []).length} layers active
                                                    </div>
                                                )}
                                            </div>
                                        )}
                                    </div>

                                    <div style={{ display: 'flex', gap: '4px' }}>
                                        {saved ? (
                                            <>
                                                <Button variant="neutral" onClick={() => startEdit(String(slot), saved.name)} style={{ padding: '2px 6px', fontSize: '9px' }}>✎</Button>
                                                <Button variant="danger" onClick={() => handleDelete(String(slot))} style={{ padding: '2px 6px', fontSize: '9px' }}>✕</Button>
                                            </>
                                        ) : (
                                            <Button variant="primary" onClick={() => handleSaveCurrent(String(slot))} style={{ padding: '2px 6px', fontSize: '9px' }}>SAVE</Button>
                                        )}
                                    </div>
                                </div>
                            )
                        })}
                    </div>
                </CollapsibleSection>

                {/* Scenario Hub */}
                <ScenarioPanel viewer={viewer} toggles={toggles} />
            </div>
        </Panel>
    )
}
