import { useState } from 'react'
import { FONT_HEAD, FONT_MONO, RagDot } from './horizonUI'

// Left nav for the Horiz0n suite. Fixed, sits below the unchanged 48px
// header. Collapses to icon-only under 880px (labels hidden via .hz-nav-label
// in index.css). P1 dashboard is reached by the HORIZ0N wordmark.

const ITEMS = [
  { id: 'status',   label: 'STATUS',   glyph: '◴' },
  { id: 'windows',  label: 'WINDOWS',  glyph: '◇' },
  { id: 'outcomes', label: 'OUTCOMES', glyph: '◎' },
  { id: 'ledger',   label: 'LEDGER',   glyph: '▤' },
  { id: 'signal',   label: 'SIGNAL',   glyph: '◉' },
  { id: 'brief',    label: 'BRIEF',    glyph: '▦' },
  { id: 'network',  label: 'NETWORK',  glyph: '⧉' },
]

function NavRow({ item, active, onClick }) {
  const [hover, setHover] = useState(false)
  const lit = active || hover
  return (
    <button
      onClick={onClick}
      title={item.label}
      onMouseEnter={() => setHover(true)}
      onMouseLeave={() => setHover(false)}
      style={{
        display: 'flex',
        alignItems: 'center',
        gap: 12,
        width: '100%',
        textAlign: 'left',
        background: active ? 'rgba(0,212,232,0.06)' : 'transparent',
        border: 'none',
        borderLeft: `3px solid ${active ? 'var(--cyan)' : 'transparent'}`,
        padding: '11px 16px 11px 17px',
        cursor: 'pointer',
        color: active ? 'var(--cyan)' : lit ? '#c8d0dc' : 'var(--text-muted)',
        fontFamily: FONT_MONO,
        fontSize: 12,
        letterSpacing: '0.12em',
        transition: 'color 0.15s, background 0.15s, border-color 0.15s',
      }}
    >
      <span style={{ fontSize: 14, width: 16, textAlign: 'center', flexShrink: 0 }}>
        {item.glyph}
      </span>
      <span className="hz-nav-label">{item.label}</span>
    </button>
  )
}

export default function HorizonSidebar({ view, onNav, onWarRoom, compactStatus }) {
  const [warHover, setWarHover] = useState(false)

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
          padding: '18px 12px',
          cursor: 'pointer',
          fontFamily: FONT_HEAD,
          fontWeight: 800,
          fontSize: 18,
          letterSpacing: '0.14em',
          color: view === 'dashboard' ? '#94c864' : '#7e9a5a',
          transition: 'color 0.15s',
        }}
      >
        <span className="hz-nav-label">HORIZ</span>
        <span style={{ color: 'var(--cyan)' }}>0</span>
        <span className="hz-nav-label">N</span>
      </button>

      {/* Compact day status — shown when the P2 board is dismissed */}
      {compactStatus && (
        <button
          onClick={() => onNav('status')}
          title="Open Morning Status"
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
            letterSpacing: '0.12em',
            color:
              compactStatus === 'RED'
                ? '#ff4d6d'
                : compactStatus === 'AMBER'
                ? '#D4A853'
                : '#94c864',
          }}
        >
          <RagDot rag={compactStatus.toLowerCase()} size={7} />
          <span className="hz-nav-label">TODAY · {compactStatus}</span>
        </button>
      )}

      <div style={{ flex: 1, overflowY: 'auto', paddingTop: 8 }}>
        {ITEMS.map(it => (
          <NavRow
            key={it.id}
            item={it}
            active={view === it.id}
            onClick={() => onNav(it.id)}
          />
        ))}
      </div>

      {/* War Room — always visible, red */}
      <button
        onClick={onWarRoom}
        title="Activate War Room"
        onMouseEnter={() => setWarHover(true)}
        onMouseLeave={() => setWarHover(false)}
        style={{
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          gap: 10,
          background: warHover ? 'rgba(255,77,109,0.12)' : 'rgba(255,77,109,0.06)',
          border: 'none',
          borderTop: '1px solid rgba(255,77,109,0.25)',
          padding: '15px 12px',
          cursor: 'pointer',
          color: '#ff4d6d',
          fontFamily: FONT_MONO,
          fontSize: 12,
          fontWeight: 600,
          letterSpacing: '0.14em',
          transition: 'background 0.15s',
        }}
      >
        <span style={{ fontSize: 14 }}>⚠</span>
        <span className="hz-nav-label">WAR ROOM</span>
      </button>
    </nav>
  )
}
