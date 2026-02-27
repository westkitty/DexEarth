import { useDrag } from '@use-gesture/react';
import { useState, useEffect, useRef } from 'react'
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

function TopNavTab({ id, label, color, help, open, onToggle, containerId, isMobile }) {
    return (
        <button
            id={containerId}
            onClick={() => onToggle(id)}
            style={{
                flex: isMobile ? '0 0 auto' : 1,
                textAlign: 'center',
                background: open ? `rgba(0, 255, 159, 0.15)` : 'rgba(10, 15, 20, 0.6)',
                backdropFilter: 'blur(8px)',
                border: `1px solid ${open ? color : 'rgba(255,255,255,0.1)'}`,
                borderBottom: open ? 'none' : `1px solid rgba(255,255,255,0.1)`,
                color: open ? color : '#AAA',
                fontFamily: 'monospace',
                fontSize: isMobile ? '9px' : '10px',
                cursor: 'pointer',
                padding: isMobile ? '7px 8px' : '8px 4px',
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

const MINIMIZE_TRANS_MS = 240
const MINIMIZE_EASE = 'cubic-bezier(0.25, 0.9, 0.3, 1)'
const MOBILE_BREAKPOINT = 768
const computeNavWidth = () => Math.max(300, Math.min(650, window.innerWidth - 16))

export default function PhaseIIRoot({ viewer, toggles, handleToggle, layerStatus, telemetry, utc }) {
    const [openSections, setOpenSections] = useState({ data: true })
    const [demoActive, setDemoActive] = useState(false)
    const [isFullscreen, setIsFullscreen] = useState(false)
    const [isMinimized, setIsMinimized] = useState(false)
    const [hudScale, setHudScale] = useState(1)
    const [hudOpacity, setHudOpacity] = useState(1)
    const [navWidth, setNavWidth] = useState(() => computeNavWidth())
    const [isMobile, setIsMobile] = useState(() => window.innerWidth < MOBILE_BREAKPOINT)
    const [mobileMenuOpen, setMobileMenuOpen] = useState(false)
    const animateTimerRef = useRef(null)

    // Free-floating Drag State (Default bottom center)
    const [pos, setPos] = useState(() => ({ x: (window.innerWidth - computeNavWidth()) / 2, y: 32 }))

    const bindDrag = useDrag((params) => {
        setPos({
            x: params.offset[0],
            y: params.offset[1]
        })
    }, {
        from: () => [pos.x, pos.y],
        bounds: { left: 12, top: 12, right: Math.max(12, window.innerWidth - navWidth - 12), bottom: window.innerHeight - 60 }
    })

    // Determine if drawer drops UP or DOWN based on Y position (if in top half, drop down)
    const dropsDown = pos.y < window.innerHeight / 2

    // Listen for external fullscreen exits (e.g. hitting ESC)
    useEffect(() => {
        const handleFsChange = () => setIsFullscreen(!!document.fullscreenElement)
        document.addEventListener('fullscreenchange', handleFsChange)
        return () => document.removeEventListener('fullscreenchange', handleFsChange)
    }, [])

    // Recompute nav width and clamp position on resize for mobile
    /* eslint-disable react-hooks/set-state-in-effect */
    useEffect(() => {
        const clampPos = (prev, width) => ({
            x: Math.min(Math.max(prev.x, 12), Math.max(12, window.innerWidth - width - 12)),
            y: Math.min(Math.max(prev.y, 12), window.innerHeight - 180)
        })
        const onResize = () => {
            const nextWidth = computeNavWidth()
            setNavWidth(nextWidth)
            setIsMobile(window.innerWidth < MOBILE_BREAKPOINT)
            setPos(prev => clampPos(prev, nextWidth))
        }
        const nextWidth = computeNavWidth()
        setNavWidth(nextWidth)
        setIsMobile(window.innerWidth < MOBILE_BREAKPOINT)
        setPos(prev => clampPos(prev, nextWidth))
        window.addEventListener('resize', onResize)
        return () => window.removeEventListener('resize', onResize)
    }, [])
    /* eslint-enable react-hooks/set-state-in-effect */

    // Inject a gentle pulse for the minimized restore pill (only once)
    useEffect(() => {
        const existing = document.getElementById('dex-restore-pulse')
        if (existing) return
        const styleEl = document.createElement('style')
        styleEl.id = 'dex-restore-pulse'
        styleEl.textContent = `@keyframes dexRestorePulse { 0% { box-shadow: 0 0 10px rgba(0,207,255,0.25); } 50% { box-shadow: 0 0 22px rgba(0,255,159,0.5); } 100% { box-shadow: 0 0 10px rgba(0,207,255,0.25); } }`
        document.head.appendChild(styleEl)
    }, [])

    useEffect(() => () => {
        if (animateTimerRef.current) clearTimeout(animateTimerRef.current)
    }, [])

    function toggleFullscreen() {
        const doc = window.document;
        const docEl = doc.documentElement;

        const requestFullScreen = docEl.requestFullscreen || docEl.mozRequestFullScreen || docEl.webkitRequestFullScreen || docEl.msRequestFullscreen;
        const cancelFullScreen = doc.exitFullscreen || doc.mozCancelFullScreen || doc.webkitExitFullscreen || doc.msExitFullscreen;

        if (!doc.fullscreenElement && !doc.mozFullScreenElement && !doc.webkitFullscreenElement && !doc.msFullscreenElement) {
            requestFullScreen?.call(docEl).catch(err => console.error(err));
        } else {
            cancelFullScreen?.call(doc).catch(err => console.error(err));
        }
    }

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

    // Expose toggleSection globally so the onboarding tour can trigger it
    useEffect(() => {
        window.__dexearth_toggle_section = toggleSection;
        window.__dexearth_open_sections = openSections;
        return () => {
            delete window.__dexearth_toggle_section;
            delete window.__dexearth_open_sections;
        }
    }, [openSections])

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
                padding: '8px 12px', marginBottom: '4px', background: 'transparent',
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

    const responsiveScale = window.innerWidth < 520 ? 0.94 : 1

    return (
        <>
            {/* ── Main HUD (Hidden when minimized) ── */}
            {!isMinimized && (
                <div style={{
                    position: 'fixed',
                    left: isMobile ? 8 : pos.x,
                    top: isMobile ? 12 : pos.y,
                    zIndex: 100,
                    display: 'flex',
                    flexDirection: dropsDown ? 'column' : 'column-reverse',
                    pointerEvents: 'none', // Let clicks pass through the container wrapper
                    width: `${navWidth}px`,
                    transition: `transform ${MINIMIZE_TRANS_MS}ms ${MINIMIZE_EASE}, opacity ${MINIMIZE_TRANS_MS}ms ${MINIMIZE_EASE}`,
                    transform: `scale(${hudScale * responsiveScale})`,
                    opacity: hudOpacity,
                }}>
                    {/* Drag Handle & Phase II header */}
                    <div
                        id="tour-drag-handle"
                        {...(isMobile ? {} : bindDrag())}
                        style={{
                            fontFamily: 'monospace', fontSize: '9px', color: '#00FF9F88', letterSpacing: '0.15em',
                            padding: '3px 8px 6px',
                            display: 'flex', justifyContent: 'space-between', alignItems: 'center',
                            pointerEvents: 'auto',
                            cursor: isMobile ? 'default' : 'grab',
                            background: 'linear-gradient(90deg, transparent, rgba(0,255,159,0.05) 50%, transparent)',
                            borderTop: dropsDown ? '1px solid rgba(0,255,159,0.1)' : 'none',
                            borderBottom: !dropsDown ? '1px solid rgba(0,255,159,0.1)' : 'none',
                            touchAction: 'none'
                        }}>
                        <div style={{ display: 'flex', gap: '8px', alignItems: 'center' }}>
                            <span style={{ cursor: 'pointer' }} title="Drag to move Navigation Bar">☷ DEXEARTH NAV</span>
                            <button onClick={() => {
                                if (animateTimerRef.current) clearTimeout(animateTimerRef.current)
                                setHudScale(0.25)
                                setHudOpacity(0)
                                animateTimerRef.current = setTimeout(() => {
                                    setIsMinimized(true)
                                }, MINIMIZE_TRANS_MS)
                            }} style={{
                                background: 'transparent', border: '1px solid #00FF9F44', color: '#00FF9F88',
                                fontFamily: 'monospace', fontSize: '9px', cursor: 'pointer', padding: '1px 6px', borderRadius: '2px',
                            }} title="Minimize HUD">
                                _
                            </button>
                            <button onClick={toggleFullscreen} style={{
                                background: 'transparent', border: '1px solid #00FF9F44', color: '#00FF9F88',
                                fontFamily: 'monospace', fontSize: '9px', cursor: 'pointer', padding: '1px 4px', borderRadius: '2px',
                            }} title="Toggle Fullscreen">
                                {isFullscreen ? '⤓' : '⤢'}
                            </button>
                        </div>
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
                    {!isMobile && (
                        <div style={{
                            display: 'flex',
                            gap: '2px',
                            pointerEvents: 'auto',
                            flexWrap: 'wrap',
                            justifyContent: 'center'
                        }}>
                            {SECTIONS.map(sec => (
                                <TopNavTab
                                    key={sec.id}
                                    id={sec.id}
                                    containerId={`tour-tab-${sec.id}`}
                                    label={sec.label} color={sec.color} help={sec.help}
                                    open={!!openSections[sec.id]}
                                    onToggle={toggleSection}
                                    isMobile={false}
                                />
                            ))}
                        </div>
                    )}

                    {isMobile && (
                        <div style={{ display: 'flex', gap: '6px', alignItems: 'center', pointerEvents: 'auto' }}>
                            <button
                                onClick={() => setMobileMenuOpen(v => !v)}
                                style={{
                                    background: 'rgba(10,15,20,0.85)',
                                    border: '1px solid rgba(0,255,159,0.35)',
                                    color: '#00FF9F',
                                    fontFamily: 'monospace',
                                    fontSize: '11px',
                                    cursor: 'pointer',
                                    padding: '6px 10px',
                                    borderRadius: '4px',
                                    letterSpacing: '0.08em'
                                }}
                            >
                                {mobileMenuOpen ? 'Close Panels' : 'Open Panels'}
                            </button>
                        </div>
                    )}

                    {/* Drop-down Glassmorphic Pane */}
                    {activeSection && (
                        <div className="drawer-pane" style={{
                            background: 'rgba(10, 15, 20, 0.75)',
                            backdropFilter: 'blur(16px)',
                            WebkitBackdropFilter: 'blur(16px)',
                            border: `1px solid ${activeSection.color}`,
                            // Dynamic borders depending on drop direction
                            borderTop: dropsDown ? 'none' : `1px solid ${activeSection.color}`,
                            borderBottom: dropsDown ? `1px solid ${activeSection.color}` : 'none',
                            borderBottomLeftRadius: dropsDown ? '6px' : '0px',
                            borderBottomRightRadius: dropsDown ? '6px' : '0px',
                            borderTopLeftRadius: !dropsDown ? '6px' : '0px',
                            borderTopRightRadius: !dropsDown ? '6px' : '0px',
                            padding: '16px',
                            color: '#FFF',
                            pointerEvents: 'auto',
                            boxShadow: dropsDown ? '0 8px 32px rgba(0,0,0,0.5)' : '0 -8px 32px rgba(0,0,0,0.5)',
                            height: '360px', /* Uniform pane size matching Log section */
                            overflowY: 'auto',
                            position: 'relative',
                            transition: 'all 150ms ease',
                            transformOrigin: dropsDown ? 'top center' : 'bottom center'
                        }}>
                            {/* Static Watermark Background (Rendered centrally for consistent alignment) */}
                            {activeSection && (
                                <img
                                    src={{
                                        data: '/DexEarthLogo.png',
                                        time: '/assets/DexEarth_icon_time.png',
                                        satellites: '/assets/DexEarth_icon_satellites.png',
                                        seismic: '/assets/DexEarth_icon_seismic.png',
                                        views: '/assets/DexEarth_icon_views.png',
                                        threat: '/assets/DexEarth_icon_threat.png',
                                        perf: '/assets/DexEarth_icon_performance.png',
                                        datasets: '/assets/DexEarth_icon_datasets.png',
                                        audit: '/assets/DexEarth_icon_logs.png',
                                        help: '/assets/DexEarth_icon_help.png',
                                        visuals: '/assets/DexEarth_icon_visuals.png'
                                    }[activeSection.id] || '/DexEarthLogo.png'}
                                    alt=""
                                    style={{
                                        position: 'absolute',
                                        top: '50%',
                                        left: '50%',
                                        width: '200px',
                                        height: '200px',
                                        objectFit: 'contain',
                                        transform: 'translate(-50%, -50%)',
                                        opacity: 0.3,
                                        pointerEvents: 'none',
                                        zIndex: 0,
                                        mixBlendMode: activeSection.id === 'data' ? 'screen' : 'normal',
                                    }}
                                />
                            )}

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

                    {isMobile && mobileMenuOpen && (
                        <div style={{
                            position: 'absolute',
                            top: dropsDown ? '62px' : undefined,
                            bottom: dropsDown ? undefined : '62px',
                            left: 0,
                            right: 0,
                            background: 'rgba(8, 12, 16, 0.95)',
                            border: '1px solid rgba(0,255,159,0.3)',
                            borderRadius: '6px',
                            padding: '10px',
                            color: '#FFF',
                            zIndex: 105,
                            maxHeight: '60vh',
                            overflowY: 'auto',
                        }}>
                            <div style={{ display: 'grid', gap: '6px' }}>
                                {SECTIONS.map(sec => (
                                    <button
                                        key={sec.id}
                                        onClick={() => {
                                            setOpenSections({ [sec.id]: true })
                                            setMobileMenuOpen(false)
                                        }}
                                        style={{
                                            textAlign: 'left',
                                            background: openSections[sec.id] ? 'rgba(0,255,159,0.1)' : 'rgba(255,255,255,0.05)',
                                            border: `1px solid ${openSections[sec.id] ? sec.color : 'rgba(255,255,255,0.1)'}`,
                                            color: openSections[sec.id] ? sec.color : '#EEE',
                                            fontFamily: 'monospace',
                                            fontSize: '12px',
                                            padding: '8px 10px',
                                            borderRadius: '4px',
                                            display: 'flex',
                                            alignItems: 'center',
                                            justifyContent: 'space-between',
                                            gap: '8px',
                                            cursor: 'pointer',
                                        }}
                                    >
                                        <span>{sec.label}</span>
                                        <span style={{ fontSize: '10px', color: '#888' }}>Open</span>
                                    </button>
                                ))}
                            </div>
                        </div>
                    )}
                </div>
            )}

            {/* ── Minimized Restore Button ── */}
            {isMinimized && (
                <button
                    onClick={() => {
                        if (animateTimerRef.current) clearTimeout(animateTimerRef.current)
                        setIsMinimized(false)
                        setHudScale(0.4)
                        setHudOpacity(0)
                        requestAnimationFrame(() => {
                            setHudScale(1)
                            setHudOpacity(1)
                        })
                    }}
                    style={{
                        position: 'fixed',
                        bottom: '24px',
                        left: '80px', // Next to Warp Home
                        width: '46px',
                        height: '46px',
                        borderRadius: '50%',
                        background: 'linear-gradient(135deg, rgba(0,207,255,0.22), rgba(0,255,159,0.18))',
                        border: '1px solid rgba(0, 207, 255, 0.45)',
                        cursor: 'pointer',
                        zIndex: 100,
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'center',
                        boxShadow: '0 0 16px rgba(0, 207, 255, 0.35)',
                        backdropFilter: 'blur(10px)',
                        transition: 'transform 150ms ease, box-shadow 150ms ease, filter 150ms ease',
                        animation: 'dexRestorePulse 1800ms ease-in-out infinite',
                    }}
                    title="Restore HUD"
                    onMouseEnter={e => {
                        e.currentTarget.style.transform = 'scale(1.05)'
                        e.currentTarget.style.boxShadow = '0 0 20px rgba(0, 255, 159, 0.45)'
                        e.currentTarget.style.filter = 'saturate(1.2)'
                    }}
                    onMouseLeave={e => {
                        e.currentTarget.style.transform = 'scale(1)'
                        e.currentTarget.style.boxShadow = '0 0 16px rgba(0, 207, 255, 0.35)'
                        e.currentTarget.style.filter = 'saturate(1)'
                    }}
                >
                    <img
                        src="/DexEarthLogo.png"
                        alt="Logo"
                        style={{ width: '28px', height: 'auto', objectFit: 'contain', opacity: 0.9 }}
                    />
                </button>
            )}

            {/* Visuals Root acts as global injection handler */}
            <div style={{ display: 'none' }}>
                <VisualsRoot viewer={viewer} />
            </div>

            <div id="tour-target-warp-home">
                <WarpHome viewer={viewer} />
            </div>
        </>
    )
}
