import { useState, useMemo } from 'react'
import { getWindows } from '../utils/horizonData'
import { fmtDate } from '../../lib/radar/scoring'
import { activateEvent, dismissEvent } from '../lib/horizonStore'
import { Card, Badge, MeterBar, PanelHeader, FONT_HEAD, FONT_BODY, FONT_MONO } from './horizonUI'

// P3 — Predictive Windows. Upcoming 90-day event windows ranked by
// opportunity. Activate / Dismiss here is the missing frontend write-path:
// Activate → activations + 'activate' decision; Dismiss → 'skip' decision.

const ACTION_STYLE = {
  'MOVE NOW': { color: '#00d4e8', bg: 'rgba(0,212,232,0.12)', border: 'rgba(0,212,232,0.35)' },
  PREPARE:    { color: '#D4A853', bg: 'rgba(212,168,83,0.12)', border: 'rgba(212,168,83,0.35)' },
  MONITOR:    { color: '#8892a4', bg: 'rgba(255,255,255,0.04)', border: 'var(--border)' },
}

const OPEN_STYLE = {
  'OPEN FIELD': '#94c864',
  CONTESTED:    '#D4A853',
  CROWDED:      '#ff4d6d',
}

function countdown(d) {
  if (d <= 0) return 'Today'
  if (d === 1) return 'Tomorrow'
  return `in ${d} days`
}

function ActionBtn({ children, tone, onClick, disabled }) {
  return (
    <button
      onClick={onClick}
      disabled={disabled}
      style={{
        fontFamily: FONT_MONO,
        fontSize: 11,
        letterSpacing: '0.08em',
        textTransform: 'uppercase',
        color: disabled ? 'var(--text-muted)' : tone,
        background: 'transparent',
        border: `1px solid ${disabled ? 'var(--border)' : tone + '66'}`,
        borderRadius: 5,
        padding: '7px 14px',
        cursor: disabled ? 'default' : 'pointer',
        transition: 'background 0.15s, border-color 0.15s',
      }}
      onMouseEnter={e => {
        if (!disabled) e.currentTarget.style.background = tone + '14'
      }}
      onMouseLeave={e => {
        e.currentTarget.style.background = 'transparent'
      }}
    >
      {children}
    </button>
  )
}

function Metric({ label, children }) {
  return (
    <div style={{ minWidth: 120 }}>
      <div
        style={{
          fontFamily: FONT_MONO,
          fontSize: 10,
          letterSpacing: '0.12em',
          textTransform: 'uppercase',
          color: 'var(--text-muted)',
          marginBottom: 6,
        }}
      >
        {label}
      </div>
      {children}
    </div>
  )
}

function WindowCard({ w, acted, onActivate, onDismiss }) {
  const a = ACTION_STYLE[w.action]
  const ev = w.event
  return (
    <Card style={{ padding: '18px 22px' }}>
      <div
        style={{
          display: 'flex',
          alignItems: 'flex-start',
          justifyContent: 'space-between',
          gap: 16,
          flexWrap: 'wrap',
        }}
      >
        <div style={{ minWidth: 240, flex: 1 }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 4 }}>
            <span
              style={{ fontFamily: FONT_HEAD, fontWeight: 700, fontSize: 15, color: 'var(--white)' }}
            >
              {ev.name}
            </span>
            <Badge color={a.color} bg={a.bg} border={a.border}>
              {w.action}
            </Badge>
          </div>
          <div style={{ fontFamily: FONT_BODY, fontSize: 13, color: 'var(--text-muted)' }}>
            {ev.sub}
          </div>
          <div
            style={{
              fontFamily: FONT_MONO,
              fontSize: 12,
              color: 'var(--cyan)',
              marginTop: 6,
            }}
          >
            {fmtDate(ev.date)} · {countdown(w.daysOut)} · {ev.geo}
          </div>
        </div>

        <div style={{ display: 'flex', gap: 26, flexWrap: 'wrap' }}>
          <Metric label="Opportunity">
            <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
              <span
                style={{ fontFamily: FONT_HEAD, fontWeight: 700, fontSize: 18, color: a.color }}
              >
                {w.opportunity}
              </span>
              <div style={{ width: 70 }}>
                <MeterBar pct={w.opportunity} color={a.color} height={6} />
              </div>
            </div>
          </Metric>
          <Metric label="Competitor pressure">
            <span style={{ fontFamily: FONT_MONO, fontSize: 13, color: '#c8d0dc' }}>
              {w.pressureCount} active · {w.pressurePct}%
            </span>
          </Metric>
          <Metric label="Field">
            <Badge
              color={OPEN_STYLE[w.opennessLabel]}
              bg="transparent"
              border={OPEN_STYLE[w.opennessLabel] + '4d'}
            >
              {w.opennessLabel}
            </Badge>
          </Metric>
        </div>
      </div>

      <div
        style={{
          display: 'flex',
          justifyContent: 'flex-end',
          gap: 10,
          marginTop: 16,
          paddingTop: 14,
          borderTop: '1px solid rgba(255,255,255,0.05)',
        }}
      >
        {acted === 'activate' ? (
          <Badge color="#94c864" bg="rgba(148,200,100,0.12)" border="rgba(148,200,100,0.4)">
            ✓ Activated
          </Badge>
        ) : acted === 'skip' ? (
          <Badge color="#ff4d6d" bg="rgba(255,77,109,0.1)" border="rgba(255,77,109,0.35)">
            Dismissed
          </Badge>
        ) : (
          <>
            <ActionBtn tone="#ff4d6d" onClick={onDismiss}>
              Dismiss
            </ActionBtn>
            <ActionBtn tone="#94c864" onClick={onActivate}>
              Activate
            </ActionBtn>
          </>
        )}
      </div>
    </Card>
  )
}

