import { useMemo } from 'react'
import { getDayStatus, statusVerdict, fmtClock } from '../utils/horizonData'
import { Card, RagDot, AskIntelButton, FONT_HEAD, FONT_BODY, FONT_MONO } from './horizonUI'

// P2 — Morning Status Board. 90-second daily briefing. Verdict reframed:
// HIGH PRESSURE / ELEVATED WATCH (cyan) · ALL CLEAR (lime). No crisis red.

export default function StatusBoard({ onDismiss, onAskIntel }) {
  const { signals, overall, updatedAt } = useMemo(() => getDayStatus(), [])
  const verdict = statusVerdict(overall)

  const intelContext = () =>
    `You are reviewing the morning status board. Verdict: ${verdict.label}. Signals — ${signals
      .map(s => `${s.label}: ${s.rag.toUpperCase()} (${s.note})`)
      .join('; ')}.`

  return (
    <Card style={{ padding: '22px 28px' }}>
      {/* Headline */}
      <div
        style={{
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          gap: 16,
          flexWrap: 'wrap',
          paddingBottom: 18,
          borderBottom: '1px solid rgba(255,255,255,0.06)',
        }}
      >
        <div style={{ display: 'flex', alignItems: 'center', gap: 14 }}>
          <span
            style={{
              width: 12,
              height: 12,
              borderRadius: '50%',
              background: verdict.color,
              boxShadow: `0 0 8px ${verdict.color}`,
              flexShrink: 0,
            }}
          />
          <div>
            <div
              style={{
                fontFamily: FONT_HEAD,
                fontWeight: 800,
                fontSize: 24,
                letterSpacing: '0.06em',
                color: verdict.color,
              }}
            >
              {verdict.label}
            </div>
            <div
              style={{
                fontFamily: FONT_BODY,
                fontSize: 12,
                color: 'var(--text-muted)',
                marginTop: 2,
              }}
            >
              90-second operational read · five signals
            </div>
          </div>
        </div>
        <div style={{ display: 'flex', alignItems: 'center', gap: 14, flexWrap: 'wrap' }}>
          <span style={{ fontFamily: FONT_MONO, fontSize: 11, color: 'var(--text-muted)' }}>
            Last updated {fmtClock(updatedAt)}
          </span>
          {onAskIntel && <AskIntelButton onClick={() => onAskIntel(intelContext())} />}
          <button
            onClick={onDismiss}
            style={{
              fontFamily: FONT_MONO,
              fontSize: 10,
              letterSpacing: '0.12em',
              textTransform: 'uppercase',
              color: 'var(--text-muted)',
              background: 'transparent',
              border: '1px solid var(--border)',
              borderRadius: 5,
              padding: '7px 12px',
              cursor: 'pointer',
              transition: 'color 0.15s, border-color 0.15s',
            }}
            onMouseEnter={e => {
              e.currentTarget.style.color = '#c8d0dc'
              e.currentTarget.style.borderColor = 'rgba(255,255,255,0.18)'
            }}
            onMouseLeave={e => {
              e.currentTarget.style.color = 'var(--text-muted)'
              e.currentTarget.style.borderColor = 'var(--border)'
            }}
          >
            Dismiss
          </button>
        </div>
      </div>

      {/* Signal rows */}
      <div>
        {signals.map((s, i) => (
          <div
            key={s.label}
            style={{
              display: 'flex',
              alignItems: 'center',
              gap: 14,
              padding: '14px 0',
              borderBottom:
                i < signals.length - 1 ? '1px solid rgba(255,255,255,0.04)' : 'none',
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
            <span
              style={{
                flex: 1,
                fontFamily: FONT_MONO,
                fontSize: 12,
                color: 'var(--text-muted)',
              }}
            >
              {s.note}
            </span>
          </div>
        ))}
      </div>
    </Card>
  )
}
