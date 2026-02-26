// ─── Reusable UI Components (Phase 4 Glassmorphism) ──────────────────────────
import React, { useState } from 'react'
import { UI_TOKENS } from './tokens.js'

export function Panel({ children, style = {} }) {
    return (
        <div style={{
            background: UI_TOKENS.glassBg,
            backdropFilter: 'blur(12px)',
            WebkitBackdropFilter: 'blur(12px)',
            border: UI_TOKENS.glassBorder,
            borderRadius: '4px',
            marginBottom: '8px',
            overflow: 'hidden',
            ...style
        }}>
            {children}
        </div>
    )
}

export function CollapsibleSection({ title, defaultOpen = false, icon = '⯈', children, titleRight = null }) {
    const [open, setOpen] = useState(defaultOpen)

    return (
        <div style={{ borderBottom: '1px solid rgba(0,255,159,0.08)' }}>
            <div
                style={{
                    display: 'flex', alignItems: 'center', justifyContent: 'space-between',
                    padding: '8px 12px', cursor: 'pointer', userSelect: 'none',
                    background: open ? 'rgba(0,255,159,0.05)' : 'transparent',
                    transition: 'background 150ms ease'
                }}
                onClick={() => setOpen(!open)}
            >
                <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                    <span style={{
                        color: UI_TOKENS.textMuted, fontSize: '10px',
                        transform: open ? 'rotate(90deg)' : 'none',
                        transition: 'transform 150ms ease',
                        display: 'inline-block', width: '12px', textAlign: 'center'
                    }}>{icon}</span>
                    <span style={{
                        color: open ? UI_TOKENS.textPrimary : UI_TOKENS.textSecondary,
                        fontWeight: open ? 600 : 400, fontSize: '11px', letterSpacing: '0.1em',
                        textTransform: 'uppercase'
                    }}>{title}</span>
                </div>
                {titleRight && <div style={{ fontSize: '10px' }}>{titleRight}</div>}
            </div>
            {open && (
                <div style={{ padding: '8px 12px', borderTop: '1px solid rgba(0,255,159,0.05)' }}>
                    {children}
                </div>
            )}
        </div>
    )
}

export function ToggleRow({ label, checked, onChange, rightLabel = null, disabled = false }) {
    return (
        <label style={{
            display: 'flex', alignItems: 'center', justifyContent: 'space-between',
            cursor: disabled ? 'not-allowed' : 'pointer', marginBottom: '6px',
            opacity: disabled ? 0.5 : 1
        }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                <input
                    type="checkbox" checked={checked} onChange={e => onChange(e.target.checked)}
                    disabled={disabled}
                    style={{ accentColor: '#00FF9F', width: '14px', height: '14px', cursor: 'inherit' }}
                />
                <span style={{ color: UI_TOKENS.textPrimary, fontSize: '11px' }}>{label}</span>
            </div>
            {rightLabel && <span style={{ color: UI_TOKENS.textMuted, fontSize: '10px' }}>{rightLabel}</span>}
        </label>
    )
}

export function SliderRow({ label, value, min, max, step = 1, onChange, unit = '', disabled = false }) {
    return (
        <div style={{ marginBottom: '8px', opacity: disabled ? 0.5 : 1 }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '4px' }}>
                <span style={{ color: UI_TOKENS.textSecondary, fontSize: '10px' }}>{label}</span>
                <span style={{ color: UI_TOKENS.textPrimary, fontSize: '10px', fontFamily: 'monospace' }}>
                    {value}{unit}
                </span>
            </div>
            <input
                type="range" min={min} max={max} step={step} value={value}
                onChange={e => onChange(+e.target.value)} disabled={disabled}
                style={{ width: '100%', accentColor: '#00FF9F', cursor: disabled ? 'not-allowed' : 'pointer' }}
            />
        </div>
    )
}

