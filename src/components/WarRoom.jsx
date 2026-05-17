import { useState, useEffect, useRef, useMemo } from 'react'
import { assessCompetitors, fmtClock } from '../utils/horizonData'
import { startWarRoom, endWarRoom } from '../lib/horizonStore'
import { FONT_HEAD, FONT_BODY, FONT_MONO } from './horizonUI'

// P6 — War Room Mode. Full-screen red-tinted takeover. Four response
// playbooks with tickable steps (persisted per browser), live competitor
// pressure, session logged to Supabase (soft-fails if table absent).

const PLAYBOOKS = [
  {
    id: 'crash',
    name: 'MARKET CRASH',
    steps: [
      'Pause all paid spend immediately',
      'Post reassurance / steady-hand content',
      'Monitor competitor silence vs aggression',
      'Prepare buy-the-dip narrative for the window',
    ],
  },
  {
    id: 'fud',
    name: 'FUD ATTACK',
    steps: [
      'Identify the source and reach',
      'Prepare factual, link-backed rebuttal',
      'Coordinate comms across channels',
      'Monitor sentiment trend hourly',
    ],
  },
  {
    id: 'launch',
    name: 'COMPETITOR LAUNCH',
    steps: [
      'Assess threat level and overlap',
      'Activate counter-window if one is open',
      'Brief the team on positioning',
      'Update Sc0pe constraints and tracked set',
    ],
  },
  {
    id: 'reg',
    name: 'REGULATORY EVENT',
    steps: [
      'Pause campaigns touching the affected market',
      'Signal legal review',
      'Prepare a holding statement',
      'Monitor peer / competitor responses',
    ],
  },
]

const STEPS_KEY = 'horizon_warroom_steps'

function loadSteps() {
  try {
    return JSON.parse(localStorage.getItem(STEPS_KEY) || '{}')
  } catch {
    return {}
  }
}

function PlaybookCard({ pb, ticked, onToggle }) {
  const [open, setOpen] = useState(false)
  const done = pb.steps.filter((_, i) => ticked[`${pb.id}:${i}`]).length
  return (
    <div
      style={{
        border: '1px solid rgba(255,77,109,0.25)',
        borderRadius: 8,
        background: 'rgba(255,77,109,0.04)',
        overflow: 'hidden',
      }}
    >
      <button
        onClick={() => setOpen(o => !o)}
        style={{
          width: '100%',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          gap: 12,
          background: 'none',
          border: 'none',
          padding: '14px 18px',
          cursor: 'pointer',
        }}
      >
        <span
          style={{
            fontFamily: FONT_HEAD,
            fontWeight: 700,
            fontSize: 14,
            letterSpacing: '0.1em',
            color: '#ff4d6d',
          }}
        >
          {pb.name}
        </span>
        <span style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
          <span style={{ fontFamily: FONT_MONO, fontSize: 11, color: 'var(--text-muted)' }}>
            {done}/{pb.steps.length}
          </span>
          <span style={{ color: '#ff4d6d', fontSize: 12 }}>{open ? '▾' : '▸'}</span>
        </span>
      </button>
      {open && (
        <div style={{ padding: '0 18px 16px' }}>
          {pb.steps.map((step, i) => {
            const key = `${pb.id}:${i}`
            const on = !!ticked[key]
            return (
              <button
                key={key}
                onClick={() => onToggle(key)}
                style={{
                  width: '100%',
                  display: 'flex',
                  alignItems: 'flex-start',
                  gap: 10,
                  textAlign: 'left',
                  background: 'none',
                  border: 'none',
                  padding: '8px 0',
                  cursor: 'pointer',
                }}
              >
                <span
                  style={{
                    flexShrink: 0,
                    width: 15,
                    height: 15,
                    marginTop: 1,
                    borderRadius: 3,
                    border: `1px solid ${on ? '#94c864' : 'rgba(255,255,255,0.25)'}`,
                    background: on ? 'rgba(148,200,100,0.2)' : 'transparent',
                    color: '#94c864',
                    fontSize: 11,
                    lineHeight: '14px',
                    textAlign: 'center',
                  }}
                >
                  {on ? '✓' : ''}
                </span>
                <span
                  style={{
                    fontFamily: FONT_BODY,
                    fontSize: 13,
                    lineHeight: 1.5,
                    color: on ? 'var(--text-muted)' : '#c8d0dc',
                    textDecoration: on ? 'line-through' : 'none',
                  }}
                >
                  {step}
                </span>
              </button>
            )
          })}
        </div>
      )}
    </div>
  )
}

