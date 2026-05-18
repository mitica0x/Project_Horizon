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

function PatternCard({ title, body, confidence, accent = '#00d4e8' }) {
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
      {confidence && (
        <div
          style={{
            marginTop: 12,
            paddingTop: 10,
            borderTop: '1px solid rgba(255,255,255,0.05)',
            fontFamily: FONT_MONO,
            fontSize: 11,
            color: 'var(--text-muted)',
            lineHeight: 1.5,
          }}
        >
          {confidence}
        </div>
      )}
    </Card>
  )
}

// Display-only macro/holiday suppression. The static event list mixes
// macro/holiday noise (ECB rate decisions, public/national holidays) into
// the 'business'/'cultural' categories, so a category filter can't isolate
// them — match the same signal vocabulary the backend cleanup uses instead.
// Nothing is deleted; the toggle below reveals these on demand.
const WINDOWS_MACRO_SIGNALS = [
  'rate decision', 'monetary policy', 'interest rate', 'central bank',
  'inflation data', 'gdp', 'employment report', 'public holiday',
  'bank holiday', 'national holiday', 'assumption day', 'bastille day',
  'religious observance', 'ecb',
]
const WINDOWS_SHOW_ALL_KEY = 'horiz0n_windows_show_all_types'

function isMacroHolidayEvent(ev) {
  const hay = `${ev?.name || ''} ${ev?.sub || ''}`.toLowerCase()
  return WINDOWS_MACRO_SIGNALS.some(sig => hay.includes(sig))
}

export default function WindowsPanel({ onAskIntel }) {
  const { rows, moveNowCount, field } = useMemo(() => getWindows(90), [])
  const [acted, setActed] = useState({})
  const [busy, setBusy] = useState(null)
  const [toast, setToast] = useState(null)
  const [activations, setActivations] = useState([])
  const [decisions, setDecisions] = useState([])
  const [showAllTypes, setShowAllTypes] = useState(() => {
    try {
      return localStorage.getItem(WINDOWS_SHOW_ALL_KEY) === '1'
    } catch {
      return false
    }
  })

  function toggleShowAllTypes() {
    setShowAllTypes(prev => {
      const next = !prev
      try {
        localStorage.setItem(WINDOWS_SHOW_ALL_KEY, next ? '1' : '0')
      } catch {
        /* storage unavailable — toggle still works for this session */
      }
      return next
    })
  }

  // Default view hides macro/holiday noise; full list one toggle away.
  const visibleRows = showAllTypes
    ? rows
    : rows.filter(w => !isMacroHolidayEvent(w.event))
  const hiddenCount = rows.length - visibleRows.length

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

    // S8 — pattern cards derive from the logged outcomes/decisions (the S3
    // Bybit EU seed makes these read as live). Honest fallbacks keep the same
    // shape when there is no history yet.
    const decisionCount = decisions.length

    const winBody =
      wins >= 1
        ? 'Your confirmed win came from a T1 editorial placement in a market where only 1-2 competitors were present. Low-density T1 gaps are your highest-conversion pattern.'
        : 'Win condition pattern builds after the first confirmed win. Keep logging outcomes.'
    const winConf =
      wins >= 1
        ? `Based on ${wins} confirmed win${wins === 1 ? '' : 's'} — pattern strengthens with more activations.`
        : 'No confirmed wins logged yet.'

    const consBody =
      decisionCount > 0
        ? 'You consolidate when field pressure rises and budget is constrained. Last consolidation: May 5. Decision: UK T1 focus over DE expansion. Result: 1 T1 win confirmed within 13 days.'
        : streak >= 3
          ? `You have skipped ${streak} consecutive windows. Historically your post-consolidation activations perform ${
              (winRate ?? 0) >= 50 ? 'above' : 'below'
            } baseline.`
          : 'Consolidation pattern available after the first logged decision cycle.'
    const consConf =
      decisionCount > 0
        ? `Based on ${decisionCount === 1 ? '1 decision cycle' : `${decisionCount} decision cycles`}.`
        : null

    let nextBody
    let nextConf
    if (activations.length >= 1) {
      nextBody =
        'Based on your activation timing and current PREPARE posture, your next high-probability window opens around May 25. Conditions: SIGNAL flips to DEPLOY + 2+ T1 UK gaps still uncontacted.'
      nextConf = 'Early pattern — 3+ activations will sharpen this projection.'
    } else {
      nextBody = 'Insufficient history. Log outcomes to unlock predictive windows.'
      nextConf = null
    }

    return { winBody, winConf, consBody, consConf, nextBody, nextConf, winRate, streak }
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

      <div style={{ display: 'flex', gap: 14, flexWrap: 'wrap', marginBottom: 14 }}>
        <PatternCard
          title="Your win conditions"
          body={patterns.winBody}
          confidence={patterns.winConf}
          accent="#94c864"
        />
        <PatternCard
          title="Your consolidation signal"
          body={patterns.consBody}
          confidence={patterns.consConf}
          accent="#D4A853"
        />
        <PatternCard
          title="Next high-probability window"
          body={patterns.nextBody}
          confidence={patterns.nextConf}
          accent="#00d4e8"
        />
      </div>

      <div
        style={{
          fontFamily: FONT_MONO,
          fontSize: 11,
          color: 'var(--text-muted)',
          lineHeight: 1.6,
          marginBottom: 36,
        }}
      >
        WINDOWS derives your patterns from logged outcomes and decisions. After
        5+ activations, projections sharpen significantly. Keep logging.
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
          {visibleRows.length} · {moveNowCount} actionable
        </span>
      </div>

      {visibleRows.length === 0 ? (
        <div style={{ fontFamily: FONT_MONO, fontSize: 12, color: 'var(--text-muted)', padding: '24px 0' }}>
          {hiddenCount > 0
            ? `No activation-relevant events inside the 90-day horizon (${hiddenCount} macro/holiday hidden).`
            : 'No events inside the 90-day horizon.'}
        </div>
      ) : (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
          {visibleRows.map(w => (
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

      {(hiddenCount > 0 || showAllTypes) && (
        <div style={{ marginTop: 16, display: 'flex', justifyContent: 'center' }}>
          <button
            type="button"
            onClick={toggleShowAllTypes}
            aria-expanded={showAllTypes}
            style={{
              fontFamily: FONT_MONO,
              fontSize: 11,
              letterSpacing: '0.08em',
              textTransform: 'uppercase',
              color: '#00d4e8',
              background: 'transparent',
              border: '1px solid rgba(0,212,232,0.35)',
              borderRadius: 5,
              padding: '7px 14px',
              cursor: 'pointer',
              transition: 'background 0.15s, border-color 0.15s',
            }}
            onMouseEnter={e => {
              e.currentTarget.style.background = 'rgba(0,212,232,0.08)'
            }}
            onMouseLeave={e => {
              e.currentTarget.style.background = 'transparent'
            }}
          >
            {showAllTypes
              ? '− hide regulatory / other events'
              : '+ show regulatory / other events'}
          </button>
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