export function StatusBadge({ status, text }) {
    // status: 'success', 'warning', 'error', 'neutral'
    const colors = {
        success: { bg: 'rgba(0,255,159,0.15)', fg: '#00FF9F', border: '#00FF9F' },
        warning: { bg: 'rgba(255,215,0,0.15)', fg: '#FFD700', border: '#FFD700' },
        error: { bg: 'rgba(255,68,68,0.15)', fg: '#FF4444', border: '#FF4444' },
        neutral: { bg: 'rgba(255,255,255,0.05)', fg: '#AAAAAA', border: '#555' },
    }
    const c = colors[status] || colors.neutral

    return (
        <span style={{
            background: c.bg, color: c.fg, border: `1px solid ${c.border}`,
            padding: '2px 6px', borderRadius: '3px', fontSize: '9px',
            textTransform: 'uppercase', letterSpacing: '0.05em', whiteSpace: 'nowrap'
        }}>
            {text}
        </span>
    )
}

export function SearchBox({ value, onChange, placeholder = "Search..." }) {
    return (
        <input
            type="text" value={value} onChange={e => onChange(e.target.value)}
            placeholder={placeholder}
            style={{
                width: '100%', background: 'rgba(0,0,0,0.4)', border: UI_TOKENS.glassBorder,
                color: '#00FF9F', padding: '6px 8px', borderRadius: '3px',
                fontFamily: UI_TOKENS.font, fontSize: '11px', outline: 'none'
            }}
        />
    )
}

export function Button({ onClick, children, variant = 'default', style = {}, disabled = false }) {
    // variant: 'default', 'danger', 'warning'
    const colors = {
        default: { border: 'rgba(0,255,159,0.4)', color: '#00FF9F', hoverBg: 'rgba(0,255,159,0.1)' },
        danger: { border: 'rgba(255,68,68,0.4)', color: '#FF4444', hoverBg: 'rgba(255,68,68,0.1)' },
        warning: { border: 'rgba(255,215,0,0.4)', color: '#FFD700', hoverBg: 'rgba(255,215,0,0.1)' },
    }
    const c = colors[variant] || colors.default
    const [hover, setHover] = useState(false)

    return (
        <button
            onClick={onClick}
            disabled={disabled}
            onMouseEnter={() => setHover(true)}
            onMouseLeave={() => setHover(false)}
            style={{
                background: hover && !disabled ? c.hoverBg : 'rgba(0,0,0,0.3)',
                border: `1px solid ${c.border}`, color: c.color,
                padding: '4px 8px', borderRadius: '3px', cursor: disabled ? 'not-allowed' : 'pointer',
                fontFamily: UI_TOKENS.font, fontSize: '10px', transition: 'all 150ms ease',
                opacity: disabled ? 0.5 : 1,
                ...style
            }}
        >
            {children}
        </button>
    )
}

export function InfoPopover({ content }) {
    const [hover, setHover] = useState(false)

    return (
        <div
            style={{ position: 'relative', display: 'inline-flex', alignItems: 'center' }}
            onMouseEnter={() => setHover(true)}
            onMouseLeave={() => setHover(false)}
        >
            <span style={{
                display: 'inline-flex', justifyContent: 'center', alignItems: 'center',
                width: '14px', height: '14px', borderRadius: '50%',
                background: hover ? 'rgba(0, 207, 255, 0.2)' : 'rgba(255, 255, 255, 0.1)',
                border: hover ? `1px solid ${UI_TOKENS.secondary}` : '1px solid rgba(255,255,255,0.2)',
                color: hover ? UI_TOKENS.secondary : UI_TOKENS.textMuted,
                fontSize: '9px', fontWeight: 'bold', cursor: 'help',
                transition: 'all 150ms ease'
            }}>
                ?
            </span>

            {hover && (
                <div style={{
                    position: 'absolute', bottom: '100%', left: '50%', transform: 'translateX(-50%)',
                    marginBottom: '8px', padding: '6px 8px', width: '200px',
                    background: 'rgba(10, 15, 20, 0.95)', border: `1px solid ${UI_TOKENS.secondary}`,
                    borderRadius: '4px', color: UI_TOKENS.textPrimary, fontSize: '10px',
                    lineHeight: '1.4', zIndex: 1000, boxShadow: '0 4px 12px rgba(0,0,0,0.5)',
                    pointerEvents: 'none'
                }}>
                    {content}
                    {/* Small unstyled arrow pointing down */}
                    <div style={{
                        position: 'absolute', top: '100%', left: '50%', transform: 'translateX(-50%)',
                        borderLeft: '4px solid transparent', borderRight: '4px solid transparent',
                        borderTop: `4px solid ${UI_TOKENS.secondary}`
                    }} />
                </div>
            )}
        </div>
    )
}
