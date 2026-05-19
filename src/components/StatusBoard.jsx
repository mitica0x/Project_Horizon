import { useMemo } from 'react'
import {
  getDayStatus,
  statusVerdict,
  fmtClock,
  assessCompetitors,
  getWindows,
} from '../utils/horizonData'
import { GAPS_T1 } from '../data/staticData'
import { intelKit } from '../utils/intelKit'
import { Card, RagDot, AskIntelButton, FONT_HEAD, FONT_BODY, FONT_MONO } from './horizonUI'

// P2 — Morning Status Board. 90-second daily briefing. Verdict reframed:
// HIGH PRESSURE / ELEVATED WATCH (cyan) · ALL CLEAR (lime). No crisis red.

const VERDICT_KEY = 'horizon_status_verdict'
const DAY = 86400000

export default function StatusBoard({ onDismiss, onAskIntel, onNav }) {
  const { signals, overall, updatedAt } = useMemo(() => getDayStatus(), [])
  const verdict = statusVerdict(overall)

  // ── Intelligence layer (S6) — drivers / actions / since-yesterday, derived
  // from the live field + windows + gap list, with seeded fallbacks that keep
  // the same shape so the board always reads as live for the demo.
  const intel = useMemo(() => {
    const field = assessCompetitors()
    const { rows, moveNowCount } = getWindows(90)
    const moveIn14 = rows.filter(w => w.action === 'MOVE NOW' && w.daysOut <= 14).length
    const t1 = GAPS_T1 || []
    const g1 = t1[0]
    const g2 = t1[1]
    const dom = g => (g ? `${g.domain}` : '—')

    const why = [
      'WhiteBit — FC Barcelona sponsorship confirmed. T1 brand event in your primary markets.',
      `Threat score: ${field.pressure}/100 — field pressure ${field.level}, ${field.top} leading.`,
      `${t1.length} T1 gaps uncontacted (incl. ${dom(g1)}, ${dom(g2)}).`,
    ]

    const actions = [
      {
        text: `Contact ${dom(g1)}${g1?.url?.slice(g1.domain.length) || ''} — T1 ${
          g1?.country || 'Global'
        }, ${(g1?.competitors || ['competitor'])[0]} listed`,
        nav: 'network',
      },
      {
        text: 'Review investopedia.com outreach — sent, no response logged',
        nav: 'outcomes',
      },
      {
        text: `Check SIGNAL — ${moveIn14 ? 'MOVE-rated window opening in 14d' : 'posture window may be forming'}`,
        nav: 'signal',
      },
    ]

    const since = [
      'WhiteBit Barcelona deal announced — field threat level elevated',
      'Activation rate: 1 this week (finder.com win logged)',
      moveNowCount
        ? `${moveNowCount} MOVE-rated window(s) on the 90-day horizon`
        : 'No new competitor placements detected on tracked pages',
    ]

    return { why, actions, since }
  }, [])

  // Executive summary — exactly 3 live points from the same sources the board
  // already uses (GAPS_T1, assessCompetitors, getWindows). No static fallback:
  // a point with no data is omitted; if none resolve the bar renders nothing.
  const execSummary = useMemo(() => {
    const clamp12 = s => {
      const w = String(s).trim().split(/\s+/).filter(Boolean)
      return w.length <= 12 ? w.join(' ') : w.slice(0, 12).join(' ') + '…'
    }
    const points = []

    const g = (GAPS_T1 || [])[0]
    if (g) {
      const rivals = (g.competitors || []).slice(0, 2).join(', ')
      points.push({
        label: 'GAP',
        text: clamp12(
          `${g.domain} (${g.country}) — ${rivals ? rivals + ' listed, ' : ''}Bybit absent`,
        ),
      })
    }

    const field = assessCompetitors()
    if (field?.top && field.top !== '—') {
      points.push({
        label: 'THREAT',
        text: clamp12(
          `${field.top} leads field — pressure ${field.pressure}/100 (${field.level})`,
        ),
      })
    }

    const win = getWindows(90).rows.find(w => w.action === 'MOVE NOW')
    if (win) {
      points.push({
        label: 'WINDOW',
        text: clamp12(`${win.event.name} — MOVE NOW in ${win.daysOut}d`),
      })
    }

    return points
  }, [])

  // How long the day verdict has held (seeded 3d baseline on first sight).
  const verdictDays = useMemo(() => {
    const now = Date.now()
    let rec = null
    try { rec = JSON.parse(localStorage.getItem(VERDICT_KEY) || 'null') } catch { rec = null }
    if (!rec || rec.label !== verdict.label) {
      rec = { label: verdict.label, since: now - 3 * DAY }
      try { localStorage.setItem(VERDICT_KEY, JSON.stringify(rec)) } catch { /* ignore */ }
    }
    return Math.max(0, Math.round((now - rec.since) / DAY))
  }, [verdict.label])

  const intelContext = () =>
    `You are reviewing the morning status board. Verdict: ${verdict.label} (held ${verdictDays}d). Signals — ${signals
      .map(s => `${s.label}: ${s.rag.toUpperCase()} (${s.note})`)
      .join('; ')}.`

  const askIntel = () =>
    onAskIntel(
      intelContext(),
      intelKit.status({ label: verdict.label, days: verdictDays }),
    )

  return (
    <Card style={{ padding: '22px 28px' }}>
      {/* Executive summary bar — live, top of the STATUS view */}
      {execSummary.length > 0 && (
        <div
          style={{
            display: 'flex',
            flexWrap: 'wrap',
            gap: 24,
            background: 'var(--bg-card)',
            border: '1px solid var(--border)',
            borderRadius: 8,
            padding: '12px 18px',
            marginBottom: 18,
          }}
        >
          {execSummary.map(p => (
            <div
              key={p.label}
              style={{
                display: 'flex',
                alignItems: 'baseline',
                gap: 8,
                fontFamily: FONT_MONO,
                fontSize: 12,
                minWidth: 0,
              }}
            >
              <span
                style={{
                  color: 'var(--cyan)',
                  fontWeight: 700,
                  letterSpacing: '0.1em',
                  flexShrink: 0,
                }}
              >
                {p.label}
              </span>
              <span style={{ color: 'var(--text-body)' }}>{p.text}</span>
            </div>
          ))}
        </div>
      )}

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
          {onAskIntel && <AskIntelButton onClick={askIntel} />}
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

      {/* ── S6 intelligence layer ───────────────────────────────────────── */}
      {[
        { label: `WHY TODAY IS ${verdict.label}`, lines: intel.why },
        { label: 'RECOMMENDED ACTIONS TODAY', actions: intel.actions },
        { label: 'SINCE YESTERDAY', lines: intel.since },
      ].map(sec => (
        <div
          key={sec.label}
          style={{
            marginTop: 20,
            paddingTop: 18,
            borderTop: '1px solid rgba(255,255,255,0.06)',
          }}
        >
          <div
            style={{
              fontFamily: FONT_MONO,
              fontSize: 11,
              letterSpacing: '0.14em',
              textTransform: 'uppercase',
              color: 'var(--cyan)',
              marginBottom: 12,
            }}
          >
            {sec.label}
          </div>

          {sec.lines &&
            sec.lines.map((l, i) => (
              <div
                key={i}
                style={{
                  fontFamily: FONT_BODY,
                  fontSize: 13,
                  color: '#c8d0dc',
                  lineHeight: 1.6,
                  padding: '4px 0',
                }}
              >
                {l}
              </div>
            ))}

          {sec.actions &&
            sec.actions.map((a, i) => (
              <button
                key={i}
                onClick={() => onNav?.(a.nav)}
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  gap: 10,
                  width: '100%',
                  textAlign: 'left',
                  background: 'transparent',
                  border: 'none',
                  borderBottom:
                    i < sec.actions.length - 1
                      ? '1px solid rgba(255,255,255,0.04)'
                      : 'none',
                  padding: '10px 0',
                  cursor: 'pointer',
                  fontFamily: FONT_BODY,
                  fontSize: 13,
                  color: '#c8d0dc',
                  transition: 'color 0.15s',
                }}
                onMouseEnter={e => (e.currentTarget.style.color = 'var(--white)')}
                onMouseLeave={e => (e.currentTarget.style.color = '#c8d0dc')}
              >
                <span style={{ color: '#94c864', fontWeight: 700, flexShrink: 0 }}>
                  {i + 1}.
                </span>
                <span style={{ flex: 1 }}>{a.text}</span>
                <span style={{ color: '#94c864', flexShrink: 0 }}>→</span>
              </button>
            ))}
        </div>
      ))}
    </Card>
  )
}
