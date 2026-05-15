import { useState, useEffect } from 'react'
import { CRITERIA } from '../utils/sortEngine'

function Chip({ label, active, weight, onClick }) {
  const [hover, setHover] = useState(false)
  return (
    <button
      onClick={onClick}
      onMouseEnter={() => setHover(true)}
      onMouseLeave={() => setHover(false)}
      style={{
        border: `1px solid ${active ? '#00d4e8' : hover ? 'rgba(0,212,232,0.4)' : 'rgba(255,255,255,0.1)'}`,
        background: active ? 'rgba(0,212,232,0.08)' : 'transparent',
        color: active ? '#00d4e8' : hover ? 'rgba(0,212,232,0.6)' : '#8892a4',
        borderRadius: 20,
        padding: '5px 12px',
        fontSize: 11,
        fontFamily: "'IBM Plex Mono', monospace",
        cursor: 'pointer',
        transition: 'all 0.15s',
        display: 'flex',
        alignItems: 'center',
      }}
    >
      {label}
      {active && weight != null && (
        <span style={{
          width: 14,
          height: 14,
          borderRadius: '50%',
          background: '#00d4e8',
          color: '#0a0e1a',
          fontSize: 9,
          display: 'inline-flex',
          alignItems: 'center',
          justifyContent: 'center',
          marginLeft: 4,
          flexShrink: 0,
        }}>
          {weight}
        </span>
      )}
    </button>
  )
}

export default function SortBar({ activeCriteria, onToggle, onReset, sectionId, strategyBanner, onApplyStrategy }) {
  const [dismissed, setDismissed] = useState(false)

  useEffect(() => {
    setDismissed(false)
  }, [strategyBanner])

  const showBanner = strategyBanner && !dismissed

  return (
    <div style={{ width: '100%', marginBottom: 16 }}>
      {showBanner && (
        <div style={{
          background: 'rgba(148,200,100,0.06)',
          border: '1px solid rgba(148,200,100,0.2)',
          borderRadius: 6,
          padding: '8px 12px',
          marginBottom: 8,
          display: 'flex',
          alignItems: 'center',
        }}>
          <span style={{ fontFamily: "'IBM Plex Mono', monospace", fontSize: 11, color: '#94c864' }}>
            ⬡ Intel suggests: {strategyBanner.label}
          </span>
          <button
            onClick={() => onApplyStrategy(strategyBanner.criteria)}
            style={{
              background: 'transparent',
              border: 'none',
              color: '#94c864',
              fontFamily: "'IBM Plex Mono', monospace",
              fontSize: 11,
              cursor: 'pointer',
              marginLeft: 8,
            }}
          >
            Apply →
          </button>
          <button
            onClick={() => setDismissed(true)}
            style={{
              background: 'none',
              border: 'none',
              color: '#8892a4',
              fontSize: 14,
              cursor: 'pointer',
              marginLeft: 'auto',
            }}
          >
            ×
          </button>
        </div>
      )}
      <div style={{ display: 'flex', alignItems: 'center', gap: 8, flexWrap: 'wrap' }}>
        {Object.entries(CRITERIA).map(([key, crit]) => {
          const idx = activeCriteria.indexOf(key)
          return (
            <Chip
              key={key}
              label={crit.label}
              active={idx !== -1}
              weight={idx !== -1 ? idx + 1 : null}
              onClick={() => onToggle(key)}
            />
          )
        })}
        {activeCriteria.length > 0 && (
          <button
            onClick={onReset}
            style={{
              marginLeft: 'auto',
              background: 'none',
              border: 'none',
              color: '#8892a4',
              fontSize: 11,
              fontFamily: "'IBM Plex Mono', monospace",
              cursor: 'pointer',
              transition: 'color 0.15s',
            }}
            onMouseEnter={e => { e.currentTarget.style.color = '#ffffff' }}
            onMouseLeave={e => { e.currentTarget.style.color = '#8892a4' }}
          >
            Reset
          </button>
        )}
      </div>
    </div>
  )
}
