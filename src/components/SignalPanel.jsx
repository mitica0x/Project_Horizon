import { useMemo } from 'react'
import { getWindows, getDayStatus, assessCompetitors, computeSignal } from '../utils/horizonData'
import { intelKit } from '../utils/intelKit'
import { GAPS_T1, GAPS_T2, SCORE } from '../data/staticData'
import { fmtDate } from '../../lib/radar/scoring'
import {
  Card,
  Badge,
  MeterBar,
  PanelHeader,
  RagDot,
  AskIntelButton,
  FONT_HEAD,
  FONT_BODY,
  FONT_MONO,
} from './horizonUI'

// P8 — Budget Deployment Signal. One dominant verdict + posture intelligence
// (duration, what flips it, track record, 90-day rhythm, field posture).

export const VERDICT = {
  DEPLOY:  { color: '#00d4e8', budget: 'HIGH',    blurb: 'Conditions align — put budget behind the open window now.' },
  PREPARE: { color: '#94c864', budget: 'MEDIUM',  blurb: 'Signals are mixed — stage assets, hold spend until the window firms up.' },
  HOLD:    { color: '#D4A853', budget: 'MINIMAL', blurb: 'No open window and the field is hot — preserve budget.' },
}

const FLIP_LINE = {
  DEPLOY: 'Sustained activation performance above 60% WIN rate would extend this posture.',
  HOLD: 'Two consecutive high-WIN activations or a DEPLOY-grade event would move this to DEPLOY.',
  PREPARE: 'No action needed yet — monitor EVENTS for emerging opportunities.',
}

// 90-day rhythm colours are spec-pinned for this chart.
const RHYTHM = { DEPLOY: '#00d4e8', HOLD: '#f59e0b', PREPARE: '#94c864' }

const FIELD_POSTURE = [
  { name: 'Binance', posture: 'ACTIVE',   color: '#00d4e8' },
  { name: 'OKX',     posture: 'BUILDING', color: '#D4A853' },
  { name: 'Bitget',  posture: 'QUIET',    color: '#8892a4' },
]

const POSTURE_KEY = 'horizon_signal_posture'
const HISTORY_KEY = 'horizon_signal_history'
const DAY = 86400000

// S7 — posture-duration fix. "You have been in PREPARE for 0 days" was wrong
// on first sight. Store a per-verdict start date; default to 3 days ago when
// none exists so the demo never shows a 0-day posture.
const POSTURE_START_PREFIX = 'horizon_posture_start_'
function postureStartDays(verdict) {
  const key = POSTURE_START_PREFIX + verdict
  let start = null
  try { start = localStorage.getItem(key) } catch { start = null }
  if (!start) {
    start = new Date(Date.now() - 3 * DAY).toISOString()
    try { localStorage.setItem(key, start) } catch { /* ignore */ }
  }
  return Math.max(0, Math.floor((Date.now() - new Date(start).getTime()) / DAY))
}

// Lightweight OPP proxy for static GAPS (lower competitor density → higher
// opportunity). Mirrors the ScanResultsPanel intuition without importing it.
function oppFor(gap) {
  const n = (gap.competitors || []).length || 1
  return Math.max(55, Math.min(95, 95 - (n - 1) * 9))
}
function geoOf(country) {
  if (!country || country === 'GLOBAL') return 'Global'
  if (country === 'UK' || country === 'GB') return 'UK'
  return country
}
function pathOf(url) {
  const d = url.split('/')[0]
  const rest = url.slice(d.length)
  return rest && rest !== '/' ? rest : ''
}

// Posture persistence: track current verdict + when it started; roll the
// previous posture into history when it changes.
function readJSON(key, fallback) {
  try {
    const v = JSON.parse(localStorage.getItem(key) || 'null')
    return v ?? fallback
  } catch {
    return fallback
  }
}

