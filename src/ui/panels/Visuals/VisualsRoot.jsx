// ─── Visuals Root ─────────────────────────────────────────────────────────────
// Collapsible wrapper combining Overlays and Styles panels.
import { useState, useEffect } from 'react'
import OverlaysPanel from './OverlaysPanel.jsx'
import StylesPanel from './StylesPanel.jsx'
import { init as initStyleManager } from '../../../visuals/styleManager.js'

const ACCENT = '#AAFFCC'

const S = {
    sectionBtn: (open) => ({
        display: 'block', width: '100%', textAlign: 'left',
        background: open ? `${ACCENT}11` : 'transparent',
        border: 'none', borderBottom: `1px solid ${ACCENT}22`,
        color: ACCENT, fontFamily: 'monospace', fontSize: '10px',
        cursor: 'pointer', padding: '4px 8px', letterSpacing: '0.05em',
    }),
}

export default function VisualsRoot({ viewer }) {
    const [openSection, setOpenSection] = useState(null)

    // Initialize style manager once viewer is available
    useEffect(() => {
        if (viewer) initStyleManager(viewer)
    }, [viewer])

    if (!viewer) return null

    const toggle = (id) => setOpenSection(prev => prev === id ? null : id)

    return (
        <div style={{ borderTop: '2px solid #AAFFCC33', marginTop: '8px', paddingTop: '4px', position: 'relative' }}>
            <div style={{ position: 'relative', zIndex: 1 }}>
                <div style={{
                    fontFamily: 'monospace', fontSize: '9px', color: '#AAFFCC88',
                    letterSpacing: '0.15em', padding: '3px 0 6px',
                }}>
                    PHASE III // VISUALS + OVERLAYS
                </div>

                {/* Overlays section */}
                <button style={S.sectionBtn(openSection === 'overlays')} onClick={() => toggle('overlays')}>
                    {openSection === 'overlays' ? '▼' : '▶'} 🌐 Overlays
                </button>
                {openSection === 'overlays' && (
                    <div style={{ paddingLeft: '4px' }}>
                        <OverlaysPanel viewer={viewer} />
                    </div>
                )}

                {/* Styles section */}
                <button style={S.sectionBtn(openSection === 'styles')} onClick={() => toggle('styles')}>
                    {openSection === 'styles' ? '▼' : '▶'} 🎨 Render Style
                </button>
                {openSection === 'styles' && (
                    <div style={{ paddingLeft: '4px' }}>
                        <StylesPanel viewer={viewer} />
                    </div>
                )}
            </div>
        </div>
    )
}
