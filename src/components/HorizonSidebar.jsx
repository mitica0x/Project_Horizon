import { useState, useEffect } from 'react'
import { FONT_HEAD, FONT_MONO } from './horizonUI'
import { statusVerdict, getDayStatus } from '../utils/horizonData'

// S6 — sidebar micro-line under the STATUS label, derived from the day verdict.
const STATUS_MICRO = {
  'HIGH PRESSURE': '3 actions · market moving',
  'ELEVATED WATCH': '1 action · monitor market',
  'ALL CLEAR': 'Market clear',
}

// Left nav for the Horiz0n suite. Collapsible (persisted), full-height (top:0).
// "Ask C0insiglieri" (intel) sits below the divider as a nav item.
// SCAN NOW lives inside StatusBoard, not the sidebar.
// N0VA pinned at the bottom in lime.

const NAV = [
  { id: 'status',   label: 'STATUS',   glyph: '◴' },
  { id: 'events',   label: 'EVENTS',   glyph: '◇' },
  { id: 'history', label: 'HISTORY', glyph: '◎' },
]

const COLLAPSE_KEY = 'horizon_sidebar_collapsed'

function NavRow({ glyph, label, active, onClick, collapsed, tone, subLine }) {
  const [hover, setHover] = useState(false)
  const lit = active || hover
  const color = active ? (tone || 'var(--cyan)') : lit ? '#c8d0dc' : 'var(--text-muted)'
  return (
    <button
      onClick={onClick}
      title={label}
      onMouseEnter={() => setHover(true)}
      onMouseLeave={() => setHover(false)}
      style={{
        display: 'flex',
        alignItems: 'center',
        gap: 12,
        width: '100%',
        textAlign: 'left',
        justifyContent: collapsed ? 'center' : 'flex-start',
        background: active ? `${tone || '#00d4e8'}14` : 'transparent',
        border: 'none',
        borderLeft: `3px solid ${active ? tone || 'var(--cyan)' : 'transparent'}`,
        padding: collapsed ? '12px 0' : '11px 16px 11px 17px',
        cursor: 'pointer',
        color,
        fontFamily: FONT_MONO,
        fontSize: 12,
        letterSpacing: '0.12em',
        transition: 'color 0.15s, background 0.15s, border-color 0.15s',
      }}
    >
      <span style={{ fontSize: 14, width: 16, textAlign: 'center', flexShrink: 0 }}>
        {glyph}
      </span>
      {!collapsed && (
        <span style={{ display: 'flex', flexDirection: 'column', gap: 2, minWidth: 0 }}>
          <span>{label}</span>
          {subLine && (
            <span
              style={{
                fontFamily: FONT_MONO,
                fontSize: 10,
                letterSpacing: '0.04em',
                textTransform: 'none',
                color: 'var(--text-muted)',
              }}
            >
              {subLine}
            </span>
          )}
        </span>
      )}
    </button>
  )
}

function Divider() {
  return (
    <div
      style={{
        height: 1,
        background: 'var(--border)',
        margin: '10px 14px',
      }}
    />
  )
}

