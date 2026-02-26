import { useState } from 'react'
import TimeControllerPanel from './panels/PhaseII/TimeControllerPanel.jsx'
import SatellitesPanel from './panels/PhaseII/SatellitesPanel.jsx'
import SeismicSimPanel from './panels/PhaseII/SeismicSimPanel.jsx'
import MarkersPanel from './panels/PhaseII/MarkersPanel.jsx'
import AlertsPanel from './panels/PhaseII/AlertsPanel.jsx'
import CascadePanel from './panels/PhaseII/CascadePanel.jsx'
import CorrelationPanel from './panels/PhaseII/CorrelationPanel.jsx'
import ThreatIndexPanel from './panels/PhaseII/ThreatIndexPanel.jsx'
import CinematicPanel from './panels/PhaseII/CinematicPanel.jsx'
import PerformancePanel from './panels/PhaseII/PerformancePanel.jsx'
import AuditLogPanel from './panels/Phase4/AuditLogPanel.jsx'
import DatasetManagerPanel from './panels/Phase4/DatasetManagerPanel.jsx'
import SavedViewsPanel from './panels/Phase4/SavedViewsPanel.jsx'
import HelpPanel from './panels/Phase4/HelpPanel.jsx'
import VisualsRoot from './panels/Visuals/VisualsRoot.jsx'
import WarpHome from './components/WarpHome.jsx'
import { InfoPopover } from './components/core.jsx'

const SECTIONS = [
    { id: 'time', label: '🕰 Time & Orbit', color: '#00CFFF', help: 'Control playback speed, time sync, and evaluate orbital cascades based on Julian dates.' },
    { id: 'satellites', label: '🛰 Satellites', color: '#00FF9F', help: 'Render real-time LEO satellites using offline SGP4 propagation from embedded TLE files.' },
    { id: 'seismic', label: '🌋 Seismic', color: '#FF8800', help: 'Track recent global seismic events and tectonic boundaries.' },
    { id: 'views', label: '📸 Views', color: '#AAFFAA', help: 'Save and manage scenario snapshots. Export offline views for later tactical reconstruction.' },
    { id: 'datasets', label: '📦 Datasets', color: '#00CFFF', help: 'Audit the staleness of data layers and manually override or cache them locally.' },
    { id: 'threat', label: '◉ Threat', color: '#FF2200', help: 'Algorithmic threat analysis overlay. Evaluates current geography against threat heuristics.' },
    { id: 'perf', label: '📊 Perf', color: '#FFFF00', help: 'Performance Governance. View system budgets and FPS. Automatically triggers Safe Mode if framerate drops.' },
    { id: 'audit', label: '📄 Log', color: '#AAAAAA', help: 'Rolling system audit log tracking layer toggles, errors, UI actions, and performance events.' },
    { id: 'help', label: 'ℹ️ Help', color: '#00FF9F', help: 'Access the Operator Manual.' },
]

function SectionToggle({ id, label, color, help, open, onToggle }) {
    return (
        <button
            onClick={() => onToggle(id)}
            style={{
                display: 'block',
                width: '100%',
                textAlign: 'left',
                background: open ? `${color}11` : 'transparent',
                border: 'none',
                borderBottom: `1px solid ${color}22`,
                color,
                fontFamily: 'monospace',
                fontSize: '10px',
                cursor: 'pointer',
                padding: '4px 8px',
                letterSpacing: '0.05em',
            }}
        >
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                <span>{open ? '▼' : '▶'} {label}</span>
                {help && open && (
                    <span onClick={(e) => e.stopPropagation()} style={{ cursor: 'default' }}>
                        <InfoPopover content={help} />
                    </span>
                )}
            </div>
        </button>
    )
}