export default function WindowsPanel() {
  const { rows, moveNowCount, field } = useMemo(() => getWindows(90), [])
  const [acted, setActed] = useState({})
  const [busy, setBusy] = useState(null)
  const [toast, setToast] = useState(null)

  const snapshotFor = w => ({
    opportunity: w.opportunity,
    pressureCount: w.pressureCount,
    pressurePct: w.pressurePct,
    action: w.action,
    daysOut: w.daysOut,
    field: { pressure: field.pressure, level: field.level, top: field.top },
  })

  const flash = msg => {
    setToast(msg)
    setTimeout(() => setToast(null), 2600)
  }

  const onActivate = async w => {
    if (busy) return
    setBusy(w.event.name)
    const { error } = await activateEvent({
      eventName: w.event.name,
      note: `Activated from Predictive Windows · ${w.action} · opp ${w.opportunity}`,
      snapshot: snapshotFor(w),
    })
    setBusy(null)
    if (error) {
      flash(`Activation logged locally — Supabase: ${String(error).slice(0, 60)}`)
    } else {
      flash(`${w.event.name} activated — tracked in Outcomes & Ledger`)
    }
    setActed(s => ({ ...s, [w.event.name]: 'activate' }))
  }

  const onDismiss = async w => {
    if (busy) return
    setBusy(w.event.name)
    await dismissEvent({
      eventName: w.event.name,
      rationale: `Dismissed from Predictive Windows · ${w.action}`,
      snapshot: snapshotFor(w),
    })
    setBusy(null)
    flash(`${w.event.name} dismissed — logged to Ledger (revisit in 14 days)`)
    setActed(s => ({ ...s, [w.event.name]: 'skip' }))
  }

  return (
    <>
      <PanelHeader
        title="Predictive Windows"
        accent="#00d4e8"
        count={rows.length}
        sub={`Next 90 days · ${moveNowCount} actionable window${
          moveNowCount === 1 ? '' : 's'
        } detected`}
      />

      {rows.length === 0 ? (
        <div
          style={{
            fontFamily: FONT_MONO,
            fontSize: 12,
            color: 'var(--text-muted)',
            padding: '32px 0',
          }}
        >
          No events inside the 90-day horizon.
        </div>
      ) : (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
          {rows.map(w => (
            <WindowCard
              key={w.event.id}
              w={w}
              acted={acted[w.event.name]}
              onActivate={() => onActivate(w)}
              onDismiss={() => onDismiss(w)}
            />
          ))}
        </div>
      )}

      {toast && (
        <div
          style={{
            position: 'fixed',
            bottom: 24,
            left: '50%',
            transform: 'translateX(-50%)',
            zIndex: 400,
            background: '#131929',
            border: '1px solid rgba(0,212,232,0.3)',
            borderRadius: 8,
            padding: '12px 20px',
            fontFamily: FONT_MONO,
            fontSize: 12,
            color: '#00d4e8',
            boxShadow: '0 8px 30px rgba(0,0,0,0.5)',
          }}
        >
          {toast}
        </div>
      )}
    </>
  )
}