function resolvePosture(currentSignal) {
  const now = Date.now()
  let posture = readJSON(POSTURE_KEY, null)
  let history = readJSON(HISTORY_KEY, [])
  if (!Array.isArray(history)) history = []

  if (!posture || !posture.signal) {
    posture = { signal: currentSignal, since: new Date(now).toISOString() }
  } else if (posture.signal !== currentSignal) {
    const days = Math.max(1, Math.round((now - new Date(posture.since).getTime()) / DAY))
    history = [{ signal: posture.signal, days }, ...history].slice(0, 12)
    posture = { signal: currentSignal, since: new Date(now).toISOString() }
  }

  try {
    localStorage.setItem(POSTURE_KEY, JSON.stringify(posture))
    localStorage.setItem(HISTORY_KEY, JSON.stringify(history))
  } catch {
    /* ignore */
  }

  if (history.length === 0) {
    history = [
      { signal: 'PREPARE', days: 12 },
      { signal: 'HOLD', days: 9 },
      { signal: 'DEPLOY', days: 6 },
    ]
  }

  const durationDays = Math.max(
    0,
    Math.round((now - new Date(posture.since).getTime()) / DAY),
  )
  return { posture, history, durationDays }
}

function Section({ title, children }) {
  return (
    <div style={{ marginTop: 28 }}>
      <div
        style={{
          fontFamily: FONT_MONO,
          fontSize: 11,
          letterSpacing: '0.14em',
          textTransform: 'uppercase',
          color: 'var(--text-muted)',
          marginBottom: 14,
        }}
      >
        {title}
      </div>
      {children}
    </div>
  )
}

// S7 — verdict-driven "What to do now" action block.
function WhatToDoNow({ verdict, onAskIntel, onNav }) {
  const draftGap = g => {
    const geo = geoOf(g.country)
    const comp = (g.competitors || [])[0] || 'a competitor'
    const url = `${g.domain}${pathOf(g.url)}`
    // Spec prompt — affiliate/sponsored listing pitch to the editor or
    // partnerships team. Kept verbatim so every DRAFT OUTREACH entry sends
    // the same prompt to Ask C0insiglieri.
    const prompt =
      `Draft a cold outreach email to the editor or partnerships team at ${url}. ` +
      `Context: this page currently lists Bybit's competitors (Crypto.com, OKX etc.) ` +
      `but does not mention Bybit. We want to propose an affiliate partnership or ` +
      `sponsored listing. Tone: professional, direct, no fluff.`
    onAskIntel?.(
      `Budget signal verdict is ${verdict}. Acting on gap ${url} — ${geo}, ${comp} currently listed.`,
      { insight: 'Outreach context loaded — tap below to draft.', chips: [prompt] },
    )
  }

  const GapLine = ({ g }) => {
    const opp = oppFor(g)
    const gapPath = pathOf(g.url)
    const visibleUrl = `${g.domain}${gapPath}`
    return (
      <div style={{ marginBottom: 12 }}>
        <div style={{ fontFamily: FONT_MONO, fontSize: 12, color: '#c8d0dc' }}>
          <a
            href={visibleUrl.startsWith('http') ? visibleUrl : `https://${visibleUrl}`}
            target="_blank"
            rel="noopener noreferrer"
            onClick={(e) => e.stopPropagation()}
            title={`Open ${visibleUrl} — verify Bybit absence`}
            style={{ color: 'var(--cyan)', textDecoration: 'underline', cursor: 'pointer' }}
          >
            {visibleUrl}
          </a> —{' '}
          <span style={{ color: 'var(--cyan)' }}>{geoOf(g.country)} T1</span> —{' '}
          <span style={{ color: opp >= 80 ? '#94c864' : '#D4A853', fontWeight: 700 }}>
            OPP {opp}
          </span>
        </div>
        <button
          onClick={() => draftGap(g)}
          style={{
            marginTop: 5,
            fontFamily: FONT_MONO,
            fontSize: 10,
            fontWeight: 700,
            letterSpacing: '0.06em',
            color: 'var(--cyan)',
            background: 'transparent',
            border: '1px solid rgba(0,212,232,0.4)',
            borderRadius: 4,
            padding: '4px 10px',
            cursor: 'pointer',
          }}
        >
          DRAFT OUTREACH
        </button>
      </div>
    )
  }

  const NavLine = ({ label, nav, tab }) => (
    <button
      onClick={() => onNav?.(nav, tab ? { tab } : undefined)}
      style={{
        display: 'flex',
        alignItems: 'center',
        gap: 10,
        width: '100%',
        textAlign: 'left',
        background: 'transparent',
        border: 'none',
        padding: '9px 0',
        cursor: 'pointer',
        fontFamily: FONT_BODY,
        fontSize: 14,
        color: '#c8d0dc',
      }}
      onMouseEnter={e => (e.currentTarget.style.color = 'var(--white)')}
      onMouseLeave={e => (e.currentTarget.style.color = '#c8d0dc')}
    >
      <span style={{ color: '#94c864' }}>·</span>
      <span style={{ flex: 1 }}>{label}</span>
      <span style={{ color: '#94c864' }}>→</span>
    </button>
  )

  const topT1 = [...GAPS_T1].sort((a, b) => oppFor(b) - oppFor(a)).slice(0, 3)
  const easy = (GAPS_T2 || []).slice(0, 3)
  const toScore = Math.min(100, SCORE + 12)

  let body
  if (verdict === 'DEPLOY') {
    body = (
      <>
        <div style={{ fontFamily: FONT_BODY, fontSize: 14, color: '#c8d0dc', marginBottom: 14 }}>
          Window is open. Activate on these gaps this week:
        </div>
        {topT1.map(g => (
          <GapLine key={g.url} g={g} />
        ))}
        <div
          style={{
            marginTop: 8,
            fontFamily: FONT_MONO,
            fontSize: 13,
            fontWeight: 700,
            color: '#94c864',
          }}
        >
          Executing all 3 moves this score from {SCORE}% to {toScore}%.
        </div>
      </>
    )
  } else if (verdict === 'HOLD') {
    body = (
      <>
        <div style={{ fontFamily: FONT_BODY, fontSize: 14, color: '#c8d0dc', marginBottom: 8 }}>
          Field pressure is low. Use this period:
        </div>
        <NavLine label="Log any unrecorded outcomes in HISTORY" nav="history" tab="outcomes" />
        <NavLine label="Capture recent decisions in HISTORY" nav="history" tab="decisions" />
        <NavLine
          label="Let competitors over-extend — your next event is projected in EVENTS"
          nav="events"
        />
      </>
    )
  } else {
    body = (
      <>
        <div style={{ fontFamily: FONT_BODY, fontSize: 14, color: '#c8d0dc', marginBottom: 8 }}>
          Not yet. These conditions would trigger DEPLOY:
        </div>
        <div
          style={{
            fontFamily: FONT_BODY,
            fontSize: 14,
            color: 'var(--text-muted)',
            lineHeight: 1.7,
            marginBottom: 16,
          }}
        >
          {FLIP_LINE.PREPARE}
        </div>
        <div style={{ fontFamily: FONT_BODY, fontSize: 14, color: '#c8d0dc', marginBottom: 12 }}>
          While you wait — these gaps are affiliate-ready, lower effort, can start now:
        </div>
        {easy.map(g => (
          <GapLine key={g.url} g={g} />
        ))}
      </>
    )
  }

  return <Section title="What to do now">{body}</Section>
}

