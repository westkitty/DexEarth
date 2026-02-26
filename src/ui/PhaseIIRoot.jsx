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
import { LAYER_DEFS } from '../config.js'

const SECTIONS = [
    { id: 'data', label: '🌐 Data Layers', color: '#00FF9F', help: 'Toggle primary tactical data layers including planes, shipping, and raw seismic events.' },
    { id: 'time', label: '🕰 Time & Orbit', color: '#00CFFF', help: 'Control playback speed, time sync, and evaluate orbital cascades based on Julian dates.' },
    { id: 'satellites', label: '🛰 Satellites', color: '#00FF9F', help: 'Render real-time LEO satellites using offline SGP4 propagation from embedded TLE files.' },
    { id: 'seismic', label: '🌋 Seismic', color: '#FF8800', help: 'Track recent global seismic events and tectonic boundaries.' },
    { id: 'views', label: '📸 Views', color: '#AAFFAA', help: 'Save and manage scenario snapshots. Export offline views for later tactical reconstruction.' },
    { id: 'datasets', label: '📦 Datasets', color: '#00CFFF', help: 'Audit the staleness of data layers and manually override or cache them locally.' },
    { id: 'threat', label: '◉ Threat', color: '#FF2200', help: 'Algorithmic threat analysis overlay. Evaluates current geography against threat heuristics.' },
    { id: 'perf', label: '📊 Perf', color: '#FFFF00', help: 'Performance Governance. View system budgets and FPS. Automatically triggers Safe Mode if framerate drops.' },
    { id: 'audit', label: '📄 Log', color: '#AAAAAA', help: 'Rolling system audit log tracking layer toggles, errors, UI actions, and performance events.' },
    { id: 'help', label: 'ℹ️ Help', color: '#00FF9F', help: 'Access the Operator Manual.' },
    { id: 'visuals', label: '🎨 Visuals', color: '#FF00FF', help: 'Manage global render styles, procedural cloud systems, and country boundary overlays.' },
]