export default function HorizonSidebar({
  view,
  onNav,
  onNova,
  onTrace,
  onIntel,
  onScan,
  scanState = 'idle',
  compactStatus,
}) {
  const [collapsed, setCollapsed] = useState(() => {
    try {
      return localStorage.getItem(COLLAPSE_KEY) === '1'
    } catch {
      return false
    }
  })
  const [novaHover, setNovaHover] = useState(false)
  const [scanHover, setScanHover] = useState(false)
  // scanState values from App.jsx's runScan: idle | sentry | mirror | herald
  // | complete | error. Treat anything between idle and a terminal state as
  // "scanning" for the sidebar button's two-state UI.
  const isScanning =
    scanState && scanState !== 'idle' && scanState !== 'complete' && scanState !== 'error'

  // Keep the content offset (.hz-shell) in sync with the actual width.
  useEffect(() => {
    document.documentElement.style.setProperty(
      '--hz-sidebar',
      collapsed ? '52px' : '210px',
    )
    try {
      localStorage.setItem(COLLAPSE_KEY, collapsed ? '1' : '0')
    } catch {
      /* ignore */
    }
    return () => document.documentElement.style.removeProperty('--hz-sidebar')
  }, [collapsed])

  const verdict = compactStatus ? statusVerdict(compactStatus) : null
  const statusMicro =
    STATUS_MICRO[(verdict || statusVerdict(getDayStatus().overall)).label] || null

  return (
    <nav
      className="hz-nav"
      style={{
        position: 'fixed',
        top: 0,
        left: 0,
        bottom: 0,
        zIndex: 150,
        background: 'var(--bg-panel)',
        borderRight: '1px solid var(--border)',
        display: 'flex',
        flexDirection: 'column',
        boxSizing: 'border-box',
      }}
    >
      {/* Wordmark → P1 dashboard */}
      <button
        onClick={() => onNav('dashboard')}
        title="C0insiglieri — dashboard"
        style={{
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          gap: 2,
          background: 'none',
          border: 'none',
          borderBottom: '1px solid var(--border)',
          padding: '16px 12px',
          cursor: 'pointer',
          fontFamily: FONT_HEAD,
          fontWeight: 800,
          fontSize: 18,
          letterSpacing: '0.14em',
          color: view === 'dashboard' ? '#94c864' : '#7e9a5a',
          transition: 'color 0.15s',
        }}
      >
        {collapsed ? (
          <>
            <span style={{color:'#ffffff'}}>C</span><span style={{color:'#94c864'}}>0</span>
          </>
        ) : (
          <>
            <span style={{color:'#ffffff'}}>C</span><span style={{color:'#94c864'}}>0</span><span style={{color:'#ffffff'}}>IN</span><span style={{color:'#00d4e8'}}>SIGLIERI</span>
          </>
        )}
      </button>

      {/* Collapse toggle */}
      <button
        onClick={() => setCollapsed(c => !c)}
        title={collapsed ? 'Expand sidebar' : 'Collapse sidebar'}
        style={{
          display: 'flex',
          alignItems: 'center',
          justifyContent: collapsed ? 'center' : 'flex-end',
          background: 'none',
          border: 'none',
          padding: '6px 14px',
          marginTop: 56,
          cursor: 'pointer',
          color: 'var(--text-muted)',
          fontSize: 14,
          fontFamily: FONT_MONO,
        }}
      >
        {collapsed ? '»' : '«'}
      </button>

      {/* Compact day verdict — shown when the STATUS board is dismissed */}
      {verdict && (
        <button
          onClick={() => onNav('status')}
          title={`Open status — ${verdict.label}`}
          style={{
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            gap: 8,
            background: 'rgba(255,255,255,0.02)',
            border: 'none',
            borderBottom: '1px solid var(--border)',
            padding: '10px 12px',
            cursor: 'pointer',
            fontFamily: FONT_MONO,
            fontSize: 10,
            letterSpacing: '0.1em',
            color: verdict.color,
          }}
        >
          <span
            style={{
              width: 7,
              height: 7,
              borderRadius: '50%',
              background: verdict.color,
              boxShadow: `0 0 6px ${verdict.color}`,
              flexShrink: 0,
            }}
          />
          {!collapsed && verdict.label}
        </button>
      )}

      <div style={{ flex: 1, overflowY: 'auto', paddingTop: 8 }}>
        {NAV.map(it => (
          <NavRow
            key={it.id}
            glyph={it.glyph}
            label={it.label}
            active={view === it.id}
            collapsed={collapsed}
            subLine={it.id === 'status' ? statusMicro : undefined}
            onClick={() => onNav(it.id)}
          />
        ))}

        <Divider />

        <NavRow glyph="⬡" label="Ask C0insiglieri" collapsed={collapsed} onClick={onIntel} />
      </div>

      {/* SCAN NOW — standalone action button anchored at the bottom, directly
          above N0VA. Triggers App-level runScan (scroll-to-hero, GSAP, polling,
          dashboard refresh). Sits outside the scrollable nav column so it
          stays pinned regardless of nav-item growth. */}
      {onScan && (
        <button
          onClick={onScan}
          disabled={isScanning}
          onMouseEnter={() => setScanHover(true)}
          onMouseLeave={() => setScanHover(false)}
          title={isScanning ? 'Scan in progress' : 'Run scan now'}
          style={{
            display: 'block',
            marginTop: 8,
            marginBottom: 4,
            marginLeft: 12,
            width: 'calc(100% - 24px)',
            padding: '6px 12px',
            background: 'transparent',
            border: `1px solid ${
              scanHover && !isScanning
                ? 'rgba(148,200,100,0.7)'
                : 'rgba(148,200,100,0.3)'
            }`,
            borderRadius: 4,
            color: scanHover && !isScanning ? '#b8e88a' : '#94c864',
            fontFamily: FONT_MONO,
            fontSize: 11,
            letterSpacing: '1px',
            cursor: isScanning ? 'default' : 'pointer',
            opacity: isScanning ? 0.6 : 1,
            transition: 'color 0.15s, border-color 0.15s, opacity 0.15s',
            textAlign: 'center',
          }}
        >
          {collapsed ? '⟳' : isScanning ? '⟳ Scanning…' : '⟳ SCAN NOW'}
        </button>
      )}

      {/* N0VA — always visible, lime */}
      <button
        onClick={onNova}
        title="Activate N0VA"
        onMouseEnter={() => setNovaHover(true)}
        onMouseLeave={() => setNovaHover(false)}
        style={{
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          gap: 10,
          background: novaHover ? 'rgba(148,200,100,0.14)' : 'rgba(148,200,100,0.06)',
          border: 'none',
          borderTop: '1px solid rgba(148,200,100,0.25)',
          padding: '15px 12px',
          cursor: 'pointer',
          color: '#94c864',
          fontFamily: FONT_MONO,
          fontSize: 12,
          fontWeight: 600,
          letterSpacing: '0.14em',
          transition: 'background 0.15s',
        }}
      >
        <span style={{ fontSize: 14 }}>◆</span>
        {!collapsed && <span>N0VA</span>}
      </button>
    </nav>
  )
}
