// Shared Horiz0n primitives — every P2–P9 panel composes these so the suite
// is visually indistinguishable from P1. Tokens lifted verbatim from
// index.css / existing components (ScopePanel, AccountMenu, App section heads).

export const FONT_HEAD = "'Geist', sans-serif"
export const FONT_BODY = "'Geist', sans-serif"
export const FONT_MONO = "'Geist Mono', monospace"

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

// Section-aware INTEL trigger — same look on every surface (S8).
export function AskIntelButton({ onClick }) {
  return (
    <button
      onClick={onClick}
      title="Ask Intel about this section"
      style={{
        display: 'inline-flex',
        alignItems: 'center',
        gap: 7,
        fontFamily: FONT_MONO,
        fontSize: 11,
        letterSpacing: '0.1em',
        textTransform: 'uppercase',
        color: '#94c864',
        background: 'transparent',
        border: '1px solid rgba(148,200,100,0.3)',
        borderRadius: 6,
        padding: '7px 13px',
        cursor: 'pointer',
        whiteSpace: 'nowrap',
        transition: 'background 0.15s, border-color 0.15s',
      }}
      onMouseEnter={e => {
        e.currentTarget.style.background = 'rgba(148,200,100,0.08)'
        e.currentTarget.style.borderColor = '#94c864'
      }}
      onMouseLeave={e => {
        e.currentTarget.style.background = 'transparent'
        e.currentTarget.style.borderColor = 'rgba(148,200,100,0.3)'
      }}
    >
      <span style={{ fontSize: 12 }}>⬡</span> Ask Intel
    </button>
  )
}

export function PanelHeader({ title, count, accent = 'var(--cyan)', sub, right }) {
  return (
    <div style={{ marginBottom: sub ? 20 : 16 }}>
      <div
        style={{
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          gap: 12,
          marginBottom: sub ? 8 : 0,
        }}
      >
        <div style={{ display: 'flex', alignItems: 'center', gap: 10, minWidth: 0 }}>
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
        {right}
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

// Clickable site domain/URL. Wraps the displayed domain (and optional path)
// text and opens it in a new tab. Appearance is fully inherited from the
// parent — colour/font/size unchanged; the only added affordances are a
// pointer cursor and an underline on hover. No logic, data, or layout.
// href: explicit `href`, else `https://domain+path` (domain already carrying
// a scheme is used as-is). If nothing resolvable, renders plain text.
export function SiteLink({ domain, path, href, style, children }) {
  const raw = href || String(domain ?? '')
  const url = href
    ? href
    : raw
      ? (/^https?:\/\//i.test(raw) ? raw : `https://${raw}${path || ''}`)
      : null
  const text = children != null ? children : (path ? `${domain}${path}` : domain)
  if (!url) return <>{text}</>
  return (
    <a
      href={url}
      target="_blank"
      rel="noopener noreferrer"
      style={{ color: 'inherit', textDecoration: 'none', cursor: 'pointer', ...style }}
      onMouseEnter={e => { e.currentTarget.style.textDecoration = 'underline' }}
      onMouseLeave={e => { e.currentTarget.style.textDecoration = 'none' }}
    >
      {text}
    </a>
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