function TopNavTab({ id, label, color, help, open, onToggle }) {
    return (
        <button
            onClick={() => onToggle(id)}
            style={{
                flex: 1,
                textAlign: 'center',
                background: open ? `rgba(0, 255, 159, 0.15)` : 'rgba(10, 15, 20, 0.6)',
                backdropFilter: 'blur(8px)',
                border: `1px solid ${open ? color : 'rgba(255,255,255,0.1)'}`,
                borderBottom: open ? 'none' : `1px solid rgba(255,255,255,0.1)`,
                color: open ? color : '#AAA',
                fontFamily: 'monospace',
                fontSize: '10px',
                cursor: 'pointer',
                padding: '8px 4px',
                letterSpacing: '0.05em',
                transition: 'all 150ms ease',
                whiteSpace: 'nowrap',
                overflow: 'hidden',
                textOverflow: 'ellipsis',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                gap: '4px',
                borderTopLeftRadius: '4px',
                borderTopRightRadius: '4px',
            }}
            title={label}
        >
            <span>{label.split(' ')[0]}</span>
            {open && help && (
                <span onClick={(e) => e.stopPropagation()} style={{ cursor: 'default' }}>
                    <InfoPopover content={help} />
                </span>
            )}
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

export default function PhaseIIRoot({ viewer, toggles, handleToggle, layerStatus, telemetry, utc }) {
    const [openSections, setOpenSections] = useState({ data: true })
    const [demoActive, setDemoActive] = useState(false)

    function toggleSection(id) {
        // Exclusive accordion behavior for Drawers: closing everything else
        setOpenSections(prev => {
            const isCurrentlyOpen = !!prev[id];
            return isCurrentlyOpen ? {} : { [id]: true };
        })
    }

    async function handleDemo() {
        if (!demoActive && viewer) {
            setDemoActive(true)
            await runDemoMode(viewer)
        }
    }

    if (!viewer) return null

    // Helper to render layer row manually inside the drawer since we removed it from App.jsx
    const renderLayerRow = (def) => {
        const count = telemetry ? telemetry[def.id] : 0
        const statusClass = layerStatus ? layerStatus[def.id] : 'idle'
        const isToggled = toggles ? toggles[def.id] : false
        
        const countLabel = statusClass === 'error'
            ? 'UNAVAILABLE'
            : typeof count === 'string' && count.length > 0
                ? count
                : `${(typeof count === 'number' ? count : 0).toLocaleString()} pts`

        return (
            <label key={def.id} style={{
                display: 'flex', alignItems: 'center', justifyContent: 'space-between',
                padding: '8px 12px', marginBottom: '4px', background: 'rgba(0,0,0,0.4)',
                borderRadius: '4px', border: '1px solid rgba(255,255,255,0.05)',
                cursor: 'pointer', pointerEvents: 'auto'
            }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                    <div style={{
                        width: '8px', height: '8px', borderRadius: '50%',
                        background: statusClass === 'active' ? '#00FF9F' : (statusClass === 'loading' ? '#FFD700' : (statusClass === 'error' ? '#FF4444' : '#555')),
                        boxShadow: statusClass === 'active' ? '0 0 8px #00FF9F' : 'none'
                    }} />
                    <span style={{ fontSize: '11px', color: isToggled ? '#00FF9F' : '#CCC', fontFamily: 'monospace' }}>
                        {def.label}
                    </span>
                </div>
                <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
                    <span style={{ fontSize: '10px', color: '#888', fontFamily: 'monospace' }}>{countLabel}</span>
                    <input 
                        type="checkbox" 
                        checked={isToggled} 
                        onChange={() => handleToggle && handleToggle(def.id)}
                        style={{ accentColor: '#00FF9F', cursor: 'pointer' }}
                    />
                </div>
            </label>
        )
    }

    const activeSection = SECTIONS.find(s => openSections[s.id])

    return (
        <>
            <div style={{
                position: 'fixed',
                top: '16px',
                left: 'max(320px, 30vw)',
                right: '32px',
                zIndex: 100,
                display: 'flex',
                flexDirection: 'column',
                pointerEvents: 'none', // Let clicks pass through the container
            }}>
                {/* Phase II header / Demo Trigger */}
                <div style={{
                    fontFamily: 'monospace', fontSize: '9px', color: '#00FF9F88', letterSpacing: '0.15em',
                    padding: '3px 8px 6px',
                    display: 'flex', justifyContent: 'flex-end', alignItems: 'center',
                    pointerEvents: 'auto',
                }}>
                    {!demoActive && (
                        <button onClick={handleDemo} style={{
                            background: 'rgba(10,15,20,0.8)', border: '1px solid #00FF9F44', color: '#00FF9F88',
                            fontFamily: 'monospace', fontSize: '9px', cursor: 'pointer', padding: '2px 8px', borderRadius: '2px',
                            backdropFilter: 'blur(4px)'
                        }}>
                            INITIATE DEMO SEQUENCE
                        </button>
                    )}
                </div>

                {/* Top Navigation Tabs */}
                <div style={{
                    display: 'flex',
                    gap: '2px',
                    pointerEvents: 'auto',
                }}>
                    {SECTIONS.map(sec => (
                        <TopNavTab
                            key={sec.id}
                            id={sec.id} label={sec.label} color={sec.color} help={sec.help}
                            open={!!openSections[sec.id]}
                            onToggle={toggleSection}
                        />
                    ))}
                </div>

                {/* Drop-down Glassmorphic Pane */}
                {activeSection && (
                    <div className="drawer-pane" style={{
                        background: 'rgba(10, 15, 20, 0.75)',
                        backdropFilter: 'blur(16px)',
                        WebkitBackdropFilter: 'blur(16px)',
                        border: `1px solid ${activeSection.color}`,
                        borderTop: 'none',
                        borderBottomLeftRadius: '6px',
                        borderBottomRightRadius: '6px',
                        padding: '16px',
                        color: '#FFF',
                        pointerEvents: 'auto',
                        boxShadow: '0 8px 32px rgba(0,0,0,0.5)',
                        overflowY: 'auto',
                        maxHeight: 'calc(100vh - 120px)',
                        position: 'relative',
                        transition: 'all 150ms ease',
                    }}>
                        {/* Static Watermark Background */}
                        <img
                            src="/DexEarthLogo.png"
                            alt=""
                            style={{
                                position: 'absolute',
                                top: '50%',
                                left: '50%',
                                width: '300px',
                                height: 'auto',
                                transform: 'translate(-50%, -50%)',
                                opacity: 0.3,
                                pointerEvents: 'none',
                                zIndex: 0,
                                mixBlendMode: 'screen',
                            }}
                        />

                        {/* Pane Content Container */}
                        <div style={{ position: 'relative', zIndex: 1 }}>
                            {SECTIONS.map(sec => {
                                if (!openSections[sec.id]) return null;
                                return (
                                    <div key={sec.id}>
                                        <div style={{ marginBottom: '12px', paddingBottom: '8px', borderBottom: `1px solid ${sec.color}44`, display: 'flex', justifyContent: 'space-between' }}>
                                            <h2 style={{ margin: 0, fontSize: '14px', fontFamily: 'monospace', color: sec.color, letterSpacing: '0.1em' }}>
                                                {sec.label.toUpperCase()}
                                            </h2>
                                            {/* Inject clock into Data and Time panels for visibility */}
                                            {(sec.id === 'data' || sec.id === 'time') && utc && (
                                                <span style={{ fontSize: '11px', color: '#888', fontFamily: 'monospace' }}>{utc}</span>
                                            )}
                                        </div>
                                        {sec.id === 'data' && (
                                            <div style={{ display: 'flex', flexDirection: 'column', gap: '2px' }}>
                                                {LAYER_DEFS.map(renderLayerRow)}
                                            </div>
                                        )}
                                        {sec.id === 'time' && <TimeControllerPanel viewer={viewer} />}
                                        {sec.id === 'satellites' && <SatellitesPanel viewer={viewer} />}
                                        {sec.id === 'seismic' && <SeismicSimPanel viewer={viewer} />}
                                        {sec.id === 'views' && <SavedViewsPanel viewer={viewer} toggles={toggles} />}
                                        {sec.id === 'threat' && <ThreatIndexPanel viewer={viewer} />}
                                        {sec.id === 'perf' && <PerformancePanel viewer={viewer} />}
                                        {sec.id === 'datasets' && <DatasetManagerPanel />}
                                        {sec.id === 'audit' && <AuditLogPanel />}
                                        {sec.id === 'help' && <HelpPanel />}
                                        {sec.id === 'visuals' && <VisualsRoot viewer={viewer} />}
                                    </div>
                                )
                            })}
                        </div>
                    </div>
                )}
            </div>

            {/* Visuals Root needs to be moved into the SECTIONS array for the new drawer paradigm.
                For now we'll inject it as an invisible host if no tabs are open just to maintain lifecycle,
                but ideally it gets its own tab. */}
            <div style={{ display: 'none' }}>
                <VisualsRoot viewer={viewer} />
            </div>

            <WarpHome viewer={viewer} />
        </>
    )
}
