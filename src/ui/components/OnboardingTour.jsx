import React, { useState, useEffect, useCallback } from 'react'

const TOUR_STEPS = [
    {
        targetId: 'tour-tab-data',
        title: 'DATA LAYERS',
        content: 'Toggle massive datasets on and off. Switch between borders, thermal anomalies, satellite propagation, and more.'
    },
    {
        targetId: 'tour-tab-time',
        title: 'TIME & ORBIT',
        content: 'Control the simulation clock. Fast-forward through orbital paths or view the solar terminator at any point in the future.'
    },
    {
        targetId: 'tour-tab-satellites',
        title: 'SATELLITE NETWORKS',
        content: 'Observe active low-earth orbit constellations propagating in real-time.'
    },
    {
        targetId: 'tour-tab-visuals',
        title: 'RENDER STYLES',
        content: 'Swap between realistic visualization, thermal imaging, and tactical wireframe modes instantly.'
    }
]

export default function OnboardingTour() {
    const [tourActive, setTourActive] = useState(false)
    const [stepIndex, setStepIndex] = useState(-1)
    const [modalPos, setModalPos] = useState({ top: '50%', left: '50%', transform: 'translate(-50%, -50%)', opacity: 0 })

    const updateModalPosition = useCallback(() => {
        if (stepIndex === -1) {
            // Welcome screen - center
            setModalPos({ top: '50%', left: '50%', transform: 'translate(-50%, -50%)', opacity: 1 })
            return
        }

        const step = TOUR_STEPS[stepIndex]
        if (!step) return

        const el = document.getElementById(step.targetId)
        if (el) {
            const rect = el.getBoundingClientRect()
            // Position modal below the target
            setModalPos({
                top: `${rect.bottom + 20}px`,
                left: `${rect.left + rect.width / 2}px`,
                transform: 'translateX(-50%)',
                opacity: 1
            })
            // Ensure the element is visible with a slight pulse
            el.style.animation = 'none'
            void el.offsetWidth // trigger reflow
            el.animate([
                { boxShadow: '0 0 0px #00FF9F' },
                { boxShadow: '0 0 20px #00FF9F' },
                { boxShadow: '0 0 0px #00FF9F' }
            ], { duration: 1500, iterations: Infinity })
        } else {
            // Fallback if element not found
            setModalPos({ top: '50%', left: '50%', transform: 'translate(-50%, -50%)', opacity: 1 })
        }
    }, [stepIndex])

    // Add resize listener to reposition modal
    useEffect(() => {
        const handleResize = () => {
            if (tourActive && stepIndex >= 0) {
                updateModalPosition()
            }
        }
        window.addEventListener('resize', handleResize)
        return () => window.removeEventListener('resize', handleResize)
    }, [tourActive, stepIndex, updateModalPosition])

    useEffect(() => {
        const hasToured = localStorage.getItem('dexearth_has_toured')
        if (!hasToured) {
            // Slight delay so the app renders first
            setTimeout(() => setTourActive(true), 1000)
        }
    }, [])


    // Attempt to update position whenever stepIndex changes
    useEffect(() => {
        if (!tourActive) return

        // Clean up previous animations
        TOUR_STEPS.forEach(s => {
            const el = document.getElementById(s.targetId)
            if (el) {
                el.getAnimations().forEach(a => a.cancel())
            }
        })

        // Use a short timeout to give React time to render DOM nodes if they were just mounted
        setTimeout(updateModalPosition, 50)
    }, [stepIndex, tourActive, updateModalPosition])

    function nextStep() {
        if (stepIndex >= TOUR_STEPS.length - 1) {
            endTour()
        } else {
            setStepIndex(i => i + 1)
        }
    }

    function endTour() {
        // Clean up animations
        TOUR_STEPS.forEach(s => {
            const el = document.getElementById(s.targetId)
            if (el) {
                el.getAnimations().forEach(a => a.cancel())
            }
        })
        localStorage.setItem('dexearth_has_toured', 'true')
        setTourActive(false)
    }

    if (!tourActive) return null

    const currentStep = stepIndex === -1 ? null : TOUR_STEPS[stepIndex]

    return (
        <div style={{
            position: 'fixed',
            inset: 0,
            zIndex: 9999,
            pointerEvents: 'none', // Let user click things underneath
        }}>
            {/* Backdrop overlay only during welcome screen */}
            {stepIndex === -1 && (
                <div style={{
                    position: 'absolute', inset: 0,
                    background: 'rgba(0,0,0,0.6)',
                    backdropFilter: 'blur(4px)',
                    pointerEvents: 'auto'
                }} />
            )}

            <div style={{
                position: 'absolute',
                ...modalPos,
                background: 'rgba(10,15,20,0.95)',
                border: '1px solid #00FF9F',
                borderRadius: '8px',
                padding: '24px',
                width: '320px',
                color: '#FFF',
                fontFamily: 'monospace',
                boxShadow: '0 12px 48px rgba(0,0,0,0.8), 0 0 0 1px rgba(0,255,159,0.2)',
                backdropFilter: 'blur(16px)',
                transition: 'all 400ms cubic-bezier(0.2, 0.8, 0.2, 1)',
                pointerEvents: 'auto'
            }}>
                {stepIndex === -1 ? (
                    <>
                        <h2 style={{ color: '#00FF9F', marginTop: 0, fontSize: '18px', letterSpacing: '2px' }}>WELCOME TO DEXEARTH</h2>
                        <p style={{ fontSize: '12px', lineHeight: 1.6, color: '#CCC' }}>
                            DexEarth is a tactical, offline-first planetary visualization engine.
                        </p>
                        <p style={{ fontSize: '12px', lineHeight: 1.6, color: '#CCC' }}>
                            Let's take a quick tour of the interface to get you acquainted with the systems.
                        </p>
                        <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '12px', marginTop: '24px' }}>
                            <button onClick={endTour} style={{
                                background: 'transparent', border: 'none', color: '#888', cursor: 'pointer', fontSize: '11px', fontFamily: 'monospace'
                            }}>SKIP</button>
                            <button onClick={nextStep} style={{
                                background: '#00FF9F', border: 'none', color: '#000', padding: '6px 16px', borderRadius: '4px', cursor: 'pointer', fontSize: '11px', fontFamily: 'monospace', fontWeight: 'bold'
                            }}>START TOUR</button>
                        </div>
                    </>
                ) : (
                    <>
                        <div style={{ fontSize: '10px', color: '#00FF9F66', marginBottom: '8px', letterSpacing: '1px' }}>
                            STEP {stepIndex + 1} OF {TOUR_STEPS.length}
                        </div>
                        <h3 style={{ margin: '0 0 12px 0', fontSize: '14px', color: '#FFF' }}>{currentStep?.title}</h3>
                        <p style={{ margin: '0 0 20px 0', fontSize: '12px', color: '#CCC', lineHeight: 1.5 }}>
                            {currentStep?.content}
                        </p>
                        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                            <button onClick={endTour} style={{
                                background: 'transparent', border: 'none', color: '#888', cursor: 'pointer', fontSize: '10px', fontFamily: 'monospace'
                            }}>END TOUR</button>
                            <button onClick={nextStep} style={{
                                background: 'rgba(0,255,159,0.1)', border: '1px solid #00FF9F', color: '#00FF9F', padding: '6px 16px', borderRadius: '4px', cursor: 'pointer', fontSize: '11px', fontFamily: 'monospace'
                            }}>
                                {stepIndex === TOUR_STEPS.length - 1 ? 'FINISH' : 'NEXT'}
                            </button>
                        </div>
                    </>
                )}
            </div>
        </div>
    )
}
