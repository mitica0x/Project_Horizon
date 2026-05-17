import { useState, useEffect, useMemo } from 'react'
import { getWindows } from '../utils/horizonData'
import { intelKit } from '../utils/intelKit'
import { fmtDate } from '../../lib/radar/scoring'
import { activateEvent, dismissEvent, fetchActivations, fetchDecisions } from '../lib/horizonStore'
import {
  Card,
  Badge,
  MeterBar,
  PanelHeader,
  AskIntelButton,
  FONT_HEAD,
  FONT_BODY,
  FONT_MONO,
} from './horizonUI'

// P3 — Windows, reframed as operational pattern intelligence: when YOU win,
// when you consolidate, and where your next window is building. Upcoming
// events are demoted to reference context. Activate/Dismiss write-path kept.

const ACTION_STYLE = {
  'MOVE NOW': { color: '#00d4e8', bg: 'rgba(0,212,232,0.12)', border: 'rgba(0,212,232,0.35)' },
  PREPARE:    { color: '#D4A853', bg: 'rgba(212,168,83,0.12)', border: 'rgba(212,168,83,0.35)' },
  MONITOR:    { color: '#8892a4', bg: 'rgba(255,255,255,0.04)', border: 'var(--border)' },
}
const OPEN_STYLE = { 'OPEN FIELD': '#94c864', CONTESTED: '#D4A853', CROWDED: '#ff4d6d' }

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
          <div style={{ fontFamily: FONT_MONO, fontSize: 12, color: 'var(--cyan)', marginTop: 6 }}>
            {fmtDate(ev.date)} · {countdown(w.daysOut)} · {ev.geo}
          </div>
        </div>

        <div style={{ display: 'flex', gap: 26, flexWrap: 'wrap' }}>
          <Metric label="Opportunity">
            <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
              <span style={{ fontFamily: FONT_HEAD, fontWeight: 700, fontSize: 18, color: a.color }}>
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
          <Badge color="#8892a4" bg="rgba(255,255,255,0.04)" border="var(--border)">
            Dismissed
          </Badge>
        ) : (
          <>
            <ActionBtn tone="#8892a4" onClick={onDismiss}>
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

function PatternCard({ title, body, accent = '#00d4e8' }) {
  return (
    <Card style={{ padding: '20px 22px', flex: 1, minWidth: 240 }}>
      <div
        style={{
          fontFamily: FONT_HEAD,
          fontWeight: 700,
          fontSize: 13,
          letterSpacing: '0.1em',
          textTransform: 'uppercase',
          color: accent,
          marginBottom: 12,
        }}
      >
        {title}
      </div>
      <div style={{ fontFamily: FONT_BODY, fontSize: 14, color: '#c8d0dc', lineHeight: 1.65 }}>
        {body}
      </div>
    </Card>
  )
}

export default function WindowsPanel({ onAskIntel }) {
  const { rows, moveNowCount, field } = useMemo(() => getWindows(90), [])
  const [acted, setActed] = useState({})
  const [busy, setBusy] = useState(null)
  const [toast, setToast] = useState(null)
  const [activations, setActivations] = useState([])
  const [decisions, setDecisions] = useState([])

  useEffect(() => {
    fetchActivations().then(({ data }) => setActivations(data || []))
    fetchDecisions().then(({ data }) => setDecisions(data || []))
  }, [])

  const patterns = useMemo(() => {
    const withOutcome = activations.filter(a => a.outcome)
    const wins = withOutcome.filter(a => a.outcome === 'win').length
    const winRate = withOutcome.length
      ? Math.round((wins / withOutcome.length) * 100)
      : null

    // leading consecutive-skip streak (decisions are newest-first)
    let streak = 0
    for (const d of decisions) {
      if (d.decision === 'skip') streak++
      else break
    }

    const winBody =
      winRate != null && withOutcome.length >= 5
        ? `You convert at ${winRate}% when you activate within 7 days of a DEPLOY signal.`
        : 'Win condition pattern builds after 5 logged outcomes. Keep logging.'

    const consBody =
      streak >= 3
        ? `You have skipped ${streak} consecutive windows. Historically your post-consolidation activations perform ${
            (winRate ?? 0) >= 50 ? 'above' : 'below'
          } baseline.`
        : 'Consolidation pattern available after 3 consecutive skips logged.'

    let nextBody
    if (activations.length >= 2) {
      const times = activations
        .map(a => new Date(a.activated_at || a.created_at).getTime())
        .filter(Boolean)
        .sort((x, y) => y - x)
      let est = 14
      if (times.length >= 2) {
        const gaps = []
        for (let i = 0; i < times.length - 1; i++)
          gaps.push((times[i] - times[i + 1]) / 86400000)
        const avg = gaps.reduce((s, g) => s + g, 0) / gaps.length
        const sinceLast = (Date.now() - times[0]) / 86400000
        est = Math.max(1, Math.round(avg - sinceLast))
      }
      nextBody = `Based on your activation rhythm, a high-performance window is estimated in ${est} days.`
    } else {
      nextBody = 'Insufficient history. Log outcomes to unlock predictive windows.'
    }

    return { winBody, consBody, nextBody, winRate, streak }
  }, [activations, decisions])

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
      note: `Activated from Windows · ${w.action} · opp ${w.opportunity}`,
      snapshot: snapshotFor(w),
    })
    setBusy(null)
    flash(
      error
        ? `Activation logged locally — Supabase: ${String(error).slice(0, 60)}`
        : `${w.event.name} activated — tracked in Outcomes & Ledger`,
    )
    setActed(s => ({ ...s, [w.event.name]: 'activate' }))
  }

  const onDismiss = async w => {
    if (busy) return
    setBusy(w.event.name)
    await dismissEvent({
      eventName: w.event.name,
      rationale: `Dismissed from Windows · ${w.action}`,
      snapshot: snapshotFor(w),
    })
    setBusy(null)
    flash(`${w.event.name} dismissed — logged to Ledger (revisit in 14 days)`)
    setActed(s => ({ ...s, [w.event.name]: 'skip' }))
  }

  const intelContext = () =>
    `You are reviewing operational windows and historical patterns. Win rate: ${
      patterns.winRate != null ? patterns.winRate + '%' : 'insufficient data'
    }. Consecutive skips: ${patterns.streak}. ${moveNowCount} MOVE NOW window(s) in 90d. Field pressure ${field.pressure}/100.`

  return (
    <>
      <PanelHeader
        title="Windows"
        accent="#00d4e8"
        sub="Your operational patterns — when you activate and win, when you consolidate, and where your next window is building."
        right={
          onAskIntel && (
            <AskIntelButton onClick={() => onAskIntel(intelContext(), intelKit.windows())} />
          )
        }
      />

      <div
        style={{
          fontFamily: FONT_MONO,
          fontSize: 10,
          letterSpacing: '0.16em',
          textTransform: 'uppercase',
          color: 'var(--text-muted)',
          marginBottom: 12,
        }}
      >
        Derived from your history
      </div>

      <div style={{ display: 'flex', gap: 14, flexWrap: 'wrap', marginBottom: 36 }}>
        <PatternCard title="Your win conditions" body={patterns.winBody} accent="#94c864" />
        <PatternCard title="Your consolidation signal" body={patterns.consBody} accent="#D4A853" />
        <PatternCard title="Next high-probability window" body={patterns.nextBody} accent="#00d4e8" />
      </div>

      {/* Divider — events demoted to reference */}
      <div
        style={{
          display: 'flex',
          alignItems: 'center',
          gap: 14,
          margin: '8px 0 20px',
        }}
      >
        <span
          style={{
            fontFamily: FONT_MONO,
            fontSize: 11,
            letterSpacing: '0.14em',
            textTransform: 'uppercase',
            color: 'var(--text-muted)',
            whiteSpace: 'nowrap',
          }}
        >
          Upcoming Events — for context
        </span>
        <span style={{ flex: 1, height: 1, background: 'var(--border)' }} />
        <span style={{ fontFamily: FONT_MONO, fontSize: 11, color: 'var(--text-muted)' }}>
          {rows.length} · {moveNowCount} actionable
        </span>
      </div>

      {rows.length === 0 ? (
        <div style={{ fontFamily: FONT_MONO, fontSize: 12, color: 'var(--text-muted)', padding: '24px 0' }}>
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
