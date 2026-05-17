import { useState, useEffect } from 'react'
import { FONT_HEAD, FONT_MONO } from './horizonUI'
import { statusVerdict } from '../utils/horizonData'

// Left nav for the Horiz0n suite. Collapsible (persisted). Sits below the
// unchanged 48px header. Floating buttons are now nav items (TRACE / INTEL /
// SCAN NOW). N0VA pinned at the bottom in lime.

const NAV = [
  { id: 'status',   label: 'STATUS',   glyph: '◴' },
  { id: 'windows',  label: 'WINDOWS',  glyph: '◇' },
  { id: 'outcomes', label: 'OUTCOMES', glyph: '◎' },
  { id: 'ledger',   label: 'LEDGER',   glyph: '▤' },
  { id: 'signal',   label: 'SIGNAL',   glyph: '◉' },
  { id: 'brief',    label: 'BRIEF',    glyph: '▦' },
  { id: 'network',  label: 'NETWORK',  glyph: '⧉' },
]

const COLLAPSE_KEY = 'horizon_sidebar_collapsed'

function NavRow({ glyph, label, active, onClick, collapsed, tone }) {
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
      {!collapsed && <span>{label}</span>}
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
  const scanLabel =
    scanState === 'idle'
      ? 'SCAN NOW'
      : scanState === 'complete'
      ? 'SCAN DONE'
      : scanState === 'error'
      ? 'AGENT OFFLINE'
      : 'SCANNING…'

  return (
    <nav
      className="hz-nav"
      style={{
        position: 'fixed',
        top: 48,
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
          borderBottom: '1px solid var(--border)',
          padding: '10px 14px',
          cursor: 'pointer',
          color: 'var(--text-muted)',
          fontSize: 14,
          fontFamily: FONT_MONO,
        }}
      >
        {collapsed ? '»' : '«'}
      </button>

      {/* Wordmark → P1 dashboard */}
      <button
        onClick={() => onNav('dashboard')}
        title="Project Horizon — dashboard"
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
            H<span style={{ color: 'var(--cyan)', fontFamily: 'inherit', fontWeight: 'inherit', fontSize: 'inherit', lineHeight: 1, display: 'inline-block', fontVariantNumeric: 'lining-nums tabular-nums' }}>0</span>
          </>
        ) : (
          <>
            HORIZ<span style={{ color: 'var(--cyan)', fontFamily: 'inherit', fontWeight: 'inherit', fontSize: 'inherit', lineHeight: 1, display: 'inline-block', fontVariantNumeric: 'lining-nums tabular-nums' }}>0</span>N
          </>
        )}
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
            onClick={() => onNav(it.id)}
          />
        ))}

        <Divider />

        <NavRow glyph="◷" label="TRACE" collapsed={collapsed} onClick={onTrace} />
        <NavRow glyph="⬡" label="INTEL" collapsed={collapsed} onClick={onIntel} />
        <NavRow
          glyph="⟳"
          label={scanLabel}
          collapsed={collapsed}
          onClick={onScan}
          active={scanState !== 'idle'}
        />
      </div>

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
