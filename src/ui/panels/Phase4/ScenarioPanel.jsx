import { Panel, CollapsibleSection, Button, UI_TOKENS } from '../../components/core.jsx'
import { exportScenario, importScenarioFile } from '../../../storage/exports.js'

export default function ScenarioPanel({ viewer, toggles }) {
    const handleExport = () => {
        const name = prompt('Enter a name for this Scenario Snapshot:', 'Operator_Snapshot')
        if (name) {
            exportScenario(viewer, toggles, name)
        }
    }

    const handleFileChange = async (e) => {
        const file = e.target.files?.[0]
        if (!file) return

        try {
            const scenario = await importScenarioFile(file)

            // Dispatch a global event holding the parsed scenario so App.jsx can load it.
            // Much cleaner than pulling the React setter logic into an external store.
            const ev = new CustomEvent('dexearth:loadScenario', { detail: scenario })
            window.dispatchEvent(ev)
        } catch (err) {
            alert(`Import failed: ${err.message}`)
        }
    }

    return (
        <Panel>
            <CollapsibleSection title="🌍 Scenario Hub" defaultOpen={false}>
                <div style={{ color: UI_TOKENS.textSecondary, fontSize: '10px', marginBottom: '8px' }}>
                    Export current system state as an offline JSON snapshot, or import one to perfectly reconstruct a tactical situation.
                </div>

                <div style={{ display: 'flex', gap: '8px', marginTop: '12px' }}>
                    <Button variant="primary" style={{ flex: 1, padding: '6px' }} onClick={handleExport}>
                        EXPORT SNAPSHOT
                    </Button>
                    <label style={{ flex: 1 }}>
                        <Button
                            variant="neutral"
                            style={{ width: '100%', padding: '6px', pointerEvents: 'none' }}
                        >
                            IMPORT JSON
                        </Button>
                        <input
                            type="file"
                            accept=".json"
                            style={{ display: 'none' }}
                            onChange={handleFileChange}
                        />
                    </label>
                </div>
            </CollapsibleSection>
        </Panel>
    )
}
