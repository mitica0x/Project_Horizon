import { useState, useEffect } from 'react'
import { getThreatColor } from '../utils/threatScore'

function UrlSection({ title, urls }) {
  const [open, setOpen] = useState(true)
  if (!urls || urls.length === 0) return null
  return (
    <div style={{ marginBottom: 16 }}>
      <button
        onClick={() => setOpen(o => !o)}
        style={{
          display: 'flex', alignItems: 'center', gap: 6,
          background: 'none', border: 'none', cursor: 'pointer',
          padding: '4px 0', width: '100%',
        }}
      >
        <span style={{ fontFamily: "'IBM Plex Mono', monospace", fontSize: 11, color: '#8892a4', letterSpacing: '0.08em', textTransform: 'uppercase' }}>
          {title} ({urls.length})
        </span>
        <span style={{ color: '#8892a4', fontSize: 10 }}>{open ? '▲' : '▼'}</span>
      </button>
      {open && (
        <div style={{ marginTop: 4 }}>
          {urls.map((url, i) => (
            <a
              key={i}
              href={`https://${url}`}
              target="_blank"
              rel="noopener noreferrer"
              style={{
                display: 'block',
                fontFamily: "'IBM Plex Mono', monospace",
                fontSize: 12, color: '#00d4e8', marginBottom: 4,
                textDecoration: 'none',
                overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap',
              }}
              onMouseEnter={e => { e.currentTarget.style.textDecoration = 'underline' }}
              onMouseLeave={e => { e.currentTarget.style.textDecoration = 'none' }}
            >
              · {url}
            </a>
          ))}
        </div>
      )}
    </div>
  )
}

function IntelPill({ label, onClick }) {
  const [hover, setHover] = useState(false)
  return (
    <button
      onClick={onClick}
      onMouseEnter={() => setHover(true)}
      onMouseLeave={() => setHover(false)}
      style={{
        display: 'block', width: '100%', textAlign: 'left',
        border: `1px solid ${hover ? '#94c864' : 'rgba(148,200,100,0.3)'}`,
        background: 'transparent',
        color: hover ? '#94c864' : '#8892a4',
        borderRadius: 20,
        padding: '8px 16px',
        fontSize: 12,
        fontFamily: "'IBM Plex Mono', monospace",
        cursor: 'pointer',
        marginBottom: 8,
        transition: 'border-color 0.15s, color 0.15s',
      }}
    >
      {label}
    </button>
  )
}

export default function CompetitorPanel({ competitor, onClose, onAskIntel }) {
  const [mounted, setMounted] = useState(false)

  useEffect(() => {
    const id = requestAnimationFrame(() => setMounted(true))
    return () => cancelAnimationFrame(id)
  }, [])

  const {
    name, score, pagesPresent, t1GapPages, cardPages, priorityPages,
    urls = [], t1Urls = [], cardUrls = [], maxScore = 1,
  } = competitor
  const threatColor = getThreatColor(score, maxScore)

  const intelQuestions = [
    `How do we get on pages ${name} owns?`,
    `Which ${name} gaps are easiest to close?`,
    `Draft outreach strategy against ${name}`,
  ]

  return (
    <div
      style={{
        position: 'fixed', top: 0, right: 0,
        width: 520, height: '100vh',
        background: '#131929',
        borderLeft: '1px solid rgba(255,77,109,0.2)',
        zIndex: 100,
        display: 'flex', flexDirection: 'column',
        transform: mounted ? 'translateX(0)' : 'translateX(100%)',
        transition: 'transform 0.3s ease',
      }}
    >
      {/* Header */}
      <div style={{ flexShrink: 0, padding: '20px 24px 0' }}>
        <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between' }}>
          <div>
            <div style={{
              fontFamily: "'Syne', sans-serif", fontWeight: 700,
              fontSize: 22, color: '#ffffff', marginBottom: 6,
            }}>
              {name}
            </div>
            <div style={{ fontFamily: "'IBM Plex Mono', monospace", fontSize: 12, color: threatColor, letterSpacing: '0.08em' }}>
              THREAT SCORE {score}
            </div>
          </div>
          <button
            onClick={onClose}
            style={{
              background: 'none', border: 'none', color: '#8892a4',
              fontSize: 22, cursor: 'pointer', lineHeight: 1,
              padding: '2px 4px', transition: 'color 0.15s',
            }}
            onMouseEnter={e => { e.currentTarget.style.color = '#ffffff' }}
            onMouseLeave={e => { e.currentTarget.style.color = '#8892a4' }}
          >×</button>
        </div>
        <div style={{ height: 2, background: threatColor, marginTop: 14, borderRadius: 1 }} />
      </div>

      {/* Scrollable body */}
      <div style={{ flex: 1, overflowY: 'auto', padding: '20px 24px', scrollbarWidth: 'thin' }}>

        {/* 2x2 metric cards */}
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12, marginBottom: 24 }}>
          {[
            { value: pagesPresent,  label: 'Pages Present',    color: '#ffffff'  },
            { value: t1GapPages,    label: 'T1 Gap Pages',     color: '#ff4d6d'  },
            { value: cardPages,     label: 'Card Pages',       color: '#94c864'  },
            { value: priorityPages, label: 'Priority Markets', color: '#60a5fa'  },
          ].map(({ value, label, color }) => (
            <div key={label} style={{ background: '#0a0e1a', borderRadius: 8, padding: '12px 16px' }}>
              <div style={{ fontFamily: "'IBM Plex Mono', monospace", fontSize: 24, fontWeight: 700, color, marginBottom: 4 }}>
                {value}
              </div>
              <div style={{ fontFamily: "'IBM Plex Sans', sans-serif", fontSize: 11, color: '#8892a4' }}>
                {label}
              </div>
            </div>
          ))}
        </div>

        {/* URL lists */}
        <UrlSection title="T1 Gap Pages" urls={t1Urls} />
        <UrlSection title="Card Pages" urls={cardUrls} />
        <UrlSection title="All Tracked Pages" urls={urls} />

        {/* Trend indicator (scaffolded) */}
        <div style={{ marginBottom: 24, padding: '12px 16px', background: '#0a0e1a', borderRadius: 8 }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 4 }}>
            <span style={{ fontFamily: "'IBM Plex Mono', monospace", fontSize: 11, color: '#8892a4', letterSpacing: '0.08em' }}>TREND</span>
            <span style={{ color: '#94c864', fontSize: 12 }}>↑</span>
          </div>
          <div style={{ fontFamily: "'IBM Plex Sans', sans-serif", fontSize: 12, color: '#8892a4', fontStyle: 'italic' }}>
            — Data available after 2+ scan cycles
          </div>
        </div>

        {/* Intel prompts */}
        <div>
          <div style={{
            fontFamily: "'IBM Plex Mono', monospace", fontSize: 11,
            color: '#94c864', letterSpacing: '0.1em',
            textTransform: 'uppercase', marginBottom: 12,
          }}>
            Ask Intel about {name}
          </div>
          {intelQuestions.map((q, i) => (
            <IntelPill key={i} label={q} onClick={() => onAskIntel(q)} />
          ))}
        </div>

      </div>
    </div>
  )
}
