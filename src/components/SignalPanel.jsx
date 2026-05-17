import { useMemo } from 'react'
import { getWindows, getDayStatus, assessCompetitors } from '../utils/horizonData'
import { GAPS_T1 } from '../data/staticData'
import { fmtDate } from '../../lib/radar/scoring'
import { Card, Badge, MeterBar, PanelHeader, RagDot, FONT_HEAD, FONT_BODY, FONT_MONO } from './horizonUI'

// P8 — Budget Deployment Signal. One dominant verdict (DEPLOY / HOLD /
// PREPARE) derived from windows + competitor pressure + sentiment + open
// gaps. Recomputed every mount (page load).

const VERDICT = {
  DEPLOY:  { color: '#94c864', budget: 'HIGH',    blurb: 'Conditions align — put budget behind the open window now.' },
  PREPARE: { color: '#D4A853', budget: 'MEDIUM',  blurb: 'Signals are mixed — stage assets, hold spend until the window firms up.' },
  HOLD:    { color: '#ff4d6d', budget: 'MINIMAL', blurb: 'No open window and the field is hot — preserve budget.' },
}

function computeSignal() {
  const { rows } = getWindows(90)
  const field = assessCompetitors()
  const status = getDayStatus()
  const sentiment =
    status.signals.find(s => s.label === 'Market Sentiment')?.rag || 'amber'

  const moveIn14 = rows.filter(w => w.action === 'MOVE NOW' && w.daysOut <= 14)
  const anyMoveNow = rows.some(w => w.action === 'MOVE NOW')
  const pressureLow = field.level === 'low'
  const pressureHigh = field.level === 'high'
  const sentimentNotRed = sentiment !== 'red'
  const gapsOpen = GAPS_T1.length > 0

  let verdict
  let confidence
  if (moveIn14.length > 0 && pressureLow && sentimentNotRed) {
    verdict = 'DEPLOY'
    confidence =
      60 +
      Math.min(moveIn14.length * 8, 16) +
      15 +
      (sentiment === 'green' ? 10 : 5)
  } else if (!anyMoveNow && pressureHigh) {
    verdict = 'HOLD'
    confidence = 62 + 18 + (sentiment === 'red' ? 8 : 4)
  } else {
    verdict = 'PREPARE'
    confidence =
      50 +
      (anyMoveNow ? 10 : 0) +
      (field.level === 'moderate' ? 10 : 0) +
      (gapsOpen ? 8 : 0)
  }
  confidence = Math.max(0, Math.min(100, Math.round(confidence)))

  const nextMove = rows.find(w => w.action === 'MOVE NOW')
  const reassess = nextMove
    ? fmtDate(nextMove.event.date)
    : new Date(Date.now() + 7 * 86400000).toLocaleDateString('en-GB', {
        day: '2-digit',
        month: 'short',
      })

  const inputs = [
    {
      label: 'Actionable windows',
      rag: anyMoveNow ? 'green' : 'red',
      detail: anyMoveNow
        ? `${moveIn14.length} MOVE NOW in 14d · ${rows.filter(w => w.action === 'MOVE NOW').length} in 90d`
        : 'No MOVE NOW windows on the horizon',
    },
    {
      label: 'Competitor pressure',
      rag: pressureLow ? 'green' : pressureHigh ? 'red' : 'amber',
      detail: `${field.pressure}/100 (${field.level}) · ${field.top} leading`,
    },
    {
      label: 'Market sentiment',
      rag: sentiment,
      detail:
        sentiment === 'green'
          ? 'Favourable'
          : sentiment === 'red'
          ? 'Adverse — hold'
          : 'Neutral (static — live in P8 feed)',
    },
  ]

  return { verdict, confidence, inputs, reassess, nextMove }
}

export default function SignalPanel() {
  const sig = useMemo(() => computeSignal(), [])
  const v = VERDICT[sig.verdict]

  return (
    <>
      <PanelHeader
        title="Budget Deployment Signal"
        accent="#94c864"
        sub="One read on whether to spend — refreshed every load"
      />

      <Card style={{ padding: '34px 36px', borderColor: v.color + '40' }}>
        {/* Verdict */}
        <div
          style={{
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
            gap: 20,
            flexWrap: 'wrap',
            paddingBottom: 26,
            borderBottom: '1px solid rgba(255,255,255,0.06)',
          }}
        >
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
                maxWidth: 460,
              }}
            >
              {v.blurb}
              {sig.verdict === 'PREPARE' && sig.nextMove
                ? ` Window opening: ${fmtDate(sig.nextMove.event.date)} (${sig.nextMove.daysOut}d).`
                : ''}
            </div>
          </div>
          <div style={{ textAlign: 'right', minWidth: 180 }}>
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
        </div>

        {/* Drivers */}
        <div
          style={{
            fontFamily: FONT_MONO,
            fontSize: 11,
            letterSpacing: '0.14em',
            textTransform: 'uppercase',
            color: 'var(--text-muted)',
            margin: '22px 0 14px',
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
              style={{
                flex: '0 0 200px',
                fontFamily: FONT_BODY,
                fontSize: 14,
                color: 'var(--white)',
              }}
            >
              {s.label}
            </span>
            <span style={{ flex: 1, fontFamily: FONT_MONO, fontSize: 12, color: 'var(--text-muted)' }}>
              {s.detail}
            </span>
          </div>
        ))}

        <div
          style={{
            marginTop: 22,
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