export default function WarRoom({ onExit }) {
  const [ticked, setTicked] = useState(loadSteps)
  const startedAt = useMemo(() => new Date(), [])
  const sessionId = useRef(null)
  const field = useMemo(() => assessCompetitors(), [])

  useEffect(() => {
    let active = true
    startWarRoom('manual').then(({ data }) => {
      if (active && data?.id) sessionId.current = data.id
    })
    return () => {
      active = false
    }
  }, [])

  useEffect(() => {
    try {
      localStorage.setItem(STEPS_KEY, JSON.stringify(ticked))
    } catch {
      /* storage full / blocked — non-fatal */
    }
  }, [ticked])

  const toggle = key => setTicked(t => ({ ...t, [key]: !t[key] }))

  const exit = () => {
    endWarRoom(sessionId.current)
    onExit()
  }

  const pressureColor =
    field.level === 'high' ? '#ff4d6d' : field.level === 'moderate' ? '#D4A853' : '#94c864'

  return (
    <div
      style={{
        position: 'fixed',
        inset: 0,
        zIndex: 3000,
        background:
          'radial-gradient(circle at 50% 0%, rgba(158,27,27,0.35), transparent 60%), rgba(8,5,7,0.97)',
        backdropFilter: 'blur(3px)',
        WebkitBackdropFilter: 'blur(3px)',
        overflowY: 'auto',
      }}
    >
      <div style={{ maxWidth: 880, margin: '0 auto', padding: '40px 32px 64px' }}>
        {/* Header */}
        <div
          style={{
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
            gap: 16,
            flexWrap: 'wrap',
            paddingBottom: 20,
            borderBottom: '1px solid rgba(255,77,109,0.3)',
          }}
        >
          <div
            style={{
              fontFamily: FONT_HEAD,
              fontWeight: 800,
              fontSize: 22,
              letterSpacing: '0.08em',
              color: '#ff4d6d',
            }}
          >
            ⚠ WAR ROOM ACTIVE
            <span
              style={{
                fontFamily: FONT_MONO,
                fontSize: 12,
                fontWeight: 400,
                letterSpacing: '0.1em',
                color: 'var(--text-muted)',
                marginLeft: 14,
              }}
            >
              {startedAt.toLocaleDateString('en-GB')} · {fmtClock(startedAt)}
            </span>
          </div>
          <button
            onClick={exit}
            style={{
              fontFamily: FONT_MONO,
              fontSize: 12,
              letterSpacing: '0.1em',
              textTransform: 'uppercase',
              color: '#ff4d6d',
              background: 'transparent',
              border: '1px solid rgba(255,77,109,0.4)',
              borderRadius: 6,
              padding: '9px 16px',
              cursor: 'pointer',
              transition: 'background 0.15s',
            }}
            onMouseEnter={e => {
              e.currentTarget.style.background = 'rgba(255,77,109,0.12)'
            }}
            onMouseLeave={e => {
              e.currentTarget.style.background = 'transparent'
            }}
          >
            Exit War Room
          </button>
        </div>

        {/* Live competitor pressure */}
        <div
          style={{
            display: 'flex',
            alignItems: 'center',
            gap: 14,
            margin: '20px 0 24px',
            padding: '14px 18px',
            border: '1px solid rgba(255,255,255,0.07)',
            borderRadius: 8,
            background: 'rgba(255,255,255,0.02)',
          }}
        >
          <span
            style={{
              fontFamily: FONT_MONO,
              fontSize: 11,
              letterSpacing: '0.12em',
              textTransform: 'uppercase',
              color: 'var(--text-muted)',
            }}
          >
            Live competitor pressure
          </span>
          <span
            style={{
              fontFamily: FONT_HEAD,
              fontWeight: 700,
              fontSize: 18,
              color: pressureColor,
            }}
          >
            {field.pressure}/100 · {field.level.toUpperCase()}
          </span>
          <span style={{ fontFamily: FONT_MONO, fontSize: 11, color: 'var(--text-muted)' }}>
            {field.top} leading · {field.activeCount} active
          </span>
        </div>

        {/* Playbooks */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
          {PLAYBOOKS.map(pb => (
            <PlaybookCard key={pb.id} pb={pb} ticked={ticked} onToggle={toggle} />
          ))}
        </div>
      </div>
    </div>
  )
}
