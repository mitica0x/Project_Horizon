// Shared Horiz0n primitives — every P2–P9 panel composes these so the suite
// is visually indistinguishable from P1. Tokens lifted verbatim from
// index.css / existing components (ScopePanel, AccountMenu, App section heads).

export const FONT_HEAD = "'Syne', sans-serif"
export const FONT_BODY = "'IBM Plex Sans', sans-serif"
export const FONT_MONO = "'IBM Plex Mono', monospace"

// Accent per nav view — uses the existing palette only.
export const VIEW_ACCENT = {
  status:  '#94c864',
  windows: '#00d4e8',
  outcomes:'#94c864',
  ledger:  '#00d4e8',
  signal:  '#94c864',
  brief:   '#00d4e8',
  network: '#00d4e8',
}

export function Card({ children, style }) {
  return (
    <div
      style={{
        background: 'var(--bg-card)',
        border: '1px solid var(--border)',
        borderRadius: 10,
        padding: '24px 28px',
        ...style,
      }}
    >
      {children}
    </div>
  )
}

export function PanelHeader({ title, count, accent = 'var(--cyan)', sub }) {
  return (
    <div style={{ marginBottom: sub ? 20 : 16 }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: sub ? 8 : 0 }}>
        <span
          style={{
            fontFamily: FONT_HEAD,
            fontWeight: 700,
            fontSize: 16,
            letterSpacing: '.1em',
            textTransform: 'uppercase',
            color: accent,
          }}
        >
          {title}
        </span>
        {count != null && (
          <span
            style={{
              fontFamily: FONT_MONO,
              fontSize: 11,
              padding: '1px 8px',
              borderRadius: 99,
              background: 'rgba(255,255,255,.05)',
              color: 'var(--text-muted)',
              border: '1px solid var(--border)',
            }}
          >
            {count}
          </span>
        )}
      </div>
      {sub && (
        <p style={{ fontFamily: FONT_BODY, fontSize: 14, color: 'var(--text-muted)', margin: 0 }}>
          {sub}
        </p>
      )}
    </div>
  )
}

export function Badge({ children, color = 'var(--text-muted)', bg = 'rgba(255,255,255,0.05)', border }) {
  return (
    <span
      style={{
        fontFamily: FONT_MONO,
        fontSize: 10,
        letterSpacing: '0.08em',
        textTransform: 'uppercase',
        padding: '2px 7px',
        borderRadius: 3,
        background: bg,
        color,
        border: `1px solid ${border ?? 'var(--border)'}`,
        whiteSpace: 'nowrap',
        flexShrink: 0,
      }}
    >
      {children}
    </span>
  )
}

export function RagDot({ rag = 'green', size = 8 }) {
  const c = rag === 'red' ? '#ff4d6d' : rag === 'amber' ? '#D4A853' : '#94c864'
  return (
    <span
      style={{
        display: 'inline-block',
        width: size,
        height: size,
        borderRadius: '50%',
        background: c,
        boxShadow: `0 0 6px ${c}`,
        flexShrink: 0,
      }}
    />
  )
}

export function Btn({ children, onClick, tone = '#00d4e8', disabled, title, style }) {
  return (
    <button
      onClick={onClick}
      disabled={disabled}
      title={title}
      style={{
        fontFamily: FONT_MONO,
        fontSize: 12,
        letterSpacing: '0.04em',
        color: disabled ? 'var(--text-muted)' : tone,
        background: '#131929',
        border: `1px solid ${tone}4d`,
        borderRadius: 6,
        padding: '9px 16px',
        cursor: disabled ? 'default' : 'pointer',
        transition: 'box-shadow 0.2s, color 0.2s',
        ...style,
      }}
      onMouseEnter={e => {
        if (!disabled) e.currentTarget.style.boxShadow = `0 0 16px ${tone}40`
      }}
      onMouseLeave={e => {
        e.currentTarget.style.boxShadow = 'none'
      }}
    >
      {children}
    </button>
  )
}

// Comparison / progress bar — reused by P8 confidence and P9 benchmarks.
export function MeterBar({ pct, color = '#00d4e8', track = 'rgba(255,255,255,0.06)', height = 8 }) {
  return (
    <div style={{ width: '100%', height, background: track, borderRadius: 99, overflow: 'hidden' }}>
      <div
        style={{
          width: `${Math.max(0, Math.min(100, pct))}%`,
          height: '100%',
          background: color,
          borderRadius: 99,
          transition: 'width 0.5s cubic-bezier(0.16,1,0.3,1)',
        }}
      />
    </div>
  )
}

// Empty / not-yet-data state, matching the muted mono idiom used app-wide.
export function EmptyState({ children }) {
  return (
    <div
      style={{
        fontFamily: FONT_MONO,
        fontSize: 12,
        letterSpacing: '0.06em',
        color: 'var(--text-muted)',
        padding: '32px 0',
        textAlign: 'center',
      }}
    >
      {children}
    </div>
  )
}