// ── Demo Mode seed ───────────────────────────────────────────────────────────
async function runDemoMode(viewer) {
    const { markersLayer } = await import('../layers/markers/layer.js')
    const { seismicSimLayer } = await import('../layers/seismicSim/layer.js')
    const { satellitesLayer } = await import('../layers/satellites/layer.js')
    const { cinematicController } = await import('../layers/cinematic/controller.js')

    // Seed markers
    await markersLayer.activate({ viewer })
    await markersLayer.addMarker({ lon: -74.0, lat: 40.7, title: 'Demo: NYC Hub', severity: 'info', tags: ['demo'] })
    await markersLayer.addMarker({ lon: 0.5, lat: 51.5, title: 'Demo: London Cable Landing', severity: 'warning', tags: ['demo'] })
    await markersLayer.addMarker({ lon: 139.6, lat: 35.7, title: 'Demo: Tokyo NOC', severity: 'critical', tags: ['demo'] })

    // Seed seismic event
    seismicSimLayer.activate({ viewer })
    seismicSimLayer.addEvent({ lon: 143.0, lat: 37.5, mag: 7.8, depthKm: 30, originMs: Date.now() - 300_000 })

    // Load satellites
    satellitesLayer.activate({ viewer })

    // Start cinematic tour after 2s
    setTimeout(() => {
        cinematicController.init(viewer)
        cinematicController.play('tectonicFireRing')
    }, 2000)
}

export default function PhaseIIRoot({ viewer, toggles }) {
    const [openSections, setOpenSections] = useState({ time: true, perf: true })
    const [demoActive, setDemoActive] = useState(false)

    function toggleSection(id) {
        setOpenSections(prev => ({ ...prev, [id]: !prev[id] }))
    }

    async function handleDemo() {
        if (!demoActive && viewer) {
            setDemoActive(true)
            await runDemoMode(viewer)
        }
    }

    if (!viewer) return null

    return (
        <>
            <div style={{ borderTop: '2px solid #00FF9F33', marginTop: '8px', paddingTop: '4px' }}>
                {/* Phase II header */}
                <div style={{
                    fontFamily: 'monospace', fontSize: '9px', color: '#00FF9F88', letterSpacing: '0.15em',
                    padding: '3px 0 6px',
                    display: 'flex', justifyContent: 'space-between', alignItems: 'center',
                }}>
                    <span>PHASE II // INTELLIGENCE SUITE</span>
                    {!demoActive && (
                        <button onClick={handleDemo} style={{
                            background: 'transparent', border: '1px solid #00FF9F44', color: '#00FF9F88',
                            fontFamily: 'monospace', fontSize: '9px', cursor: 'pointer', padding: '1px 6px', borderRadius: '2px',
                        }}>
                            DEMO
                        </button>
                    )}
                </div>

                {/* Section toggles */}
                {SECTIONS.map(sec => (
                    <div key={sec.id}>
                        <SectionToggle
                            id={sec.id} label={sec.label} color={sec.color} help={sec.help}
                            open={!!openSections[sec.id]}
                            onToggle={toggleSection}
                        />

                        {openSections[sec.id] && (
                            <div style={{ paddingLeft: '4px' }}>
                                {sec.id === 'time' && <TimeControllerPanel viewer={viewer} />}
                                {sec.id === 'satellites' && <SatellitesPanel viewer={viewer} />}
                                {sec.id === 'seismic' && <SeismicSimPanel viewer={viewer} />}
                                {sec.id === 'views' && <SavedViewsPanel viewer={viewer} toggles={toggles} />}
                                {sec.id === 'threat' && <ThreatIndexPanel viewer={viewer} />}
                                {sec.id === 'perf' && <PerformancePanel viewer={viewer} />}
                                {sec.id === 'datasets' && <DatasetManagerPanel />}
                                {sec.id === 'audit' && <AuditLogPanel />}
                                {sec.id === 'help' && <HelpPanel />}
                            </div>
                        )}
                    </div>
                ))}
                <VisualsRoot viewer={viewer} />
            </div>
            <WarpHome viewer={viewer} />
        </>
    )
}