export default function SignalPanel({ onAskIntel, onNav, hideHeader = false }) {
  const sig = useMemo(() => computeSignal(), [])
  const { posture, history } = useMemo(
    () => resolvePosture(sig.verdict),
    [sig.verdict],
  )
  const durationDays = useMemo(() => postureStartDays(sig.verdict), [sig.verdict])
  const v = VERDICT[sig.verdict]

  // 90-day rhythm distribution — from history if rich enough, else seeded.
  const rhythm = useMemo(() => {
    const acc = { DEPLOY: 0, HOLD: 0, PREPARE: 0 }
    history.forEach(h => {
      if (acc[h.signal] != null) acc[h.signal] += h.days
    })
    acc[posture.signal] += durationDays
    let total = acc.DEPLOY + acc.HOLD + acc.PREPARE
    if (total < 10) {
      return [
        { k: 'DEPLOY', pct: 31 },
        { k: 'HOLD', pct: 38 },
        { k: 'PREPARE', pct: 31 },
      ]
    }
    return ['DEPLOY', 'HOLD', 'PREPARE'].map(k => ({
      k,
      pct: Math.round((acc[k] / total) * 100),
    }))
  }, [history, posture, durationDays])

  const intelContext = () =>
    `You are reviewing the budget deployment signal. Current posture: ${sig.verdict}, held ${durationDays} day(s), confidence ${sig.confidence}%. Field pressure ${sig.field.pressure}/100 (${sig.field.level}).`

  return (
    <>
      {!hideHeader && <PanelHeader
        title="Budget Deployment Signal"
        accent="#94c864"
        sub="One read on whether to spend — refreshed every load"
        right={
          onAskIntel && (
            <AskIntelButton
              onClick={() =>
                onAskIntel(intelContext(), intelKit.signal({ days: durationDays }))
              }
            />
          )
        }
      />}

      {/* Recommendation card — verdict + confidence + drivers on the left,
          flip-conditions and "What to do now" on the right. Track record,
          90-day rhythm, field posture, and next-reassessment sit full-width
          below the grid. */}
      <Card style={{ padding: '34px 36px', borderColor: v.color + '40' }}>
        <div
          style={{
            display: 'grid',
            gridTemplateColumns: '1fr 1fr',
            gap: '24px 32px',
            alignItems: 'start',
          }}
        >
          {/* LEFT COLUMN */}
          <div>
            <div
              style={{
                fontFamily: FONT_MONO,
                fontSize: 11,
                letterSpacing: '0.16em',
                textTransform: 'uppercase',
                color: 'var(--text-muted)',
                marginBottom: 8,
              }}
            >
              Verdict
            </div>
            <div
              style={{
                fontFamily: FONT_HEAD,
                fontWeight: 800,
                fontSize: 52,
                letterSpacing: '0.04em',
                lineHeight: 1,
                color: v.color,
              }}
            >
              {sig.verdict}
            </div>
            <div
              style={{
                fontFamily: FONT_BODY,
                fontSize: 14,
                color: '#c8d0dc',
                marginTop: 12,
              }}
            >
              {v.blurb}
              {sig.verdict === 'PREPARE' && sig.nextMove
                ? ` Window opening: ${fmtDate(sig.nextMove.event.date)} (${sig.nextMove.daysOut}d).`
                : ''}
            </div>

            <div style={{ marginTop: 24 }}>
              <div
                style={{
                  fontFamily: FONT_MONO,
                  fontSize: 11,
                  letterSpacing: '0.16em',
                  textTransform: 'uppercase',
                  color: 'var(--text-muted)',
                  marginBottom: 8,
                }}
              >
                Confidence
              </div>
              <div
                style={{
                  fontFamily: FONT_HEAD,
                  fontWeight: 800,
                  fontSize: 34,
                  color: v.color,
                  marginBottom: 8,
                }}
              >
                {sig.confidence}%
              </div>
              <MeterBar pct={sig.confidence} color={v.color} height={7} />
              <div style={{ marginTop: 16 }}>
                <span
                  style={{
                    fontFamily: FONT_MONO,
                    fontSize: 10,
                    letterSpacing: '0.12em',
                    textTransform: 'uppercase',
                    color: 'var(--text-muted)',
                    marginRight: 8,
                  }}
                >
                  Budget
                </span>
                <Badge color={v.color} bg="transparent" border={v.color + '4d'}>
                  {v.budget} effort
                </Badge>
              </div>
            </div>

            <Section title="Posture duration">
              <div style={{ fontFamily: FONT_BODY, fontSize: 15, color: '#c8d0dc' }}>
                You have been in{' '}
                <span style={{ color: v.color, fontFamily: FONT_HEAD, fontWeight: 700 }}>
                  {sig.verdict}
                </span>{' '}
                for{' '}
                <span style={{ color: v.color, fontFamily: FONT_HEAD, fontWeight: 700 }}>
                  {durationDays}
                </span>{' '}
                {durationDays === 1 ? 'day' : 'days'}.
              </div>
            </Section>

            <div
              style={{
                fontFamily: FONT_MONO,
                fontSize: 11,
                letterSpacing: '0.14em',
                textTransform: 'uppercase',
                color: 'var(--text-muted)',
                margin: '28px 0 14px',
              }}
            >
              Signals driving this verdict
            </div>
            {sig.inputs.map((s, i) => (
              <div
                key={s.label}
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  gap: 14,
                  padding: '13px 0',
                  borderBottom:
                    i < sig.inputs.length - 1 ? '1px solid rgba(255,255,255,0.04)' : 'none',
                }}
              >
                <RagDot rag={s.rag} size={9} />
                <span
                  style={{ flex: '0 0 160px', fontFamily: FONT_BODY, fontSize: 14, color: 'var(--white)' }}
                >
                  {s.label}
                </span>
                <span style={{ flex: 1, fontFamily: FONT_MONO, fontSize: 12, color: 'var(--text-muted)', minWidth: 0 }}>
                  {s.detail}
                </span>
              </div>
            ))}
          </div>

          {/* RIGHT COLUMN */}
          <div>
            <Section title="What would flip it">
              <div style={{ fontFamily: FONT_BODY, fontSize: 14, color: 'var(--text-muted)', lineHeight: 1.7 }}>
                {FLIP_LINE[sig.verdict]}
              </div>
            </Section>

            <WhatToDoNow verdict={sig.verdict} onAskIntel={onAskIntel} onNav={onNav} />
          </div>
        </div>

        {/* Sections below the 2-col grid — full width */}
        <Section title="Signal track record">
          <div style={{ display: 'flex', gap: 10, flexWrap: 'wrap' }}>
            {history.slice(0, 5).map((h, i) => (
              <div
                key={i}
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  gap: 8,
                  padding: '8px 12px',
                  border: '1px solid var(--border)',
                  borderRadius: 6,
                  background: 'rgba(255,255,255,0.02)',
                }}
              >
                <span
                  style={{
                    width: 7,
                    height: 7,
                    borderRadius: '50%',
                    background: RHYTHM[h.signal] || '#8892a4',
                    flexShrink: 0,
                  }}
                />
                <span style={{ fontFamily: FONT_MONO, fontSize: 11, color: '#c8d0dc' }}>
                  {h.signal}
                </span>
                <span style={{ fontFamily: FONT_MONO, fontSize: 11, color: 'var(--text-muted)' }}>
                  {h.days}d
                </span>
              </div>
            ))}
          </div>
        </Section>

        <Section title="90-day posture rhythm">
          <div
            style={{
              display: 'flex',
              width: '100%',
              height: 16,
              borderRadius: 99,
              overflow: 'hidden',
              border: '1px solid var(--border)',
            }}
          >
            {rhythm.map(seg => (
              <div
                key={seg.k}
                title={`${seg.k} ${seg.pct}%`}
                style={{ width: `${seg.pct}%`, background: RHYTHM[seg.k] }}
              />
            ))}
          </div>
          <div style={{ display: 'flex', gap: 18, marginTop: 10, flexWrap: 'wrap' }}>
            {rhythm.map(seg => (
              <span
                key={seg.k}
                style={{ display: 'flex', alignItems: 'center', gap: 6, fontFamily: FONT_MONO, fontSize: 11, color: 'var(--text-muted)' }}
              >
                <span
                  style={{ width: 8, height: 8, borderRadius: 2, background: RHYTHM[seg.k] }}
                />
                {seg.k} {seg.pct}%
              </span>
            ))}
          </div>
        </Section>

        <Section title="Field posture">
          <div style={{ display: 'flex', flexDirection: 'column', gap: 0 }}>
            {FIELD_POSTURE.map((c, i) => (
              <div
                key={c.name}
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'space-between',
                  padding: '12px 0',
                  borderBottom:
                    i < FIELD_POSTURE.length - 1 ? '1px solid rgba(255,255,255,0.04)' : 'none',
                }}
              >
                <span style={{ fontFamily: FONT_HEAD, fontWeight: 700, fontSize: 14, color: 'var(--white)' }}>
                  {c.name}
                </span>
                <Badge color={c.color} bg="transparent" border={c.color + '4d'}>
                  {c.posture}
                </Badge>
              </div>
            ))}
          </div>
        </Section>

        <div
          style={{
            marginTop: 26,
            paddingTop: 16,
            borderTop: '1px solid rgba(255,255,255,0.06)',
            fontFamily: FONT_MONO,
            fontSize: 12,
            color: 'var(--text-muted)',
          }}
        >
          Next reassessment: <span style={{ color: 'var(--cyan)' }}>{sig.reassess}</span>
        </div>
      </Card>
    </>
  )
}
